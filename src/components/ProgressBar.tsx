/* src/components/ProgressBar.tsx */
import React from 'react';
import { useThemeAssets } from '../assets/themeAssets';

// Barre de progression réutilisable (recadrage, génération...) : même
// JSX que celle dupliquée dans CropPhoto.tsx et GenererPhoto.tsx.
interface ProgressBarProps {
    // Pourcentage 0-100 connu -> remplissage déterminé (GenererPhoto).
    // Omis -> variante indéterminée, balayage animé pour une durée qu'on ne
    // connaît pas à l'avance (CropPhoto pendant l'enregistrement).
    progress?: number;
    // Classe additionnelle optionnelle (ex: "camera-capture-progress" sur
    // CropPhoto.tsx), ajoutée à "progress-bar" sans le remplacer.
    className?: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ progress, className }) => {
    const assets = useThemeAssets();

    return (
        <div className={`progress-bar${className ? ` ${className}` : ''}`}>
            <img src={assets.barreProgression} alt="" className="progress-bar-track" draggable={false} />
            <div className="progress-bar-slot">
                {progress === undefined ? (
                    <div className="progress-bar-fill-indeterminate" />
                ) : (
                    <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
                )}
            </div>
        </div>
    );
};

export default ProgressBar;
