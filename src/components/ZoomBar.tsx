/* src/components/ZoomBar.tsx */
import React, { useRef } from 'react';
import { useThemeAssets } from '../assets/themeAssets';

// Barre de zoom réutilisable : même JSX/logique de glissement que celle
// dupliquée dans CropPhoto.tsx, RencontreAjouterPhoto.tsx et
// TelechargerPhoto.tsx - un seul endroit à corriger désormais (ex: le
// fantôme de glissement Firefox, voir draggable={false} ci-dessous).
interface ZoomBarProps {
    min: number;
    max: number;
    value: number;
    onChange: (value: number) => void;
    // Classe additionnelle optionnelle (ex: "camera-zoom-bar" sur la page
    // caméra en direct), ajoutée à "zoom-bar" sans le remplacer.
    className?: string;
}

const ZoomBar: React.FC<ZoomBarProps> = ({ min, max, value, onChange, className }) => {
    const assets = useThemeAssets();
    const barRef = useRef<HTMLDivElement>(null);

    const valeurDepuisPosition = (clientX: number): number => {
        const el = barRef.current;
        if (!el) return value;
        const rect = el.getBoundingClientRect();
        const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
        return min + ratio * (max - min);
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        onChange(valeurDepuisPosition(e.clientX));
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (e.buttons === 0) return;
        onChange(valeurDepuisPosition(e.clientX));
    };

    return (
        <div
            ref={barRef}
            className={`zoom-bar${className ? ` ${className}` : ''}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
        >
            <img src={assets.zoom} alt="" className="zoom-track" draggable={false} />
            <span className="zoom-label">ZOOM</span>
            <div className="zoom-slot">
                <div
                    className="zoom-fill"
                    style={{ width: `${((value - min) / (max - min)) * 100}%` }}
                />
            </div>
        </div>
    );
};

export default ZoomBar;
