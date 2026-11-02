/* src/pages/PersonnagePage.tsx */
import React, { useEffect, useRef, useState } from 'react';
import * as RouterDom from 'react-router-dom';
import { useTheme } from '../context/theme';
import { useUiLang, useThemeAssets, BanniereTitre } from '../communs';
import NavArrow from '../components/NavArrow';
import { askCharacterReply, demanderMiseAJourEtat, etatDeltaVide, plierEtatDeltas, type EtatDelta } from '../utils/chat';
import { useAvatarUtilisateur } from '../utils/useAvatarUtilisateur';
import { resoudreProfilPourEnvoi } from '../utils/profilConversation';
import { chargerVoixPersonnage } from '../utils/voixPersonnage';
import { trouverParametresVoix, type VoixChoisie } from '../utils/voix';
import { getDeviceId } from '../utils/deviceId';
import Voice from '../plugins/voice';
import { envoyerSignalement } from '../utils/signalements';
import { useTraductionCreation } from '../utils/traduction';

interface PersonnageState {
    creation?: {
        id: number;
        title: string;
        imageUrl: string;
        avatarUrl?: string;
        bio?: string;
        description?: string;
        histoire?: string;
        salutation?: string;
        creatorId?: string;
        creatorPseudo?: string;
        voix?: VoixChoisie | null;
    };
}

interface ChatMessage {
    id: number;
    sender: 'character' | 'user';
    text: string;
    // Delta d'état associé à ce message (uniquement pour les messages du
    // personnage) ; sert à reconstruire la fiche d'état par pliage.
    etatDelta?: EtatDelta;
}

// Historique des conversations conservé localement sur l'appareil (propre à
// chaque téléphone, pas partagé sur le serveur).
const chatStorageKey = (id: number) => `realornot-chat-${id}`;

const loadStoredMessages = (id: number | undefined, salutation?: string): ChatMessage[] => {
    if (id === undefined) return [];
    try {
        const raw = localStorage.getItem(chatStorageKey(id));
        if (raw) return JSON.parse(raw);
    } catch {
        // ignore, on repart d'une conversation vierge
    }
    return salutation ? [{ id: 0, sender: 'character', text: salutation }] : [];
};

// Reconstitue la fiche d'état actuelle en pliant, dans l'ordre, les deltas
// de tous les messages du personnage.
const plierEtatMessages = (msgs: ChatMessage[]) =>
    plierEtatDeltas(msgs.filter((m) => m.sender === 'character').map((m) => m.etatDelta ?? etatDeltaVide()));

const IconReload: React.FC = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12a9 9 0 1 1-3-6.7" />
        <polyline points="21 3 21 9 15 9" />
    </svg>
);

const IconPencil: React.FC = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
);

const IconHautParleur: React.FC = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
);

const IconCopier: React.FC = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
);

// Convention d'écriture : un passage entre * est une action ou une pensée
// intime (ex. "*je m'assois sur le canapé*"), distincte du dialogue parlé
// autour - affiché en italique discret (voir .personnage-texte-action dans
// le CSS), astérisques conservés de part et d'autre pour rester visible que
// c'est une action/pensée. Le personnage applique la même convention côté
// serveur (voir system_prompt).
const ACTION_RE = /\*(.+?)\*/g;

const rendreTexteAvecActions = (texte: string): React.ReactNode[] => {
    const parties: React.ReactNode[] = [];
    let dernierIndex = 0;
    let cle = 0;
    for (const match of texte.matchAll(ACTION_RE)) {
        const debut = match.index ?? 0;
        if (debut > dernierIndex) {
            parties.push(texte.slice(dernierIndex, debut));
        }
        parties.push(
            <em key={cle++} className="personnage-texte-action">{`*${match[1]}*`}</em>
        );
        dernierIndex = debut + match[0].length;
    }
    if (dernierIndex < texte.length) {
        parties.push(texte.slice(dernierIndex));
    }
    return parties;
};

