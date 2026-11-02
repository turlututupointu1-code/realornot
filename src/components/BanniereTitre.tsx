/* src/components/BanniereTitre.tsx */
import React from 'react';
import { useThemeAssets } from '../assets/themeAssets';

interface BanniereTitreProps {
    texte: string;
    children?: React.ReactNode;
}

// Bloc "bannière titre" (fond titre.png + icône/avatar + texte), répété à
// l'identique en haut de la plupart des pages de création. Le contenu du
// milieu (icône simple, avatar, bouton...) varie selon la page et se passe
// en children.
const BanniereTitre: React.FC<BanniereTitreProps> = ({ texte, children }) => {
    const assets = useThemeAssets();
    return (
        <div className="create-banner-title">
            <img src={assets.titre} alt="" className="create-banner-bg" />
            {children}
            <span className="create-banner-text">{texte}</span>
        </div>
    );
};

export default BanniereTitre;
