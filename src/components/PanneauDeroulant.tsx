/* src/components/PanneauDeroulant.tsx */
import React from 'react';
import { useThemeAssets, ChevronArrow } from '../communs';

interface PanneauDeroulantProps {
    classe?: string; // classe propre à la barre (ex. 'moi-avatar-toggle') ; inutile avec burger
    titre: string;
    ouvert: boolean;
    onBasculer: () => void;
    droite?: React.ReactNode; // contenu à droite, avant la flèche (ex. petit avatar choisi) ; barre image seulement
    burger?: boolean; // true : style du menu burger (ligne + sous-menu) au lieu de la barre image
    children: React.ReactNode; // contenu du panneau, affiché seulement quand il est ouvert
}

// Ligne déroulante commune : page « Moi » (avatar, pseudonyme, caractère) et menu burger (langue, graphisme).
// La flèche pointe vers le bas (fermé) ou vers le haut (ouvert) ; le contenu s'affiche juste dessous.
const PanneauDeroulant: React.FC<PanneauDeroulantProps> = ({ classe, titre, ouvert, onBasculer, droite, burger, children }) => {
    const assets = useThemeAssets();
    const sens = ouvert ? 'haut' : 'bas';

    // Style menu burger : ligne burger-item + liste burger-submenu
    if (burger) {
        return (
            <>
            <div className="burger-item burger-item-expandable" onClick={onBasculer}>
            {titre} <ChevronArrow sens={sens} className="burger-chevron" />
            </div>
            {ouvert && <div className="burger-submenu">{children}</div>}
            </>
        );
    }

    // Style page « Moi » : barre image barre1.png
    return (
        <div>
        <button type="button" className={`details-voix-row ${classe ?? ''}`} onClick={onBasculer}>
        <img src={assets.barre1} alt="" className="details-categories-bg" />
        <div className="details-voix-content">
        <span className="details-voix-label">{titre}</span>
        <span className="moi-avatar-toggle-right">
        {droite}
        <ChevronArrow sens={sens} className="moi-avatar-chevron" />
        </span>
        </div>
        </button>
        {ouvert && children}
        </div>
    );
};

export default PanneauDeroulant;
