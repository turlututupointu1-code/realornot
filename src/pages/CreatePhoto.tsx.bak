/* src/pages/CreatePhoto.tsx */
import React from 'react';
import * as RouterDom from 'react-router-dom';
import { useUiLang, useThemeAssets, HeaderRetour, BanniereTitre } from '../communs';

const CreatePhoto: React.FC = () => {
    const t = useUiLang();
    const assets = useThemeAssets();

    return (
        <div className="page-content-container create-page create-photo-page">
            <HeaderRetour />
            <BanniereTitre texte={t.titre}>
                <img src={assets.creer} alt="" className="create-banner-icon" />
            </BanniereTitre>

            <div className="create-buttons">
                <RouterDom.Link to="/creer/generer" className="create-btn create-btn-image btn-bouton-png">
                    <img src={assets.barre2} alt="" />
                    <img src={assets.palette} alt="" className="create-banner-icon" />
                    <div className="create-btn-caption">
                        <span className="create-btn-title">{t.genererTitre}</span>
                    </div>
                </RouterDom.Link>

                <RouterDom.Link to="/creer/telecharger" className="create-btn create-btn-image btn-bouton-png">
                    <img src={assets.barre2} alt="" />
                    <img src={assets.appareilphoto} alt="" className="create-banner-icon" />
                    <div className="create-btn-caption">
                        <span className="create-btn-title">{t.telechargerTitre}</span>
                    </div>
                </RouterDom.Link>
            </div>

            <div className="create-silhouette-wrapper">
                <img src={assets.silhouette} alt="" className="create-silhouette" />
            </div>
        </div>
    );
};

export default CreatePhoto;
