/* src/utils/traduction.ts */
import { useEffect, useState } from 'react';
import { SERVER_BASE_URL } from '../config';
import { enTeteAuth } from './compte';

export interface ChampsTraduits {
    title: string;
    description: string;
    histoire: string;
    salutation: string;
    bio: string;
}

const traduireCreation = async (creationId: number, lang: string): Promise<ChampsTraduits> => {
    const response = await fetch(`${SERVER_BASE_URL}/creations/${creationId}/traduction/${lang}`, {
        headers: enTeteAuth(),
    });
    if (!response.ok) throw new Error(`Erreur serveur (${response.status})`);
    return response.json();
};

export interface ChampsVignetteTraduits {
    title: string;
    bio: string;
}

// Traduction groupée (titre + bio) pour une grille de vignettes (accueil...) :
// un seul appel réseau pour toute la page plutôt qu'un par carte. Les
// identifiants inconnus du serveur (ex : les personnages de démonstration)
// sont simplement absents du résultat.
export const traduireCreationsEnLot = async (
    ids: number[],
    lang: string,
): Promise<Record<number, ChampsVignetteTraduits>> => {
    const response = await fetch(`${SERVER_BASE_URL}/creations/traduction/${lang}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...enTeteAuth() },
                                 body: JSON.stringify({ ids }),
    });
    if (!response.ok) throw new Error(`Erreur serveur (${response.status})`);
    const brut: Record<string, ChampsVignetteTraduits> = await response.json();
    const resultat: Record<number, ChampsVignetteTraduits> = {};
    Object.entries(brut).forEach(([id, champs]) => { resultat[Number(id)] = champs; });
    return resultat;
};

interface CreationTraduisible {
    id: number;
    title?: string;
    description?: string;
    histoire?: string;
    salutation?: string;
    bio?: string;
}

// Traduit à la volée le contenu écrit par le créateur (nom, description,
// histoire, salutation, bio) vers la langue actuelle de l'app, pour
// l'affichage aux autres utilisateurs. `actif` permet de ne pas déclencher
// l'appel quand ce n'est pas utile (ex : le créateur consultant son propre
// personnage).
export const useTraductionCreation = (
    creation: CreationTraduisible | null | undefined,
    lang: string,
    actif: boolean,
): ChampsTraduits => {
    const [traduit, setTraduit] = useState<ChampsTraduits | null>(null);

    // Efface la traduction précédente dès que le personnage/la langue change,
    // pendant le rendu (comparaison à la clé précédente) plutôt que dans
    // l'effet ci-dessous, qui ne fait alors plus que l'appel réseau.
    const cle = `${creation?.id ?? ''}|${lang}|${actif ? '1' : '0'}`;
    const [clePrecedente, setClePrecedente] = useState(cle);
    if (cle !== clePrecedente) {
        setClePrecedente(cle);
        setTraduit(null);
    }

    useEffect(() => {
        if (!creation || !actif) return undefined;
        let annule = false;
        traduireCreation(creation.id, lang)
            .then((c) => { if (!annule) setTraduit(c); })
            .catch((err) => console.log('Traduction échouée', err));
        return () => { annule = true; };
    }, [creation, lang, actif]);

    return {
        title: traduit?.title ?? creation?.title ?? '',
        description: traduit?.description ?? creation?.description ?? '',
        histoire: traduit?.histoire ?? creation?.histoire ?? '',
        salutation: traduit?.salutation ?? creation?.salutation ?? '',
        bio: traduit?.bio ?? creation?.bio ?? '',
    };
};
