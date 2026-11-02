/* src/utils/adminVus.ts */
// Compteurs "déjà vus" (comptes/personnages/signalements), pour savoir s'il
// y a du nouveau depuis la dernière consultation - partagé entre le bouton
// admin du menu burger (badge visible partout) et l'interface admin
// elle-même (badges par onglet), pour que les deux restent synchronisés.
import { chargerJSON } from './stockageLocal';

const CLES_VUES_KEY = 'realornot-admin-vus';

export interface CompteursVus {
    comptes: number;
    personnages: number;
    signalements: number;
}

const compteursVusParDefaut: CompteursVus = { comptes: 0, personnages: 0, signalements: 0 };

/*export const chargerCompteursVus = (): CompteursVus => {
    try {
        const brut = localStorage.getItem(CLES_VUES_KEY);
        if (brut) return { ...compteursVusParDefaut, ...JSON.parse(brut) };
    } catch {
        // ignore, on repart de zéro
    }
    return { ...compteursVusParDefaut };
};*/

export const chargerCompteursVus = (): CompteursVus =>
chargerJSON(CLES_VUES_KEY, compteursVusParDefaut);


export const enregistrerCompteursVus = (vus: CompteursVus): void => {
    localStorage.setItem(CLES_VUES_KEY, JSON.stringify(vus));
};
