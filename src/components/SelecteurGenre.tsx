/* src/components/SelecteurGenre.tsx */
import React, { useEffect, useState } from 'react';
import { useUiLang, useThemeAssets } from '../communs';

// Symboles de genre, alignés par position avec t.genres.
const GENRE_SYMBOLS = ['♀', '♂', '⚧', '⚥', '⚪'];

// Non-binaire : petit drapeau (jaune, blanc, violet, noir) plutôt qu'un
// symbole, à la place du rond de GENRE_SYMBOLS[4].
const IconGenreNonBinaire: React.FC = () => (
    <svg viewBox="0 0 24 16" className="details-genre-flag">
        <rect width="24" height="4" y="0" fill="#FCF434" />
        <rect width="24" height="4" y="4" fill="#FFFFFF" />
        <rect width="24" height="4" y="8" fill="#9C59D1" />
        <rect width="24" height="4" y="12" fill="#2C2C2C" />
    </svg>
);

// Intersexe : drapeau officiel (fond jaune, cercle violet centré) à la place
// du symbole GENRE_SYMBOLS[3].
const IconGenreIntersexe: React.FC = () => (
    <svg viewBox="0 0 24 16" className="details-genre-flag">
        <rect width="24" height="16" fill="#FFD800" />
        <circle cx="12" cy="8" r="5" fill="none" stroke="#7902AA" strokeWidth="2.5" />
    </svg>
);

interface SelecteurGenreProps {
    genre: number | null;
    onChange: (genre: number) => void;
    // Image de la barre : barre1 (Moi, Détails) ou barre2 (Mon profil).
    barre?: 'barre1' | 'barre2';
    // Classe supplémentaire de la rangée (marges propres à la page).
    classe?: string;
}

// Choix du genre : une barre, 5 symboles et un curseur qui glisse le long du cadre intérieur jusqu'au symbole choisi.
// Utilisé par les pages Moi, Mon profil et Détails du personnage. Réglages par thème : variables --genre-* (voir _15-categories-genre-voix.scss).
const SelecteurGenre: React.FC<SelecteurGenreProps> = ({ genre, onChange, barre = 'barre1', classe }) => {
    const t = useUiLang();
    const assets = useThemeAssets();
    const [activeGenreTooltip, setActiveGenreTooltip] = useState<number | null>(null);

    useEffect(() => {
        if (activeGenreTooltip === null) return;
        const timer = window.setTimeout(() => setActiveGenreTooltip(null), 5000);
        return () => window.clearTimeout(timer);
    }, [activeGenreTooltip]);

    return (
        <div className={`details-genre-row${classe ? ` ${classe}` : ''}`}>
            <img src={barre === 'barre2' ? assets.barre2 : assets.barre1} alt="" className="details-categories-bg" />
            <div className="details-genre-items" style={{ '--genre-i': genre ?? 0 } as React.CSSProperties}>
                <span className={`details-genre-curseur${genre === null ? ' details-genre-curseur-cache' : ''}`} aria-hidden="true" />
                {GENRE_SYMBOLS.map((symbol, i) => (
                    <div key={symbol} className="details-genre-item">
                        <button
                            type="button"
                            className={`details-genre-symbol details-genre-symbol-${i}`}
                            aria-pressed={genre === i}
                            onClick={() => {
                                onChange(i);
                                setActiveGenreTooltip(activeGenreTooltip === i ? null : i);
                            }}
                        >
                            {i === 3 ? <IconGenreIntersexe /> : i === 4 ? <IconGenreNonBinaire /> : symbol}
                        </button>
                        {activeGenreTooltip === i && (
                            <span className="details-genre-tooltip">{t.genres[i]}</span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SelecteurGenre;
