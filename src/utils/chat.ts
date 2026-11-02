/* src/utils/chat.ts */
import { SERVER_BASE_URL } from '../config';

export interface ChatHistoryEntry {
    sender: 'character' | 'user';
    text: string;
}

// Delta d'état extrait du tag [ÉTAT: ...] d'une réponse du personnage.
// Champs vides = pas de changement pour ce champ sur cet échange.
export interface EtatDelta {
    lieu: string;
    objetUtilisateurAjoute: string;
    objetPersonnageAjoute: string;
    fait: string;
}

// Le modèle respecte presque toujours la consigne d'un seul astérisque de
// chaque côté d'une action/pensée (voir system_prompt côté serveur), mais
// lui échappe parfois une habitude "markdown" à deux astérisques (**gras**).
// PersonnagePage.tsx (ACTION_RE = /\*(.+?)\*/g) capture alors le second
// astérisque comme texte au lieu de le traiter comme délimiteur, ce qui
// affichait "**texte*" au lieu de "*texte*" une fois les astérisques
// réaffichés autour de l'action. Réduire toute suite de 2+ astérisques à un
// seul avant que le texte n'atteigne l'affichage règle le problème à la
// source, quel que soit l'endroit qui le relit ensuite (bulle, TTS, copie).
const normaliserAsterisques = (texte: string): string => texte.replace(/\*{2,}/g, '*');

export const etatDeltaVide = (): EtatDelta => ({
    lieu: '',
    objetUtilisateurAjoute: '',
    objetPersonnageAjoute: '',
    fait: '',
});

// Fiche d'état "pliée" (résultat du fold de tous les deltas de la
// conversation, dans l'ordre) envoyée au serveur pour réinjection de contexte.
export interface EtatFiche {
    lieu: string;
    objets_utilisateur: string[];
    objets_personnage: string[];
    faits_marquants: string[];
}

export const etatFicheVide = (): EtatFiche => ({
    lieu: '',
    objets_utilisateur: [],
    objets_personnage: [],
    faits_marquants: [],
});

// Combine tous les deltas d'une conversation, dans l'ordre, en une fiche
// d'état unique : le dernier lieu renseigné gagne, les objets/faits
// s'accumulent sans doublons.
export const plierEtatDeltas = (deltas: EtatDelta[]): EtatFiche => {
    const fiche = etatFicheVide();
    for (const delta of deltas) {
        if (delta.lieu) fiche.lieu = delta.lieu;
        if (delta.objetUtilisateurAjoute && !fiche.objets_utilisateur.includes(delta.objetUtilisateurAjoute)) {
            fiche.objets_utilisateur.push(delta.objetUtilisateurAjoute);
        }
        if (delta.objetPersonnageAjoute && !fiche.objets_personnage.includes(delta.objetPersonnageAjoute)) {
            fiche.objets_personnage.push(delta.objetPersonnageAjoute);
        }
        if (delta.fait && !fiche.faits_marquants.includes(delta.fait)) {
            fiche.faits_marquants.push(delta.fait);
        }
    }
    return fiche;
};

// Informations sur l'utilisateur (genre / caractère, globaux ou propres à
// cette conversation) envoyées au personnage pour qu'il en tienne compte.
export interface ProfilUtilisateurChat {
    genre?: string;
    caractere?: string;
}

// Nombre maximum de messages d'historique envoyés au serveur à chaque appel
// (~35 derniers échanges utilisateur/personnage), pour éviter que la requête
// ne grossisse indéfiniment sur une conversation très longue. La fiche
// d'état (etat) conserve déjà les faits importants au-delà de cette fenêtre.
const MAX_HISTORY_MESSAGES = 70;

const limiterHistorique = (history: ChatHistoryEntry[]): ChatHistoryEntry[] =>
    history.length > MAX_HISTORY_MESSAGES ? history.slice(-MAX_HISTORY_MESSAGES) : history;

interface ChatRequest {
    name: string;
    bio?: string;
    description?: string;
    histoire?: string;
    salutation?: string;
    history: ChatHistoryEntry[];
    etat?: EtatFiche;
    profilUtilisateur?: ProfilUtilisateurChat;
    // Langue choisie par l'utilisateur dans le menu Langue (ex: 'fr', 'en') :
    // le personnage doit répondre dans cette langue.
    lang?: string;
    // Identifiant du personnage : le serveur s'en sert pour compter les messages qu'on lui adresse.
    creationId?: number;
}

export interface ChatReponse {
    reply: string;
    etatDelta: EtatDelta;
}

// Forme brute de la réponse JSON du serveur, avant conversion en EtatDelta.
interface ChatReponseBrute {
    etatDelta?: {
        lieu?: string;
        objet_utilisateur_ajoute?: string;
        objet_personnage_ajoute?: string;
        fait?: string;
    };
}

const lireEtatDelta = (data: ChatReponseBrute): EtatDelta => ({
    lieu: data.etatDelta?.lieu ?? '',
    objetUtilisateurAjoute: data.etatDelta?.objet_utilisateur_ajoute ?? '',
    objetPersonnageAjoute: data.etatDelta?.objet_personnage_ajoute ?? '',
    fait: data.etatDelta?.fait ?? '',
});

// Demande une réponse du personnage au serveur local, qui la génère via un
// modèle de langage tournant sur le PC (Ollama). Le serveur retire lui-même
// le tag technique [ÉTAT: ...] du texte et retourne son contenu à part.
export const askCharacterReply = async (request: ChatRequest): Promise<ChatReponse> => {
    const response = await fetch(`${SERVER_BASE_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...request, history: limiterHistorique(request.history) }),
    });
    if (!response.ok) throw new Error(`Erreur serveur (${response.status})`);
    const data = await response.json();
    return {
        reply: normaliserAsterisques((data.reply as string) ?? ''),
        etatDelta: lireEtatDelta(data),
    };
};

interface EtatSeulRequest {
    name: string;
    bio?: string;
    description?: string;
    histoire?: string;
    history: ChatHistoryEntry[];
    etat?: EtatFiche;
    profilUtilisateur?: ProfilUtilisateurChat;
    texteModifie: string;
}

// Après une édition manuelle du texte d'un message du personnage, demande au
// serveur de recalculer UNIQUEMENT la fiche d'état à partir de ce nouveau
// texte (le modèle n'incarne pas le personnage dans ce mode, il ne fait
// qu'analyser, pour éviter toute confusion avec la consigne elle-même).
export const demanderMiseAJourEtat = async (request: EtatSeulRequest): Promise<EtatDelta> => {
    const response = await fetch(`${SERVER_BASE_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...request, history: limiterHistorique(request.history), mode: 'etat_seul' }),
    });
    if (!response.ok) throw new Error(`Erreur serveur (${response.status})`);
    const data = await response.json();
    return lireEtatDelta(data);
};
