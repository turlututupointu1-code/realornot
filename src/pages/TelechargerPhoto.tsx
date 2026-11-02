/* src/pages/TelechargerPhoto.tsx */
import React from 'react';
import * as RouterDom from 'react-router-dom';
import { useUiLang, useThemeAssets, HeaderRetour, BanniereTitre } from '../communs';
import { useCameraCapture } from '../utils/useCameraCapture';
import CropPhoto from '../components/CropPhoto';
import ZoomBar from '../components/ZoomBar';


const TelechargerPhoto: React.FC = () => {
    const t = useUiLang();
    const assets = useThemeAssets();
    const navigate = RouterDom.useNavigate();
    const {
        photoACadrer, setPhotoACadrer, photoDepuisCamera,
        cameraActive, flash, plageZoom, niveauZoom,
        ouvrirCamera, fermerCamera, capturerPhoto,
        basculerFlash, basculerCamera, appliquerZoom, choisirDansGalerie,
    } = useCameraCapture();

    if (photoACadrer) {
        return (
            <CropPhoto
                imageSrc={photoACadrer}
                onCancel={async () => {
                    if (photoDepuisCamera) {
                        // Rouvre la caméra avant de faire disparaître la boîte
                        // de recadrage, pour ne pas laisser voir la page
                        // "Choisir votre photo" entre les deux.
                        await ouvrirCamera();
                    }
                    setPhotoACadrer(null);
                }}
                onConfirm={(recadree) => {
                    setPhotoACadrer(null);
                    navigate('/creer/personnage', { state: { generatedImage: recadree } });
                }}
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

    return (
        <div className="page-content-container create-page telecharger-photo-page">
            <HeaderRetour />

            <BanniereTitre texte={t.choisirVotrePhoto}>
                <img src={assets.appareilphoto} alt="" className="create-banner-icon" />
            </BanniereTitre>

            <div className="upload-choice-row">
            {/* Chaque choix : le téléphone, puis son texte en dessous. */}
            <div className="upload-choice">
            <button
            type="button"
            className="upload-choice-box"
            onClick={ouvrirCamera}
            >
            <img src={assets.smartphone} alt="" className="upload-choice-icon" />
            </button>
            <span className="upload-choice-label">{t.telechargerPrendrePhoto}</span>
            </div>

            <div className="upload-choice">
            <button
            type="button"
            className="upload-choice-box"
            onClick={choisirDansGalerie}
            >
            <img src={assets.repertoire} alt="" className="upload-choice-icon" />
            </button>
            <span className="upload-choice-label">{t.telechargerChoisirPhoto}</span>
            </div>
            </div>

            {/* Avertissement en rouge, centré sur toute la largeur, sous les deux choix. */}
            <p className="upload-choice-note">{t.telechargerAutorisationEcrite}</p>
            <div className="create-silhouette-wrapper">
                <img src={assets.silhouette} alt="" className="create-silhouette" />
            </div>
        </div>
    );
};

export default TelechargerPhoto;
