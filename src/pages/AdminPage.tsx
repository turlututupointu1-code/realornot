/* src/pages/AdminPage.tsx */
import React, { useEffect, useRef, useState } from 'react';
import * as RouterDom from 'react-router-dom';
import {
    obtenirStatistiques, obtenirQuotaTraduction, obtenirToutesLesCreations, forcerVisibilite,
    supprimerCreationAdmin, obtenirComptes, supprimerCompteAdmin, renommerCompteAdmin, changerMotDePasseAdmin,
    definirAdminCompte, obtenirClesApi, modifierClesApi,
    obtenirSignalements, obtenirFeatureFlagsAdmin, modifierFeatureFlag, supprimerFeatureFlag,
    obtenirQuiEstConnecte, obtenirSignalementsRencontre, changerCodeAdmin,
    lancerBuildRelease, obtenirStatutBuild, modifierChangelogRelease, obtenirAvisApplication,
    obtenirAnatomie, modifierAnatomie, obtenirMeubles, modifierMeubles,
    type StatistiquesAdmin, type QuotaTraduction, type CompteAdmin, type Signalement, type FeatureFlags,
    type ConnexionAdmin, type SignalementRencontre, type AvisApplication, type SectionAnatomie,
} from '../utils/admin';
import type { UserCreation } from '../utils/userCreations';
import { obtenirReleases, type Releases, type Plateforme } from '../utils/releases';
import { chargerCompteursVus, enregistrerCompteursVus, type CompteursVus } from '../utils/adminVus';
import { ChampMotDePasse } from '../components/PopupPseudo';
import PageDuBas from '../components/PageDuBas';
import '../styles/admin.scss';

type Onglet = 'stats' | 'quota' | 'personnages' | 'comptes' | 'cles' | 'signalements' | 'flags' | 'versions';

const ONGLETS: { cle: Onglet; label: string }[] = [
    { cle: 'comptes', label: 'Comptes' },
    { cle: 'stats', label: 'Statistiques' },
    { cle: 'quota', label: 'Quota traduction' },
    { cle: 'personnages', label: 'Personnages' },
    { cle: 'cles', label: 'Clés API' },
    { cle: 'signalements', label: 'Signalements' },
    { cle: 'flags', label: 'Feature flags' },
    { cle: 'versions', label: 'Versions' },
];

// Couleur d'alerte du quota de traduction, réutilisée pour les deux
// fournisseurs (Google/DeepL) : gris en dessous de 250 000 traductions,
// orange à partir de 250 000, rouge à partir de 499 999.
const couleurQuota = (utilise: number): 'normal' | 'orange' | 'rouge' => {
    if (utilise >= 499999) return 'rouge';
    if (utilise >= 250000) return 'orange';
    return 'normal';
};

const SectionStatistiques: React.FC<{
    onQuiEstConnecte: () => void;
    onOuvrirQuota: () => void;
    onMessagesRencontre: () => void;
    onChangerCodeAdmin: () => void;
    onAvisApplication: () => void;
    onAnatomie: () => void;
    onMeubles: () => void;
}> = ({ onQuiEstConnecte, onOuvrirQuota, onMessagesRencontre, onChangerCodeAdmin, onAvisApplication, onAnatomie, onMeubles }) => {
    const [stats, setStats] = useState<StatistiquesAdmin | null>(null);
    const [quota, setQuota] = useState<QuotaTraduction | null>(null);
    const [erreur, setErreur] = useState<string | null>(null);

    useEffect(() => {
        obtenirStatistiques().then(setStats).catch((e) => setErreur(e.message));
        obtenirQuotaTraduction().then(setQuota).catch(() => {});
    }, []);

    if (erreur) return <p className="admin-erreur">{erreur}</p>;
    if (!stats) return <p>Chargement...</p>;

    return (
        <div className="admin-stats-grid">
            <div className="admin-stat-box"><span className="admin-stat-nombre">{stats.totalCreations}</span><span>Personnages au total</span></div>
            <div className="admin-stat-box"><span className="admin-stat-nombre">{stats.totalPublic}</span><span>Publics</span></div>
            <div className="admin-stat-box"><span className="admin-stat-nombre">{stats.totalPrive}</span><span>Privés</span></div>
            <div className="admin-stat-box"><span className="admin-stat-nombre">{stats.totalComptes}</span><span>Comptes</span></div>
            {quota && (
                <>
                    <button
                        type="button"
                        className={`admin-stat-box admin-stat-box-bouton admin-quota-alerte-${couleurQuota(quota.googleUtilise)}`}
                        onClick={onOuvrirQuota}
                    >
                        Quota traduction Google
                    </button>
                    <button
                        type="button"
                        className={`admin-stat-box admin-stat-box-bouton admin-quota-alerte-${couleurQuota(quota.deeplUtilise)}`}
                        onClick={onOuvrirQuota}
                    >
                        Quota traduction DeepL
                    </button>
                </>
            )}
            <div className="admin-stat-box"><span className="admin-stat-nombre">{stats.totalSignalements}</span><span>Signalements</span></div>
            <button type="button" className="admin-stat-box admin-stat-box-bouton" onClick={onMessagesRencontre}>
                Messages (Personne réelle)
            </button>
            <button type="button" className="admin-stat-box admin-stat-box-bouton" onClick={onAvisApplication}>
                Avis sur l'application
            </button>
            <button type="button" className="admin-stat-box admin-stat-box-bouton" onClick={onQuiEstConnecte}>
                Qui s'est connecté ?
            </button>
            <button type="button" className="admin-stat-box admin-stat-box-bouton" onClick={onChangerCodeAdmin}>
                Changer le code d'accès admin
            </button>
            <button type="button" className="admin-stat-box admin-stat-box-bouton" onClick={onAnatomie}>
                Anatomie
            </button>
            <button type="button" className="admin-stat-box admin-stat-box-bouton" onClick={onMeubles}>
                Meubles
            </button>
        </div>
    );
};

