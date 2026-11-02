/* src/utils/rencontre.ts */
import { SERVER_BASE_URL } from '../config';
import { chargerToken } from './compte';

export interface QuestionRencontre {
    id: string;
    texte: string;
    options: string[];
    categorie?: string;
    multiple?: boolean;
    // Pas d'options à choix : réponse tapée librement (stockée dans
    // "precisions", comme le texte libre des questions à choix "Autre").
    libre?: boolean;
    // Position de l'option "Autre" dans `options`, si la question en a une -
    // comparer cet index plutôt que le texte de l'option reste valable une
    // fois le contenu traduit dans d'autres langues (voir indexAutre côté
    // serveur, server.py).
    indexAutre?: number;
}

export interface PhotoRencontre {
    id: string;
    filename: string;
}

export interface ProfilRencontre {
    pseudo: string;
    // Prénom affiché publiquement (voir definirPrenomRencontre) - distinct
    // du pseudo, qui ne sert qu'à se connecter au bon compte et doit rester
    // unique : le prénom, lui, peut être partagé par plusieurs personnes
    // sans qu'un numéro y soit ajouté. Replié sur le pseudo côté serveur
    // tant qu'aucun prénom n'a encore été donné.
    prenom: string;
    bio: string;
    reponses: Record<string, number>;
    reponsesMultiples?: Record<string, number[]>;
    precisions?: Record<string, string>;
    age?: number;
    photos?: PhotoRencontre[];
    photoPresentationId?: string | null;
    // False tant que le questionnaire n'a jamais été enregistré une
    // première fois (voir POST /rencontre/profil côté serveur) - permet à
    // RencontrePhotosPage de rediriger vers le questionnaire plutôt que de
    // laisser ajouter des photos à un profil qui n'existe pas encore
    // vraiment.
    profilEnregistre?: boolean;
    // Présent uniquement sur les profils renvoyés par obtenirProfilsRencontre
    // (score calculé côté serveur entre le profil listé et le sien) - null
    // si aucune donnée commune ne permet de calculer un score.
    compatibilite?: number | null;
}

// URL complète d'une photo de profil de rencontre (voir GET
// /rencontre/photos/<filename> côté serveur).
export const urlPhotoRencontre = (photo: PhotoRencontre): string =>
    `${SERVER_BASE_URL}/rencontre/photos/${photo.filename}`;

// La langue de l'interface (voir useTheme().lang) - le serveur retombe sur
// le français si la langue est absente ou n'a pas encore de traduction pour
// le questionnaire (voir questions_rencontre_pour_langue côté serveur).
export const obtenirQuestionsRencontre = async (lang?: string): Promise<QuestionRencontre[]> => {
    const reponse = await fetch(`${SERVER_BASE_URL}/rencontre/questions?lang=${encodeURIComponent(lang ?? 'fr')}`);
    if (!reponse.ok) throw new Error(`Erreur serveur (${reponse.status})`);
    return reponse.json();
};

export const obtenirMonProfilRencontre = async (): Promise<ProfilRencontre> => {
    const token = chargerToken();
    const reponse = await fetch(`${SERVER_BASE_URL}/rencontre/profil`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!reponse.ok) throw new Error(`Erreur serveur (${reponse.status})`);
    return reponse.json();
};

// Résultat par question (id -> match ou non avec mon propre profil) pour la
// page de consultation d'un profil (point vert/rouge devant chaque titre) -
// une question absente du résultat n'est pas comparable (pas de point).
export const obtenirComparaisonRencontre = async (pseudo: string): Promise<Record<string, boolean>> => {
    const token = chargerToken();
    const reponse = await fetch(`${SERVER_BASE_URL}/rencontre/profil/${encodeURIComponent(pseudo)}/comparaison`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!reponse.ok) throw new Error(`Erreur serveur (${reponse.status})`);
    return reponse.json();
};

export const obtenirProfilsRencontre = async (): Promise<ProfilRencontre[]> => {
    const token = chargerToken();
    const reponse = await fetch(`${SERVER_BASE_URL}/rencontre/profils`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!reponse.ok) throw new Error(`Erreur serveur (${reponse.status})`);
    return reponse.json();
};

