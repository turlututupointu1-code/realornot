/* src/components/ChevronArrow.tsx */
import React from 'react';
import { useThemeAssets } from '../assets/themeAssets';

interface ChevronArrowProps {
    deg?: number;
    // 'bas' = flèche vers le bas (menu fermé), 'haut' = vers le haut (menu ouvert).
    // Absent : flèche non tournée (comportement des autres pages).
    sens?: 'bas' | 'haut';
    className?: string;
}

const ChevronArrow: React.FC<ChevronArrowProps> = ({ sens, className }) => {
    const assets = useThemeAssets();
    // L'image de la flèche pointe vers la droite : +90° la tourne vers le bas, -90° vers le haut.
    const rotation = sens === 'bas' ? 90 : sens === 'haut' ? -90 : undefined;
    return (
        <img
        src={assets.fleche}
        alt=""
        draggable={false}
        className={`fleche-icone${className ? ` ${className}` : ''}`}
        style={rotation !== undefined ? { transform: `rotate(${rotation}deg)` } : undefined}
        />
    );
};

export default ChevronArrow;
