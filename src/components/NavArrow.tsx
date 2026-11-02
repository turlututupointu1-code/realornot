/* src/components/NavArrow.tsx */
import React from 'react';
import * as RouterDom from 'react-router-dom';
import { useUiLang, useThemeAssets } from '../communs';

type NavArrowProps = {
    direction: 'back' | 'continue';
    onClick?: () => void;
    disabled?: boolean;
    ariaLabel?: string;
};

const NavArrow: React.FC<NavArrowProps> = ({ direction, onClick, disabled, ariaLabel }) => {
    const navigate = RouterDom.useNavigate();
    const t = useUiLang();
    const assets = useThemeAssets();
    const icon = assets.fleche;
    const defaultLabel = direction === 'back' ? t.retour : t.continuer;
    const className = direction === 'back' ? 'nav-arrow-btn nav-arrow-back' : 'nav-arrow-btn nav-arrow-continue';
    const iconClassName = direction === 'back' ? 'fleche-icone fleche-retour' : 'fleche-icone';

    // Pour "back", si aucun onClick n'est fourni, on revient simplement en arrière dans l'historique.
    const handleClick = onClick || (direction === 'back' ? () => navigate(-1) : undefined);

    return (
        <button
            type="button"
            onClick={handleClick}
            disabled={disabled}
            className={className}
            aria-label={ariaLabel || defaultLabel}
        >
            <img src={icon} alt="" className={iconClassName} />
        </button>
    );
};

export default NavArrow;
