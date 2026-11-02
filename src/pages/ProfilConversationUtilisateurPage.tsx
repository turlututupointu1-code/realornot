/* src/pages/ProfilConversationUtilisateurPage.tsx */
import React, { useEffect, useState } from 'react';
import * as RouterDom from 'react-router-dom';
import { useUiLang, useThemeAssets, BanniereTitre } from '../communs';
import NavArrow from '../components/NavArrow';
import { useAvatarUtilisateur } from '../utils/useAvatarUtilisateur';
import {
    type ProfilConversation,
    chargerProfilConversation,
    enregistrerProfilConversation,
} from '../utils/profilConversation';
import { envoyerSignalement } from '../utils/signalements';

interface LocationState {
    creation?: {
        id: number;
        title: string;
        imageUrl: string;
    };
}

// Symboles de genre, alignés par position avec t.genres (mêmes couleurs que
// sur la page Moi / Détails du personnage).
const GENRE_SYMBOLS = ['♀', '♂', '⚧', '⚥', '⚪'];

// Non-binaire : petit drapeau (jaune, blanc, violet, noir) plutôt qu'un
// symbole, à la place du rond de GENRE_SYMBOLS[4].
const IconGenreNonBinaire: React.FC = () => (
    <svg viewBox="0 0 24 16" className="details-genre-flag">
        <rect width="24" height="4" y="0" fill="#FCF434" />
        <rect width="24" height="4" y="4" fill="#FFFFFF" />
        <rect width="24" height="4" y="8" fill="#9C59D1" />
        <rect width="24" height="4" y="12" fill="#2C2C2C" />
    </svg>
);

// Intersexe : drapeau officiel (fond jaune, cercle violet centré) à la place
// du symbole GENRE_SYMBOLS[3].
const IconGenreIntersexe: React.FC = () => (
    <svg viewBox="0 0 24 16" className="details-genre-flag">
        <rect width="24" height="16" fill="#FFD800" />
        <circle cx="12" cy="8" r="5" fill="none" stroke="#7902AA" strokeWidth="2.5" />
    </svg>
);

const chatKey = (id: number) => `realornot-chat-${id}`;