const SectionQuota: React.FC = () => {
    const [quota, setQuota] = useState<QuotaTraduction | null>(null);
    const [erreur, setErreur] = useState<string | null>(null);

    useEffect(() => {
        obtenirQuotaTraduction().then(setQuota).catch((e) => setErreur(e.message));
    }, []);

    if (erreur) return <p className="admin-erreur">{erreur}</p>;
    if (!quota) return <p>Chargement...</p>;

    const pourcentage = (valeur: number) => Math.min(100, Math.round((valeur / quota.limiteParFournisseur) * 100));

    return (
        <div>
            <p>Période en cours : depuis le {quota.periode} (renouvellement le 22 de chaque mois)</p>
            <div className="admin-quota-fournisseur">
                <div className="admin-quota-label">Google Cloud Translation (priorité) — {quota.googleUtilise.toLocaleString('fr-FR')} / {quota.limiteParFournisseur.toLocaleString('fr-FR')}</div>
                <div className="admin-quota-barre"><div className="admin-quota-remplissage" style={{ width: `${pourcentage(quota.googleUtilise)}%` }} /></div>
            </div>
            <div className="admin-quota-fournisseur">
                <div className="admin-quota-label">DeepL (repli) — {quota.deeplUtilise.toLocaleString('fr-FR')} / {quota.limiteParFournisseur.toLocaleString('fr-FR')}</div>
                <div className="admin-quota-barre"><div className="admin-quota-remplissage admin-quota-remplissage-deepl" style={{ width: `${pourcentage(quota.deeplUtilise)}%` }} /></div>
            </div>
        </div>
    );
};

const ConfirmationSuppression: React.FC<{
    message: string;
    onAnnuler: () => void;
    onConfirmer: () => void;
}> = ({ message, onAnnuler, onConfirmer }) => (
    // Page qui monte du bas (plus de popup) : la croix et « Annuler » ferment la page avec la même descente
    <PageDuBas onFermer={onAnnuler}>
    {(fermer) => (
        <div className="update-prompt-overlay">
        <div className="update-prompt-box profil-recommencer-confirmation">
        <p className="update-prompt-text">{message}</p>
        <div className="update-prompt-actions">
        <button type="button" className="update-prompt-btn update-prompt-btn-secondary" onClick={fermer}>
        Annuler
        </button>
        <button type="button" className="update-prompt-btn update-prompt-btn-primary" onClick={onConfirmer}>
        Supprimer
        </button>
        </div>
        </div>
        </div>
    )}
    </PageDuBas>
);

const SectionPersonnages: React.FC = () => {
    const [creations, setCreations] = useState<UserCreation[]>([]);
    const [erreur, setErreur] = useState<string | null>(null);
    const [chargement, setChargement] = useState(true);
    // Confirmation de suppression (voir consigne_prudence_popups.md) -
    // remplace window.confirm par une fenêtre interne ; la logique qui suit
    // (supprimerCreationAdmin puis rafraichir) reste strictement identique.
    const [aSupprimer, setASupprimer] = useState<UserCreation | null>(null);

    const charger = () => {
        obtenirToutesLesCreations()
            .then((c) => setCreations([...c].sort((a, b) => b.id - a.id)))
            .catch((e) => setErreur(e.message))
            .finally(() => setChargement(false));
    };

    const rafraichir = () => {
        setChargement(true);
        charger();
    };

    useEffect(() => { charger(); }, []);

    const basculerVisibilite = async (creation: UserCreation) => {
        try {
            await forcerVisibilite(creation.id, !(creation.isPublic ?? true));
            rafraichir();
        } catch (e) {
            setErreur(e instanceof Error ? e.message : 'Erreur');
        }
    };

    const supprimer = (creation: UserCreation) => {
        setASupprimer(creation);
    };

    const confirmerSuppression = async () => {
        if (!aSupprimer) return;
        try {
            await supprimerCreationAdmin(aSupprimer.id);
            setASupprimer(null);
            rafraichir();
        } catch (e) {
            setErreur(e instanceof Error ? e.message : 'Erreur');
            setASupprimer(null);
        }
    };

    if (erreur) return <p className="admin-erreur">{erreur}</p>;
    if (chargement) return <p>Chargement...</p>;

    return (
        <div className="admin-liste">
            {creations.map((c) => (
                <div key={c.id} className="admin-ligne">
                    <div className="admin-ligne-info">
                        <strong>{c.title}</strong> — {c.creatorPseudo || '(sans compte)'} — {c.category || '(sans catégorie)'}
                        <span className={`admin-badge${(c.isPublic ?? true) ? ' admin-badge-public' : ' admin-badge-prive'}`}>
                            {(c.isPublic ?? true) ? 'Public' : 'Privé'}
                        </span>
                    </div>
                    <div className="admin-ligne-actions">
                        <button type="button" onClick={() => basculerVisibilite(c)}>
                            {(c.isPublic ?? true) ? 'Rendre privé' : 'Rendre public'}
                        </button>
                        <button type="button" className="admin-btn-danger" onClick={() => supprimer(c)}>Supprimer</button>
                    </div>
                </div>
            ))}
            {creations.length === 0 && <p>Aucun personnage.</p>}

            {aSupprimer && (
                <ConfirmationSuppression
                message={`Supprimer définitivement "${aSupprimer.title}" ?`}
                onAnnuler={() => setASupprimer(null)}
                onConfirmer={confirmerSuppression}
                />
            )}
        </div>
    );
};

