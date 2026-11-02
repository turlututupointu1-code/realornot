/* src/utils/releases.ts */
import { SERVER_BASE_URL } from '../config';

export interface ReleaseEntry {
    version: string;
    filename: string;
    date: string;
    changelog: string;
}

export type Plateforme = 'android' | 'windows' | 'linux';

export type Releases = Record<Plateforme, ReleaseEntry[]>;

// Public - alimente la page de téléchargement (voir spec_page_telechargement.md)
// et l'onglet admin "Versions", pas d'authentification nécessaire pour
// simplement consulter la liste (comme /app/version, déjà public).
export const obtenirReleases = async (): Promise<Releases> => {
    const reponse = await fetch(`${SERVER_BASE_URL}/app/releases`);
    if (!reponse.ok) throw new Error(`Erreur serveur (${reponse.status})`);
    return reponse.json();
};

export const urlTelechargementRelease = (plateforme: Plateforme, filename: string): string =>
    `${SERVER_BASE_URL}/app/releases/${plateforme}/${encodeURIComponent(filename)}`;
