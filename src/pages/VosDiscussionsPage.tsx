/* src/pages/VosDiscussionsPage.tsx */
import React, { useEffect, useState } from 'react';
import * as RouterDom from 'react-router-dom';
import { useUiLang, useThemeAssets, HeaderRetour, BanniereTitre } from '../communs';
import { getMesCreations, getUserCreations, type UserCreation } from '../utils/userCreations';

const CHAT_KEY_PREFIX = 'realornot-chat-';

interface StoredMessage {
    sender: 'character' | 'user';
    text: string;
}

interface Discussion {
    creation: UserCreation;
    dernierMessage: string;
}

// Repère, parmi les conversations enregistrées sur cet appareil, celles qui
// contiennent au moins un message envoyé par l'utilisateur (donc une vraie
// discussion, pas juste la salutation affichée par défaut).
const trouverDiscussions = (creations: UserCreation[]): Discussion[] => {
    const parCreation = new Map(creations.map((c) => [c.id, c]));
    const discussions: Discussion[] = [];

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith(CHAT_KEY_PREFIX)) continue;
        const id = Number(key.slice(CHAT_KEY_PREFIX.length));
        const creation = parCreation.get(id);
        if (!creation) continue;

        try {
            const messages: StoredMessage[] = JSON.parse(localStorage.getItem(key) || '[]');
            const aEchange = messages.some((m) => m.sender === 'user');
            if (!aEchange) continue;
            const dernier = messages[messages.length - 1];
            discussions.push({ creation, dernierMessage: dernier?.text || '' });
        } catch {
            // conversation illisible, on l'ignore
        }
    }

    return discussions;
};

const VosDiscussionsPage: React.FC = () => {
    const t = useUiLang();
    const assets = useThemeAssets();
    const navigate = RouterDom.useNavigate();
    const [discussions, setDiscussions] = useState<Discussion[]>([]);

    useEffect(() => {
        // Une discussion peut porter sur un personnage public créé par
        // quelqu'un d'autre (visible via getUserCreations) ou sur l'un des
        // vôtres même privé (visible seulement via getMesCreations) : il faut
        // les deux listes pour retrouver toutes les créations concernées.
        // Promise.allSettled plutôt que Promise.all : hors-ligne, il est
        // possible qu'une seule des deux listes ait déjà une copie locale
        // (voir userCreations.ts) ; on ne veut pas perdre les discussions
        // résolvables avec celle-là juste parce que l'autre échoue.
        Promise.allSettled([getUserCreations(), getMesCreations()])
            .then(([publiques, miennes]) => {
                const parId = new Map<number, UserCreation>();
                if (publiques.status === 'fulfilled') {
                    publiques.value.forEach((c) => parId.set(c.id, c));
                }
                if (miennes.status === 'fulfilled') {
                    miennes.value.forEach((c) => parId.set(c.id, c));
                }
                setDiscussions(trouverDiscussions(Array.from(parId.values())));
            })
            .catch((err) => console.log('Chargement des discussions échoué', err));
    }, []);

    return (
        <div className="page-content-container create-page moi-page">
            <HeaderRetour />

            <BanniereTitre texte={t.vosDiscussions}>
                <img src={assets.palette} alt="" className="create-banner-icon" />
            </BanniereTitre>

            <div className="moi-discussions-list">
                {discussions.map(({ creation, dernierMessage }) => {
                    const hasImage = creation.imageUrl && creation.imageUrl !== 'placeholder';
                    return (
                        <div
                            key={creation.id}
                            className="moi-discussion-item"
                            role="button"
                            onClick={() => navigate(`/personnage/${creation.id}`, { state: { creation } })}
                        >
                            <div
                                className="moi-discussion-avatar"
                                style={hasImage ? { backgroundImage: `url(${creation.imageUrl})` } : undefined}
                            />
                            <div className="moi-discussion-info">
                                <div className="moi-discussion-title">{creation.title}</div>
                                <div className="moi-discussion-preview">{dernierMessage}</div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default VosDiscussionsPage;
