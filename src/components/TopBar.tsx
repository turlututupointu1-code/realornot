/* src/components/TopBar.tsx */
import React, { useEffect, useRef, useState } from 'react';
import * as RouterDom from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { languageList, languageNames } from '../i18n/translations';
import { useTheme, DOSSIER_PAR_THEME } from '../context/theme';
import type { ThemeName } from '../context/theme';
import { useUiLang, useThemeAssets, ChevronArrow, BanniereTitre } from '../communs';
import PanneauDeroulant from './PanneauDeroulant';
import AppCloser from '../plugins/appCloser';
import { obtenirStatistiques, normaliserCodeAdmin, verifierCodeAdmin } from '../utils/admin';
import { chargerCompteursVus } from '../utils/adminVus';
import { changerMotDePasse, effacerCompte, supprimerCompte } from '../utils/compte';
import { useUnSeulOuvert } from '../utils/useUnSeulOuvert';
import { oublierMotDePasseConfirme } from '../pages/useModeReelAcces';
import { ChampMotDePasse } from './PopupPseudo';
import { chargerProfilVous } from '../utils/vousProfil';
import { chargerPseudo } from '../utils/pseudo';
import {
    obtenirProfilsRencontre, obtenirMonProfilRencontre, obtenirCompteurVuesRencontre, obtenirCompteurMessagesRencontre, contacterAdminRencontre,
} from '../utils/rencontre';

interface TopBarProps {
    searchTerm: string;
    onSearchChange: (value: string) => void;
    // Garde le bouton burger accessible (thème, langue, admin...) tout en
    // masquant la barre de recherche là où elle n'a pas de sens (ex : page
    // "Personne réelle").
    sansRecherche?: boolean;
}

// Clés stables (indépendantes de la langue) alignées avec t.categories par position.
const categoryKeys = ['tous', 'famille', 'amis', 'rencontres', 'people', 'fiction', 'histoire'];

// Tapé dans la barre de recherche, ouvre l'interface admin au lieu de
// lancer une recherche. Connaître ce code suffit pour agir côté serveur
// (voir compte_admin_authentifie), peu importe le compte connecté sur cet
// appareil - c'est voulu, pour pouvoir autoriser un autre téléphone que
// celui de "Philippe 1" simplement en lui donnant le code. Le code lui-même
// n'est plus codé en dur ici (voir spec_code_admin.md) - vérifié auprès du
// serveur (seule source de vérité, hashée) après un court débounce, pour ne
// pas interroger le serveur à chaque lettre tapée pendant une recherche
// normale. Longueur minimale de 6 (voir /admin/changer-code) : en dessous,
// ce n'est de toute façon pas un code valide, inutile d'appeler le serveur.
const DEBOUNCE_CODE_ADMIN_MS = 400;
const LONGUEUR_MIN_CODE_ADMIN = 6;

// N'affiche le bouton admin du menu que si le code secret a été saisi sur
// cet appareil il y a moins d'une heure (simple confort d'affichage - la
// vraie protection reste côté serveur, via ce même code envoyé en en-tête
// X-Admin-Code) ; sinon il disparaît du menu tant qu'on ne repasse pas par
// le code secret dans la barre de recherche.
const RAFRAICHISSEMENT_ADMIN_MS = 10000;
const CLE_DERNIERE_UTILISATION_ADMIN = 'realornot-admin-derniere-utilisation';
const UNE_HEURE_MS = 60 * 60 * 1000;
const enregistrerUtilisationAdmin = () => {
    localStorage.setItem(CLE_DERNIERE_UTILISATION_ADMIN, String(Date.now()));
};

