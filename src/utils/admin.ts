/* src/utils/admin.ts */
import { SERVER_BASE_URL } from '../config';
import { chargerToken } from './compte';
import type { UserCreation } from './userCreations';
import type { Plateforme } from './releases';

const enTeteAuth = (): Record<string, string> => {
    const token = chargerToken();
    const code = localStorage.getItem('realornot-admin-code');
    return {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        // Connaître le code secret d'accès admin (voir TopBar.tsx) suffit à
        // agir sur ces routes, peu importe le compte connecté sur cet
        // appareil - c'est justement le but de ce code : autoriser
        // n'importe quel téléphone qui le connaît, pas seulement le compte
        // "Philippe 1".
        ...(code ? { 'X-Admin-Code': code } : {}),
    };
};

const appelAdmin = async <T>(chemin: string, options: RequestInit = {}): Promise<T> => {
    const response = await fetch(`${SERVER_BASE_URL}${chemin}`, {
        ...options,
        headers: { ...enTeteAuth(), ...(options.headers || {}) },
    });
    if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error || `Erreur serveur (${response.status})`);
    }
    return response.json();
};

export interface QuotaTraduction {
    periode: string;
    googleUtilise: number;
    deeplUtilise: number;
    limiteParFournisseur: number;
}

export const obtenirQuotaTraduction = (): Promise<QuotaTraduction> =>
    appelAdmin('/admin/quota-traduction');

export const obtenirToutesLesCreations = (): Promise<UserCreation[]> =>
    appelAdmin('/admin/creations');

export const forcerVisibilite = (id: number, isPublic: boolean): Promise<UserCreation> =>
    appelAdmin(`/admin/creations/${id}/visibilite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublic }),
    });

export const supprimerCreationAdmin = (id: number): Promise<void> =>
    appelAdmin(`/admin/creations/${id}`, { method: 'DELETE' });

export interface CompteAdmin {
    pseudo: string;
    motDePasse: string | null;
    dateCreation: string;
    isAdmin: boolean;
    nombreCreations: number;
}

export const obtenirComptes = (): Promise<CompteAdmin[]> =>
    appelAdmin('/admin/comptes');

export const supprimerCompteAdmin = (pseudo: string): Promise<void> =>
    appelAdmin(`/admin/comptes/${encodeURIComponent(pseudo)}`, { method: 'DELETE' });

export const renommerCompteAdmin = (pseudo: string, nouveauPseudo: string): Promise<{ pseudo: string }> =>
    appelAdmin(`/admin/comptes/${encodeURIComponent(pseudo)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nouveauPseudo }),
    });

export const changerMotDePasseAdmin = (pseudo: string, nouveauMotDePasse: string): Promise<void> =>
    appelAdmin(`/admin/comptes/${encodeURIComponent(pseudo)}/mot-de-passe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nouveauMotDePasse }),
    });

export const definirAdminCompte = (pseudo: string, isAdmin: boolean): Promise<void> =>
    appelAdmin(`/admin/comptes/${encodeURIComponent(pseudo)}/admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAdmin }),
    });

export interface ClesApi {
    googleTranslateApiKey: string;
    deeplApiKey: string;
}

export const obtenirClesApi = (): Promise<ClesApi> =>
    appelAdmin('/admin/cles-api');

export const modifierClesApi = (cles: Partial<ClesApi>): Promise<void> =>
    appelAdmin('/admin/cles-api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cles),
    });

// Textes injectés dans le chat IA quand l'utilisateur évoque une partie du
// corps (voir message_sujets_anatomie côté serveur) - modifiables depuis
// l'admin (bouton "Anatomie", voir AdminPage.tsx) sans avoir à éditer les
// fichiers à la main ni redémarrer le serveur. "base" est le rappel court
// toujours inclus dès qu'un des 3 sujets est déclenché ; les 3 autres
// correspondent chacun à un fichier/sujet complet.
export type SectionAnatomie = 'base' | 'tete' | 'tronc' | 'genital';

export const obtenirAnatomie = (): Promise<Record<SectionAnatomie, string>> =>
    appelAdmin('/admin/anatomie');