// --- Ordre d'affichage du questionnaire ---------------------------------
// Beaucoup de questions/catégories ont été réordonnées par rapport à leur
// place naturelle dans la liste renvoyée par le serveur (demandes
// successives) : "J'habite ?" sous "Je recherche ?", "Comment je gère les
// désaccords ?" sous "Le plus important...", "Personnalité / compatibilité"
// sous ça, puis voyage/weekend/horaire, "Style de vie / quotidien", le
// reste jusqu'à "Comment je décrirais mon rythme de vie ?", "Situation"
// (avec "Je veux des enfants un jour ?" juste après), "Centres d'intérêt",
// "Communication", et enfin "Je fume ?"/"Je bois de l'alcool ?" tout en bas.
// Fonction partagée entre RencontrePage (édition, par blocs individuels ou
// groupés) et RencontreProfilPage (lecture seule, liste à plat) pour que
// l'ordre reste identique sur les deux pages.
const ID_QUESTION_LANGUES = 'langues';
const IDS_QUESTIONS_IDENTITE = ['genre', 'orientation'];
const ID_QUESTION_AGE = 'tranche_age';
const ID_QUESTION_RECHERCHE = 'recherche';
const CATEGORIE_HABITE = "J'habite ?";
const CATEGORIE_PERSONNALITE = 'Personnalité / compatibilité';
const CATEGORIE_STYLE_VIE = 'Style de vie / quotidien';
const CATEGORIE_SITUATION = 'Situation';
const CATEGORIE_CENTRES_INTERET = "Centres d'intérêt";
const CATEGORIE_COMMUNICATION = 'Communication';
const ID_QUESTION_IMPORTANT = 'important';
const ID_QUESTION_DESACCORD = 'desaccord';
const ID_QUESTION_VOYAGE = 'voyage';
const ID_QUESTION_WEEKEND = 'weekend';
const ID_QUESTION_HORAIRE = 'horaire';
const ID_QUESTION_RYTHME = 'rythme';
const ID_QUESTION_ENFANTS = 'enfants';
const ID_QUESTION_FUME = 'fume';
const ID_QUESTION_ALCOOL = 'alcool';

export type GroupeQuestionsRencontre = { categorie: string; questions: QuestionRencontre[] };
export type BlocQuestionRencontre =
    | { type: 'question'; question: QuestionRencontre; verticale?: boolean }
    | { type: 'groupe'; groupe: GroupeQuestionsRencontre };

