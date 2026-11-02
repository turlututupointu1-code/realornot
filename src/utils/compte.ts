/* src/utils/compte.ts */
import { SERVER_BASE_URL } from '../config';
import { enregistrerPseudo } from './pseudo';

const TOKEN_KEY = 'realornot-token';

export const chargerToken = (): string | null => localStorage.getItem(TOKEN_KEY);

const enregistrerToken = (token: string): void => {
    localStorage.setItem(TOKEN_KEY, token);
};

export const effacerCompte = (): void => {
    localStorage.removeItem(TOKEN_KEY);
};

export interface CompteConnecte {
    pseudo: string;
    token: string;
}

interface ReponseErreur {
    error?: string;
}

const appelCompte = async <T>(chemin: string, corps: unknown): Promise<T> => {
    const reponse = await fetch(`${SERVER_BASE_URL}${chemin}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corps),
    });
    const data = await reponse.json().catch(() => ({}));
    if (!reponse.ok) {
        throw new Error((data as ReponseErreur).error || `Erreur serveur (${reponse.status})`);
    }
    return data as T;
};

export const creerCompte = async (
    pseudo: string,
    motDePasse: string,
    question: string,
    reponse: string,
): Promise<CompteConnecte> => {
    const data = await appelCompte<CompteConnecte>('/inscription', { pseudo, motDePasse, question, reponse });
    enregistrerPseudo(data.pseudo);
    enregistrerToken(data.token);
    return data;
};

export const connecterCompte = async (pseudo: string, motDePasse: string): Promise<CompteConnecte> => {
    const data = await appelCompte<CompteConnecte>('/connexion', { pseudo, motDePasse });
    enregistrerPseudo(data.pseudo);
    enregistrerToken(data.token);
    return data;
};

export const recupererQuestionSecrete = async (pseudo: string): Promise<string> => {
    const data = await appelCompte<{ question: string }>('/mot-de-passe-oublie/question', { pseudo });
    return data.question;
};

// Vérifie la réponse à la question secrète et renvoie le mot de passe actuel
// en clair (affiché sur l'écran suivant - voir mode 'nouveau-mot-de-passe'
// dans PopupPseudo.tsx) plutôt que de forcer un nouveau mot de passe sans
// jamais confirmer que la réponse était la bonne.
export const verifierReponseSecrete = async (pseudo: string, reponse: string): Promise<string> => {
    const data = await appelCompte<{ motDePasse: string }>('/mot-de-passe-oublie/verifier', { pseudo, reponse });
    return data.motDePasse;
};

export const reinitialiserMotDePasse = async (
    pseudo: string,
    reponse: string,
    nouveauMotDePasse: string,
): Promise<CompteConnecte> => {
    const data = await appelCompte<CompteConnecte>('/mot-de-passe-oublie/reinitialiser', {
        pseudo,
        reponse,
        nouveauMotDePasse,
    });
    enregistrerPseudo(data.pseudo);
    enregistrerToken(data.token);
    return data;
};

// Vérifie auprès du serveur que le jeton gardé en local correspond toujours
// à un compte existant (ex : compte supprimé depuis l'interface admin
// pendant que ce téléphone restait "connecté" dessus). Une coupure réseau
// n'est pas traitée comme une session invalide - on ne déconnecte que sur un
// refus explicite du serveur.
export const sessionValide = async (): Promise<boolean> => {
    const token = chargerToken();
    if (!token) return false;
    try {
        const reponse = await fetch(`${SERVER_BASE_URL}/moi`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return reponse.status !== 401 && reponse.status !== 403;
    } catch {
        return true;
    }
};

// Changement volontaire de mot de passe depuis un compte déjà connecté (voir
// spec_changer_mot_de_passe.md) - distinct de reinitialiserMotDePasse
// ci-dessus (récupération par question secrète, sans être connecté).
export const changerMotDePasse = async (ancienMotDePasse: string, nouveauMotDePasse: string): Promise<void> => {
    const token = chargerToken();
    const reponse = await fetch(`${SERVER_BASE_URL}/compte/changer-mot-de-passe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ancienMotDePasse, nouveauMotDePasse }),
    });
    if (!reponse.ok) {
        const data = await reponse.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || `Erreur serveur (${reponse.status})`);
    }
};

export interface InfoCompte {
    pseudo: string;
    suppressionEnAttente: boolean;
    joursRestants?: number;
}

// Étend /moi (déjà utilisé par sessionValide) plutôt que de créer un
// endpoint séparé - même appel réseau, un champ en plus, sans rien changer
// au comportement existant de sessionValide elle-même.
export const obtenirInfoCompte = async (): Promise<InfoCompte | null> => {
    const token = chargerToken();
    if (!token) return null;
    try {
        const reponse = await fetch(`${SERVER_BASE_URL}/moi`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!reponse.ok) return null;
        return (await reponse.json()) as InfoCompte;
    } catch {
        return null;
    }
};

// Suppression de compte (voir spec_suppression_compte.md) - ne fait que
// marquer le compte "en attente" côté serveur (délai de grâce de 30 jours) ;
// c'est l'appelant (voir TopBar.tsx) qui déconnecte l'appareil juste après.
export const supprimerCompte = async (motDePasse: string): Promise<void> => {
    const token = chargerToken();
    const reponse = await fetch(`${SERVER_BASE_URL}/compte/supprimer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ motDePasse }),
    });
    if (!reponse.ok) {
        const data = await reponse.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || `Erreur serveur (${reponse.status})`);
    }
};

// Annule une suppression en attente (voir SuppressionEnAttentePage) - seul
// moyen de revenir en arrière : se reconnecter seul ne suffit pas.
export const annulerSuppressionCompte = async (): Promise<void> => {
    const token = chargerToken();
    const reponse = await fetch(`${SERVER_BASE_URL}/compte/annuler-suppression`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!reponse.ok) {
        const data = await reponse.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || `Erreur serveur (${reponse.status})`);
    }
};

// En-tête d'authentification prêt à l'emploi pour fetch() - absent (objet
// vide) si aucun compte n'est connecté, pour rester utilisable même sur des
// routes publiques qui acceptent les deux cas.
export const enTeteAuth = (): Record<string, string> => {
    const token = chargerToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
};
