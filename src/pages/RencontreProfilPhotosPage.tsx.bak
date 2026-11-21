/* src/pages/RencontreProfilPhotosPage.tsx */
import React, { useEffect, useState } from 'react';
import * as RouterDom from 'react-router-dom';
import { useUiLang, HeaderRetour, BanniereTitre } from '../communs';
import type { PhotoRencontre, ProfilRencontre } from '../utils/rencontre';
import { obtenirProfilsRencontre, urlPhotoRencontre } from '../utils/rencontre';

// Galerie des photos d'un profil consulté (voir "Voir les photos" dans
// RencontreProfilPage.tsx) - lecture seule, contrairement à
// RencontrePhotosPage.tsx qui gère mes propres photos.
const RencontreProfilPhotosPage: React.FC = () => {
    const { pseudo } = RouterDom.useParams<{ pseudo: string }>();
    const location = RouterDom.useLocation();
    const t = useUiLang();
    const [profil, setProfil] = useState<ProfilRencontre | null>(
        (location.state as { profil?: ProfilRencontre } | null)?.profil ?? null
    );
    const [chargement, setChargement] = useState(() => !profil);
    // Photo agrandie en plein écran quand on touche une vignette (voir plus
    // bas) - null = pas d'agrandissement affiché.
    const [photoAgrandie, setPhotoAgrandie] = useState<PhotoRencontre | null>(null);

    useEffect(() => {
        if (profil) return;
        obtenirProfilsRencontre()
            .then((profils) => setProfil(profils.find((p) => p.pseudo === pseudo) ?? null))
            .catch(() => {})
            .finally(() => setChargement(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (chargement) return null;

    const photos = profil?.photos ?? [];

    return (
        <div className="page-content-container create-page rencontre-page rencontre-souspage">
            <HeaderRetour />

            <BanniereTitre texte={profil?.prenom ?? pseudo ?? 'Profil'} />

            {photos.length === 0 && (
                <p style={{ textAlign: 'center', opacity: 0.7 }}>
                    {t.aucunePhotoProfilTexte ?? "Cette personne n'a pas encore ajouté de photo."}
                </p>
            )}

            <div className="rencontre-photos-grille rencontre-photos-grille--haut">
                {photos.slice(0, 3).map((photo) => (
                    <div
                        key={photo.id}
                        className={`rencontre-photo-case${photo.id === profil?.photoPresentationId ? ' rencontre-photo-case--presentation' : ''}`}
                        onClick={() => setPhotoAgrandie(photo)}
                    >
                        <img src={urlPhotoRencontre(photo)} alt="" />
                    </div>
                ))}
            </div>
            {photos.length > 3 && (
                <div className="rencontre-photos-grille rencontre-photos-grille--bas">
                    {photos.slice(3, 5).map((photo) => (
                        <div
                            key={photo.id}
                            className={`rencontre-photo-case${photo.id === profil?.photoPresentationId ? ' rencontre-photo-case--presentation' : ''}`}
                            onClick={() => setPhotoAgrandie(photo)}
                        >
                            <img src={urlPhotoRencontre(photo)} alt="" />
                        </div>
                    ))}
                </div>
            )}

            {photoAgrandie && (
                <div className="rencontre-photo-agrandie-overlay" onClick={() => setPhotoAgrandie(null)}>
                    <img src={urlPhotoRencontre(photoAgrandie)} alt="" className="rencontre-photo-agrandie-img" />
                </div>
            )}
        </div>
    );
};

export default RencontreProfilPhotosPage;
