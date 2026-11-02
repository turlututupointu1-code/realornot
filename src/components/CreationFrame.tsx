/* src/components/CreationFrame.tsx */
import React from 'react';
import { useUiLang } from '../context/theme';

interface CreationFrameProps {
    id: number;
    title: string;
    imageUrl: string;
    bio?: string;
    creatorPseudo?: string;
    nbMessages?: number;
    onClick: () => void;
}

// Transforme le nombre de messages envoyés à un personnage en libellé court : <1k, >1k, >2k...
const libelleNbMessages = (n: number): string =>
n < 1000 ? '<1k' : '>' + Math.floor(n / 1000) + 'k';

const CreationFrame: React.FC<CreationFrameProps> = ({ title, imageUrl, bio, creatorPseudo, nbMessages, onClick }) => {
    const t = useUiLang();
    const hasImage = imageUrl && imageUrl !== 'placeholder';
    return (
        <div
        className="creation-card"
        role="button"
        aria-label={`Création: ${title}`}
        onClick={onClick}
        >
        <div
        className="creation-card-image"
        style={hasImage ? { backgroundImage: `url(${imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
        >
        {nbMessages !== undefined && (
            <span className="creation-card-count">{libelleNbMessages(nbMessages)}</span>
        )}
        {creatorPseudo && (
            <span className="creation-card-creator">{t.personnageCreeParIA}</span>
        )}
        </div>
        <div className="creation-card-info">
        <div className="creation-card-title">{title}</div>
        {bio && <div className="creation-card-bio">{bio}</div>}
        </div>
        </div>
    );
};

export default CreationFrame;