const PersonnagePage: React.FC = () => {
    const t = useUiLang();
    const assets = useThemeAssets();
    const { lang } = useTheme();
    const location = RouterDom.useLocation();
    const navigate = RouterDom.useNavigate();
    const state = (location.state || {}) as PersonnageState;
    const creation = state.creation;

    const hasImage = creation?.imageUrl && creation.imageUrl !== 'placeholder';

    // Voix choisie pour ce personnage, envoyée par le serveur comme le reste
    // du personnage (partagée entre tous les téléphones). Repli sur l'ancien
    // stockage local de l'appareil pour les personnages modifiés avant
    // l'ajout de ce champ côté serveur ; null si aucune voix n'a jamais été
    // assignée.
    const [parametresVoix] = useState(() => {
        if (creation?.id === undefined) return null;
        const voixChoisie = creation.voix ?? chargerVoixPersonnage(creation.id);
        return voixChoisie ? trouverParametresVoix(voixChoisie.cle) : null;
    });

    const lireMessage = (texte: string) => {
        if (!parametresVoix) return;
        // Annonce le début/la fin d'une action ou pensée à voix haute,
        // puisque l'italique qui les distingue à l'écran ne se voit pas à
        // l'oral - sans ça, un auditeur ne peut pas savoir que ce passage
        // n'est pas du dialogue parlé.
        const texteAnnonce = texte.replace(/\*(.+?)\*/g, 'action, $1, fin action,');
        Voice.speak({
            text: texteAnnonce,
            pitch: parametresVoix.pitch,
            rate: parametresVoix.rate,
            voiceName: parametresVoix.voiceName,
            langueTag: t.langueCode,
        }).catch((err) => console.log('Lecture de la voix échouée', err));
    };

    const [messages, setMessages] = useState<ChatMessage[]>(() =>
        loadStoredMessages(creation?.id, creation?.salutation)
    );
    const [draft, setDraft] = useState('');
    const [isWaitingReply, setIsWaitingReply] = useState(false);
    const [regeneratingId, setRegeneratingId] = useState<number | null>(null);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editDraft, setEditDraft] = useState('');
    // Messages utilisateur envoyés au serveur mais restés sans réponse
    // (erreur ou réponse vide après retries côté serveur). Un message
    // marqué ici n'est jamais renvoyé au serveur dans l'historique d'un
    // appel suivant tant qu'il n'a pas été rejoué avec succès (voir
    // handleRetryUserMessage) : sinon plusieurs questions sans réponse
    // s'empilent comme autant de tours "user" consécutifs dans l'historique,
    // et le petit modèle local finit par essayer de répondre à toutes à la
    // fois dans un seul message fourre-tout.
    const [failedMessageIds, setFailedMessageIds] = useState<Set<number>>(new Set());
    const [photoRevelee, setPhotoRevelee] = useState(false);
    const revealTimerRef = useRef<number | null>(null);
    // Heure du dernier appui pendant que le texte est caché : sert à repérer le double appui qui le fait réapparaître.
    const dernierAppuiRef = useRef(0);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const chatInputRef = useRef<HTMLTextAreaElement>(null);
    const avatarUtilisateur = useAvatarUtilisateur();
    // Repli sur l'image complète si le recadrage automatique du visage a
    // échoué à la création (creerAvatarDepuisPhoto renvoie alors avatarUrl
    // vide - fréquent sur une image stylisée où aucun visage n'est détecté) :
    // mieux vaut un avatar non recadré que pas d'avatar du tout à côté des
    // bulles.
    const avatarPersonnage = creation?.avatarUrl
        || (creation?.imageUrl && creation.imageUrl !== 'placeholder' ? creation.imageUrl : undefined);
    // Le créateur du personnage accède à la page complète "Votre profil pour
    // cette conversation" ; les autres utilisateurs à une page simplifiée.
    const estCreateur = !creation?.creatorId || creation.creatorId === getDeviceId();
    // Traduction à la volée du nom/histoire/salutation pour les visiteurs
    // (inutile pour le créateur, qui les voit déjà dans sa propre langue).
    const traduit = useTraductionCreation(creation, lang, !estCreateur);

    // Recale le message d'accueil affiché sur la salutation actuelle
    // (traduite si besoin) tant qu'aucune vraie conversation n'a commencé
    // (un seul message, celui d'accueil par défaut) - couvre aussi bien
    // l'arrivée tardive d'une traduction (appel réseau asynchrone) qu'une
    // salutation mise en cache localement avec un texte périmé (ex : une
    // ancienne traduction erronée enregistrée avant un correctif serveur).
    // Déclenché uniquement quand traduit.salutation change réellement (valeur
    // précédente suivie via useState, initialisée à null pour forcer une
    // première vérification) plutôt qu'à chaque rendu : sinon l'appel à
    // setMessages pendant le rendu se redéclenche indéfiniment ("Too many
    // re-renders", React #301) au lieu de converger.
    const [salutationVerifiee, setSalutationVerifiee] = useState<string | null>(null);
    if (creation && traduit.salutation && traduit.salutation !== salutationVerifiee) {
        setSalutationVerifiee(traduit.salutation);
        setMessages((prev) => (
            prev.length === 1 && prev[0].id === 0 && prev[0].sender === 'character' && prev[0].text !== traduit.salutation
                ? [{ ...prev[0], text: traduit.salutation }]
                : prev
        ));
    }

    const [signalementOuvert, setSignalementOuvert] = useState(false);
    const [motifChoisi, setMotifChoisi] = useState<string | null>(null);
    const [commentaireSignalement, setCommentaireSignalement] = useState('');
    const [envoiEnCours, setEnvoiEnCours] = useState(false);
    const [signalementConfirme, setSignalementConfirme] = useState(false);
    // Vrai pendant l'animation de descente de la fenêtre « Signaler » (avant qu'elle soit retirée).
    const [signalementSortie, setSignalementSortie] = useState(false);

    const motifs = [
        t.motifContenuSexuel,
        t.motifSuicideAutomutilation,
        t.motifSecuriteEnfants,
        t.motifHarcelement,
        t.motifDiscoursHaineux,
        t.motifAutre,
    ];

    // Ferme la fenêtre « Signaler » : la fait d'abord redescendre (0,3 s, même durée que l'animation CSS),
    // puis la retire et remet les champs à zéro.
    const fermerSignalement = () => {
        if (signalementSortie) return; // fermeture déjà en cours
        setSignalementSortie(true);
        window.setTimeout(() => {
            setSignalementOuvert(false);
            setMotifChoisi(null);
            setCommentaireSignalement('');
            setSignalementConfirme(false);
            setSignalementSortie(false);
        }, 300);
    };

    const handleEnvoyerSignalement = async () => {
        if (!motifChoisi || envoiEnCours) return;
        setEnvoiEnCours(true);
        try {
            await envoyerSignalement({
                creationId: creation?.id,
                creationTitle: creation?.title || '',
                motif: motifChoisi,
                commentaire: commentaireSignalement.trim(),
            });
            setSignalementConfirme(true);
        } catch (err) {
            console.log('Signalement échoué', err);
        } finally {
            setEnvoiEnCours(false);
        }
    };

    useEffect(() => {
        if (creation?.id === undefined) return;
        localStorage.setItem(chatStorageKey(creation.id), JSON.stringify(messages));
    }, [messages, creation?.id]);

    useEffect(() => {
        // Défilement instantané (un défilement "smooth" prend du temps et,
        // si un second défilement se déclenche entre-temps - ex. la réponse
        // qui arrive juste après l'indicateur "en train d'écrire" -,
        // l'animation s'interrompt en cours de route avant d'atteindre le bas).
        // Attend le prochain frame : à l'ouverture de la page, le bandeau/les
        // bulles ne sont pas encore mis en page au moment où cet effet se
        // déclenche, et scrollIntoView calculerait sa position sur une
        // hauteur de page pas encore définitive (on reste alors coincé en haut).
        const idFrame = requestAnimationFrame(() => {
            chatEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
        });
        return () => cancelAnimationFrame(idFrame);
    }, [messages, isWaitingReply]);

    useEffect(() => {
        // Quand le clavier virtuel apparaît/disparaît, la hauteur visible
        // de la page change (visualViewport) sans que 'messages' ne change
        // - sans ce second effet, le dernier message reste caché sous le
        // clavier jusqu'au prochain envoi.
        const viewport = window.visualViewport;
        if (!viewport) return;
        const surRedimensionnement = () => {
            chatEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
        };
        viewport.addEventListener('resize', surRedimensionnement);
        return () => viewport.removeEventListener('resize', surRedimensionnement);
    }, []);

    // Genre/caractère à envoyer au personnage : celui propre à cette
    // conversation s'il a été personnalisé, sinon le profil global "moi".
    const construireProfilUtilisateur = () => resoudreProfilPourEnvoi(creation?.id, t.genres);

    // Ne garde, pour l'envoi au serveur, que les messages déjà aboutis
    // (jamais un message resté sans réponse) plus le message qu'on est en
    // train d'envoyer/rejouer (identifié par messageIdEnCours) - voir la
    // note sur failedMessageIds plus haut.
    const historiquePourEnvoi = (tousLesMessages: ChatMessage[], messageIdEnCours: number) =>
        tousLesMessages.filter((m) => m.id === messageIdEnCours || !failedMessageIds.has(m.id));

    // Insère * autour du texte au point du curseur :
    // - s'il y a une sélection, elle est entourée directement ;
    // - sinon, entoure toute la phrase en cours juste avant le curseur
    //   (depuis le dernier point/!/?, pas juste le dernier mot) ;
    // - sinon (rien à entourer, curseur en zone vide), insère une paire *
    //   vide avec le curseur placé au milieu, prêt à taper dedans.
    const handleInsererAsterisques = () => {
        const champ = chatInputRef.current;
        if (!champ) {
            setDraft((prev) => `${prev}*`);
            return;
        }
        const debut = champ.selectionStart ?? draft.length;
        const fin = champ.selectionEnd ?? draft.length;

        if (debut !== fin) {
            const texteSelectionne = draft.slice(debut, fin);
            const nouveauTexte = `${draft.slice(0, debut)}*${texteSelectionne}*${draft.slice(fin)}`;
            setDraft(nouveauTexte);
            const positionCurseur = debut + 1 + texteSelectionne.length + 1;
            requestAnimationFrame(() => {
                champ.focus();
                champ.setSelectionRange(positionCurseur, positionCurseur);
            });
            return;
        }

        // Recule jusqu'à la dernière ponctuation de fin de phrase (. ! ?)
        // ou jusqu'au tout début du texte, puis ignore les espaces de tête.
        let debutPhrase = debut;
        // Si le curseur est juste après un point/!/? (cas le plus courant :
        // on vient de finir sa phrase), ce caractère termine la phrase à
        // entourer, pas une nouvelle phrase vide - on recule d'abord dessus
        // avant de chercher la VRAIE ponctuation de la phrase précédente,
        // sinon la boucle s'arrêtait immédiatement et n'entourait rien.
        if (debutPhrase > 0 && '.!?'.includes(draft[debutPhrase - 1])) {
            debutPhrase -= 1;
        }
        while (debutPhrase > 0 && !'.!?'.includes(draft[debutPhrase - 1])) {
            debutPhrase -= 1;
        }
        while (debutPhrase < debut && /\s/.test(draft[debutPhrase])) {
            debutPhrase += 1;
        }
        const phraseAvantCurseur = draft.slice(debutPhrase, debut);

        if (phraseAvantCurseur) {
            const nouveauTexte = `${draft.slice(0, debutPhrase)}*${phraseAvantCurseur}*${draft.slice(debut)}`;
            setDraft(nouveauTexte);
            const positionCurseur = debutPhrase + 1 + phraseAvantCurseur.length + 1;
            requestAnimationFrame(() => {
                champ.focus();
                champ.setSelectionRange(positionCurseur, positionCurseur);
            });
            return;
        }

        const nouveauTexte = `${draft.slice(0, debut)}**${draft.slice(debut)}`;
        setDraft(nouveauTexte);
        const positionCurseur = debut + 1;
        requestAnimationFrame(() => {
            champ.focus();
            champ.setSelectionRange(positionCurseur, positionCurseur);
        });
    };

    const handleSend = async () => {
        const text = draft.trim();
        if (!text || isWaitingReply || !creation) return;

        const userMessage: ChatMessage = { id: messages.length, sender: 'user', text };
        const updatedMessages = [...messages, userMessage];
        setMessages(updatedMessages);
        setDraft('');
        setIsWaitingReply(true);

        try {
            const envoi = historiquePourEnvoi(updatedMessages, userMessage.id);
            const { reply, etatDelta } = await askCharacterReply({
                name: creation.title,
                bio: creation.bio,
                description: creation.description,
                histoire: creation.histoire,
                salutation: creation.salutation,
                history: envoi.map((m) => ({ sender: m.sender, text: m.text })),
                etat: plierEtatMessages(envoi),
                profilUtilisateur: construireProfilUtilisateur(),
                lang,
            });
            setMessages((prev) => [...prev, { id: prev.length, sender: 'character', text: reply, etatDelta }]);
            setFailedMessageIds((prev) => {
                if (!prev.has(userMessage.id)) return prev;
                const next = new Set(prev);
                next.delete(userMessage.id);
                return next;
            });
        } catch (err) {
            console.log('Réponse du personnage échouée', err);
            // Le message reste visible dans la conversation mais marqué en
            // échec (bulle "Réessayer") plutôt que silencieusement ignoré :
            // sans ça, l'utilisateur ne voit rien se passer et retape une
            // nouvelle question, qui vient s'empiler sur celle-ci côté
            // historique envoyé au serveur.
            setFailedMessageIds((prev) => new Set(prev).add(userMessage.id));
        } finally {
            setIsWaitingReply(false);
        }
    };

    const handleRetryUserMessage = async (messageId: number) => {
        if (isWaitingReply || !creation) return;
        const index = messages.findIndex((m) => m.id === messageId);
        if (index === -1) return;

        setIsWaitingReply(true);
        try {
            const envoi = historiquePourEnvoi(messages.slice(0, index + 1), messageId);
            const { reply, etatDelta } = await askCharacterReply({
                name: creation.title,
                bio: creation.bio,
                description: creation.description,
                histoire: creation.histoire,
                salutation: creation.salutation,
                history: envoi.map((m) => ({ sender: m.sender, text: m.text })),
                etat: plierEtatMessages(envoi),
                profilUtilisateur: construireProfilUtilisateur(),
                lang,
            });
            setMessages((prev) => [...prev, { id: prev.length, sender: 'character', text: reply, etatDelta }]);
            setFailedMessageIds((prev) => {
                const next = new Set(prev);
                next.delete(messageId);
                return next;
            });
        } catch (err) {
            console.log('Nouvelle tentative échouée', err);
            // Reste marqué en échec : le bouton "Réessayer" reste disponible.
        } finally {
            setIsWaitingReply(false);
        }
    };

    const handleRegenerate = async (messageId: number) => {
        if (!creation || regeneratingId !== null || isWaitingReply) return;
        const index = messages.findIndex((m) => m.id === messageId);
        if (index === -1) return;

        const historyBefore = messages.slice(0, index);
        setRegeneratingId(messageId);

        try {
            // creationId permet au serveur de compter ce message dans le compteur du personnage (vignette).
            const { reply, etatDelta } = await askCharacterReply({
                creationId: creation.id,
                name: creation.title,
                bio: creation.bio,
                description: creation.description,
                histoire: creation.histoire,
                salutation: creation.salutation,
                history: historyBefore.map((m) => ({ sender: m.sender, text: m.text })),
                etat: plierEtatMessages(historyBefore),
                profilUtilisateur: construireProfilUtilisateur(),
                lang,
            });
            // Remplace entièrement le delta de cet échange (pas d'addition à l'ancien).
            setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, text: reply, etatDelta } : m)));
        } catch (err) {
            console.log('Régénération échouée', err);
        } finally {
            setRegeneratingId(null);
        }
    };

    const handleStartEdit = (message: ChatMessage) => {
        setEditingId(message.id);
        setEditDraft(message.text);
    };

    const handleCopierMessage = (texte: string) => {
        navigator.clipboard?.writeText(texte).catch((err) => console.log('Copie échouée', err));
    };





    const handleCancelEdit = () => {
        setEditingId(null);
        setEditDraft('');
    };

    const handleSaveEdit = () => {
        if (editingId === null || !creation) return;
        const messageId = editingId;
        const text = editDraft.trim();
        setEditingId(null);
        setEditDraft('');
        if (!text) return;

        setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, text } : m)));

        // Met à jour silencieusement la fiche d'état après une édition manuelle,
        // sans afficher ni le texte de l'édition ni une nouvelle réponse. Le
        // serveur analyse le texte édité en mode technique (pas de jeu de
        // rôle) pour ne pas confondre la consigne avec du dialogue.
        const index = messages.findIndex((m) => m.id === messageId);
        if (index === -1) return;
        const historyBefore = messages.slice(0, index);

        demanderMiseAJourEtat({
            name: creation.title,
            bio: creation.bio,
            description: creation.description,
            histoire: creation.histoire,
            history: historyBefore.map((m) => ({ sender: m.sender, text: m.text })),
            etat: plierEtatMessages(historyBefore),
            profilUtilisateur: construireProfilUtilisateur(),
            texteModifie: text,
        })
            .then((etatDelta) => {
                setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, etatDelta } : m)));
            })
            .catch((err) => console.log('Mise à jour silencieuse de l\'état échouée', err));
    };

    // Éléments "texte" sur lesquels un appui ne doit PAS déclencher la
    // révélation de la photo (bulles de dialogue, saisie, boutons, titres),
    // pour ne pas gêner leur usage normal (lecture, édition, navigation).
    const PRESS_EXCLUDED_SELECTOR =
        'button, input, textarea, .personnage-bubble, .personnage-chat-input-bar, .create-banner-title, .personnage-histoire-box';

    const annulerRevelationEnAttente = () => {
        if (revealTimerRef.current !== null) {
            window.clearTimeout(revealTimerRef.current);
            revealTimerRef.current = null;
        }
    };

    // Appui long de 2 secondes : cache le texte pour voir la photo. Le texte reste caché
    // quand on lâche l'écran. Pour le faire réapparaître : double appui (2 appuis rapprochés).
    const handlePressStart = (e: React.PointerEvent<HTMLDivElement>) => {
        if (photoRevelee) {
            // Texte caché : un deuxième appui dans les 400 ms le fait réapparaître.
            const maintenant = Date.now();
            if (maintenant - dernierAppuiRef.current < 400) {
                setPhotoRevelee(false);
                dernierAppuiRef.current = 0;
            } else {
                dernierAppuiRef.current = maintenant;
            }
            return;
        }
        if ((e.target as HTMLElement).closest(PRESS_EXCLUDED_SELECTOR)) return;
        annulerRevelationEnAttente();
        revealTimerRef.current = window.setTimeout(() => {
            setPhotoRevelee(true);
            revealTimerRef.current = null;
        }, 2000); // durée de l'appui long : 2 secondes
    };

    // Relâcher l'écran annule seulement l'appui long en cours : ça ne fait plus réapparaître le texte.
    const handlePressEnd = () => {
        annulerRevelationEnAttente();
    };

    useEffect(() => annulerRevelationEnAttente, []);

    return (
        <div
            className="page-content-container personnage-page"
            onPointerDown={handlePressStart}
            onPointerUp={handlePressEnd}
            onPointerLeave={handlePressEnd}
            onPointerCancel={handlePressEnd}
        >
            {hasImage && (
                <div
                    className="personnage-bg"
                    style={{ backgroundImage: `url(${creation!.imageUrl})` }}
                />
            )}

            <div className={`personnage-content${photoRevelee ? ' personnage-content-masque' : ''}`}>
                <div className="personnage-header-fixed">
                    <NavArrow direction="back" />

                    {!estCreateur && (
                        <button
                            type="button"
                            className="signaler-btn"
                            onClick={() => setSignalementOuvert(true)}
                            aria-label={t.signalerBouton}
                        >
                            <img src={assets.drapeau} alt="" className="signaler-btn-img" />
                        </button>
                    )}

                    {creation?.creatorPseudo && (
                        <div className="personnage-creator-banner">
                            {t.personnageCreeParIA}
                        </div>
                    )}
                </div>

                <BanniereTitre texte={traduit.title}>
                    {creation && avatarUtilisateur && (
                        <button
                            type="button"
                            className="personnage-user-avatar-banner-btn"
                            /* Créateur : ouvre "Détails du personnage" en mode modification ; autres utilisateurs : page "Mon profil" simplifiée */
                            onClick={() => (estCreateur
                                ? navigate('/creer/personnage', { state: { creationExistante: creation, depuisDiscussion: true } }) // depuisDiscussion : permet d'afficher "Recommencer la conversation" dans Détails du personnage
                                : navigate(`/personnage/${creation.id}/utilisateur`, { state: { creation } })
                            )}
                            aria-label={t.modifierProfilConversation}
                        >
                            <img src={avatarUtilisateur} alt="" className="personnage-user-avatar-banner-img" />
                            <span className="personnage-user-avatar-pencil">
                                <IconPencil />
                            </span>
                        </button>
                    )}
                </BanniereTitre>

                <div className="create-buttons">
                    {creation?.histoire && (
                        <div className="create-box personnage-histoire-box">
                            <p className="personnage-field-text">{traduit.histoire}</p>
                        </div>
                    )}

                    <div className="personnage-chat">
                        {messages.map((message) => {
                        return (
                            <div
                                key={message.id}
                                className={`personnage-bubble-group${
                                    message.sender === 'user' ? ' personnage-bubble-group-user' : ' personnage-bubble-group-character'
                                }`}
                            >
                                {message.sender === 'character' && avatarPersonnage && (
                                    <img src={avatarPersonnage} alt="" className="personnage-character-avatar" />
                                )}
                                <div className="personnage-bubble-column">
                                    <div
                                        className={`create-box personnage-bubble ${
                                            message.sender === 'character'
                                                ? 'personnage-salutation-box'
                                                : 'personnage-user-box'
                                        } ${editingId === message.id ? 'personnage-bubble-editing' : ''}`}

                                    >
                                        {editingId === message.id ? (
                                            <textarea
                                                className="personnage-edit-textarea"
                                                value={editDraft}
                                                onChange={(e) => setEditDraft(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && !e.shiftKey) {
                                                        e.preventDefault();
                                                        handleSaveEdit();
                                                    }
                                                }}
                                                autoFocus
                                            />
                                        ) : regeneratingId === message.id ? (
                                            <span className="personnage-typing-inline">
                                                <span className="personnage-typing-dot" />
                                                <span className="personnage-typing-dot" />
                                                <span className="personnage-typing-dot" />
                                            </span>
                                        ) : (
                                            <p className="personnage-field-text">{rendreTexteAvecActions(message.text)}</p>
                                        )}
                                        {message.sender === 'character' && editingId === message.id && (
                                            <div className="personnage-bubble-actions">
                                                <button
                                                    type="button"
                                                    className="personnage-bubble-action-btn personnage-bubble-text-btn"
                                                    onClick={handleCancelEdit}
                                                >
                                                    {t.annuler}
                                                </button>
                                                <button
                                                    type="button"
                                                    className="personnage-bubble-action-btn personnage-bubble-text-btn personnage-bubble-save-btn"
                                                    onClick={handleSaveEdit}
                                                >
                                                    {t.enregistrer}
                                                </button>
                                            </div>
                                        )}
                                        {editingId !== message.id && ( // boutons haut-parleur, relancer, crayon et copier : sous tous les messages (IA et utilisateur)
                                            <div className="personnage-bubble-actions">
                                            {parametresVoix && (
                                                    <button
                                                        type="button"
                                                        className="personnage-bubble-action-btn personnage-bubble-action-voix"
                                                        onClick={() => lireMessage(message.text)}
                                                        aria-label={t.ecouter}
                                                    >
                                                        <IconHautParleur />
                                                    </button>
                                                )}
                                                {/* Relancer : seulement sous les messages du personnage (l'utilisateur n'a pas besoin de recharger ses propres messages) */}
                                                {message.sender === 'character' && (
                                                    <button
                                                    type="button"
                                                    className="personnage-bubble-action-btn"
                                                    onClick={() => handleRegenerate(message.id)}
                                                    disabled={regeneratingId !== null || isWaitingReply}
                                                    aria-label={t.regenerer}
                                                    >
                                                    <IconReload />
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    className="personnage-bubble-action-btn"
                                                    onClick={() => handleStartEdit(message)}
                                                    disabled={regeneratingId !== null || isWaitingReply}
                                                    aria-label={t.modifierMessage}
                                                    >
                                                    <IconPencil />
                                                    </button>
                                                    {/* Bouton copier : copie le texte de ce message, toujours visible à droite du crayon */}
                                                    <button
                                                    type="button"
                                                    className="personnage-bubble-action-btn"
                                                    onClick={() => handleCopierMessage(message.text)}
                                                    aria-label={t.copierMessage}
                                                    >
                                                    <IconCopier />
                                                    </button>
                                            </div>
                                        )}
                                    </div>
                                    {message.sender === 'user' && failedMessageIds.has(message.id) && (
                                        <div className="personnage-bubble-erreur">
                                            <span className="personnage-bubble-erreur-texte">
                                                Le personnage n'a pas pu répondre.
                                            </span>
                                            <button
                                                type="button"
                                                className="personnage-bubble-action-btn personnage-bubble-text-btn"
                                                onClick={() => handleRetryUserMessage(message.id)}
                                                disabled={isWaitingReply}
                                            >
                                                Réessayer
                                            </button>
                                        </div>
                                    )}
                                </div>
                                {message.sender === 'user' && avatarUtilisateur && (
                                    <img src={avatarUtilisateur} alt="" className="personnage-user-avatar" />
                                )}
                            </div>
                        );
                        })}
                        {isWaitingReply && (
                            <div className="personnage-bubble-group personnage-bubble-group-character">
                                {avatarPersonnage && (
                                    <img src={avatarPersonnage} alt="" className="personnage-character-avatar" />
                                )}
                                <div className="create-box personnage-bubble personnage-salutation-box personnage-typing">
                                    <span className="personnage-typing-dot" />
                                    <span className="personnage-typing-dot" />
                                    <span className="personnage-typing-dot" />
                                </div>
                            </div>
                        )}
                        <div ref={chatEndRef} className="personnage-chat-end" />
                    </div>
                </div>
            </div>





            <div className={`personnage-chat-input-bar${photoRevelee ? ' personnage-chat-input-bar-masque' : ''}`}>
                <div className="personnage-chat-input-wrapper">
                    <textarea
                        ref={chatInputRef}
                        className="personnage-chat-input personnage-chat-input-textarea"
                        placeholder={t.ecrireA.replace('{nom}', creation?.title ?? '')} // « Écrire à Arlette... » : le nom de l'IA remplace {nom}
                        value={draft}
                        rows={2}
                        disabled={editingId !== null}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                    />
                    <button
                        type="button"
                        className="personnage-chat-insert-asterisques"
                        onClick={handleInsererAsterisques}
                        aria-label="Insérer une action ou une pensée entre *"
                        disabled={editingId !== null}
                    >
                        **
                    </button>
                </div>
                <button type="button" className="personnage-chat-send" onClick={handleSend} disabled={isWaitingReply || editingId !== null}>
                    <img src={assets.fleche} alt="" />
                </button>
            </div>

            {signalementOuvert && (
                <div className={`update-prompt-overlay signaler-feuille-overlay${signalementSortie ? ' signaler-feuille-overlay-sortie' : ''}`}>
                <div className={`update-prompt-box signaler-feuille${signalementSortie ? ' signaler-feuille-sortie' : ''}`}>
                        {signalementConfirme ? (
                            <p className="update-prompt-text">{t.signalementEnvoye}</p>
                        ) : (
                            <>
                                <p className="update-prompt-text">{t.signalerTitre}</p>
                                <div className="signaler-motifs">
                                    {motifs.map((motif) => (
                                        <button
                                            key={motif}
                                            type="button"
                                            className={`signaler-motif-btn${motifChoisi === motif ? ' signaler-motif-btn-actif' : ''}`}
                                            onClick={() => setMotifChoisi(motif)}
                                        >
                                            {motif}
                                        </button>
                                    ))}
                                </div>
                                <textarea
                                    className="moi-champ signaler-commentaire"
                                    placeholder={t.signalerCommentairePlaceholder}
                                    value={commentaireSignalement}
                                    onChange={(e) => setCommentaireSignalement(e.target.value)}
                                    rows={3}
                                    maxLength={300}
                                />
                            </>
                        )}
                        <div className="update-prompt-actions">
                            {signalementConfirme ? (
                                <button
                                    type="button"
                                    className="update-prompt-btn update-prompt-btn-primary"
                                    onClick={fermerSignalement}
                                >
                                    {t.valider}
                                </button>
                            ) : (
                                <>
                                    <button
                                        type="button"
                                        className="update-prompt-btn update-prompt-btn-secondary"
                                        onClick={fermerSignalement}
                                        disabled={envoiEnCours}
                                    >
                                        {t.annuler}
                                    </button>
                                    <button
                                        type="button"
                                        className="update-prompt-btn update-prompt-btn-primary"
                                        onClick={handleEnvoyerSignalement}
                                        disabled={!motifChoisi || envoiEnCours}
                                    >
                                        {t.envoyer}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PersonnagePage;
