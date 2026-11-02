/* src/components/HeaderRetour.tsx */
import React from 'react';
import NavArrow from './NavArrow';

interface HeaderRetourProps {
    onClick?: () => void;
    children?: React.ReactNode;
}

// Bandeau fixe avec la flèche retour, en haut de la quasi-totalité des
// pages - onClick permet de personnaliser la navigation (par défaut,
// NavArrow revient en arrière) ; children accueille un éventuel bouton
// supplémentaire (ex. "Signaler", "Bloquer").
const HeaderRetour: React.FC<HeaderRetourProps> = ({ onClick, children }) => (
    <div className="profil-conversation-header-fixed">
    <NavArrow direction="back" onClick={onClick} />
    {children}
    </div>
);

export default HeaderRetour;