const TopBar: React.FC<TopBarProps> = ({ searchTerm, onSearchChange, sansRecherche }) => {
    const [isOpen, setIsOpen] = useState(false);
    // Un seul sous-menu ouvert à la fois : langue, graphisme ou compatibilité (ouvrir l'un ferme les autres)
    const sousMenu = useUnSeulOuvert<'langue' | 'graphisme' | 'compat'>();
    const langOpen = sousMenu.estOuvert('langue');
    const graphOpen = sousMenu.estOuvert('graphisme');
    const compatOpen = sousMenu.estOuvert('compat');
    // Contacter l'administrateur (voir spec_contact_admin.md) - pour l'instant
    // uniquement côté "Personne réelle" (voir estModeReel plus bas).
    const [contactOuvert, setContactOuvert] = useState(false);
    const [messageContact, setMessageContact] = useState('');
    // Mode IA : pas de compte, donc une adresse e-mail est demandée pour que l'administrateur puisse répondre
    const [emailContact, setEmailContact] = useState('');
    const emailValide = (valeur: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valeur);
    const [contactEnvoiEnCours, setContactEnvoiEnCours] = useState(false);
    const [contactEnvoye, setContactEnvoye] = useState(false);
    const [contactErreur, setContactErreur] = useState<string | null>(null);
    // Changer son mot de passe (voir spec_changer_mot_de_passe.md) - même
    // emplacement "Personne réelle" que ci-dessus, ne touche pas à
    // /connexion (voir changerMotDePasse dans utils/compte.ts).
    const [motDePasseOuvert, setMotDePasseOuvert] = useState(false);
    const [ancienMotDePasse, setAncienMotDePasse] = useState('');
    const [nouveauMotDePasse, setNouveauMotDePasse] = useState('');
    const [confirmerMotDePasse, setConfirmerMotDePasse] = useState('');
    const [motDePasseEnvoiEnCours, setMotDePasseEnvoiEnCours] = useState(false);
    const [motDePasseChangeSucces, setMotDePasseChangeSucces] = useState(false);
    const [motDePasseErreur, setMotDePasseErreur] = useState<string | null>(null);
    // Supprimer mon compte (voir spec_suppression_compte.md) - même
    // emplacement "Personne réelle" que le changement de mot de passe,
    // juste en dessous. Ne fait que marquer le compte "en attente" côté
    // serveur (voir supprimerCompte dans utils/compte.ts) ; le vrai
    // effacement est différé de 30 jours et géré par le serveur seul.
    const [supprimerCompteOuvert, setSupprimerCompteOuvert] = useState(false);
    // Fermeture animée des pages « mot de passe » et « supprimer mon compte » :
    // la page redescend pendant 0,3 s (classe signaler-feuille-sortie, déjà utilisée par « Signaler »), puis elle est retirée.
    const [pageEnSortie, setPageEnSortie] = useState(false);
    // Classe de la page : ajoute signaler-feuille-sortie pendant la descente
    const classePage = pageEnSortie ? 'mode-reel-page signaler-feuille-sortie' : 'mode-reel-page';
    const fermerAvecAnimation = (fermer: () => void) => {
        setPageEnSortie(true);
        window.setTimeout(() => {
            setPageEnSortie(false);
            fermer();
        }, 300);
    };
    const [motDePasseSuppression, setMotDePasseSuppression] = useState('');
    const [suppressionEnvoiEnCours, setSuppressionEnvoiEnCours] = useState(false);
    const [suppressionConfirmee, setSuppressionConfirmee] = useState(false);
    const [suppressionErreur, setSuppressionErreur] = useState<string | null>(null);
    const codeAdminTimeoutRef = useRef<number | null>(null);
    useEffect(() => () => {
        if (codeAdminTimeoutRef.current !== null) window.clearTimeout(codeAdminTimeoutRef.current);
    }, []);

    const t = useUiLang();
    const categories = t.categories;
    // {min}/{max} remplacés dans le texte traduit (même principe que
    // {pseudo} dans salutationsRetour, voir PopupPseudo.tsx).
    const compatibleDe = (min: number, max: number) => (t.compatibleDeTexte ?? 'Compatible de {min} à {max}%')
        .replace('{min}', String(min)).replace('{max}', String(max));
    const { theme, setTheme, lang, setLang } = useTheme();
    const assets = useThemeAssets();
    const navigate = RouterDom.useNavigate();
    const location = RouterDom.useLocation();
    const estModeReel = location.pathname.startsWith('/mode-reel');
    const [maintenant, setMaintenant] = useState(() => Date.now());
    useEffect(() => {
        const id = window.setInterval(() => setMaintenant(Date.now()), 60000);
        return () => window.clearInterval(id);
    }, []);
    const derniereUtilisationAdmin = Number(localStorage.getItem(CLE_DERNIERE_UTILISATION_ADMIN)) || 0;
    const peutVoirBoutonAdmin = derniereUtilisationAdmin > 0
        && (maintenant - derniereUtilisationAdmin) < UNE_HEURE_MS;
    const [nouveautesAdmin, setNouveautesAdmin] = useState(0);

    useEffect(() => {
        if (!peutVoirBoutonAdmin) return undefined;
        let annule = false;
        const verifier = () => {
            const vus = chargerCompteursVus();
            obtenirStatistiques()
                .then((stats) => {
                    if (annule) return;
                    const total = Math.max(0, stats.totalComptes - vus.comptes)
                        + Math.max(0, stats.totalCreations - vus.personnages)
                        + Math.max(0, stats.totalSignalements - vus.signalements);
                    setNouveautesAdmin(total);
                })
                .catch(() => {});
        };
        verifier();
        const intervalId = window.setInterval(verifier, RAFRAICHISSEMENT_ADMIN_MS);
        return () => { annule = true; window.clearInterval(intervalId); };
    }, [peutVoirBoutonAdmin]);

    // Nombre de profils par tranche de compatibilité, affiché à côté de
    // chaque lien "Compatible de X à Y%" du menu (voir RencontreListePage,
    // qui applique le même filtre par tranche).
    const [comptesCompatibilite, setComptesCompatibilite] = useState({ tres: 0, bon: 0, moyen: 0, faible: 0 });
    useEffect(() => {
        if (!estModeReel) return undefined;
        let annule = false;
        const verifier = () => {
            obtenirProfilsRencontre()
                .then((profils) => {
                    if (annule) return;
                    setComptesCompatibilite({
                        tres: profils.filter((p) => p.compatibilite != null && p.compatibilite >= 75).length,
                        bon: profils.filter((p) => p.compatibilite != null && p.compatibilite >= 50 && p.compatibilite < 75).length,
                        moyen: profils.filter((p) => p.compatibilite != null && p.compatibilite >= 25 && p.compatibilite < 50).length,
                        faible: profils.filter((p) => p.compatibilite != null && p.compatibilite < 25).length,
                    });
                })
                .catch(() => {});
        };
        verifier();
        const intervalId = window.setInterval(verifier, RAFRAICHISSEMENT_ADMIN_MS);
        return () => { annule = true; window.clearInterval(intervalId); };
    }, [estModeReel]);

    // Compteur de vues de profil (voir compteurs_visites.md) - même
    // rafraîchissement périodique que les tranches de compatibilité.
    // Mon genre dans le profil de rencontre (position dans la liste : 0 homme, 3 femme trans -> profil-homme.png ; tous les autres -> profil-femme.png). Sert à l'icône du menu « vues de profil ».
    const [monGenreRencontre, setMonGenreRencontre] = useState<number | null>(null);
    useEffect(() => {
        if (!estModeReel) return undefined;
        let annule = false;
        obtenirMonProfilRencontre()
        .then((profil) => { if (!annule) setMonGenreRencontre(profil.reponses?.genre ?? null); })
        .catch(() => {});
        return () => { annule = true; };
    }, [estModeReel]);

    const [compteurVues, setCompteurVues] = useState({ total: 0, nouvelles: 0 });
    useEffect(() => {
        if (!estModeReel) return undefined;
        let annule = false;
        const verifier = () => {
            obtenirCompteurVuesRencontre()
                .then((compteur) => { if (!annule) setCompteurVues(compteur); })
                .catch(() => {});
        };
        verifier();
        const intervalId = window.setInterval(verifier, RAFRAICHISSEMENT_ADMIN_MS);
        return () => { annule = true; window.clearInterval(intervalId); };
    }, [estModeReel]);

    // Compteur de messages non lus (voir compteurs_visites.md) - même
    // rafraîchissement périodique.
    const [messagesNonLus, setMessagesNonLus] = useState(0);
    useEffect(() => {
        if (!estModeReel) return undefined;
        let annule = false;
        const verifier = () => {
            obtenirCompteurMessagesRencontre()
                .then((compteur) => { if (!annule) setMessagesNonLus(compteur.nonLus); })
                .catch(() => {});
        };
        verifier();
        const intervalId = window.setInterval(verifier, RAFRAICHISSEMENT_ADMIN_MS);
        return () => { annule = true; window.clearInterval(intervalId); };
    }, [estModeReel]);

    const languages = languageList.map(l => ({
        code: l.code,
        flag: l.flag,
        native: l.native,
        translated: l.code === lang ? undefined : languageNames[lang]?.[l.code],
    }));

    // Clés stables (indépendantes de la langue) alignées avec t.themes par position.
    const themeKeys = [
        'gothique', 'dentelle', 'cyberpunk', 'frosted', 'gelee', 'glassmorphism',
        'laiton', 'metal', 'metal-futuriste', 'neumorph', 'vaporwave', 'vert-encapsule', 'vinyle'
    ];
    const themes = t.themes;

    // « Créer » reste grisé tant que la page « Moi » n'est pas remplie entièrement (genre, avatar, pseudo, caractère).
    // Relu à chaque affichage de la barre : le menu burger se rouvre après chaque modification de « Moi ».
    const profilMoi = chargerProfilVous();
    const moiComplet = profilMoi.genre !== null
    && profilMoi.avatarChoisi !== null
    && !!(chargerPseudo() ?? '').trim()
    && !!profilMoi.caractere.trim()
    && typeof profilMoi.prevenirNouvelleIA === 'boolean'; // Oui ou Non choisi (null ou absent = pas de réponse)

    const closeAll = () => {
        setIsOpen(false);
        sousMenu.fermer();
    };

    const handleThemeClick = (themeKey: string) => {
        // Générique : marche pour n'importe quel thème du registre central
        // (voir THEMES dans context/theme.ts) sans condition à ajouter à la
        // main - les entrées du menu qui ne sont pas encore de vrais thèmes
        // (gelee, glassmorphism...) sont ignorées tant qu'elles n'y figurent
        // pas.
        if (themeKey in DOSSIER_PAR_THEME) setTheme(themeKey as ThemeName);
        closeAll();
    };

    const handleLangClick = (code: string) => {
        setLang(code);
        closeAll();
    };

    const handleCategoryClick = (categoryKey: string) => {
        navigate(`/mode-ia/categorie/${categoryKey}`);
        closeAll();
    };

    const fermerContact = () => {
        setContactOuvert(false);
        setMessageContact('');
        setEmailContact('');
        setContactEnvoye(false);
        setContactErreur(null);
    };

    const envoyerContact = async () => {
        const texte = messageContact.trim();
        // Mode IA : l'adresse e-mail est obligatoire (en mode réel, l'administrateur répond via le pseudo du compte)
        const email = estModeReel ? '' : emailContact.trim();
        if (!texte || contactEnvoiEnCours || (!estModeReel && !emailValide(email))) return;
        setContactEnvoiEnCours(true);
        setContactErreur(null);
        try {
            await contacterAdminRencontre(texte, email || undefined);
            setContactEnvoye(true);
        } catch (err) {
            setContactErreur(err instanceof Error ? err.message : 'Erreur.');
        } finally {
            setContactEnvoiEnCours(false);
        }
    };

    const fermerMotDePasse = () => {
        setMotDePasseOuvert(false);
        setAncienMotDePasse('');
        setNouveauMotDePasse('');
        setConfirmerMotDePasse('');
        setMotDePasseChangeSucces(false);
        setMotDePasseErreur(null);
    };

    const envoyerChangementMotDePasse = async () => {
        if (motDePasseEnvoiEnCours) return;
        if (!ancienMotDePasse || nouveauMotDePasse.length < 6 || nouveauMotDePasse !== confirmerMotDePasse) return;
        setMotDePasseEnvoiEnCours(true);
        setMotDePasseErreur(null);
        try {
            await changerMotDePasse(ancienMotDePasse, nouveauMotDePasse);
            setMotDePasseChangeSucces(true);
        } catch (err) {
            setMotDePasseErreur(err instanceof Error ? err.message : 'Erreur.');
        } finally {
            setMotDePasseEnvoiEnCours(false);
        }
    };

    const fermerSuppressionCompte = () => {
        setSupprimerCompteOuvert(false);
        setMotDePasseSuppression('');
        setSuppressionConfirmee(false);
        setSuppressionErreur(null);
    };

    const envoyerSuppressionCompte = async () => {
        if (suppressionEnvoiEnCours || !motDePasseSuppression) return;
        setSuppressionEnvoiEnCours(true);
        setSuppressionErreur(null);
        try {
            await supprimerCompte(motDePasseSuppression);
            setSuppressionConfirmee(true);
        } catch (err) {
            setSuppressionErreur(err instanceof Error ? err.message : 'Erreur.');
        } finally {
            setSuppressionEnvoiEnCours(false);
        }
    };

    // Déconnexion complète et rechargement (voir spec_suppression_compte.md,
    // "l'utilisateur est déconnecté et ramené à l'écran de connexion") -
    // window.location.reload() plutôt qu'un simple navigate() : ModeReelGuard
    // garde motDePasseOk en state React, jamais relu depuis sessionStorage
    // une fois monté, donc effacer le marqueur seul ne suffirait pas à le
    // faire réafficher le formulaire de connexion.
    const handleCompteSupprimeValide = () => {
        effacerCompte();
        oublierMotDePasseConfirme();
        window.location.reload();
    };

    // Débounce (voir DEBOUNCE_CODE_ADMIN_MS) : évite d'appeler le serveur à
    // chaque lettre tapée dans la barre de recherche - seulement une fois
    // que la saisie s'est stabilisée. Échec silencieux (catch vide) : dans
    // l'immense majorité des cas, ce que la personne tape est une vraie
    // recherche, pas une tentative de code, donc une erreur 401 ici est
    // normale et ne doit rien afficher.
    const tenterCodeAccesAdmin = (valeur: string) => {
        if (codeAdminTimeoutRef.current !== null) {
            window.clearTimeout(codeAdminTimeoutRef.current);
        }
        const code = normaliserCodeAdmin(valeur);
        if (code.length < LONGUEUR_MIN_CODE_ADMIN) return;
        codeAdminTimeoutRef.current = window.setTimeout(async () => {
            try {
                await verifierCodeAdmin(code);
                onSearchChange('');
                localStorage.setItem('realornot-admin-code', code);
                enregistrerUtilisationAdmin();
                navigate('/admin');
            } catch {
                // Pas le bon code (ou simple recherche) - rien à faire.
            }
        }, DEBOUNCE_CODE_ADMIN_MS);
    };

    const handleFermerApp = () => {
        // Fermeture volontaire (voir spec : "si on quitte l'application... on
        // doit tout recommencer pour aller sur le site") - plus besoin
        // d'effacer explicitement la mémorisation du mot de passe ici : elle
        // vit maintenant dans sessionStorage (voir useModeReelAcces.ts), qui
        // disparaît de lui-même avec la WebView à la fermeture réelle du
        // processus.
        //
        // AppCloser (plugin natif Android, voir android/.../AppCloserPlugin.java)
        // n'a pas d'équivalent Electron enregistré : sur PC, window.close()
        // ferme la fenêtre, ce qui déclenche 'window-all-closed' côté main
        // process (voir electron/src/index.ts) et quitte bien l'appli.
        if (Capacitor.getPlatform() === 'android') {
            AppCloser.exitApp().catch((err) => console.log('Fermeture de l\'app échouée', err));
        } else {
            window.close();
        }
    };

    return (
        <>
                {isOpen && (
                <div className="burger-overlay" onClick={closeAll}>
                    <div className="burger-panel" onClick={(e) => e.stopPropagation()}>
                        <div className="burger-panel-scroll">

                        {/* Langue et Graphisme : même composant PanneauDeroulant (style burger), un seul sous-menu ouvert à la fois */}
                        <PanneauDeroulant burger titre={t.langue} ouvert={langOpen} onBasculer={() => sousMenu.basculer('langue')}>
                        {languages.map((l) => (
                            <div
                            key={l.code}
                            className={`burger-subitem${l.code === lang ? ' burger-subitem-active' : ''}`}
                            onClick={() => handleLangClick(l.code)}
                            >
                            {l.flag} {l.native}{l.translated ? ` (${l.translated})` : ''}
                            </div>
                        ))}
                        </PanneauDeroulant>

                        <PanneauDeroulant burger titre={t.graphisme} ouvert={graphOpen} onBasculer={() => sousMenu.basculer('graphisme')}>
                        {themes.map((th, i) => (
                            <div
                            key={themeKeys[i]}
                            className={`burger-subitem${themeKeys[i] === theme ? ' burger-subitem-active' : ''}`}
                            onClick={() => handleThemeClick(themeKeys[i])}
                            >
                            {th}
                            </div>
                        ))}
                        </PanneauDeroulant>

                        <div
                        className="burger-item"
                        onClick={() => { navigate(estModeReel ? '/mode-ia' : '/mode-reel'); closeAll(); }}
                        >
                        {estModeReel ? 'Passer au mode intelligence artificiel' : 'Passer en mode réel'}                        </div>

                        {!estModeReel && (
                            <>
                                <div className="burger-separator" />

                                <div
                                    className="burger-item burger-item-icon"
                                    onClick={() => { navigate('/moi'); closeAll(); }}
                                >
                                {/* Point rouge clignotant sur « Moi » tant que la page n'est pas complète */}
                                <span className="bouton-icone-fond burger-icone-avec-pastille">
                                <img src={assets.messages} alt="" className="bouton-icone" />
                                {!moiComplet && <span className="burger-point-rouge" />}
                                </span>
                                {t.messages}
                                    <ChevronArrow className="burger-chevron burger-chevron-droite" />
                                    </div>

                                <div
                                className={`burger-item burger-item-icon${moiComplet ? '' : ' burger-item-grise'}`}
                                onClick={() => { if (!moiComplet) return; navigate('/creer'); closeAll(); }}
                                >
                                    <span className="bouton-icone-fond">
                                        <img src={assets.creer} alt="" className="bouton-icone" />
                                    </span>
                                    {t.creer}
                                    <ChevronArrow className="burger-chevron burger-chevron-droite" />
                                    </div>
                                    {/* Indice sous « Créer » tant que « Moi » n'est pas complète : lisible sans cliquer (hors du bloc grisé) */}
                                    {!moiComplet && <div className="burger-indice-moi">{t.remplirMoiDAbord}</div>}

                                <div className="burger-separator" />

                                <div className="burger-item" onClick={() => handleCategoryClick('nouveau')}>{t.nouveau}</div>
                                {categories.map((item, i) => (
                                    <div
                                    key={item}
                                    className="burger-item"
                                    onClick={() => handleCategoryClick(categoryKeys[i])}
                                    >
                                    {item}
                                    </div>
                                ))}                            </>
                        )}

                        {estModeReel && (
                            <>
                            <div className="burger-separator" />

                            <div
                            className="burger-item burger-item-icon"
                            onClick={() => { navigate('/mode-reel', { state: { voirQuestionnaire: true } }); closeAll(); }}
                            >
                            {/* Icône profil-homme.png ou profil-femme.png selon mon genre ; rien tant que le genre est inconnu */}
                            {monGenreRencontre !== null && (
                                <span className="bouton-icone-fond">
                                <img src={[0, 3].includes(monGenreRencontre) ? assets.profilHomme : assets.profilFemme} alt="" className="bouton-icone" />
                                </span>
                            )}
                            {t.rencontreMonProfilMenu ?? 'Mon profil'}
                            </div>
                                <div
                                className="burger-item"
                                onClick={() => { navigate('/mode-reel/vues'); closeAll(); }}
                                >
                                👁 {(t.vuesMenuTexte ?? '{total} vues de profil').replace('{total}', String(compteurVues.total))}
                                {compteurVues.nouvelles > 0 && ` (+${compteurVues.nouvelles})`}
                                </div>
                                <div
                                className="burger-item burger-item-icon"
                                onClick={() => { navigate('/mode-reel/messages'); closeAll(); }}
                                >
                                {/* Icône messages.png du thème ; petite pastille verte s'il y a des messages non lus */}
                                <span className="bouton-icone-fond burger-icone-avec-pastille">
                                <img src={assets.messages} alt="" className="bouton-icone" />
                                {messagesNonLus > 0 && <span className="burger-pastille-verte" />}
                                </span>
                                {t.messagesPageTitre ?? 'Messages'}
                                </div>

                                <div
                                className="burger-item burger-item-icon"
                                onClick={() => { navigate('/mode-reel/photos'); closeAll(); }}
                                >
                                {/* Icône appareilphoto.png du thème */}
                                <span className="bouton-icone-fond">
                                <img src={assets.appareilphoto} alt="" className="bouton-icone" />
                                </span>
                                {t.mesPhotosMenu ?? 'Mes photos'}
                                </div>

                                <div
                                    className="burger-item burger-item-expandable burger-item-icon"
                                    onClick={() => sousMenu.basculer('compat')}
                                >
                                {/* Icône compatibilite.png du thème */}
                                <span className="bouton-icone-fond">
                                <img src={assets.compatibilite} alt="" className="bouton-icone" />
                                </span>
                                {t.compatibiliteLabel ?? 'Compatibilité'} <ChevronArrow sens={compatOpen ? 'haut' : 'bas'} className="burger-chevron" />
                                </div>
                                {compatOpen && (
                                    <div className="burger-submenu">
                                        <div
                                            className="burger-subitem burger-subitem-compat"
                                            onClick={() => { navigate('/rencontre?min=75&max=100'); closeAll(); }}
                                        >
                                            <span>{compatibleDe(75, 100)}</span>
                                            <span className="burger-subitem-compte">{comptesCompatibilite.tres}</span>
                                        </div>

                                        <div
                                            className="burger-subitem burger-subitem-compat"
                                            onClick={() => { navigate('/rencontre?min=50&max=74'); closeAll(); }}
                                        >
                                            <span>{compatibleDe(50, 74)}</span>
                                            <span className="burger-subitem-compte">{comptesCompatibilite.bon}</span>
                                        </div>

                                        <div
                                            className="burger-subitem burger-subitem-compat"
                                            onClick={() => { navigate('/rencontre?min=25&max=49'); closeAll(); }}
                                        >
                                            <span>{compatibleDe(25, 49)}</span>
                                            <span className="burger-subitem-compte">{comptesCompatibilite.moyen}</span>
                                        </div>

                                        <div
                                            className="burger-subitem burger-subitem-compat"
                                            onClick={() => { navigate('/rencontre?min=0&max=24'); closeAll(); }}
                                        >
                                            <span>{compatibleDe(0, 24)}</span>
                                            <span className="burger-subitem-compte">{comptesCompatibilite.faible}</span>
                                        </div>
                                    </div>
                                )}

                                <div className="burger-separator" />

                                <div
                                    className="burger-item burger-item-icon"
                                    onClick={() => { setMotDePasseOuvert(true); closeAll(); }}
                                >
                                {/* Icône cadenas.png du thème */}
                                <span className="bouton-icone-fond">
                                <img src={assets.cadenas} alt="" className="bouton-icone" />
                                </span>
                                {t.changerMotDePasseBtn ?? 'Changer mon mot de passe'}
                                </div>

                                <div
                                className="burger-item burger-item-icon"
                                onClick={() => { setSupprimerCompteOuvert(true); closeAll(); }}
                                >
                                {/* Icône supprimer.png du thème */}
                                <span className="bouton-icone-fond">
                                <img src={assets.supprimer} alt="" className="bouton-icone" />
                                </span>
                                {t.supprimerCompteBtn ?? 'Supprimer mon compte'}
                                </div>
                            </>
                        )}

                        </div>

                        <div className="burger-separator burger-separator-fixed" />

                        <div className="burger-bottom-row">
                            {peutVoirBoutonAdmin && (
                                <button
                                    type="button"
                                    className="burger-admin-btn"
                                    onClick={() => { enregistrerUtilisationAdmin(); closeAll(); navigate('/admin'); }}
                                    aria-label="Administration"
                                >
                                    ⚙
                                    {nouveautesAdmin > 0 && <span className="burger-admin-badge">{nouveautesAdmin}</span>}
                                </button>
                            )}
                            <button type="button" className="burger-close-btn" onClick={handleFermerApp} aria-label={t.fermer}>
                                <img src={assets.fermer} alt="" className="burger-close-btn-img" />
                            </button>
                        </div>

                        {/* Contacter l'administrateur : disponible dans les deux modes (IA et personne réelle) */}
                        <div
                            className="burger-item burger-item-contact-admin"
                            onClick={() => { setContactOuvert(true); closeAll(); }}
                        >
                            {t.contacterAdminBtn ?? "Contacter l'administrateur"}
                        </div>
                    </div>
                </div>
            )}
            {/* La boîte qui regroupe burger + barre de recherche */}
            <div className="top-bar-box">
            <button
            className="burger-icon"
            onClick={() => setIsOpen(!isOpen)}
            aria-label={t.menu}
            >
            <img src={assets.burger} alt={t.menu} className="burger-icon-img" />
            {/* Point rouge qui clignote doucement tant que la page « Moi » n'est pas complète (mode IA seulement) */}
            {!estModeReel && !moiComplet && <span className="burger-point-rouge" />}
            </button>

            {!sansRecherche && (
                <div className="search-bar-wrapper">
                <input
                type="text"
                className="search-bar"
                placeholder={theme === 'cyberpunk' ? 'CYBERNETIC_ARCHIVES' : t.rechercher}
                value={searchTerm}
                onChange={(e) => {
                    const valeur = e.target.value;
                    onSearchChange(valeur);
                    tenterCodeAccesAdmin(valeur);
                }}
                />
                </div>
            )}

            {/* Côté « Personne réelle » : la barre de titre prend l'emplacement de la barre de recherche, à côté du burger (comme côté IA) */}
            {sansRecherche && (
                <div className="search-bar-wrapper">
                <BanniereTitre texte={t.rencontreTitre ?? 'Profil de rencontre'} />
                </div>
            )}
            </div>
            {contactOuvert && (
                // Page plein écran qui monte du bas (plus de popup) ; boutons annuler.png / continuer.png
                <div className={classePage}>
                <div className="update-prompt-overlay">
                    <div className="update-prompt-box profil-recommencer-confirmation">
                        {contactEnvoye ? (
                            <p className="update-prompt-text">{t.contacterAdminEnvoye ?? 'Message envoyé.'}</p>
                        ) : (
                            <>
                                <p className="update-prompt-text">{t.contacterAdminTitre ?? "Contacter l'administrateur"}</p>
                                {/* Mode IA : adresse e-mail pour que l'administrateur puisse répondre */}
                                {!estModeReel && (
                                    <input
                                        type="email"
                                        className="pseudo-popup-input"
                                        placeholder={t.contacterAdminEmailPlaceholder ?? 'Ton adresse e-mail (pour te répondre)'}
                                        value={emailContact}
                                        onChange={(e) => setEmailContact(e.target.value)}
                                        maxLength={200}
                                        spellCheck={false}
                                        autoComplete="email"
                                    />
                                )}
                                <textarea
                                    className="pseudo-popup-input signaler-commentaire"
                                    placeholder={t.contacterAdminPlaceholder ?? 'Ton message...'}
                                    value={messageContact}
                                    onChange={(e) => setMessageContact(e.target.value)}
                                    rows={4}
                                    maxLength={2000}
                                />
                                {contactErreur && <p className="compte-erreur-texte">{contactErreur}</p>}
                            </>
                        )}
                        <div className="update-prompt-actions">
                            {contactEnvoye ? (
                                <button type="button" className="update-prompt-btn update-prompt-btn-primary" onClick={() => fermerAvecAnimation(fermerContact)}>
                                    {t.valider}
                                </button>
                            ) : (
                                <>
                                    <button
                                        type="button"
                                        className="update-prompt-btn update-prompt-btn-secondary"
                                        onClick={() => fermerAvecAnimation(fermerContact)}
                                        disabled={contactEnvoiEnCours}
                                    >
                                        {t.annuler}
                                    </button>
                                    <button
                                        type="button"
                                        className="update-prompt-btn update-prompt-btn-primary"
                                        onClick={envoyerContact}
                                        disabled={!messageContact.trim() || (!estModeReel && !emailValide(emailContact.trim())) || contactEnvoiEnCours}
                                    >
                                        {t.envoyer}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
                </div>
            )}

            {motDePasseOuvert && (
                // Page plein écran qui monte du bas (plus de popup) ; mêmes styles que la page « mode réel »
                <div className={classePage}>
                <div className="update-prompt-overlay">
                <div className="update-prompt-box profil-recommencer-confirmation">
                {motDePasseChangeSucces ? (
                            <p className="update-prompt-text">{t.motDePasseChangeConfirme ?? 'Mot de passe changé.'}</p>
                        ) : (
                            <>
                                <p className="update-prompt-text">{t.changerMotDePasseTitre ?? 'Changer mon mot de passe'}</p>
                                <div className="pseudo-popup-halo-masque">
                                    <ChampMotDePasse
                                        placeholder={t.ancienMotDePassePlaceholder ?? 'Mot de passe actuel'}
                                        value={ancienMotDePasse}
                                        onChange={setAncienMotDePasse}
                                        autoComplete="current-password"
                                        afficherLabel={t.afficherMotDePasseLabel}
                                        masquerLabel={t.masquerMotDePasseLabel}
                                    />
                                </div>
                                <div className="pseudo-popup-halo-masque">
                                    <ChampMotDePasse
                                        placeholder={t.nouveauMotDePassePlaceholder}
                                        value={nouveauMotDePasse}
                                        onChange={setNouveauMotDePasse}
                                        autoComplete="new-password"
                                        afficherLabel={t.afficherMotDePasseLabel}
                                        masquerLabel={t.masquerMotDePasseLabel}
                                    />
                                </div>
                                <div className="pseudo-popup-halo-masque">
                                    <ChampMotDePasse
                                        placeholder={t.confirmerMotDePassePlaceholder}
                                        value={confirmerMotDePasse}
                                        onChange={setConfirmerMotDePasse}
                                        autoComplete="new-password"
                                        afficherLabel={t.afficherMotDePasseLabel}
                                        masquerLabel={t.masquerMotDePasseLabel}
                                    />
                                </div>
                                {confirmerMotDePasse.length > 0 && nouveauMotDePasse !== confirmerMotDePasse && (
                                    <p className="compte-erreur-texte">
                                        {t.motsDePasseDifferentsTexte ?? 'Les mots de passe ne correspondent pas.'}
                                    </p>
                                )}
                                {motDePasseErreur && <p className="compte-erreur-texte">{motDePasseErreur}</p>}
                            </>
                        )}
                        <div className="update-prompt-actions">
                        {motDePasseChangeSucces ? (
                            <button type="button" className="update-prompt-btn update-prompt-btn-primary" onClick={() => fermerAvecAnimation(fermerMotDePasse)}>
                            {t.valider}
                            </button>
                        ) : (
                            <>
                            <button
                            type="button"
                            className="update-prompt-btn update-prompt-btn-secondary"
                            onClick={() => fermerAvecAnimation(fermerMotDePasse)}
                            disabled={motDePasseEnvoiEnCours}
                            >
                            {t.annuler}
                            </button>
                            <button
                            type="button"
                            className="update-prompt-btn update-prompt-btn-primary"
                            onClick={envoyerChangementMotDePasse}
                                        disabled={
                                            !ancienMotDePasse
                                            || nouveauMotDePasse.length < 6
                                            || nouveauMotDePasse !== confirmerMotDePasse
                                            || motDePasseEnvoiEnCours
                                        }
                                    >
                                    {t.continuer}
                                    </button>
                                    </>
                        )}
                        </div>
                        </div>
                        </div>
                        </div>
            )}

            {supprimerCompteOuvert && (
                // Page plein écran qui monte du bas (plus de popup) ; boutons annuler.png / continuer.png
                <div className={classePage}>
                <div className="update-prompt-overlay">
                <div className="update-prompt-box profil-recommencer-confirmation">
                {suppressionConfirmee ? (
                            <p className="update-prompt-text">
                                {t.supprimerCompteDemandeConfirmee ?? 'Compte supprimé. Tu as 30 jours pour changer d\'avis en te reconnectant.'}
                            </p>
                        ) : (
                            <>
                                <p className="update-prompt-text">{t.supprimerCompteTitre ?? 'Supprimer mon compte'}</p>
                                <p className="update-prompt-text">
                                    {t.supprimerCompteTexte ?? 'Cette action est irréversible : ton profil, tes photos et tes messages seront définitivement effacés après un délai de 30 jours. Saisis ton mot de passe pour confirmer.'}
                                </p>
                                <div className="pseudo-popup-halo-masque">
                                    <ChampMotDePasse
                                        placeholder={t.motDePassePlaceholder}
                                        value={motDePasseSuppression}
                                        onChange={setMotDePasseSuppression}
                                        autoComplete="current-password"
                                        afficherLabel={t.afficherMotDePasseLabel}
                                        masquerLabel={t.masquerMotDePasseLabel}
                                    />
                                </div>
                                {suppressionErreur && <p className="compte-erreur-texte">{suppressionErreur}</p>}
                            </>
                        )}
                        {suppressionConfirmee ? (
                            <div className="update-prompt-actions">
                                <button type="button" className="update-prompt-btn update-prompt-btn-primary" onClick={handleCompteSupprimeValide}>
                                    {t.valider}
                                </button>
                            </div>
                        ) : (
                            <div className="update-prompt-actions">
                            <button type="button" className="update-prompt-btn update-prompt-btn-secondary" onClick={() => fermerAvecAnimation(fermerSuppressionCompte)} disabled={suppressionEnvoiEnCours}>
                            {t.annuler}
                            </button>
                            <button
                            type="button"
                            className="update-prompt-btn update-prompt-btn-primary"
                            onClick={envoyerSuppressionCompte}
                            disabled={!motDePasseSuppression || suppressionEnvoiEnCours}
                            >
                            {t.continuer}
                            </button>
                            </div>
                        )}
                        </div>
                        </div>
                        </div>
            )}
            </>
    );
};

export default TopBar;