const SectionComptes: React.FC = () => {
    const [comptes, setComptes] = useState<CompteAdmin[]>([]);
    const [erreur, setErreur] = useState<string | null>(null);
    const [chargement, setChargement] = useState(true);
    const [pseudoEnEdition, setPseudoEnEdition] = useState<string | null>(null);
    const [brouillonPseudo, setBrouillonPseudo] = useState('');
    const [pseudoEnEditionMdp, setPseudoEnEditionMdp] = useState<string | null>(null);
    const [brouillonMdp, setBrouillonMdp] = useState('');
    // Confirmation de suppression (voir consigne_prudence_popups.md) -
    // remplace window.confirm par une fenêtre interne ; la logique qui suit
    // (supprimerCompteAdmin puis rafraichir) reste strictement identique.
    const [aSupprimer, setASupprimer] = useState<CompteAdmin | null>(null);

    const charger = () => {
        obtenirComptes().then(setComptes).catch((e) => setErreur(e.message)).finally(() => setChargement(false));
    };

    const rafraichir = () => {
        setChargement(true);
        charger();
    };

    useEffect(() => { charger(); }, []);

    const supprimer = (compte: CompteAdmin) => {
        setASupprimer(compte);
    };

    const confirmerSuppression = async () => {
        if (!aSupprimer) return;
        try {
            await supprimerCompteAdmin(aSupprimer.pseudo);
            setASupprimer(null);
            rafraichir();
        } catch (e) {
            setErreur(e instanceof Error ? e.message : 'Erreur');
            setASupprimer(null);
        }
    };

    const commencerEdition = (compte: CompteAdmin) => {
        setPseudoEnEdition(compte.pseudo);
        setBrouillonPseudo(compte.pseudo);
    };

    const validerEdition = async (ancienPseudo: string) => {
        const nouveauPseudo = brouillonPseudo.trim();
        if (!nouveauPseudo || nouveauPseudo === ancienPseudo) {
            setPseudoEnEdition(null);
            return;
        }
        try {
            await renommerCompteAdmin(ancienPseudo, nouveauPseudo);
            setPseudoEnEdition(null);
            rafraichir();
        } catch (e) {
            setErreur(e instanceof Error ? e.message : 'Erreur');
        }
    };

    const commencerEditionMdp = (compte: CompteAdmin) => {
        setPseudoEnEditionMdp(compte.pseudo);
        setBrouillonMdp('');
    };

    const validerEditionMdp = async (pseudo: string) => {
        if (brouillonMdp.length < 6) return;
        try {
            await changerMotDePasseAdmin(pseudo, brouillonMdp);
            setPseudoEnEditionMdp(null);
            setBrouillonMdp('');
            rafraichir();
        } catch (e) {
            setErreur(e instanceof Error ? e.message : 'Erreur');
        }
    };

    const basculerAdmin = async (compte: CompteAdmin) => {
        try {
            await definirAdminCompte(compte.pseudo, !compte.isAdmin);
            rafraichir();
        } catch (e) {
            setErreur(e instanceof Error ? e.message : 'Erreur');
        }
    };

    if (erreur) return <p className="admin-erreur">{erreur}</p>;
    if (chargement) return <p>Chargement...</p>;

    return (
        <div className="admin-liste">
            {comptes.map((c) => (
                <div key={c.pseudo} className="admin-ligne">
                    <div className="admin-ligne-info">
                        {pseudoEnEdition === c.pseudo ? (
                            <input
                                type="text"
                                className="admin-input"
                                value={brouillonPseudo}
                                onChange={(e) => setBrouillonPseudo(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && validerEdition(c.pseudo)}
                                autoFocus
                            />
                        ) : (
                            <strong>{c.pseudo}</strong>
                        )}
                        {' '}— créé le {c.dateCreation} — {c.nombreCreations} personnage(s)
                        {c.isAdmin && <span className="admin-badge admin-badge-admin">Admin</span>}
                        <div className="admin-ligne-mdp">
                            Mot de passe : {c.motDePasse ?? '(inconnu — changez-le pour le voir ici)'}
                        </div>
                        {pseudoEnEditionMdp === c.pseudo && (
                            <input
                                type="text"
                                className="admin-input"
                                placeholder="Nouveau mot de passe (min 6 caractères)"
                                value={brouillonMdp}
                                onChange={(e) => setBrouillonMdp(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && validerEditionMdp(c.pseudo)}
                                autoFocus
                            />
                        )}
                    </div>
                    <div className="admin-ligne-actions">
                        {pseudoEnEdition === c.pseudo ? (
                            <>
                                <button type="button" onClick={() => validerEdition(c.pseudo)}>Enregistrer</button>
                                <button type="button" onClick={() => setPseudoEnEdition(null)}>Annuler</button>
                            </>
                        ) : pseudoEnEditionMdp === c.pseudo ? (
                            <>
                                <button
                                    type="button"
                                    onClick={() => validerEditionMdp(c.pseudo)}
                                    disabled={brouillonMdp.length < 6}
                                >
                                    Enregistrer
                                </button>
                                <button type="button" onClick={() => setPseudoEnEditionMdp(null)}>Annuler</button>
                            </>
                        ) : (
                            <>
                                <button type="button" onClick={() => commencerEdition(c)}>Modifier</button>
                                <button type="button" onClick={() => commencerEditionMdp(c)}>Pass</button>
                                <button type="button" onClick={() => basculerAdmin(c)}>
                                    {c.isAdmin ? 'Retirer admin' : 'Rendre admin'}
                                </button>
                            </>
                        )}
                        <button type="button" className="admin-btn-danger" onClick={() => supprimer(c)}>Supprimer</button>
                    </div>
                </div>
            ))}
            {comptes.length === 0 && <p>Aucun compte.</p>}

            {aSupprimer && (
                <ConfirmationSuppression
                message={`Supprimer le compte "${aSupprimer.pseudo}" ? Ses personnages ne seront pas supprimés.`}
                onAnnuler={() => setASupprimer(null)}
                onConfirmer={confirmerSuppression}
                />
            )}
        </div>
    );
};

const SectionClesApi: React.FC = () => {
    const [cles, setCles] = useState<{ googleTranslateApiKey: string; deeplApiKey: string } | null>(null);
    const [nouvelleGoogle, setNouvelleGoogle] = useState('');
    const [nouvelleDeepl, setNouvelleDeepl] = useState('');
    const [erreur, setErreur] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    useEffect(() => {
        obtenirClesApi().then(setCles).catch((e) => setErreur(e.message));
    }, []);

    const enregistrer = async () => {
        setErreur(null);
        setMessage(null);
        try {
            await modifierClesApi({
                ...(nouvelleGoogle.trim() ? { googleTranslateApiKey: nouvelleGoogle.trim() } : {}),
                ...(nouvelleDeepl.trim() ? { deeplApiKey: nouvelleDeepl.trim() } : {}),
            });
            setNouvelleGoogle('');
            setNouvelleDeepl('');
            setMessage('Clés mises à jour, prises en compte immédiatement.');
            obtenirClesApi().then(setCles);
        } catch (e) {
            setErreur(e instanceof Error ? e.message : 'Erreur');
        }
    };

    if (erreur && !cles) return <p className="admin-erreur">{erreur}</p>;
    if (!cles) return <p>Chargement...</p>;

    return (
        <div className="admin-form">
            <label>
                Google Cloud Translation (actuelle : {cles.googleTranslateApiKey || '(non définie)'})
                <input type="text" placeholder="Nouvelle clé (laisser vide pour ne pas changer)" value={nouvelleGoogle} onChange={(e) => setNouvelleGoogle(e.target.value)} />
            </label>
            <label>
                DeepL (actuelle : {cles.deeplApiKey || '(non définie)'})
                <input type="text" placeholder="Nouvelle clé (laisser vide pour ne pas changer)" value={nouvelleDeepl} onChange={(e) => setNouvelleDeepl(e.target.value)} />
            </label>
            <button type="button" onClick={enregistrer} disabled={!nouvelleGoogle.trim() && !nouvelleDeepl.trim()}>Enregistrer</button>
            {message && <p className="admin-message">{message}</p>}
            {erreur && <p className="admin-erreur">{erreur}</p>}
        </div>
    );
};

const SectionSignalements: React.FC = () => {
    const [signalements, setSignalements] = useState<Signalement[]>([]);
    const [erreur, setErreur] = useState<string | null>(null);
    const [chargement, setChargement] = useState(true);

    useEffect(() => {
        obtenirSignalements()
            .then((s) => setSignalements([...s].sort((a, b) => b.id - a.id)))
            .catch((e) => setErreur(e.message))
            .finally(() => setChargement(false));
    }, []);

    if (erreur) return <p className="admin-erreur">{erreur}</p>;
    if (chargement) return <p>Chargement...</p>;

    return (
        <div className="admin-liste">
            {signalements.map((s) => (
                <div key={s.id} className="admin-ligne admin-ligne-colonne">
                    <div><strong>{s.creationTitle || `Personnage #${s.creationId}`}</strong> — {s.motif} — {s.date}</div>
                    {s.commentaire && <div className="admin-signalement-commentaire">{s.commentaire}</div>}
                </div>
            ))}
            {signalements.length === 0 && <p>Aucun signalement.</p>}
        </div>
    );
};

// Gestion des versions téléchargeables (voir spec_page_telechargement.md) -
// "Compiler" lance un vrai build côté serveur (job asynchrone, même principe
// que la génération d'image - voir lancerBuildRelease/obtenirStatutBuild) et
// affiche son journal en direct comme indicateur de progression ; le
// changelog de chaque version déjà compilée reste modifiable après coup.
const PLATEFORMES_ADMIN: { cle: Plateforme; label: string }[] = [
    { cle: 'android', label: 'Android' },
    { cle: 'windows', label: 'Windows' },
    { cle: 'linux', label: 'Linux (.deb)' },
];

const SectionVersions: React.FC = () => {
    const [releases, setReleases] = useState<Releases | null>(null);
    const [erreur, setErreur] = useState<string | null>(null);
    const [buildEnCours, setBuildEnCours] = useState<Plateforme | null>(null);
    const [buildLog, setBuildLog] = useState<string[]>([]);
    const [buildErreur, setBuildErreur] = useState<string | null>(null);
    const [changelogEdite, setChangelogEdite] = useState<Record<string, string>>({});
    const pollRef = useRef<number | null>(null);

    const charger = () => {
        obtenirReleases().then(setReleases).catch((e) => setErreur(e.message));
    };

    useEffect(() => {
        charger();
        return () => { if (pollRef.current !== null) window.clearInterval(pollRef.current); };
    }, []);

    const handleCompiler = async (plateforme: Plateforme) => {
        if (buildEnCours) return;
        setBuildEnCours(plateforme);
        setBuildLog([]);
        setBuildErreur(null);
        try {
            const { job_id } = await lancerBuildRelease(plateforme);
            pollRef.current = window.setInterval(async () => {
                try {
                    const statut = await obtenirStatutBuild(job_id);
                    setBuildLog(statut.log);
                    if (statut.status === 'done') {
                        if (pollRef.current !== null) window.clearInterval(pollRef.current);
                        setBuildEnCours(null);
                        charger();
                    } else if (statut.status === 'error' || statut.status === 'not_found') {
                        if (pollRef.current !== null) window.clearInterval(pollRef.current);
                        setBuildEnCours(null);
                        setBuildErreur(statut.error || 'Échec de la compilation.');
                    }
                } catch {
                    // Coupure réseau temporaire - on réessaiera au prochain tick.
                }
            }, 3000);
        } catch (err) {
            setBuildEnCours(null);
            setBuildErreur(err instanceof Error ? err.message : 'Erreur.');
        }
    };

    const handleEnregistrerChangelog = async (plateforme: Plateforme, version: string) => {
        const cle = `${plateforme}:${version}`;
        const texte = changelogEdite[cle] ?? '';
        try {
            await modifierChangelogRelease(plateforme, version, texte);
            charger();
        } catch (err) {
            setErreur(err instanceof Error ? err.message : 'Erreur.');
        }
    };

    if (erreur) return <p className="admin-erreur">{erreur}</p>;
    if (!releases) return <p>Chargement...</p>;

    return (
        <div>
            {buildErreur && <p className="admin-erreur">{buildErreur}</p>}
            {PLATEFORMES_ADMIN.map(({ cle, label }) => (
                <div key={cle} className="admin-versions-plateforme">
                    <h3>{label}</h3>
                    <button type="button" onClick={() => handleCompiler(cle)} disabled={buildEnCours !== null}>
                        {buildEnCours === cle ? 'Compilation en cours...' : 'Compiler'}
                    </button>
                    {buildEnCours === cle && (
                        <pre className="admin-versions-log">{buildLog.join('\n')}</pre>
                    )}
                    {releases[cle].length === 0 ? (
                        <p>Aucune version compilée.</p>
                    ) : (
                        <div className="admin-liste">
                            {releases[cle].map((r) => {
                                const cleEdition = `${cle}:${r.version}`;
                                return (
                                    <div key={r.version} className="admin-ligne admin-ligne-colonne">
                                        <div><strong>{r.version}</strong> — {r.date} — {r.filename}</div>
                                        <textarea
                                            className="pseudo-popup-input signaler-commentaire"
                                            rows={2}
                                            placeholder="Notes de mise à jour..."
                                            value={changelogEdite[cleEdition] ?? r.changelog}
                                            onChange={(e) => setChangelogEdite((prev) => ({ ...prev, [cleEdition]: e.target.value }))}
                                        />
                                        <button type="button" onClick={() => handleEnregistrerChangelog(cle, r.version)}>
                                            Enregistrer le changelog
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

const SectionFlags: React.FC = () => {
    const [flags, setFlags] = useState<FeatureFlags>({});
    const [nouveauNom, setNouveauNom] = useState('');
    const [erreur, setErreur] = useState<string | null>(null);
    const [chargement, setChargement] = useState(true);

    const charger = () => {
        obtenirFeatureFlagsAdmin().then(setFlags).catch((e) => setErreur(e.message)).finally(() => setChargement(false));
    };

    useEffect(() => { charger(); }, []);

    const basculer = async (nom: string, actif: boolean) => {
        try {
            setFlags(await modifierFeatureFlag(nom, !actif));
        } catch (e) {
            setErreur(e instanceof Error ? e.message : 'Erreur');
        }
    };

    const supprimer = async (nom: string) => {
        try {
            setFlags(await supprimerFeatureFlag(nom));
        } catch (e) {
            setErreur(e instanceof Error ? e.message : 'Erreur');
        }
    };

    const ajouter = async () => {
        const nom = nouveauNom.trim();
        if (!nom) return;
        try {
            setFlags(await modifierFeatureFlag(nom, true));
            setNouveauNom('');
        } catch (e) {
            setErreur(e instanceof Error ? e.message : 'Erreur');
        }
    };

    if (chargement) return <p>Chargement...</p>;

    return (
        <div>
            <div className="admin-liste">
                {Object.entries(flags).map(([nom, actif]) => (
                    <div key={nom} className="admin-ligne">
                        <div className="admin-ligne-info">
                            <strong>{nom}</strong>
                            <span className={`admin-badge${actif ? ' admin-badge-public' : ' admin-badge-prive'}`}>{actif ? 'Actif' : 'Inactif'}</span>
                        </div>
                        <div className="admin-ligne-actions">
                            <button type="button" onClick={() => basculer(nom, actif)}>{actif ? 'Désactiver' : 'Activer'}</button>
                            <button type="button" className="admin-btn-danger" onClick={() => supprimer(nom)}>Supprimer</button>
                        </div>
                    </div>
                ))}
                {Object.keys(flags).length === 0 && <p>Aucun feature flag pour l'instant.</p>}
            </div>
            <div className="admin-form admin-form-inline">
                <input type="text" placeholder="Nom du nouveau flag" value={nouveauNom} onChange={(e) => setNouveauNom(e.target.value)} />
                <button type="button" onClick={ajouter} disabled={!nouveauNom.trim()}>Ajouter (activé)</button>
            </div>
            {erreur && <p className="admin-erreur">{erreur}</p>}
        </div>
    );
};

// Pour repérer les nouveautés (compte/personnage/signalement) depuis la
// dernière fois qu'on a ouvert l'onglet concerné, peu importe où on se
// trouve dans l'interface admin.
const RAFRAICHISSEMENT_STATS_MS = 10000;

const AdminPage: React.FC = () => {
    const navigate = RouterDom.useNavigate();
    const [estAdmin, setEstAdmin] = useState<boolean | null>(null);
    const [onglet, setOnglet] = useState<Onglet>('stats');
    const [stats, setStats] = useState<StatistiquesAdmin | null>(null);
    const [vus, setVus] = useState<CompteursVus>(chargerCompteursVus);
    const [connexionsAdmin, setConnexionsAdmin] = useState<ConnexionAdmin[] | null>(null);
    const [messagesRencontre, setMessagesRencontre] = useState<SignalementRencontre[] | null>(null);
    const [avisApplication, setAvisApplication] = useState<AvisApplication[] | null>(null);
    // Changer le code d'accès admin (voir spec_code_admin.md) - source
    // unique de vérité désormais hashée côté serveur (voir admin_code.json),
    // plus aucune valeur codée en dur ni ici ni dans TopBar.tsx.
    const [changerCodeOuvert, setChangerCodeOuvert] = useState(false);
    const [ancienCodeAdmin, setAncienCodeAdmin] = useState('');
    const [nouveauCodeAdmin, setNouveauCodeAdmin] = useState('');
    const [confirmerCodeAdmin, setConfirmerCodeAdmin] = useState('');
    const [codeAdminEnvoiEnCours, setCodeAdminEnvoiEnCours] = useState(false);
    const [codeAdminSucces, setCodeAdminSucces] = useState(false);
    const [codeAdminErreur, setCodeAdminErreur] = useState<string | null>(null);
    // Édition des textes anatomiques injectés dans le chat IA (voir bouton
    // "Anatomie" ci-dessus et utils/admin.ts) - même principe de fenêtre
    // plein écran que "Qui s'est connecté ?"/"Messages" ci-dessus, mais avec
    // un grand textarea par sujet (base + tête/tronc/génital, chacun
    // enregistré indépendamment - même principe que le changelog par
    // version dans SectionVersions) plutôt qu'une liste en lecture seule.
    const SECTIONS_ANATOMIE: { cle: SectionAnatomie; label: string }[] = [
        { cle: 'base', label: 'Socle (toujours inclus si un sujet ci-dessous est déclenché)' },
        { cle: 'tete', label: 'Tête, visage, cou' },
        { cle: 'tronc', label: 'Tronc, bras, jambes' },
        { cle: 'genital', label: 'Génital, zones sensibles' },
    ];
    const [anatomieOuvert, setAnatomieOuvert] = useState(false);
    const [anatomieTextes, setAnatomieTextes] = useState<Record<SectionAnatomie, string>>({
        base: '', tete: '', tronc: '', genital: '',
    });
    const [anatomieChargement, setAnatomieChargement] = useState(false);
    const [anatomieEnregistrement, setAnatomieEnregistrement] = useState<SectionAnatomie | null>(null);
    const [anatomieMessage, setAnatomieMessage] = useState<string | null>(null);
    const [anatomieErreur, setAnatomieErreur] = useState<string | null>(null);
    // Édition de la liste de meubles par pièce (voir bouton "Meubles"
    // ci-dessus) - un seul texte cette fois (pas de découpage en plusieurs
    // fichiers : voir decouper_meubles_par_piece côté serveur).
    const [meublesOuvert, setMeublesOuvert] = useState(false);
    const [meublesTexte, setMeublesTexte] = useState('');
    const [meublesChargement, setMeublesChargement] = useState(false);
    const [meublesEnregistrement, setMeublesEnregistrement] = useState(false);
    const [meublesMessage, setMeublesMessage] = useState<string | null>(null);
    const [meublesErreur, setMeublesErreur] = useState<string | null>(null);

    const fermerChangerCode = () => {
        setChangerCodeOuvert(false);
        setAncienCodeAdmin('');
        setNouveauCodeAdmin('');
        setConfirmerCodeAdmin('');
        setCodeAdminSucces(false);
        setCodeAdminErreur(null);
    };

    const envoyerChangementCodeAdmin = async () => {
        if (codeAdminEnvoiEnCours) return;
        if (!ancienCodeAdmin || nouveauCodeAdmin.length < 6 || nouveauCodeAdmin !== confirmerCodeAdmin) return;
        setCodeAdminEnvoiEnCours(true);
        setCodeAdminErreur(null);
        try {
            await changerCodeAdmin(ancienCodeAdmin, nouveauCodeAdmin);
            // Cet appareil doit continuer à avoir accès admin avec le
            // nouveau code sans repasser par la barre de recherche (voir
            // enTeteAuth dans utils/admin.ts, qui relit cette clé à chaque
            // requête admin).
            localStorage.setItem('realornot-admin-code', nouveauCodeAdmin.trim().toLowerCase());
            setCodeAdminSucces(true);
        } catch (err) {
            setCodeAdminErreur(err instanceof Error ? err.message : 'Erreur.');
        } finally {
            setCodeAdminEnvoiEnCours(false);
        }
    };

    const handleQuiEstConnecte = () => {
        setConnexionsAdmin([]);
        obtenirQuiEstConnecte().then(setConnexionsAdmin).catch(() => setConnexionsAdmin([]));
    };

    const handleMessagesRencontre = () => {
        setMessagesRencontre([]);
        obtenirSignalementsRencontre()
            .then((m) => setMessagesRencontre([...m].sort((a, b) => b.date.localeCompare(a.date))))
            .catch(() => setMessagesRencontre([]));
    };

    const handleAvisApplication = () => {
        setAvisApplication([]);
        obtenirAvisApplication()
            .then((a) => setAvisApplication([...a].sort((x, y) => y.date.localeCompare(x.date))))
            .catch(() => setAvisApplication([]));
    };

    const handleOuvrirAnatomie = () => {
        setAnatomieOuvert(true);
        setAnatomieChargement(true);
        setAnatomieMessage(null);
        setAnatomieErreur(null);
        obtenirAnatomie()
            .then(setAnatomieTextes)
            .catch((e) => setAnatomieErreur(e instanceof Error ? e.message : 'Erreur.'))
            .finally(() => setAnatomieChargement(false));
    };

    const fermerAnatomie = () => {
        setAnatomieOuvert(false);
        setAnatomieMessage(null);
        setAnatomieErreur(null);
    };

    const enregistrerAnatomie = async (section: SectionAnatomie) => {
        if (anatomieEnregistrement || !anatomieTextes[section].trim()) return;
        setAnatomieEnregistrement(section);
        setAnatomieMessage(null);
        setAnatomieErreur(null);
        try {
            await modifierAnatomie(section, anatomieTextes[section]);
            setAnatomieMessage('Enregistré, pris en compte immédiatement.');
        } catch (e) {
            setAnatomieErreur(e instanceof Error ? e.message : 'Erreur.');
        } finally {
            setAnatomieEnregistrement(null);
        }
    };

    const handleOuvrirMeubles = () => {
        setMeublesOuvert(true);
        setMeublesChargement(true);
        setMeublesMessage(null);
        setMeublesErreur(null);
        obtenirMeubles()
            .then((r) => setMeublesTexte(r.texte))
            .catch((e) => setMeublesErreur(e instanceof Error ? e.message : 'Erreur.'))
            .finally(() => setMeublesChargement(false));
    };

    const fermerMeubles = () => {
        setMeublesOuvert(false);
        setMeublesMessage(null);
        setMeublesErreur(null);
    };

    const enregistrerMeubles = async () => {
        if (meublesEnregistrement || !meublesTexte.trim()) return;
        setMeublesEnregistrement(true);
        setMeublesMessage(null);
        setMeublesErreur(null);
        try {
            await modifierMeubles(meublesTexte);
            setMeublesMessage('Enregistré, pris en compte immédiatement.');
        } catch (e) {
            setMeublesErreur(e instanceof Error ? e.message : 'Erreur.');
        } finally {
            setMeublesEnregistrement(false);
        }
    };

    useEffect(() => {
        obtenirStatistiques()
            .then(() => setEstAdmin(true))
            .catch(() => setEstAdmin(false));
    }, []);

    useEffect(() => {
        if (estAdmin !== true) return undefined;
        let annule = false;
        const charger = () => {
            obtenirStatistiques().then((s) => { if (!annule) setStats(s); }).catch(() => {});
        };
        charger();
        const intervalId = window.setInterval(charger, RAFRAICHISSEMENT_STATS_MS);
        return () => { annule = true; window.clearInterval(intervalId); };
    }, [estAdmin]);

    const nouveaux = {
        comptes: stats ? Math.max(0, stats.totalComptes - vus.comptes) : 0,
        personnages: stats ? Math.max(0, stats.totalCreations - vus.personnages) : 0,
        signalements: stats ? Math.max(0, stats.totalSignalements - vus.signalements) : 0,
    };

    const badgePourOnglet = (cle: Onglet): number => {
        if (cle === 'comptes') return nouveaux.comptes;
        if (cle === 'personnages') return nouveaux.personnages;
        if (cle === 'signalements') return nouveaux.signalements;
        return 0;
    };

    const ouvrirOnglet = (cle: Onglet) => {
        setOnglet(cle);
        if (!stats) return;
        if (cle !== 'comptes' && cle !== 'personnages' && cle !== 'signalements') return;
        const nouveauxVus: CompteursVus = {
            ...vus,
            ...(cle === 'comptes' ? { comptes: stats.totalComptes } : {}),
            ...(cle === 'personnages' ? { personnages: stats.totalCreations } : {}),
            ...(cle === 'signalements' ? { signalements: stats.totalSignalements } : {}),
        };
        setVus(nouveauxVus);
        enregistrerCompteursVus(nouveauxVus);
    };

    if (estAdmin === null) {
        return <div className="admin-page"><p>Vérification...</p></div>;
    }

    if (estAdmin === false) {
        return (
            <div className="admin-page admin-acces-refuse">
                <p>Accès refusé.</p>
                <button type="button" onClick={() => navigate('/')}>Retour</button>
            </div>
        );
    }

    return (
        <div className="admin-page">
            <div className="admin-header">
                <h1>Administration</h1>
                <div className="admin-header-actions">
                    <button type="button" onClick={() => navigate('/')}>Fermer</button>
                </div>
            </div>
            {connexionsAdmin !== null && (
                <div className="admin-acces-refuse admin-overlay-plein-ecran">
                    <p>Qui s'est connecté en administrateur :</p>
                    {connexionsAdmin.length === 0 ? (
                        <p>Personne pour l'instant.</p>
                    ) : (
                        <ul className="admin-liste-simple">
                            {connexionsAdmin.map((c) => (
                                <li key={c.pseudo} className="admin-liste-item">
                                    <strong>{c.pseudo}</strong> — {c.derniereUtilisation}
                                </li>
                            ))}
                        </ul>
                    )}
                    <button type="button" onClick={() => setConnexionsAdmin(null)}>Fermer</button>
                </div>
            )}
            {messagesRencontre !== null && (
                <div className="admin-acces-refuse admin-overlay-plein-ecran">
                    <p>Messages "Personne réelle" (signalements de profil + contacts) :</p>
                    <p className="admin-pharos-note">
                        Si un signalement concerne des mineurs, des armes ou de la drogue, transmets-le également sur{' '}
                        <a href="https://www.internet-signalement.gouv.fr/PharosS1/" target="_blank" rel="noopener noreferrer">
                            Pharos
                        </a>
                        , le portail officiel du ministère de l'Intérieur.
                    </p>
                    {messagesRencontre.length === 0 ? (
                        <p>Aucun message pour l'instant.</p>
                    ) : (
                        <ul className="admin-liste-simple">
                            {messagesRencontre.map((m) => (
                                <li key={m.id} className="admin-liste-item">
                                    {m.type === 'contact' ? (
                                        <>
                                            <strong>{m.de}</strong> (contact) — {m.date}
                                            <div>{m.message}</div>
                                        </>
                                    ) : (
                                        <>
                                            <strong>{m.de}</strong> a signalé <strong>{m.cible}</strong> — {m.motif} — {m.date}
                                        </>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                    <button type="button" onClick={() => setMessagesRencontre(null)}>Fermer</button>
                </div>
            )}
            {avisApplication !== null && (
                <div className="admin-acces-refuse admin-overlay-plein-ecran">
                    <p>Avis sur l'application (1 à 5 étoiles, un par appareil) :</p>
                    {avisApplication.length === 0 ? (
                        <p>Aucun avis pour l'instant.</p>
                    ) : (
                        <>
                            <p>
                                Moyenne : {(avisApplication.reduce((s, a) => s + a.note, 0) / avisApplication.length).toFixed(1)} / 5
                                {' '}({avisApplication.length} avis)
                            </p>
                            <ul className="admin-liste-simple">
                                {avisApplication.map((a) => (
                                    <li key={a.deviceId} className="admin-liste-item">
                                        {'★'.repeat(a.note)}{'☆'.repeat(5 - a.note)} — {a.date}
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}
                    <button type="button" onClick={() => setAvisApplication(null)}>Fermer</button>
                </div>
            )}
            {changerCodeOuvert && (
                <div className="admin-acces-refuse admin-overlay-plein-ecran">
                    <p>Changer le code d'accès admin :</p>
                    {codeAdminSucces ? (
                        <p className="admin-message">Code d'accès admin changé.</p>
                    ) : (
                        <div style={{ width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <ChampMotDePasse
                                placeholder="Code actuel"
                                value={ancienCodeAdmin}
                                onChange={setAncienCodeAdmin}
                                autoComplete="current-password"
                                afficherLabel="Afficher"
                                masquerLabel="Masquer"
                            />
                            <ChampMotDePasse
                                placeholder="Nouveau code"
                                value={nouveauCodeAdmin}
                                onChange={setNouveauCodeAdmin}
                                autoComplete="new-password"
                                afficherLabel="Afficher"
                                masquerLabel="Masquer"
                            />
                            <ChampMotDePasse
                                placeholder="Confirmer le nouveau code"
                                value={confirmerCodeAdmin}
                                onChange={setConfirmerCodeAdmin}
                                autoComplete="new-password"
                                afficherLabel="Afficher"
                                masquerLabel="Masquer"
                            />
                            {confirmerCodeAdmin.length > 0 && nouveauCodeAdmin !== confirmerCodeAdmin && (
                                <p className="admin-erreur">Les codes ne correspondent pas.</p>
                            )}
                            {codeAdminErreur && <p className="admin-erreur">{codeAdminErreur}</p>}
                        </div>
                    )}
                    <div className="admin-actions-row">
                        {codeAdminSucces ? (
                            <button type="button" onClick={fermerChangerCode}>Fermer</button>
                        ) : (
                            <>
                                <button type="button" onClick={fermerChangerCode} disabled={codeAdminEnvoiEnCours}>Annuler</button>
                                <button
                                    type="button"
                                    onClick={envoyerChangementCodeAdmin}
                                    disabled={
                                        !ancienCodeAdmin
                                        || nouveauCodeAdmin.length < 6
                                        || nouveauCodeAdmin !== confirmerCodeAdmin
                                        || codeAdminEnvoiEnCours
                                    }
                                >
                                    Valider
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}
            {anatomieOuvert && (
                <div className="admin-acces-refuse admin-overlay-plein-ecran">
                    {/* Fixe (pas dans le flux défilant) : avec 4 textareas hauts
                        empilés, le bouton "Fermer" en bas du contenu devenait
                        inatteignable sans faire défiler toute la page. */}
                    <button
                        type="button"
                        onClick={fermerAnatomie}
                        className="admin-fermer-flottant"
                    >
                        Fermer
                    </button>
                    <p>Textes anatomiques donnés à l'IA de chat quand l'utilisateur évoque une partie du corps (un sujet = un fichier, enregistrés indépendamment) :</p>
                    {anatomieChargement ? (
                        <p>Chargement...</p>
                    ) : (
                        <div style={{ width: '100%', maxWidth: 700, display: 'flex', flexDirection: 'column', gap: 24 }}>
                            {SECTIONS_ANATOMIE.map(({ cle, label }) => (
                                <div key={cle} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    <label>{label}</label>
                                    <textarea
                                        className="pseudo-popup-input signaler-commentaire"
                                        style={{ width: '100%', minHeight: cle === 'base' ? '15vh' : '30vh' }}
                                        value={anatomieTextes[cle]}
                                        onChange={(e) => setAnatomieTextes((prev) => ({ ...prev, [cle]: e.target.value }))}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => enregistrerAnatomie(cle)}
                                        disabled={anatomieEnregistrement !== null || !anatomieTextes[cle].trim()}
                                    >
                                        {anatomieEnregistrement === cle ? 'Enregistrement...' : 'Enregistrer cette section'}
                                    </button>
                                </div>
                            ))}
                            {anatomieMessage && <p className="admin-message">{anatomieMessage}</p>}
                            {anatomieErreur && <p className="admin-erreur">{anatomieErreur}</p>}
                        </div>
                    )}
                    <div className="admin-actions-row">
                        <button type="button" onClick={fermerAnatomie}>Fermer</button>
                    </div>
                </div>
            )}
            {meublesOuvert && (
                <div className="admin-acces-refuse admin-overlay-plein-ecran">
                    <button
                        type="button"
                        onClick={fermerMeubles}
                        className="admin-fermer-flottant"
                    >
                        Fermer
                    </button>
                    <p>Meubles courants par pièce, donnés à l'IA de chat quand l'utilisateur évoque une pièce de la maison (titre en majuscules = nom de la pièce, une ligne "- meuble" par élément) :</p>
                    {meublesChargement ? (
                        <p>Chargement...</p>
                    ) : (
                        <div style={{ width: '100%', maxWidth: 700, display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <textarea
                                className="pseudo-popup-input signaler-commentaire"
                                style={{ width: '100%', minHeight: '50vh' }}
                                value={meublesTexte}
                                onChange={(e) => setMeublesTexte(e.target.value)}
                            />
                            {meublesMessage && <p className="admin-message">{meublesMessage}</p>}
                            {meublesErreur && <p className="admin-erreur">{meublesErreur}</p>}
                        </div>
                    )}
                    <div className="admin-actions-row">
                        <button type="button" onClick={fermerMeubles}>Fermer</button>
                        <button
                            type="button"
                            onClick={enregistrerMeubles}
                            disabled={meublesChargement || meublesEnregistrement || !meublesTexte.trim()}
                        >
                            {meublesEnregistrement ? 'Enregistrement...' : 'Enregistrer'}
                        </button>
                    </div>
                </div>
            )}
            <div className="admin-tabs">
                {ONGLETS.map((o) => {
                    const badge = badgePourOnglet(o.cle);
                    return (
                        <button
                            key={o.cle}
                            type="button"
                            className={`admin-tab${onglet === o.cle ? ' admin-tab-active' : ''}`}
                            onClick={() => ouvrirOnglet(o.cle)}
                        >
                            {o.label}
                            {badge > 0 && <span className="admin-tab-badge">{badge}</span>}
                        </button>
                    );
                })}
            </div>
            <div className="admin-content">
                {onglet === 'stats' && (
                    <SectionStatistiques
                        onQuiEstConnecte={handleQuiEstConnecte}
                        onOuvrirQuota={() => ouvrirOnglet('quota')}
                        onMessagesRencontre={handleMessagesRencontre}
                        onChangerCodeAdmin={() => setChangerCodeOuvert(true)}
                        onAvisApplication={handleAvisApplication}
                        onAnatomie={handleOuvrirAnatomie}
                        onMeubles={handleOuvrirMeubles}
                    />
                )}
                {onglet === 'quota' && <SectionQuota />}
                {onglet === 'personnages' && <SectionPersonnages />}
                {onglet === 'comptes' && <SectionComptes />}
                {onglet === 'cles' && <SectionClesApi />}
                {onglet === 'signalements' && <SectionSignalements />}
                {onglet === 'flags' && <SectionFlags />}
                {onglet === 'versions' && <SectionVersions />}
            </div>
        </div>
    );
};

export default AdminPage;
