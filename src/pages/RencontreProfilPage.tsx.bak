/* src/pages/RencontreProfilPage.tsx */
import React, { useEffect, useState } from 'react';
import * as RouterDom from 'react-router-dom';
import { useUiLang, useThemeAssets, HeaderRetour, BanniereTitre } from '../communs';
import ActionsBlocageSignalement from '../components/ActionsBlocageSignalement';
import type { ProfilRencontre } from '../utils/rencontre';
import { obtenirProfilsRencontre, urlPhotoRencontre, enregistrerVueProfilRencontre } from '../utils/rencontre';

// Page d'accueil du profil consulté (voir RencontreProfilPhotosPage.tsx et
// RencontreProfilDetailsPage.tsx pour le détail) : juste la photo de
// présentation et les 3 actions possibles, pour arriver directement sur
// l'essentiel plutôt que sur une longue page à faire défiler.
const RencontreProfilPage: React.FC = () => {
    const { pseudo } = RouterDom.useParams<{ pseudo: string }>();
    const location = RouterDom.useLocation();
    const navigate = RouterDom.useNavigate();
    const t = useUiLang();
    const assets = useThemeAssets();
    const [profil, setProfil] = useState<ProfilRencontre | null>(
        (location.state as { profil?: ProfilRencontre } | null)?.profil ?? null
    );
    const [chargement, setChargement] = useState(() => !profil);

    useEffect(() => {
        // Sans effet côté serveur si c'est mon propre profil (voir
        // compteurs_visites.md) - pas besoin de le vérifier ici.
        if (pseudo) enregistrerVueProfilRencontre(pseudo);
        if (profil) return;
        // Pas de route serveur dédiée à un seul profil - la liste complète
        // (déjà utilisée par RencontreListePage) sert aussi de filet de
        // sécurité si on arrive ici sans state (ex. rafraîchissement de la
        // page).
        obtenirProfilsRencontre()
            .then((profils) => setProfil(profils.find((p) => p.pseudo === pseudo) ?? null))
            .catch(() => {})
            .finally(() => setChargement(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (chargement) return null;

    const photoPresentation = profil?.photos?.find((p) => p.id === profil.photoPresentationId);

    return (
        <div className="page-content-container create-page rencontre-page rencontre-souspage">
            <HeaderRetour />
            <BanniereTitre texte={profil?.prenom ?? pseudo ?? 'Profil'} />

            {!profil && <p className="texte-vide-centre">{t.profilIntrouvable ?? 'Profil introuvable.'}</p>}

            {profil && (
                <>
                    {photoPresentation ? (
                        <img src={urlPhotoRencontre(photoPresentation)} alt="" className="rencontre-profil-photo" />
                    ) : (
                        <div className="create-box rencontre-bio-box rencontre-aucune-photo">
                            <p className="details-field-label" style={{ textAlign: 'center', fontStyle: 'italic' }}>
                                {t.aucunePhotoTexte ?? "La personne n'a pas donné de photo"}
                            </p>
                        </div>
                    )}

                    <button
                        type="button"
                        className="create-btn create-btn-image btn-bouton-png rencontre-profil-bouton"
                        onClick={() => navigate(`/rencontre/voir/${profil.pseudo}/photos`, { state: { profil } })}
                    >
                        <img src={assets.barre1} alt="" />
                        <div className="create-btn-caption">
                            <span className="create-btn-title">{t.voirPhotosBtn ?? 'Voir les photos'}</span>
                        </div>
                    </button>

                    <button
                        type="button"
                        className="create-btn create-btn-image btn-bouton-png rencontre-profil-bouton"
                        onClick={() => navigate(`/rencontre/voir/${profil.pseudo}/details`, { state: { profil } })}
                    >
                        <img src={assets.barre1} alt="" />
                        <div className="create-btn-caption">
                            <span className="create-btn-title">{t.voirProfilBtn ?? 'Voir le profil'}</span>
                        </div>
                    </button>

                    <button
                        type="button"
                        className="create-btn create-btn-image btn-bouton-png rencontre-profil-bouton"
                        onClick={() => navigate(`/mode-reel/messages/${profil.pseudo}`, { state: { prenom: profil.prenom } })}
                    >
                        <img src={assets.barre1} alt="" />
                        <div className="create-btn-caption">
                            <span className="create-btn-title">{t.envoyerMessageBtn ?? 'Envoyer un message'}</span>
                        </div>
                    </button>

                    <ActionsBlocageSignalement
                        pseudo={profil.pseudo}
                        variante="grand"
                        onBloque={() => navigate('/rencontre', { replace: true })}
                    />
                </>
            )}
        </div>
    );
};

export default RencontreProfilPage;