export const construireBlocsRencontre = (questions: QuestionRencontre[]): BlocQuestionRencontre[] => {
    const questionLangues = questions.find((q) => q.id === ID_QUESTION_LANGUES);
    const questionsIdentite = IDS_QUESTIONS_IDENTITE
        .map((id) => questions.find((q) => q.id === id))
        .filter((q): q is QuestionRencontre => q !== undefined);
    const questionAge = questions.find((q) => q.id === ID_QUESTION_AGE);
    const autresQuestions = questions.filter(
        (q) => q.id !== ID_QUESTION_LANGUES && q.id !== ID_QUESTION_AGE && !IDS_QUESTIONS_IDENTITE.includes(q.id)
    );
    const questionsSansCategorie = autresQuestions.filter((q) => !q.categorie);
    const questionsAvecCategorie = autresQuestions.filter((q) => q.categorie);
    const groupesCategories = questionsAvecCategorie.reduce<GroupeQuestionsRencontre[]>(
        (acc, question) => {
            const categorie = question.categorie as string;
            const dernier = acc[acc.length - 1];
            if (dernier && dernier.categorie === categorie) {
                dernier.questions.push(question);
            } else {
                acc.push({ categorie, questions: [question] });
            }
            return acc;
        },
        []
    );
    const itemsIndividuels: { question: QuestionRencontre; verticale?: boolean }[] = [
        ...(questionLangues ? [{ question: questionLangues, verticale: true }] : []),
        ...questionsIdentite.map((question) => ({ question, verticale: true })),
        ...(questionAge ? [{ question: questionAge }] : []),
        ...questionsSansCategorie.map((question) => ({ question })),
    ];

    const groupeHabite = groupesCategories.find((g) => g.categorie === CATEGORIE_HABITE);
    const groupePersonnalite = groupesCategories.find((g) => g.categorie === CATEGORIE_PERSONNALITE);
    const groupeStyleVie = groupesCategories.find((g) => g.categorie === CATEGORIE_STYLE_VIE);
    const groupeSituation = groupesCategories.find((g) => g.categorie === CATEGORIE_SITUATION);
    const groupeCentresInteret = groupesCategories.find((g) => g.categorie === CATEGORIE_CENTRES_INTERET);
    const groupeCommunication = groupesCategories.find((g) => g.categorie === CATEGORIE_COMMUNICATION);
    const autresGroupes = groupesCategories.filter(
        (g) => ![
            CATEGORIE_HABITE, CATEGORIE_PERSONNALITE, CATEGORIE_STYLE_VIE, CATEGORIE_SITUATION,
            CATEGORIE_CENTRES_INTERET, CATEGORIE_COMMUNICATION,
        ].includes(g.categorie)
    );
    const questionImportant = itemsIndividuels.find((it) => it.question.id === ID_QUESTION_IMPORTANT);
    const questionDesaccord = itemsIndividuels.find((it) => it.question.id === ID_QUESTION_DESACCORD);
    const questionVoyage = itemsIndividuels.find((it) => it.question.id === ID_QUESTION_VOYAGE);
    const questionWeekend = itemsIndividuels.find((it) => it.question.id === ID_QUESTION_WEEKEND);
    const questionHoraire = itemsIndividuels.find((it) => it.question.id === ID_QUESTION_HORAIRE);
    const questionEnfants = itemsIndividuels.find((it) => it.question.id === ID_QUESTION_ENFANTS);
    const questionFume = itemsIndividuels.find((it) => it.question.id === ID_QUESTION_FUME);
    const questionAlcool = itemsIndividuels.find((it) => it.question.id === ID_QUESTION_ALCOOL);
    const idsReordonnes = [
        ID_QUESTION_IMPORTANT, ID_QUESTION_DESACCORD, ID_QUESTION_VOYAGE, ID_QUESTION_WEEKEND,
        ID_QUESTION_HORAIRE, ID_QUESTION_ENFANTS, ID_QUESTION_FUME, ID_QUESTION_ALCOOL,
    ];
    const itemsIndividuelsRestants = itemsIndividuels.filter((it) => !idsReordonnes.includes(it.question.id));
    const indexApresRecherche = itemsIndividuelsRestants.findIndex((it) => it.question.id === ID_QUESTION_RECHERCHE) + 1;
    const indexApresRythme = itemsIndividuelsRestants.findIndex((it) => it.question.id === ID_QUESTION_RYTHME) + 1;

    return [
        ...itemsIndividuelsRestants.slice(0, indexApresRecherche).map((it) => ({ type: 'question' as const, ...it })),
        ...(groupeHabite ? [{ type: 'groupe' as const, groupe: groupeHabite }] : []),
        ...(questionImportant ? [{ type: 'question' as const, ...questionImportant }] : []),
        ...(questionDesaccord ? [{ type: 'question' as const, ...questionDesaccord }] : []),
        ...(groupePersonnalite ? [{ type: 'groupe' as const, groupe: groupePersonnalite }] : []),
        ...(questionVoyage ? [{ type: 'question' as const, ...questionVoyage }] : []),
        ...(questionWeekend ? [{ type: 'question' as const, ...questionWeekend }] : []),
        ...(questionHoraire ? [{ type: 'question' as const, ...questionHoraire }] : []),
        ...(groupeStyleVie ? [{ type: 'groupe' as const, groupe: groupeStyleVie }] : []),
        ...itemsIndividuelsRestants.slice(indexApresRecherche, indexApresRythme).map((it) => ({ type: 'question' as const, ...it })),
        ...(groupeSituation ? [{ type: 'groupe' as const, groupe: groupeSituation }] : []),
        ...(groupeCentresInteret ? [{ type: 'groupe' as const, groupe: groupeCentresInteret }] : []),
        ...(groupeCommunication ? [{ type: 'groupe' as const, groupe: groupeCommunication }] : []),
        ...(questionEnfants ? [{ type: 'question' as const, ...questionEnfants }] : []),
        ...itemsIndividuelsRestants.slice(indexApresRythme).map((it) => ({ type: 'question' as const, ...it })),
        ...autresGroupes.map((groupe) => ({ type: 'groupe' as const, groupe })),
        ...(questionFume ? [{ type: 'question' as const, ...questionFume }] : []),
        ...(questionAlcool ? [{ type: 'question' as const, ...questionAlcool }] : []),
    ];
};

