/* src/utils/stockageLocal.ts */
// Lecture JSON générique depuis localStorage, avec repli sur une valeur par
// défaut en cas d'absence ou d'erreur de lecture - partagée par
// vousProfil.ts, profilConversation.ts et adminVus.ts, qui suivaient chacun
// exactement le même schéma.
export function chargerJSON<T>(cle: string, valeurParDefaut: T): T {
    try {
        const raw = localStorage.getItem(cle);
        if (raw) return { ...valeurParDefaut, ...JSON.parse(raw) };
    } catch {
        // ignore, on repart de la valeur par défaut
    }
    return { ...valeurParDefaut };
}
