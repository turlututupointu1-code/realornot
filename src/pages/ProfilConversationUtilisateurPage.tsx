/* src/pages/ProfilConversationUtilisateurPage.tsx */
import React, { useEffect, useState } from 'react';
import * as RouterDom from 'react-router-dom';
import { useUiLang, useThemeAssets, BanniereTitre } from '../communs';
import NavArrow from '../components/NavArrow';
import SelecteurGenre from '../components/SelecteurGenre';
import { useAvatarUtilisateur } from '../utils/useAvatarUtilisateur';
import {
    type ProfilConversation,
    chargerProfilConversation,
    enregistrerProfilConversation,
} from '../utils/profilConversation';

interface LocationState {
    creation?: {
        id: number;
        title: string;
        imageUrl: string;
    };
}

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
    // Confirmation "recommencer" (voir consigne_prudence_popups.md) -
    // remplace window.confirm par une fenêtre interne ; la logique qui suit
    // (localStorage.removeItem + navigate(-1) dans confirmerRecommencer,
    // inchangée caractère pour caractère) reste strictement identique.
    const [confirmationRecommencerOuverte, setConfirmationRecommencerOuverte] = useState(false);
    // Vrai pendant l'animation de descente de la fenêtre de confirmation (avant qu'elle soit retirée).
    const [confirmationSortie, setConfirmationSortie] = useState(false);

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

                <SelecteurGenre
                    genre={profilConversation.genre}
                    onChange={(i) => setProfilConversation((p) => ({ ...p, genre: i }))}
                    barre="barre2"
                    classe="profil-conversation-genre-row"
                />

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
