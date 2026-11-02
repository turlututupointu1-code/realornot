/* src/components/PageDuBas.tsx */
import React, { useState } from 'react';
import { useThemeAssets } from '../assets/themeAssets';

// Page plein écran qui monte du bas (style .mode-reel-page dans base.scss), avec une croix en haut à droite.
// Une seule page pour tous les endroits qui l'utilisent (connexion, demande d'avis...).
// À la fermeture, la page redescend pendant 0,3 s (classe signaler-feuille-sortie) avant d'appeler onFermer.
// Les enfants peuvent aussi être une fonction qui reçoit « fermer », pour que leurs propres boutons
// (Plus tard, Valider...) ferment la page avec la même descente.
interface Props {
    onFermer: () => void;
    // Masque la croix (ex. pendant un téléchargement qui ne doit pas être interrompu)
    sansCroix?: boolean;
    children: React.ReactNode | ((fermer: () => void) => React.ReactNode);
}

const PageDuBas: React.FC<Props> = ({ onFermer, sansCroix, children }) => {
    const assets = useThemeAssets();
    const [enSortie, setEnSortie] = useState(false);

    // Lance la descente puis ferme la page une fois l'animation terminée
    const fermer = () => {
        setEnSortie(true);
        window.setTimeout(onFermer, 300);
    };

    return (
        <div className={enSortie ? 'mode-reel-page signaler-feuille-sortie' : 'mode-reel-page'}>
            {!sansCroix && (
                <button type="button" className="mode-reel-page-fermer" onClick={fermer} aria-label="Fermer">
                    <img src={assets.fermer} alt="" />
                </button>
            )}
            {typeof children === 'function' ? children(fermer) : children}
        </div>
    );
};

export default PageDuBas;
