/* src/utils/voixPersonnage.ts */
import type { VoixChoisie } from './voix';

// Voix choisie pour un personnage, gardée uniquement en local sur l'appareil
// (jamais envoyée au serveur, qui est partagé entre tous les téléphones).
const voixPersonnageKey = (id: number) => `realornot-voix-personnage-${id}`;

export const enregistrerVoixPersonnage = (id: number, voix: VoixChoisie) => {
    localStorage.setItem(voixPersonnageKey(id), JSON.stringify(voix));
};

export const chargerVoixPersonnage = (id: number): VoixChoisie | null => {
    try {
        const raw = localStorage.getItem(voixPersonnageKey(id));
        return raw ? (JSON.parse(raw) as VoixChoisie) : null;
    } catch {
        return null;
    }
};
