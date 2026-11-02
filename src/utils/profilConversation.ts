/* src/utils/profilConversation.ts */
import { chargerProfilVous } from './vousProfil';
import { chargerJSON } from './stockageLocal';

// Réglages spécifiques à l'utilisateur pour UNE conversation donnée (genre et
// caractère), en complément ou en remplacement du profil global "Vous".
// Stocké uniquement en local sur l'appareil (jamais sur le serveur).
export interface ProfilConversation {
    genre: number | null;
    caractere: string;
}

const profilConversationVide: ProfilConversation = { genre: null, caractere: '' };

export const chatKey = (id: number) => `realornot-chat-${id}`;

export const profilConversationKey = (id: number) => `realornot-profil-conversation-${id}`;

/*export const chargerProfilConversation = (id: number | undefined): ProfilConversation => {
    if (id === undefined) return { ...profilConversationVide };
    try {
        const raw = localStorage.getItem(profilConversationKey(id));
        if (raw) return { ...profilConversationVide, ...JSON.parse(raw) };
    } catch {
        // ignore, on repart d'un profil de conversation vierge
    }
    return { ...profilConversationVide };
};*/

export const chargerProfilConversation = (id: number | undefined): ProfilConversation => {
    if (id === undefined) return { ...profilConversationVide };
    return chargerJSON(profilConversationKey(id), profilConversationVide);
};


export const enregistrerProfilConversation = (id: number, profil: ProfilConversation) => {
    localStorage.setItem(profilConversationKey(id), JSON.stringify(profil));
};

// Combine le profil de conversation (s'il a été personnalisé) et le profil
// global "Vous" (utilisé par défaut sinon), pour obtenir ce qui doit être
// envoyé au personnage IA : le réglage propre à cette conversation prime
// quand il est renseigné, sinon on retombe sur le profil global.
export const resoudreProfilPourEnvoi = (
    id: number | undefined,
    genresLabels: string[]
): { genre?: string; caractere?: string } => {
    const global = chargerProfilVous();
    const conversation = chargerProfilConversation(id);

    const genreIndex = conversation.genre !== null ? conversation.genre : global.genre;
    const caractere = conversation.caractere || global.caractere;

    return {
        genre: genreIndex !== null ? genresLabels[genreIndex] : undefined,
        caractere: caractere || undefined,
    };
};
