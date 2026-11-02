/* src/utils/pseudo.ts */
const PSEUDO_KEY = 'realornot-pseudo';

export const chargerPseudo = (): string | null => localStorage.getItem(PSEUDO_KEY);

// Pseudo vide = pseudo effacé : on retire la clé (chargerPseudo() renvoie alors null, comme avant la première saisie).
export const enregistrerPseudo = (pseudo: string): void => {
    if (!pseudo) {
        localStorage.removeItem(PSEUDO_KEY);
        return;
    }
    localStorage.setItem(PSEUDO_KEY, pseudo);
};
