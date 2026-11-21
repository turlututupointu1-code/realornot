/* src/pages/RencontreAjouterPhoto.tsx */
import React, { useEffect, useState } from 'react';
import * as RouterDom from 'react-router-dom';
/*import { CameraPreview } from '@capgo/camera-preview';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { StatusBar } from '@capacitor/status-bar';
import { useTheme } from '../context/theme';
import { STATUT_PAR_THEME } from '../context/theme';
import { useThemeAssets } from '../assets/themeAssets';*/
import { useUiLang, useThemeAssets, HeaderRetour, BanniereTitre } from '../communs';
import { useCameraCapture } from '../utils/useCameraCapture';
import CropPhoto from '../components/CropPhoto';
import ZoomBar from '../components/ZoomBar';
import { ajouterPhotoRencontre } from '../utils/rencontre';

const RencontreAjouterPhoto: React.FC = () => {
    const t = useUiLang();
    const assets = useThemeAssets();
    const navigate = RouterDom.useNavigate();
    const location = RouterDom.useLocation();
    // Déclenché directement depuis "Mes photos" : une case vide envoie
    // 'galerie', le bouton dédié envoie 'camera' - plus d'écran de choix
    // intermédiaire (voir RencontrePhotosPage.tsx).
    const modeAuto = (location.state as { mode?: 'camera' | 'galerie' } | null)?.mode ?? null;
    const [envoiEnCours, setEnvoiEnCours] = useState(false);
    const [erreur, setErreur] = useState<string | null>(null);

    const {
        photoACadrer, setPhotoACadrer, photoDepuisCamera,
        cameraActive, flash, plageZoom, niveauZoom,
        ouvrirCamera, fermerCamera, capturerPhoto,
        basculerFlash, basculerCamera, appliquerZoom, choisirDansGalerie,
    } = useCameraCapture(() => {
        if (modeAuto) navigate('/mode-reel/photos', { replace: true });
    });

    // Lancement automatique du mode choisi depuis "Mes photos" - pas
    // d'écran de choix à afficher ni à toucher ici.
    useEffect(() => {
        if (modeAuto === 'camera') ouvrirCamera();
        else if (modeAuto === 'galerie') choisirDansGalerie();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const confirmerRecadrage = async (recadree: string) => {
        setPhotoACadrer(null);
        setEnvoiEnCours(true);
        setErreur(null);
        try {
            await ajouterPhotoRencontre(recadree);
            navigate('/mode-reel/photos', { replace: true });
        } catch (err) {
            setErreur(err instanceof Error ? err.message : 'Impossible d\'ajouter la photo.');
            setEnvoiEnCours(false);
        }
    };

    if (photoACadrer) {
        return (
            <CropPhoto
                imageSrc={photoACadrer}
                onCancel={async () => {
                    if (photoDepuisCamera) {
                        await ouvrirCamera();
                    }
                    setPhotoACadrer(null);
                }}
                onConfirm={confirmerRecadrage}
            />
        );
    }

    if (cameraActive) {
        return (
            <div className="camera-overlay">
                <div className="camera-controls-panel">
                    {plageZoom.max > plageZoom.min && (
                        <ZoomBar
                            min={plageZoom.min}
                            max={plageZoom.max}
                            value={niveauZoom}
                            onChange={appliquerZoom}
                            className="camera-zoom-bar"
                        />
                    )}

                    <div className="camera-bottom-row">
                        <button type="button" className="camera-back-app-btn" onClick={fermerCamera} aria-label={t.retour}>
                            <img src={assets.fleche} alt="" className="fleche-icone fleche-retour" />
                        </button>

                        <div className="camera-controls-row">
                            <button type="button" className="camera-btn" onClick={basculerFlash} aria-label={t.flash} data-active={flash !== 'off'}>
                                <img src={assets.flash} alt="" className="camera-btn-icon" />
                            </button>

                            <button type="button" className="camera-capture-btn" onClick={capturerPhoto} aria-label={t.creer}>
                                <img src={assets.capture} alt="" className="camera-capture-btn-icon" />
                            </button>

                            <button type="button" className="camera-btn" onClick={basculerCamera} aria-label={t.basculerCamera}>
                                <img src={assets.basculer} alt="" className="camera-btn-icon" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Cas normal : mode transmis depuis "Mes photos", déclenché par l'effet
    // ci-dessus - rien à afficher ici pendant que la caméra/galerie s'ouvre.
    if (modeAuto) return null;

    return (
        <div className="page-content-container create-page telecharger-photo-page">
            <HeaderRetour />
            <BanniereTitre texte={t.choisirVotrePhoto}>
                <img src={assets.appareilphoto} alt="" className="create-banner-icon" />
            </BanniereTitre>

            {erreur && <p className="compte-erreur-texte">{erreur}</p>}

            <div className="upload-choice-row">
                <button
                    type="button"
                    className="upload-choice-box"
                    onClick={ouvrirCamera}
                    disabled={envoiEnCours}
                >
                    <img src={assets.smartphone} alt="" className="upload-choice-icon" />
                    <span className="upload-choice-label">{t.prendrePhoto}</span>
                </button>

                <button
                    type="button"
                    className="upload-choice-box"
                    onClick={choisirDansGalerie}
                    disabled={envoiEnCours}
                >
                    <img src={assets.repertoire} alt="" className="upload-choice-icon" />
                </button>
            </div>

            <div className="create-silhouette-wrapper">
                <img src={assets.silhouette} alt="" className="create-silhouette" />
            </div>
        </div>
    );
};

export default RencontreAjouterPhoto;