export const modifierAnatomie = (section: SectionAnatomie, texte: string): Promise<void> =>
    appelAdmin(`/admin/anatomie/${section}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texte }),
    });

// Liste de meubles par pièce injectée dans le chat IA quand l'utilisateur
// évoque une pièce de la maison (voir message_pieces_meubles côté serveur) -
// un seul fichier (le découpage par pièce se fait automatiquement côté
// serveur à partir des titres en majuscules), modifiable depuis l'admin
// (bouton "Meubles", voir AdminPage.tsx).
export const obtenirMeubles = (): Promise<{ texte: string }> =>
    appelAdmin('/admin/meubles');

export const modifierMeubles = (texte: string): Promise<void> =>
    appelAdmin('/admin/meubles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texte }),
    });

export interface StatistiquesAdmin {
    totalCreations: number;
    totalPublic: number;
    totalPrive: number;
    totalComptes: number;
    totalSignalements: number;
}

export const obtenirStatistiques = (): Promise<StatistiquesAdmin> =>
    appelAdmin('/admin/statistiques');

export interface Signalement {
    id: number;
    creationId: number | null;
    creationTitle: string;
    motif: string;
    commentaire: string;
    date: string;
}

export const obtenirSignalements = (): Promise<Signalement[]> =>
    appelAdmin('/reports');

// Signalements de profil + contacts admin côté "Personne réelle" (voir
// spec_bloquer_signaler.md et spec_contact_admin.md) - distinct de
// obtenirSignalements ci-dessus, qui concerne les personnages IA.
export interface SignalementRencontre {
    id: string;
    type: 'profil' | 'contact';
    de: string;
    cible: string | null;
    motif: string | null;
    message: string | null;
    date: string;
}

export const obtenirSignalementsRencontre = (): Promise<SignalementRencontre[]> =>
    appelAdmin('/rencontre/signalements');

// Avis (1 à 5 étoiles) laissés via AvisApplicationPopup.tsx (voir
// src/utils/avisApplication.ts pour l'envoi côté utilisateur).
export interface AvisApplication {
    deviceId: string;
    note: number;
    date: string;
}

export const obtenirAvisApplication = (): Promise<AvisApplication[]> =>
    appelAdmin('/admin/avis-application');

export type FeatureFlags = Record<string, boolean>;

export const obtenirFeatureFlagsAdmin = (): Promise<FeatureFlags> =>
    appelAdmin('/feature-flags');

export const modifierFeatureFlag = (nom: string, actif: boolean): Promise<FeatureFlags> =>
    appelAdmin('/admin/feature-flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nom, actif }),
    });

export const supprimerFeatureFlag = (nom: string): Promise<FeatureFlags> =>
    appelAdmin('/admin/feature-flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nom, supprimer: true }),
    });

// Lecture publique des feature flags (utilisable par n'importe quelle page
// de l'app, pas seulement l'admin), pour activer/désactiver une
// fonctionnalité sans redéployer.
export const obtenirFeatureFlagsPublic = async (): Promise<FeatureFlags> => {
    const response = await fetch(`${SERVER_BASE_URL}/feature-flags`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Erreur serveur (${response.status})`);
    return response.json();
};

export interface ConnexionAdmin {
    pseudo: string;
    derniereUtilisation: string;
}

export const obtenirQuiEstConnecte = (): Promise<ConnexionAdmin[]> =>
    appelAdmin('/admin/qui-est-connecte');

// Code d'accès admin (voir spec_code_admin.md) - source unique de vérité
// hashée côté serveur (voir admin_code.json), plus aucune valeur codée en
// dur ici ni côté serveur.
// Normalise une saisie de code admin (tapée soit dans la barre de recherche
// - voir TopBar.tsx -, soit dans le formulaire "Changer le code d'accès
// admin" - voir AdminPage.tsx) : insensible à la casse (le clavier mobile
// peut ajouter une majuscule automatique) et tolère un '#' de tête (simple
// convention d'écriture, pas partie du code lui-même).
export const normaliserCodeAdmin = (valeur: string): string => valeur.trim().toLowerCase().replace(/^#/, '');

export const verifierCodeAdmin = (code: string): Promise<void> =>
    appelAdmin('/admin/verifier-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
    });

export const changerCodeAdmin = (ancienCode: string, nouveauCode: string): Promise<void> =>
    appelAdmin('/admin/changer-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ancienCode, nouveauCode }),
    });

// Page de téléchargement des versions (voir spec_page_telechargement.md) -
// obtenirReleases (lecture publique) vit dans utils/releases.ts ; seules les
// actions d'administration (compiler, modifier le changelog) demandent le
// code admin, via appelAdmin comme le reste de ce fichier.
export interface StatutBuild {
    status: 'running' | 'done' | 'error' | 'not_found';
    error: string | null;
    log: string[];
}

export const lancerBuildRelease = (plateforme: Plateforme): Promise<{ job_id: string }> =>
    appelAdmin(`/admin/releases/${plateforme}/build`, { method: 'POST' });

export const obtenirStatutBuild = (jobId: string): Promise<StatutBuild> =>
    appelAdmin(`/admin/releases/build-status/${jobId}`);

export const modifierChangelogRelease = (plateforme: Plateforme, version: string, changelog: string): Promise<void> =>
    appelAdmin(`/admin/releases/${plateforme}/${encodeURIComponent(version)}/changelog`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changelog }),
    });
