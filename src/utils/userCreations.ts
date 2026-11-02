/* src/utils/userCreations.ts */
import { SERVER_BASE_URL } from '../config';
import { enTeteAuth } from './compte';
import { getDeviceId } from './deviceId';
import type { VoixChoisie } from './voix';

export interface UserCreation {
    id: number;
    title: string;
    imageUrl: string;
    // Portrait carré recadré automatiquement autour du visage détecté sur la
    // photo (utilisé dans le chat, à côté des messages du personnage) ;
    // vide si aucun visage n'a été détecté.
    avatarUrl: string;
    style: string;
    category: string;
    bio: string;
    description: string;
    histoire: string;
    salutation: string;
    // Identifiant de l'appareil qui a créé ce personnage (voir deviceId.ts).
    // Absent pour les personnages créés avant l'ajout de cette restriction.
    creatorId?: string;
    // Pseudo du créateur au moment de la création (voir pseudo.ts), affiché
    // publiquement sous la photo. Absent si le créateur n'avait pas de pseudo,
    // ou pour les personnages créés avant l'ajout de ce champ.
    creatorPseudo?: string;
    // Visible dans la liste publique (Accueil) ou uniquement par son créateur
    // (Vos créations). Absent (créations antérieures à ce champ) = public.
    isPublic?: boolean;
    // Index dans GENRE_SYMBOLS/t.genres (♀ ♂ ⚧ ⚥). Absent pour les
    // personnages créés avant l'ajout de ce champ.
    genre?: number | null;
    // Voix choisie pour lire les messages du personnage (voir utils/voix.ts).
    // Partagée via le serveur comme le reste du personnage, contrairement à
    // avant où elle restait coincée en local sur l'appareil qui l'avait
    // choisie. Absent/null pour les personnages sans voix assignée.
    voix?: VoixChoisie | null;
    // Nombre de fois où on a adressé la parole à ce personnage (compté par le serveur).
    nbMessages?: number;
}


const resoudreUrls = (creations: UserCreation[]): UserCreation[] =>
    creations.map((c) => ({
        ...c,
        imageUrl: c.imageUrl && c.imageUrl.startsWith('/creations/')
            ? `${SERVER_BASE_URL}${c.imageUrl}`
            : c.imageUrl,
            avatarUrl: c.avatarUrl && c.avatarUrl.startsWith('/creations/')
            ? `${SERVER_BASE_URL}${c.avatarUrl}`
            : c.avatarUrl,
            nbMessages: c.nbMessages ?? 0, // personnages sans compteur = 0
    }));

// Copie locale de la dernière liste reçue avec succès : si le serveur (le PC
// de Philippe) est éteint ou injoignable, l'app reste utilisable pour tout ce
// que l'utilisateur a déjà vu, plutôt que d'afficher une page vide.
const CACHE_PUBLIQUES_KEY = 'realornot-cache-creations-publiques';
const CACHE_MIENNES_KEY = 'realornot-cache-mes-creations';

const lireCache = (cle: string): UserCreation[] => {
    try {
        const brut = localStorage.getItem(cle);
        return brut ? (JSON.parse(brut) as UserCreation[]) : [];
    } catch {
        return [];
    }
};

const ecrireCache = (cle: string, creations: UserCreation[]): void => {
    try {
        localStorage.setItem(cle, JSON.stringify(creations));
    } catch {
        // Quota de stockage dépassé ou indisponible : tant pis, la mise en
        // cache est un confort, pas une nécessité.
    }
};

// Les personnages créés sont stockés sur le serveur local (même PC que la
// génération de photos), pour être visibles depuis tous les téléphones du
// réseau, et pas seulement sur l'appareil qui les a créés. Ne renvoie que les
// créations publiques (utilisé pour l'accueil / la recherche).
// Récupère une liste de créations depuis le serveur, avec repli sur la
// dernière copie mise en cache si l'appel échoue (serveur local injoignable) -
// partagé par getUserCreations (liste publique) et getMesCreations (les
// miennes), qui ne diffèrent que par l'URL, les en-têtes et la clé de cache.
const getCreationsAvecCache = async (
    url: string,
    headers: Record<string, string>,
    cleCache: string,
): Promise<UserCreation[]> => {
    try {
        const response = await fetch(url, { headers, cache: 'no-store' });
        if (!response.ok) throw new Error(`Erreur serveur (${response.status})`);
        const creations: UserCreation[] = await response.json();
        const resolues = resoudreUrls(creations);
        ecrireCache(cleCache, resolues);
        return resolues;
    } catch (err) {
        const cache = lireCache(cleCache);
        if (cache.length > 0) return cache;
        throw err;
    }
};

export const getUserCreations = (): Promise<UserCreation[]> =>
getCreationsAvecCache(`${SERVER_BASE_URL}/creations`, {}, CACHE_PUBLIQUES_KEY);

// "Vos créations" : uniquement celles du compte connecté, publiques et
// privées confondues.
export const getMesCreations = (): Promise<UserCreation[]> =>
getCreationsAvecCache(`${SERVER_BASE_URL}/creations/mine`, { ...enTeteAuth(), 'X-Device-Id': getDeviceId() }, CACHE_MIENNES_KEY);

export const addUserCreation = async (creation: Omit<UserCreation, 'id'>): Promise<UserCreation> => {
    const response = await fetch(`${SERVER_BASE_URL}/creations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...enTeteAuth() },
        body: JSON.stringify(creation),
    });
    if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error || `Erreur serveur (${response.status})`);
    }
    return response.json();
};

export interface ModificationCreation {
    title: string;
    category: string;
    bio: string;
    description: string;
    histoire: string;
    salutation: string;
    isPublic: boolean;
    genre: number | null;
    voix?: VoixChoisie | null;
    // Nombre de fois où on a adressé la parole à ce personnage (compté par le serveur).
    nbMessages?: number;
}

export const modifierUserCreation = async (id: number, modification: ModificationCreation): Promise<UserCreation> => {
    const response = await fetch(`${SERVER_BASE_URL}/creations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...enTeteAuth(), 'X-Device-Id': getDeviceId() },
        body: JSON.stringify(modification),
    });
    if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error || `Erreur serveur (${response.status})`);
    }
    return response.json();
};

// Convertit une blob: URL (issue de la génération) en data URL, pour l'envoyer
// au serveur dans le corps JSON de la requête.
export const blobUrlToDataUrl = async (blobUrl: string): Promise<string> => {
    const response = await fetch(blobUrl);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};