// Version à plat (pour un affichage simple, sans accordéon) : les questions
// d'un même groupe se suivent dans l'ordre, avec le nom du groupe à
// récupérer via `categorie` sur la première d'entre elles.
export const ordonnerQuestionsRencontre = (questions: QuestionRencontre[]): QuestionRencontre[] =>
    construireBlocsRencontre(questions).flatMap((bloc) => (bloc.type === 'question' ? [bloc.question] : bloc.groupe.questions));

export const enregistrerProfilRencontre = async (
    bio: string,
    reponses: Record<string, number>,
    reponsesMultiples: Record<string, number[]>,
    precisions: Record<string, string>,
    age?: number,
): Promise<ProfilRencontre> => {
    const token = chargerToken();
    const reponse = await fetch(`${SERVER_BASE_URL}/rencontre/profil`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bio, reponses, reponsesMultiples, precisions, age }),
    });
    if (!reponse.ok) throw new Error(`Erreur serveur (${reponse.status})`);
    return reponse.json();
};

// Prénom affiché publiquement (voir DateNaissanceGate.tsx, qui l'appelle
// juste après l'inscription/la connexion) - distinct du pseudo de connexion,
// qui doit rester unique (voir trouver_pseudo_disponible côté serveur) :
// aucune vérification d'unicité ici, jamais de suffixe numérique ajouté.
export const definirPrenomRencontre = async (prenom: string): Promise<string> => {
    const token = chargerToken();
    const reponse = await fetch(`${SERVER_BASE_URL}/rencontre/prenom`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ prenom }),
    });
    const data = await reponse.json().catch(() => ({}));
    if (!reponse.ok) throw new Error((data as { error?: string }).error || `Erreur serveur (${reponse.status})`);
    return (data as { prenom: string }).prenom;
};

interface ReponsePhotosRencontre {
    photos: PhotoRencontre[];
    photoPresentationId: string | null;
}

