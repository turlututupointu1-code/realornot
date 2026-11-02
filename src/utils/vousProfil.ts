/* src/utils/vousProfil.ts */
import avatar01 from '../images/avatars/avatar_01.png';
import avatar02 from '../images/avatars/avatar_02.png';
import avatar03 from '../images/avatars/avatar_03.png';
import avatar04 from '../images/avatars/avatar_04.png';
import avatar05 from '../images/avatars/avatar_05.png';
import avatar06 from '../images/avatars/avatar_06.png';
import avatar07 from '../images/avatars/avatar_07.png';
import avatar08 from '../images/avatars/avatar_08.png';
import avatar09 from '../images/avatars/avatar_09.png';
import avatar10 from '../images/avatars/avatar_10.png';
import avatar11 from '../images/avatars/avatar_11.png';
import avatar12 from '../images/avatars/avatar_12.png';
import avatar13 from '../images/avatars/avatar_13.png';
import avatar14 from '../images/avatars/avatar_14(1).png';
import avatar15 from '../images/avatars/avatar_15(1).png';
import avatar16 from '../images/avatars/avatar_16(1).png';
import avatar17 from '../images/avatars/avatar_05(1).png';
import avatar18 from '../images/avatars/avatar_06(1).png';
import avatar19 from '../images/avatars/avatar_03(1).png';
import avatar20 from '../images/avatars/avatar_04(1).png';

import { chargerJSON } from './stockageLocal';

// Vingt avatars réels fournis par l'utilisateur.
export const AVATARS = [
    avatar01, avatar02, avatar03, avatar04, avatar05, avatar06,
    avatar07, avatar08, avatar09, avatar10, avatar11, avatar12,
    avatar13, avatar14, avatar15, avatar16, avatar17, avatar18,
    avatar19, avatar20,
];

// Profil "Vous" sauvegardé localement sur l'appareil (pas encore envoyé au
// serveur), pour que le genre et l'avatar choisis restent d'une session à
// l'autre et soient visibles dans les conversations.
const VOUS_PROFIL_KEY = 'realornot-vous-profil';

export interface VousProfil {
    genre: number | null;
    avatarChoisi: number | null;
    caractere: string;
    // Prévenir quand une nouvelle IA est publiée : true = Oui, false = Non, null ou absent = pas encore de réponse (« Moi » reste incomplète)
    prevenirNouvelleIA?: boolean | null;
}

/*export const chargerProfilVous = (): VousProfil => {
    try {
        const raw = localStorage.getItem(VOUS_PROFIL_KEY);
        if (raw) return { genre: null, avatarChoisi: null, caractere: '', ...JSON.parse(raw) };
    } catch {
        // ignore, on repart d'un profil vierge
    }
    return { genre: null, avatarChoisi: null, caractere: '' };
}*/

export const chargerProfilVous = (): VousProfil =>
chargerJSON(VOUS_PROFIL_KEY, { genre: null, avatarChoisi: null, caractere: '', prevenirNouvelleIA: null });

export const enregistrerProfilVous = (profil: VousProfil) => {
    localStorage.setItem(VOUS_PROFIL_KEY, JSON.stringify(profil));
};

export const getAvatarImage = (index: number | null): string | undefined =>
    index !== null ? AVATARS[index] : undefined;
