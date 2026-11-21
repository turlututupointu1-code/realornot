/* src/pages/RencontreMessagesPage.tsx */
import React, { useEffect, useState } from 'react';
import * as RouterDom from 'react-router-dom';
import { useUiLang, HeaderRetour, BanniereTitre } from '../communs';
import type { ConversationRencontre } from '../utils/rencontre';
import { obtenirConversationsRencontre } from '../utils/rencontre';

// Boîte de réception de la messagerie entre vrais comptes (voir
// compteurs_visites.md) - une ligne par conversation, même habillage que
// VosDiscussionsPage.tsx (conversations avec des personnages IA).
const RencontreMessagesPage: React.FC = () => {
    const t = useUiLang();
    const navigate = RouterDom.useNavigate();
    const [conversations, setConversations] = useState<ConversationRencontre[]>([]);
    const [chargement, setChargement] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                setConversations(await obtenirConversationsRencontre());
            } catch {
                // Liste vide en cas d'échec (ex. hors-ligne).
            } finally {
                setChargement(false);
            }
        })();
    }, []);

    if (chargement) return null;

    return (
        <div className="page-content-container create-page moi-page">
            <HeaderRetour />
            <BanniereTitre texte={t.messagesPageTitre ?? 'Messages'} />

            {conversations.length === 0 && (
                <p className="texte-vide-centre">{t.aucunMessageTexte ?? 'Aucun message pour l\'instant.'}</p>
            )}

            <div className="moi-discussions-list">
                {conversations.map((conv) => (
                    <div
                        key={conv.pseudo}
                        className="moi-discussion-item"
                        role="button"
                        onClick={() => navigate(`/mode-reel/messages/${conv.pseudo}`, { state: { prenom: conv.prenom } })}
                    >
                        <div className="moi-discussion-avatar rencontre-avatar-lettre">
                            {conv.prenom[0]?.toUpperCase()}
                        </div>
                        <div className="info-discussion-info">
                            <div className="moi-discussion-title">
                                {conv.prenom}
                                {conv.nonLus > 0 && <span className="rencontre-conversation-non-lus">{conv.nonLus}</span>}
                            </div>
                            <div className="moi-discussion-preview">{conv.dernierMessage}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default RencontreMessagesPage;
