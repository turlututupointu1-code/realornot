/* src/pages/RencontrePhotosPage.tsx */
import React, { useEffect, useState } from 'react';
import * as RouterDom from 'react-router-dom';
import { useUiLang, BanniereTitre } from '../communs';
import NavArrow from '../components/NavArrow';
import type { PhotoRencontre } from '../utils/rencontre';
import {
    obtenirMonProfilRencontre,
    supprimerPhotoRencontre,
    definirPhotoPresentationRencontre,
    urlPhotoRencontre,
} from '../utils/rencontre';

const MAX_PHOTOS = 5;

// Page "Mes photos" du profil de rencontre (voir spec_page_photos.md) :
// jusqu'à 5 photos, une définie comme "photo de présentation" (celle
// affichée en priorité). Chaque action (ajout, suppression, changement de
// présentation) est enregistrée immédiatement côté serveur - pas de bouton
// "Enregistrer" séparé, pour éviter un état local qui pourrait diverger de
// ce qui est réellement stocké.
const RencontrePhotosPage: React.FC = () => {
    const t = useUiLang();
    const location = RouterDom.useLocation();
    const navigate = RouterDom.useNavigate();
    // Arrivée juste après le questionnaire (voir RencontrePage.tsx) vs accès
    // volontaire depuis le menu "Mes photos" - message d'accueil différent
    // (voir spec_page_photos.md).
    const premiereVisite = (location.state as { premiereVisite?: boolean } | null)?.premiereVisite === true;
    const [photos, setPhotos] = useState<PhotoRencontre[]>([]);
    const [photoPresentationId, setPhotoPresentationId] = useState<string | null>(null);
    const [chargement, setChargement] = useState(true);
    const [enCours, setEnCours] = useState(false);
    const [erreur, setErreur] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const profil = await obtenirMonProfilRencontre();
                // Accès direct depuis le menu "Mes photos" (voir TopBar.tsx)
                // avant d'avoir jamais enregistré le questionnaire une
                // première fois : le profil n'existe pas encore vraiment,
                // on renvoie sur le questionnaire plutôt que de laisser
                // ajouter des photos dans le vide (voir profilEnregistre
                // côté serveur, rencontre_profil_post).
                if (!profil.profilEnregistre) {
                    // Ne pas repasser chargement à false ici : la page ne
                    // doit jamais s'afficher, même brièvement, avant que la
                    // redirection prenne effet. voirQuestionnaire:true (même
                    // drapeau que "Mon profil" dans TopBar.tsx) pour forcer
                    // l'affichage du formulaire plutôt que du message de
                    // bienvenue par défaut - sinon RencontrePage montre la
                    // bienvenue pour tout compte qui n'est pas "fraîchement
                    // créé" cette session, même avec des réponses vides.
                    navigate('/mode-reel', { replace: true, state: { voirQuestionnaire: true } });
                    return;
                }
                setPhotos(profil.photos ?? []);
                setPhotoPresentationId(profil.photoPresentationId ?? null);
                setChargement(false);
            } catch {
                // Silencieux : page utilisable (vide) même si le chargement
                // initial échoue (ex. hors-ligne).
                setChargement(false);
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Case vide de la grille : va chercher directement une photo dans la
    // galerie (pas de choix intermédiaire) - l'appareil photo a son propre
    // bouton dédié juste en dessous de la grille (voir prendrePhoto).
    // replace:true : cette page-détour ne doit jamais rester dans
    // l'historique (voir RencontreAjouterPhoto.tsx, qui revient elle-même en
    // replace) - sinon la flèche retour de "Mes photos" repasse par elle et
    // rouvre la caméra/galerie au lieu de quitter la page.
    const ajouterPhotoDepuisGalerie = () => {
        if (enCours || photos.length >= MAX_PHOTOS) return;
        navigate('/mode-reel/photos/ajouter', { state: { mode: 'galerie' }, replace: true });
    };

    const prendrePhoto = () => {
        if (enCours || photos.length >= MAX_PHOTOS) return;
        navigate('/mode-reel/photos/ajouter', { state: { mode: 'camera' }, replace: true });
    };

    const choisirPresentation = async (photoId: string) => {
        if (enCours || photoId === photoPresentationId) return;
        setEnCours(true);
        setErreur(null);
        try {
            const data = await definirPhotoPresentationRencontre(photoId);
            setPhotoPresentationId(data.photoPresentationId);
        } catch (err) {
            if (err instanceof Error) setErreur(err.message);
        } finally {
            setEnCours(false);
        }
    };

    const supprimerPhoto = async (photoId: string) => {
        if (enCours) return;
        setEnCours(true);
        setErreur(null);
        try {
            const data = await supprimerPhotoRencontre(photoId);
            setPhotos(data.photos);
            setPhotoPresentationId(data.photoPresentationId);
        } catch (err) {
            if (err instanceof Error) setErreur(err.message);
        } finally {
            setEnCours(false);
        }
    };

    if (chargement) return null;

    const cases = Array.from({ length: MAX_PHOTOS }, (_, i) => photos[i] ?? null);

    const renderCase = (photo: PhotoRencontre | null, cle: string) => {
        if (!photo) {
            return (
                <button
                    type="button"
                    key={cle}
                    className="rencontre-photo-case rencontre-photo-case--vide"
                    onClick={ajouterPhotoDepuisGalerie}
                    disabled={enCours || photos.length >= MAX_PHOTOS}
                >
                    +
                </button>
            );
        }
        const estPresentation = photo.id === photoPresentationId;
        return (
            <div
                key={cle}
                className={`rencontre-photo-case${estPresentation ? ' rencontre-photo-case--presentation' : ''}`}
                onClick={() => choisirPresentation(photo.id)}
            >
                <img src={urlPhotoRencontre(photo)} alt="" />
                <button
                    type="button"
                    className="rencontre-photo-supprimer"
                    onClick={(e) => { e.stopPropagation(); supprimerPhoto(photo.id); }}
                    aria-label={t.supprimerPhotoLabel ?? 'Supprimer'}
                >
                    ✕
                </button>
                {estPresentation && (
                    <div className="rencontre-photo-bandeau">
                        {t.photoPresentationLabel ?? 'Présentation'}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="page-content-container create-page rencontre-page rencontre-souspage">
            <div className="profil-conversation-header-fixed">
                <NavArrow direction="back" />
            </div>

            <BanniereTitre texte={t.mesPhotosTitre ?? 'Mes photos'} />

            <div className="create-box rencontre-bio-box">
                <p className="details-field-label" style={{ textAlign: 'center' }}>
                    {photos.length === 0
                        ? (premiereVisite
                            ? (t.mesPhotosPremiereVisite ?? "Tu n'as pas encore ajouté de photo — montre-toi sous ton meilleur jour !")
                            : (t.mesPhotosGestionVide ?? "Tu n'as pas encore ajouté de photo — montre-toi sous ton meilleur jour !"))
                        : (t.mesPhotosGestionTexte ?? 'Gère tes photos : ajoute, remplace ou change ta photo principale')}
                </p>
            </div>

            <div className="create-box rencontre-bio-box">
                <p className="details-field-label">
                    {t.mesPhotosAide
                        ?? "Touche une case vide pour choisir une photo dans tes fichiers. Touche une photo déjà ajoutée pour la définir comme photo de présentation."}
                </p>
            </div>

            {erreur && <p className="compte-erreur-texte">{erreur}</p>}

            <div className="rencontre-photos-grille rencontre-photos-grille--haut">
                {cases.slice(0, 3).map((photo, i) => renderCase(photo, photo?.id ?? `vide-${i}`))}
            </div>
            <div className="rencontre-photos-grille rencontre-photos-grille--bas">
                {cases.slice(3, 5).map((photo, i) => renderCase(photo, photo?.id ?? `vide-${i + 3}`))}
            </div>

            <button
                type="button"
                className="rencontre-prendre-photo-btn"
                onClick={prendrePhoto}
                disabled={enCours || photos.length >= MAX_PHOTOS}
            >
                {t.prendrePhoto}
            </button>
        </div>
    );
};

export default RencontrePhotosPage;