// Version simplifiée de "Votre profil pour cette conversation", pour les
// utilisateurs qui n'ont pas créé ce personnage : juste leur caractère pour
// cette conversation, leur genre, et la possibilité de recommencer leur
// propre conversation (l'historique est de toute façon local à l'appareil).
const ProfilConversationUtilisateurPage: React.FC = () => {
    const t = useUiLang();
    const assets = useThemeAssets();
    const location = RouterDom.useLocation();
    const navigate = RouterDom.useNavigate();
    const state = (location.state || {}) as LocationState;
    const creation = state.creation;

    const avatarUtilisateur = useAvatarUtilisateur();
    const [profilConversation, setProfilConversation] = useState<ProfilConversation>(() =>
        chargerProfilConversation(creation?.id)
    );
    const [activeGenreTooltip, setActiveGenreTooltip] = useState<number | null>(null);
    const [signalementOuvert, setSignalementOuvert] = useState(false);
    const [motifChoisi, setMotifChoisi] = useState<string | null>(null);
    const [commentaireSignalement, setCommentaireSignalement] = useState('');
    const [envoiEnCours, setEnvoiEnCours] = useState(false);
    const [signalementConfirme, setSignalementConfirme] = useState(false);
    // Vrai pendant l'animation de descente de la fenêtre « Signaler » (avant qu'elle soit retirée).
    const [signalementSortie, setSignalementSortie] = useState(false);
    // Confirmation "recommencer" (voir consigne_prudence_popups.md) -
    // remplace window.confirm par une fenêtre interne ; la logique qui suit
    // (localStorage.removeItem + navigate(-1) dans confirmerRecommencer,
    // inchangée caractère pour caractère) reste strictement identique.
    const [confirmationRecommencerOuverte, setConfirmationRecommencerOuverte] = useState(false);
    // Vrai pendant l'animation de descente de la fenêtre de confirmation (avant qu'elle soit retirée).
    const [confirmationSortie, setConfirmationSortie] = useState(false);

    const motifs = [
        t.motifContenuSexuel,
        t.motifSuicideAutomutilation,
        t.motifSecuriteEnfants,
        t.motifHarcelement,
        t.motifDiscoursHaineux,
        t.motifAutre,
    ];

    // Ferme la fenêtre « Signaler » : la fait d'abord redescendre (0,3 s, même durée que l'animation CSS),
    // puis la retire et remet les champs à zéro.
    const fermerSignalement = () => {
        if (signalementSortie) return; // fermeture déjà en cours
        setSignalementSortie(true);
        window.setTimeout(() => {
            setSignalementOuvert(false);
            setMotifChoisi(null);
            setCommentaireSignalement('');
            setSignalementConfirme(false);
            setSignalementSortie(false);
        }, 300);
    };

    const handleEnvoyerSignalement = async () => {
        if (!motifChoisi || envoiEnCours) return;
        setEnvoiEnCours(true);
        try {
            await envoyerSignalement({
                creationId: creation?.id,
                creationTitle: creation?.title || '',
                motif: motifChoisi,
                commentaire: commentaireSignalement.trim(),
            });
            setSignalementConfirme(true);
        } catch (err) {
            console.log('Signalement échoué', err);
        } finally {
            setEnvoiEnCours(false);
        }
    };

    useEffect(() => {
        if (activeGenreTooltip === null) return;
        const timer = window.setTimeout(() => setActiveGenreTooltip(null), 5000);
        return () => window.clearTimeout(timer);
    }, [activeGenreTooltip]);

    useEffect(() => {
        if (creation?.id === undefined) return;
        enregistrerProfilConversation(creation.id, profilConversation);
    }, [profilConversation, creation?.id]);

    const handleRecommencer = () => {
        setConfirmationRecommencerOuverte(true);
    };

    // Annule la confirmation : la fenêtre redescend d'abord (0,3 s, même durée que l'animation CSS), puis est retirée.
    const annulerRecommencer = () => {
        if (confirmationSortie) return; // fermeture déjà en cours
        setConfirmationSortie(true);
        window.setTimeout(() => {
            setConfirmationRecommencerOuverte(false);
            setConfirmationSortie(false);
        }, 300);
    };

    const confirmerRecommencer = () => {
        setConfirmationRecommencerOuverte(false);
        if (creation?.id !== undefined) {
            localStorage.removeItem(chatKey(creation.id));
        }
        navigate(-1);
    };

    return (
        <div className="page-content-container create-page profil-conversation-page">
            <div className="profil-conversation-header-fixed">
                <NavArrow direction="back" />

                <button
                    type="button"
                    className="signaler-btn"
                    onClick={() => setSignalementOuvert(true)}
                    aria-label={t.signalerBouton}
                >
                    <img src={assets.drapeau} alt="" className="signaler-btn-img" />
                </button>
            </div>

            <BanniereTitre texte={t.profilConversationTitre}>
                {avatarUtilisateur ? (
                    <span className="profil-conversation-avatar-btn" aria-hidden="true">
                        <img src={avatarUtilisateur} alt="" className="profil-conversation-avatar-img" />
                    </span>
                ) : (
                    <img src={assets.palette} alt="" className="create-banner-icon" />
                )}
            </BanniereTitre>

            {avatarUtilisateur && (
                <div className="profil-conversation-avatar-large">
                    <img src={avatarUtilisateur} alt="" />
                </div>
            )}

            <div className="profil-conversation-sections">
            {/* Onglet de dossier collé en haut à gauche de la boîte : le titre fait partie de la boîte. */}
            <div className="profil-conversation-boxed profil-dossier">
            <p className="profil-dossier-onglet">{t.quiEtesVous}</p>
            <div className="create-box">
            <textarea
            className="create-textarea"
            placeholder={t.caractereConversationPlaceholder}
            value={profilConversation.caractere}
            onChange={(e) => setProfilConversation((p) => ({ ...p, caractere: e.target.value }))}
            rows={6}
            />
            </div>
            </div>

                <div className="details-genre-row profil-conversation-genre-row">
                    <img src={assets.barre2} alt="" className="details-categories-bg" />
                    <div className="details-genre-items">
                        {GENRE_SYMBOLS.map((symbol, i) => (
                            <div key={symbol} className="details-genre-item">
                                <button
                                    type="button"
                                    className={`details-genre-symbol details-genre-symbol-${i}${profilConversation.genre === i ? ' details-genre-symbol-active' : ''}`}
                                    onClick={() => {
                                        setProfilConversation((p) => ({ ...p, genre: i }));
                                        setActiveGenreTooltip(activeGenreTooltip === i ? null : i);
                                    }}
                                >
                                    {i === 3 ? <IconGenreIntersexe /> : i === 4 ? <IconGenreNonBinaire /> : symbol}
                                </button>
                                {activeGenreTooltip === i && (
                                    <span className="details-genre-tooltip">{t.genres[i]}</span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="profil-conversation-boxed">
                    <button
                        type="button"
                        className="create-btn create-btn-image profil-conversation-restart-btn"
                        onClick={handleRecommencer}
                    >
                        <img src={assets.barre1} alt="" />
                        <div className="create-btn-caption">
                            <span className="create-btn-title">{t.recommencerConversation}</span>
                        </div>
                    </button>
                </div>
            </div>

            {signalementOuvert && (
                <div className={`update-prompt-overlay signaler-feuille-overlay${signalementSortie ? ' signaler-feuille-overlay-sortie' : ''}`}>
                <div className={`update-prompt-box signaler-feuille${signalementSortie ? ' signaler-feuille-sortie' : ''}`}>
                        {signalementConfirme ? (
                            <p className="update-prompt-text">{t.signalementEnvoye}</p>
                        ) : (
                            <>
                                <p className="update-prompt-text">{t.signalerTitre}</p>
                                <div className="signaler-motifs">
                                    {motifs.map((motif) => (
                                        <button
                                            key={motif}
                                            type="button"
                                            className={`signaler-motif-btn${motifChoisi === motif ? ' signaler-motif-btn-actif' : ''}`}
                                            onClick={() => setMotifChoisi(motif)}
                                        >
                                            {motif}
                                        </button>
                                    ))}
                                </div>
                                <textarea
                                    className="moi-champ signaler-commentaire"
                                    placeholder={t.signalerCommentairePlaceholder}
                                    value={commentaireSignalement}
                                    onChange={(e) => setCommentaireSignalement(e.target.value)}
                                    rows={3}
                                    maxLength={300}
                                />
                            </>
                        )}
                        <div className="update-prompt-actions">
                            {signalementConfirme ? (
                                <button
                                    type="button"
                                    className="update-prompt-btn update-prompt-btn-primary"
                                    onClick={fermerSignalement}
                                >
                                    {t.valider}
                                </button>
                            ) : (
                                <>
                                    <button
                                        type="button"
                                        className="update-prompt-btn update-prompt-btn-secondary"
                                        onClick={fermerSignalement}
                                        disabled={envoiEnCours}
                                    >
                                        {t.annuler}
                                    </button>
                                    <button
                                        type="button"
                                        className="update-prompt-btn update-prompt-btn-primary"
                                        onClick={handleEnvoyerSignalement}
                                        disabled={!motifChoisi || envoiEnCours}
                                    >
                                        {t.envoyer}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {confirmationRecommencerOuverte && (
                <div className={`update-prompt-overlay signaler-feuille-overlay${confirmationSortie ? ' signaler-feuille-overlay-sortie' : ''}`}>
                <div className={`update-prompt-box signaler-feuille profil-recommencer-confirmation${confirmationSortie ? ' signaler-feuille-sortie' : ''}`}>
                        <p className="update-prompt-text">{t.confirmerRecommencer}</p>
                        <div className="update-prompt-actions">
                            <button
                                type="button"
                                className="update-prompt-btn update-prompt-btn-secondary"
                                onClick={annulerRecommencer}
                                >
                                {t.non}
                                </button>
                                <button
                                type="button"
                                className="update-prompt-btn update-prompt-btn-primary"
                                onClick={confirmerRecommencer}
                                >
                                {t.oui}
                                </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProfilConversationUtilisateurPage;
