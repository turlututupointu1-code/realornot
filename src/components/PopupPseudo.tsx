/* src/components/PopupPseudo.tsx */
import React, { useEffect, useState } from 'react';
import * as RouterDom from 'react-router-dom';
import { useUiLang } from '../context/theme';
import { chargerPseudo } from '../utils/pseudo';
import {
    chargerToken,
    connecterCompte,
    creerCompte,
    effacerCompte,
    recupererQuestionSecrete,
    verifierReponseSecrete,
    reinitialiserMotDePasse,
    sessionValide,
} from '../utils/compte';
import type { Translations } from '../i18n/translations';
import { decouperSalutation, type SalutationParties } from '../utils/salutation';

const salutationAleatoire = (t: Translations): SalutationParties => decouperSalutation(t.salutationsRetour);

const DUREE_SALUTATION_MS = 3000;

type Mode = 'creer' | 'connecter' | 'question' | 'reinitialiser' | 'nouveau-mot-de-passe';

const messageErreur = (err: unknown, secours: string): string =>
    (err instanceof Error && err.message) ? err.message : secours;

interface ChampMotDePasseProps {
    placeholder: string;
    value: string;
    onChange: (valeur: string) => void;
    onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
    afficherLabel: string;
    masquerLabel: string;
    autoFocus?: boolean;
    autoComplete?: string;
    readOnly?: boolean;
}

export const ChampMotDePasse: React.FC<ChampMotDePasseProps> = ({
    placeholder, value, onChange, onKeyDown, afficherLabel, masquerLabel, autoFocus, autoComplete, readOnly,
}) => {
    const [visible, setVisible] = useState(false);
    return (
        <div className="compte-mot-de-passe-wrapper">
            <input
                type={visible ? 'text' : 'password'}
                className="pseudo-popup-input compte-mot-de-passe-input"
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={onKeyDown}
                autoFocus={autoFocus}
                autoComplete={autoComplete}
                readOnly={readOnly}
                autoCorrect="off"
                spellCheck={false}
            />
            <button
                type="button"
                className="compte-mot-de-passe-oeil"
                onClick={() => setVisible((v) => !v)}
                aria-label={visible ? masquerLabel : afficherLabel}
                tabIndex={-1}
            >
                {visible ? '🙈' : '👁'}
            </button>
        </div>
    );
};

interface PopupPseudoProps {
    // Par défaut (mode IA), la connexion réussie ramène à l'accueil. Le mode
    // réel n'a pas d'accueil propre à ce popup : il fournit ce callback pour
    // simplement signaler qu'un compte est prêt et laisser ModeReelGuard
    // continuer vers la page suivante.
    onConnecte?: () => void;
    // Mode de départ (par défaut 'creer') - utilisé par "Personne réelle"
    // pour démarrer directement en 'connecter' quand un compte est déjà
    // connu sur ce téléphone.
    modeInitial?: Mode;
    // Redemande systématiquement pseudo + mot de passe même si un jeton est
    // déjà stocké (pas de salutation "content de te revoir", pas de
    // pré-remplissage du pseudo) - utilisé par "Personne réelle" pour
    // qu'un téléphone prêté/laissé ouvert ne donne pas accès direct au
    // compte de son propriétaire juste en appuyant sur un bouton.
    forcerReconnexion?: boolean;
}