export const ajouterPhotoRencontre = async (imageDataUrl: string): Promise<ReponsePhotosRencontre> => {
    const token = chargerToken();
    const reponse = await fetch(`${SERVER_BASE_URL}/rencontre/photo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ imageUrl: imageDataUrl }),
    });
    if (!reponse.ok) {
        const data = await reponse.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || `Erreur serveur (${reponse.status})`);
    }
    return reponse.json();
};

export const supprimerPhotoRencontre = async (photoId: string): Promise<ReponsePhotosRencontre> => {
    const token = chargerToken();
    const reponse = await fetch(`${SERVER_BASE_URL}/rencontre/photo/${encodeURIComponent(photoId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!reponse.ok) throw new Error(`Erreur serveur (${reponse.status})`);
    return reponse.json();
};

export const definirPhotoPresentationRencontre = async (photoId: string): Promise<ReponsePhotosRencontre> => {
    const token = chargerToken();
    const reponse = await fetch(`${SERVER_BASE_URL}/rencontre/photo/${encodeURIComponent(photoId)}/presentation`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!reponse.ok) throw new Error(`Erreur serveur (${reponse.status})`);
    return reponse.json();
};

// Enregistre que je viens de consulter le profil de `pseudo` (voir
// compteurs_visites.md) - sans effet si c'est mon propre profil (géré côté
// serveur). Échec silencieux : ne doit jamais empêcher l'affichage du
// profil consulté.
export const enregistrerVueProfilRencontre = async (pseudo: string): Promise<void> => {
    const token = chargerToken();
    await fetch(`${SERVER_BASE_URL}/rencontre/profil/${encodeURIComponent(pseudo)}/vue`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
};

export interface CompteurVuesRencontre {
    total: number;
    nouvelles: number;
}

export const obtenirCompteurVuesRencontre = async (): Promise<CompteurVuesRencontre> => {
    const token = chargerToken();
    const reponse = await fetch(`${SERVER_BASE_URL}/rencontre/vues/compteur`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!reponse.ok) throw new Error(`Erreur serveur (${reponse.status})`);
    return reponse.json();
};

export interface VisiteRencontre {
    pseudo: string;
    prenom: string;
    date: string;
}

export interface VuesRencontre {
    nouvelles: VisiteRencontre[];
    anciennes: VisiteRencontre[];
}

// Récupère la liste des visiteurs de mon profil - remet aussi à zéro le
// compteur de "nouvelles vues" côté serveur (voir compteurs_visites.md).
export const obtenirVuesRencontre = async (): Promise<VuesRencontre> => {
    const token = chargerToken();
    const reponse = await fetch(`${SERVER_BASE_URL}/rencontre/vues`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!reponse.ok) throw new Error(`Erreur serveur (${reponse.status})`);
    return reponse.json();
};

// --- Messagerie entre vrais comptes -------------------------------------
// Distincte de la conversation avec un personnage IA (voir PersonnagePage.tsx
// et VosDiscussionsPage.tsx, qui restent gérés en localStorage pour l'IA).

export interface MessageRencontre {
    id: string;
    de: string;
    a: string;
    texte: string;
    date: string;
    lu: boolean;
}

export interface ConversationRencontre {
    pseudo: string;
    prenom: string;
    dernierMessage: string;
    dernierDe: string;
    date: string;
    nonLus: number;
}

export const obtenirCompteurMessagesRencontre = async (): Promise<{ nonLus: number }> => {
    const token = chargerToken();
    const reponse = await fetch(`${SERVER_BASE_URL}/rencontre/messages/compteur`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!reponse.ok) throw new Error(`Erreur serveur (${reponse.status})`);
    return reponse.json();
};

export const obtenirConversationsRencontre = async (): Promise<ConversationRencontre[]> => {
    const token = chargerToken();
    const reponse = await fetch(`${SERVER_BASE_URL}/rencontre/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!reponse.ok) throw new Error(`Erreur serveur (${reponse.status})`);
    return reponse.json();
};

// Récupère l'historique avec `autrePseudo` - marque aussi comme lus, côté
// serveur, tous les messages reçus de sa part (voir compteurs_visites.md).
export const obtenirMessagesRencontre = async (autrePseudo: string): Promise<MessageRencontre[]> => {
    const token = chargerToken();
    const reponse = await fetch(`${SERVER_BASE_URL}/rencontre/messages/${encodeURIComponent(autrePseudo)}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!reponse.ok) throw new Error(`Erreur serveur (${reponse.status})`);
    return reponse.json();
};

export const envoyerMessageRencontre = async (destinataire: string, texte: string): Promise<MessageRencontre> => {
    const token = chargerToken();
    const reponse = await fetch(`${SERVER_BASE_URL}/rencontre/messages/${encodeURIComponent(destinataire)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ texte }),
    });
    if (!reponse.ok) {
        const data = await reponse.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || `Erreur serveur (${reponse.status})`);
    }
    return reponse.json();
};

// --- Blocage et signalement (voir spec_bloquer_signaler.md) -------------
// Deux actions séparées : bloquer rend les deux profils mutuellement
// invisibles (voir /rencontre/bloquer côté serveur), signaler se contente
// d'envoyer un motif à l'administrateur sans effet sur la visibilité.

// Liste fermée (pas de champ de texte libre) - doit rester identique à
// MOTIFS_SIGNALEMENT_RENCONTRE côté serveur, qui la revalide.
export const MOTIFS_SIGNALEMENT_RENCONTRE = [
    'Contenu sexuel', 'Suicide ou automutilation', 'Sécurité des enfants',
    'Harcèlement ou intimidation', 'Discours haineux et discrimination', 'Autre',
] as const;

export const bloquerProfilRencontre = async (pseudo: string): Promise<void> => {
    const token = chargerToken();
    const reponse = await fetch(`${SERVER_BASE_URL}/rencontre/bloquer/${encodeURIComponent(pseudo)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!reponse.ok) {
        const data = await reponse.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || `Erreur serveur (${reponse.status})`);
    }
};

export const signalerProfilRencontre = async (pseudo: string, motif: string): Promise<void> => {
    const token = chargerToken();
    const reponse = await fetch(`${SERVER_BASE_URL}/rencontre/signaler/${encodeURIComponent(pseudo)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ motif }),
    });
    if (!reponse.ok) {
        const data = await reponse.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || `Erreur serveur (${reponse.status})`);
    }
};

// Contact général de l'administrateur (voir spec_contact_admin.md) -
// message libre, indépendant du signalement d'un profil précis.
// email : renseigné en mode IA (pas de compte), pour que l'administrateur puisse répondre.
export const contacterAdminRencontre = async (message: string, email?: string): Promise<void> => {
    const token = chargerToken();
    const reponse = await fetch(`${SERVER_BASE_URL}/rencontre/contacter-admin`, {
        method: 'POST',
        // Sans compte (mode IA), pas d'en-tête Authorization
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ message, email }),
    });
    if (!reponse.ok) {
        const data = await reponse.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || `Erreur serveur (${reponse.status})`);
    }
};
