/* src/pages/RencontreConversationPage.tsx */
import React, { useEffect, useRef, useState } from 'react';
import * as RouterDom from 'react-router-dom';
import { useUiLang, useThemeAssets, HeaderRetour, BanniereTitre } from '../communs';
import { chargerPseudo } from '../utils/pseudo';
import ActionsBlocageSignalement from '../components/ActionsBlocageSignalement';
import type { MessageRencontre } from '../utils/rencontre';
import { obtenirMessagesRencontre, envoyerMessageRencontre } from '../utils/rencontre';

// Conversation avec un vrai compte (voir compteurs_visites.md) - barre de
// saisie fixe collée au clavier, avec les messages dans une boîte blanche
// (voir .rencontre-conversation-box) plutôt que sur le fond du thème. Le
// positionnement de la barre au-dessus du clavier est purement CSS (voir
// .personnage-chat-input-bar dans base.css) : android:windowSoftInputMode
// ="adjustResize" (AndroidManifest.xml) redimensionne déjà réellement la
// fenêtre à l'ouverture du clavier, donc une simple position fixe suffit
// sans recalcul JS de la hauteur du clavier.
const RencontreConversationPage: React.FC = () => {
    const { pseudo: autrePseudo } = RouterDom.useParams<{ pseudo: string }>();
    const location = RouterDom.useLocation();
    const navigate = RouterDom.useNavigate();
    // Transmis par RencontreMessagesPage/RencontreProfilPage (voir leur
    // navigate) - à défaut (arrivée directe sur l'URL, ex. rafraîchissement),
    // affiche le pseudo plutôt que de refaire un appel serveur juste pour ça.
    const autrePrenom = (location.state as { prenom?: string } | null)?.prenom ?? autrePseudo;
    const t = useUiLang();
    const assets = useThemeAssets();
    const [monPseudo] = useState(() => chargerPseudo());
    const [messages, setMessages] = useState<MessageRencontre[]>([]);
    const [draft, setDraft] = useState('');
    const [envoiEnCours, setEnvoiEnCours] = useState(false);
    const [chargement, setChargement] = useState(true);
    const [erreur, setErreur] = useState<string | null>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!autrePseudo) return;
        (async () => {
            try {
                setMessages(await obtenirMessagesRencontre(autrePseudo));
            } catch {
                // Conversation vide en cas d'échec (ex. hors-ligne).
            } finally {
                setChargement(false);
            }
        })();
    }, [autrePseudo]);

    useEffect(() => {
        const idFrame = requestAnimationFrame(() => {
            chatEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
        });
        return () => cancelAnimationFrame(idFrame);
    }, [messages]);

    const handleSend = async () => {
        const texte = draft.trim();
        if (!texte || envoiEnCours || !autrePseudo) return;
        setEnvoiEnCours(true);
        setDraft('');
        setErreur(null);
        try {
            const message = await envoyerMessageRencontre(autrePseudo, texte);
            setMessages((prev) => [...prev, message]);
        } catch (err) {
            setDraft(texte);
            setErreur(err instanceof Error ? err.message : 'Échec de l\'envoi.');
        } finally {
            setEnvoiEnCours(false);
        }
    };

    if (chargement) return null;

    return (
        // Même conteneur à deux niveaux que PersonnagePage.tsx
        // (page-content-container personnage-page > personnage-content) -
        // RencontreConversationPage utilisait à tort .personnage-content
        // seule comme racine, ce qui la privait du padding-top/bottom et du
        // padding latéral que .page-content-container/.personnage-page
        // portent normalement (titre collé en haut, bulles sans marge).
        <div className="page-content-container personnage-page rencontre-conversation-page">
            <div className="personnage-content">
            <HeaderRetour>
            {autrePseudo && (
                <ActionsBlocageSignalement
                pseudo={autrePseudo}
                variante="compact"
                onBloque={() => navigate('/mode-reel/messages', { replace: true })}
                />
            )}
            </HeaderRetour>
                <BanniereTitre texte={autrePrenom ?? 'Profil'} />

                {/* Boîte blanche façon "page" (comme le reste de la section
                    Personne réelle) plutôt que les bulles flottant
                    directement sur le fond du thème, propre aux
                    conversations IA. */}
                <div className="create-box rencontre-conversation-box">
                    <div className="personnage-chat">
                        {messages.map((message) => (
                            <div
                                key={message.id}
                                className={`personnage-bubble-group${
                                    message.de === monPseudo ? ' personnage-bubble-group-user' : ' personnage-bubble-group-character'
                                }`}
                            >
                                <div className="personnage-bubble-column">
                                    <div
                                        className={`create-box personnage-bubble ${
                                            message.de === monPseudo ? 'personnage-user-box' : 'personnage-salutation-box'
                                        }`}
                                    >
                                        <p className="personnage-field-text">{message.texte}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                        <div ref={chatEndRef} className="personnage-chat-end" />
                    </div>
                </div>

                {erreur && <p className="compte-erreur-texte">{erreur}</p>}
            </div>

            <div className="personnage-chat-input-bar">
                <input
                    type="text"
                    className="personnage-chat-input"
                    placeholder={t.ecrireMessage}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
                    spellCheck={false}
                />
                <button type="button" className="personnage-chat-send" onClick={handleSend} disabled={envoiEnCours}>
                    <img src={assets.fleche} alt="" />
                </button>
            </div>
        </div>
    );
};

export default RencontreConversationPage;