const PopupPseudo: React.FC<PopupPseudoProps> = ({ onConnecte, modeInitial, forcerReconnexion }) => {
    const t = useUiLang();
    const navigate = RouterDom.useNavigate();
    const [token, setToken] = useState<string | null>(() => chargerToken());
    const [pseudoActuel, setPseudoActuel] = useState<string | null>(() => chargerPseudo());
    const [salutationVisible, setSalutationVisible] = useState(() => !forcerReconnexion && chargerToken() !== null);
    const [salutationParties] = useState<SalutationParties | null>(() => (
        !forcerReconnexion && chargerToken() !== null ? salutationAleatoire(t) : null
    ));

    const [mode, setMode] = useState<Mode>(modeInitial ?? 'creer');
    const [pseudoSaisie, setPseudoSaisie] = useState(() => (forcerReconnexion ? '' : chargerPseudo() ?? ''));
    const [motDePasseSaisie, setMotDePasseSaisie] = useState('');
    const [confirmerSaisie, setConfirmerSaisie] = useState('');
    const [questionSaisie, setQuestionSaisie] = useState('');
    const [reponseSaisie, setReponseSaisie] = useState('');
    const [pseudoOublie, setPseudoOublie] = useState('');
    const [questionReinitSaisie, setQuestionReinitSaisie] = useState('');
    const [reponseReinitSaisie, setReponseReinitSaisie] = useState('');
    const [erreur, setErreur] = useState<string | null>(null);
    const [chargement, setChargement] = useState(false);

    useEffect(() => {
        if (!salutationVisible) return;
        const timer = window.setTimeout(() => setSalutationVisible(false), DUREE_SALUTATION_MS);
        return () => window.clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Vérifie que le compte gardé en mémoire sur ce téléphone existe toujours
    // côté serveur (peut avoir été supprimé depuis l'interface admin) : sans
    // ça, l'app resterait "connectée" indéfiniment sur un compte disparu.
    // Inutile si forcerReconnexion est actif : le formulaire de connexion
    // s'affiche de toute façon sans tenir compte de `token`/`salutationVisible`
    // dans ce mode (voir ModeReelGuard, seul appelant à passer cette prop).
    useEffect(() => {
        if (token === null || forcerReconnexion) return;
        sessionValide().then((valide) => {
            if (!valide) {
                effacerCompte();
                setToken(null);
                setSalutationVisible(false);
            }
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const changerMode = (nouveauMode: Mode) => {
        setMode(nouveauMode);
        setErreur(null);
    };

    const surEntree = (fn: () => void) => (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') fn();
    };

    const surConnexionReussie = (data: { pseudo: string; token: string }) => {
        setPseudoActuel(data.pseudo);
        setToken(data.token);
        if (onConnecte) {
            onConnecte();
        } else {
            navigate('/');
        }
    };

    const handleCreerCompte = async () => {
        const pseudo = pseudoSaisie.trim();
        if (!pseudo || motDePasseSaisie.length < 6 || motDePasseSaisie !== confirmerSaisie
            || !questionSaisie.trim() || !reponseSaisie.trim()) return;
        setChargement(true);
        setErreur(null);
        try {
            const data = await creerCompte(pseudo, motDePasseSaisie, questionSaisie.trim(), reponseSaisie.trim());
            // Distingue un compte tout juste créé d'une connexion à un
            // compte existant (voir RencontrePage) : seul le premier doit
            // voir le questionnaire plutôt que le message de bienvenue,
            // même si aucune réponse n'est encore enregistrée pour lui.
            sessionStorage.setItem('realornot-compte-fraichement-cree', 'true');
            surConnexionReussie(data);
        } catch (err) {
            setErreur(messageErreur(err, t.compteErreurGenerique));
        } finally {
            setChargement(false);
        }
    };

    const handleConnecter = async () => {
        const pseudo = pseudoSaisie.trim();
        if (!pseudo || !motDePasseSaisie) return;
        setChargement(true);
        setErreur(null);
        try {
            const data = await connecterCompte(pseudo, motDePasseSaisie);
            surConnexionReussie(data);
        } catch (err) {
            setErreur(messageErreur(err, t.compteErreurGenerique));
        } finally {
            setChargement(false);
        }
    };

    const handleDemanderQuestion = async () => {
        const pseudo = pseudoOublie.trim();
        if (!pseudo) return;
        setChargement(true);
        setErreur(null);
        try {
            const question = await recupererQuestionSecrete(pseudo);
            setQuestionReinitSaisie(question);
            setMode('reinitialiser');
        } catch (err) {
            setErreur(messageErreur(err, t.compteErreurGenerique));
        } finally {
            setChargement(false);
        }
    };

    // Vérifie la réponse côté serveur avant d'avancer (voir mode
    // 'nouveau-mot-de-passe') - le mot de passe actuel renvoyé pré-remplit
    // le premier champ de l'écran suivant.
    const handleConfirmerReponse = async () => {
        const pseudo = pseudoOublie.trim();
        if (!pseudo || !reponseReinitSaisie.trim()) return;
        setChargement(true);
        setErreur(null);
        try {
            const motDePasseActuel = await verifierReponseSecrete(pseudo, reponseReinitSaisie.trim());
            setMotDePasseSaisie(motDePasseActuel);
            setConfirmerSaisie('');
            changerMode('nouveau-mot-de-passe');
        } catch (err) {
            setErreur(messageErreur(err, t.compteErreurGenerique));
        } finally {
            setChargement(false);
        }
    };

    const handleReinitialiser = async () => {
        const pseudo = pseudoOublie.trim();
        if (!pseudo || !reponseReinitSaisie.trim() || confirmerSaisie.length < 6) return;
        if (confirmerSaisie === motDePasseSaisie) {
            setErreur(t.nouveauMotDePasseIdentique ?? 'Tu dois modifier ton mot de passe.');
            return;
        }
        setChargement(true);
        setErreur(null);
        try {
            const data = await reinitialiserMotDePasse(pseudo, reponseReinitSaisie.trim(), confirmerSaisie);
            surConnexionReussie(data);
        } catch (err) {
            setErreur(messageErreur(err, t.compteErreurGenerique));
        } finally {
            setChargement(false);
        }
    };

    if (token === null || forcerReconnexion) {
        if (mode === 'creer') {
            return (
                <div className="update-prompt-overlay">
                    <div className="update-prompt-box">
                        <p className="update-prompt-text">{t.pseudoTitre}</p>
                        <div className="pseudo-popup-halo-masque">
                            <input
                                type="text"
                                className="pseudo-popup-input"
                                placeholder={t.pseudoPlaceholder}
                                value={pseudoSaisie}
                                onChange={(e) => setPseudoSaisie(e.target.value)}
                                maxLength={30}
                                autoFocus
                                autoCapitalize="none"
                                autoCorrect="off"
                                spellCheck={false}
                                autoComplete="off"
                            />
                        </div>
                        <div className="pseudo-popup-halo-masque">
                            <ChampMotDePasse
                                placeholder={t.motDePassePlaceholder}
                                value={motDePasseSaisie}
                                onChange={setMotDePasseSaisie}
                                autoComplete="new-password"
                                afficherLabel={t.afficherMotDePasseLabel}
                                masquerLabel={t.masquerMotDePasseLabel}
                            />
                        </div>
                        <div className="pseudo-popup-halo-masque">
                            <ChampMotDePasse
                                placeholder={t.confirmerMotDePassePlaceholder}
                                value={confirmerSaisie}
                                onChange={setConfirmerSaisie}
                                autoComplete="new-password"
                                afficherLabel={t.afficherMotDePasseLabel}
                                masquerLabel={t.masquerMotDePasseLabel}
                            />
                        </div>
                        {confirmerSaisie.length > 0 && motDePasseSaisie !== confirmerSaisie && (
                            <p className="compte-erreur-texte">
                                {t.motsDePasseDifferentsTexte ?? 'Les mots de passe ne correspondent pas.'}
                            </p>
                        )}
                        <div className="compte-question-exemple">{t.questionSecreteExemple}</div>
                        <div className="pseudo-popup-halo-masque">
                            <input
                                type="text"
                                className="pseudo-popup-input"
                                placeholder={t.questionSecretePlaceholder}
                                value={questionSaisie}
                                onChange={(e) => setQuestionSaisie(e.target.value)}
                            />
                        </div>
                        <div className="pseudo-popup-halo-masque">
                            <input
                                type="text"
                                className="pseudo-popup-input"
                                placeholder={t.reponseSecretePlaceholder}
                                value={reponseSaisie}
                                onChange={(e) => setReponseSaisie(e.target.value)}
                                onKeyDown={surEntree(handleCreerCompte)}
                            />
                        </div>
                        {erreur && <p className="compte-erreur-texte">{erreur}</p>}
                        <div className="update-prompt-actions">
                            <button
                                type="button"
                                className="update-prompt-btn update-prompt-btn-primary"
                                onClick={handleCreerCompte}
                                disabled={chargement || !pseudoSaisie.trim() || motDePasseSaisie.length < 6
                                    || motDePasseSaisie !== confirmerSaisie || !questionSaisie.trim() || !reponseSaisie.trim()}
                            >
                                {t.creerCompteBtn}
                            </button>
                        </div>
                        <button type="button" className="compte-lien-secondaire" onClick={() => changerMode('connecter')}>
                            {t.dejaCompteLien}
                        </button>
                    </div>
                </div>
            );
        }

        if (mode === 'connecter') {
            return (
                <div className="update-prompt-overlay">
                    <div className="update-prompt-box">
                        <p className="update-prompt-text">{t.connexionTitre}</p>
                        <div className="pseudo-popup-halo-masque">
                            <input
                                type="text"
                                className="pseudo-popup-input"
                                placeholder={t.pseudoPlaceholder}
                                value={pseudoSaisie}
                                onChange={(e) => setPseudoSaisie(e.target.value)}
                                maxLength={30}
                                autoFocus
                                autoCapitalize="none"
                                autoCorrect="off"
                                spellCheck={false}
                                autoComplete="off"
                            />
                        </div>
                        <div className="pseudo-popup-halo-masque">
                            <ChampMotDePasse
                                placeholder={t.motDePassePlaceholder}
                                value={motDePasseSaisie}
                                onChange={setMotDePasseSaisie}
                                onKeyDown={surEntree(handleConnecter)}
                                afficherLabel={t.afficherMotDePasseLabel}
                                masquerLabel={t.masquerMotDePasseLabel}
                                autoComplete="off"
                            />
                        </div>
                        {erreur && <p className="compte-erreur-texte">{erreur}</p>}
                        <div className="update-prompt-actions">
                            <button
                                type="button"
                                className="update-prompt-btn update-prompt-btn-primary"
                                onClick={handleConnecter}
                                disabled={chargement || !pseudoSaisie.trim() || !motDePasseSaisie}
                            >
                                {t.seConnecterBtn}
                            </button>
                        </div>
                        <button
                            type="button"
                            className="compte-lien-secondaire"
                            onClick={() => { setPseudoOublie(pseudoSaisie); changerMode('question'); }}
                        >
                            {t.motDePasseOublieLien}
                        </button>
                        <button type="button" className="compte-lien-secondaire" onClick={() => changerMode('creer')}>
                            {t.pasDeCompteLien}
                        </button>
                    </div>
                </div>
            );
        }

        if (mode === 'question') {
            return (
                <div className="update-prompt-overlay">
                    <div className="update-prompt-box">
                        <p className="update-prompt-text">{t.motDePasseOublieTitre}</p>
                        <div className="pseudo-popup-halo-masque">
                            <input
                                type="text"
                                className="pseudo-popup-input"
                                placeholder={t.pseudoPlaceholder}
                                value={pseudoOublie}
                                onChange={(e) => setPseudoOublie(e.target.value)}
                                onKeyDown={surEntree(handleDemanderQuestion)}
                                maxLength={30}
                                autoFocus
                                autoCapitalize="none"
                                autoCorrect="off"
                                spellCheck={false}
                                autoComplete="off"
                            />
                        </div>
                        {erreur && <p className="compte-erreur-texte">{erreur}</p>}
                        <div className="update-prompt-actions">
                            <button
                                type="button"
                                className="update-prompt-btn update-prompt-btn-primary"
                                onClick={handleDemanderQuestion}
                                disabled={chargement || !pseudoOublie.trim()}
                            >
                                {t.valider}
                            </button>
                        </div>
                        <button type="button" className="compte-lien-secondaire" onClick={() => changerMode('connecter')}>
                            {t.retour}
                        </button>
                    </div>
                </div>
            );
        }

        if (mode === 'reinitialiser') {
            return (
                <div className="update-prompt-overlay">
                    <div className="update-prompt-box">
                        <p className="update-prompt-text">{t.quelleEstTaQuestionSecrete ?? 'Ta question secrète'}</p>
                        <div className="pseudo-popup-halo-masque">
                            <input
                                type="text"
                                className="pseudo-popup-input"
                                value={questionReinitSaisie}
                                onChange={(e) => setQuestionReinitSaisie(e.target.value)}
                            />
                        </div>
                        <p className="update-prompt-text">{t.reponseSecretePlaceholder}</p>
                        <div className="pseudo-popup-halo-masque">
                            <input
                                type="text"
                                className="pseudo-popup-input"
                                value={reponseReinitSaisie}
                                onChange={(e) => setReponseReinitSaisie(e.target.value)}
                                onKeyDown={surEntree(handleConfirmerReponse)}
                                autoFocus
                            />
                        </div>
                        {erreur && <p className="compte-erreur-texte">{erreur}</p>}
                        <div className="update-prompt-actions">
                            <button
                                type="button"
                                className="update-prompt-btn update-prompt-btn-primary"
                                onClick={handleConfirmerReponse}
                                disabled={chargement || !reponseReinitSaisie.trim()}
                            >
                                {t.confirmerBtn ?? 'Confirmer'}
                            </button>
                        </div>
                        <button type="button" className="compte-lien-secondaire" onClick={() => changerMode('connecter')}>
                            {t.retour}
                        </button>
                    </div>
                </div>
            );
        }

        return (
            <div className="update-prompt-overlay">
                <div className="update-prompt-box">
                    <p className="update-prompt-text">{t.modifierMotDePasseTitre ?? 'Modifier votre mot de passe'}</p>
                    <div className="pseudo-popup-halo-masque">
                        <input
                            type="text"
                            className="pseudo-popup-input"
                            value={motDePasseSaisie}
                            readOnly
                        />
                    </div>
                    <div className="pseudo-popup-halo-masque">
                        <ChampMotDePasse
                            placeholder={t.nouveauMotDePassePlaceholder}
                            value={confirmerSaisie}
                            onChange={setConfirmerSaisie}
                            onKeyDown={surEntree(handleReinitialiser)}
                            autoComplete="new-password"
                            autoFocus
                            afficherLabel={t.afficherMotDePasseLabel}
                            masquerLabel={t.masquerMotDePasseLabel}
                        />
                    </div>
                    {erreur && <p className="compte-erreur-texte">{erreur}</p>}
                    <div className="update-prompt-actions">
                        <button
                            type="button"
                            className="update-prompt-btn update-prompt-btn-primary"
                            onClick={handleReinitialiser}
                            disabled={chargement || confirmerSaisie.length < 6}
                        >
                            {t.reinitialiserBtn}
                        </button>
                    </div>
                    <button type="button" className="compte-lien-secondaire" onClick={() => changerMode('connecter')}>
                        {t.retour}
                    </button>
                </div>
            </div>
        );
    }

    if (!salutationVisible || pseudoActuel === null) return null;

    // Une "apres" réduite à de la ponctuation (ex: ".", " !") ne mérite pas
    // sa propre ligne : elle reste collée au pseudo plutôt que de finir
    // isolée toute seule en bas du message.
    const apres = salutationParties?.apres ?? '';
    const apresSubstantielle = /\p{L}/u.test(apres);

    return (
        <div className="update-prompt-overlay pseudo-salutation-overlay">
            <div className="update-prompt-box">
                <p className="update-prompt-text">
                    {salutationParties?.avant}
                    <br />
                    <strong>{pseudoActuel}</strong>
                    {apresSubstantielle ? <br /> : null}
                    {apres}
                </p>
            </div>
        </div>
    );
};

export default PopupPseudo;
