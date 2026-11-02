/* src/utils/voix.ts */

export interface VoixItem {
    cle: string;
    index: number;
    pitch: number;
    rate: number;
}

export interface VoixSection {
    titre: string;
    items: VoixItem[];
}

// pitch/rate approximent le caractère de chaque tessiture, en attendant de
// vraies voix synthétisées dédiées. "index" pointe vers t.voixTraits (texte
// affiché, traduit dans les 10 langues) ; "cle" ne sert que de clé React.
export const VOIX_FEMININES: VoixSection[] = [
    {
        titre: 'Soprano',
        items: [
            { cle: 'princesse', index: 0, pitch: 1.8, rate: 1.15 },
            { cle: 'romantique', index: 1, pitch: 1.6, rate: 1.0 },
            { cle: 'forte-personnalite', index: 2, pitch: 1.3, rate: 0.9 },
            { cle: 'soubrette', index: 3, pitch: 1.75, rate: 1.1 },
        ],
    },
    {
        titre: 'Mezzo-soprano',
        items: [
            { cle: 'seduisante', index: 4, pitch: 1.5, rate: 1.1 },
            { cle: 'femme-forte', index: 5, pitch: 1.3, rate: 1.0 },
            { cle: 'agile', index: 6, pitch: 1.1, rate: 0.9 },
        ],
    },
    {
        titre: 'Contralto',
        items: [
            { cle: 'autorite-maternelle', index: 7, pitch: 1.2, rate: 1.1 },
            { cle: 'amoureux', index: 8, pitch: 1.0, rate: 1.0 },
            { cle: 'puissant', index: 9, pitch: 0.85, rate: 0.9 },
        ],
    },
];

export const VOIX_MASCULINES: VoixSection[] = [
    {
        titre: 'Ténor',
        items: [
            { cle: 'juvenile', index: 10, pitch: 1.0, rate: 1.1 },
            { cle: 'comique-tenor', index: 11, pitch: 0.9, rate: 1.0 },
            { cle: 'seducteur', index: 12, pitch: 0.8, rate: 0.9 },
        ],
    },
    {
        titre: 'Baryton',
        items: [
            { cle: 'autoritaire', index: 13, pitch: 0.75, rate: 1.0 },
            { cle: 'comique-baryton', index: 14, pitch: 0.7, rate: 0.95 },
            { cle: 'sage', index: 15, pitch: 0.6, rate: 0.9 },
        ],
    },
    {
        titre: 'Basse',
        items: [
            { cle: 'excentrique', index: 16, pitch: 0.55, rate: 1.0 },
            { cle: 'menacant', index: 17, pitch: 0.6, rate: 1.05 },
            { cle: 'profonde', index: 18, pitch: 0.45, rate: 0.85 },
        ],
    },
];

// Deux voix natives distinctes (pas juste un pitch différent de la même
// voix), pour que les voix masculines sonnent vraiment différemment des
// voix féminines.
export const VOIX_NOM_FEMININE = 'fr-fr-x-fra-local';
export const VOIX_NOM_MASCULINE = 'fr-fr-x-frb-local';

// Mémorise qu'une voix a été choisie pour le personnage en cours de création,
// afin que le bouton "Voix" de la page précédente (Détails du personnage)
// passe au bleu et affiche son nom au retour. Effacé une fois le personnage
// enregistré. "index" pointe vers t.voixTraits pour retrouver le libellé
// traduit depuis l'autre page.
export const VOIX_CHOISIE_KEY = 'realornot-voix-choisie-en-cours';

export interface VoixChoisie {
    cle: string;
    index: number;
}

export interface ParametresVoix {
    pitch: number;
    rate: number;
    voiceName: string;
}

// Retrouve pitch/rate/voiceName à partir de la seule "cle" mémorisée pour un
// personnage, pour pouvoir relire ses messages avec la même voix ailleurs
// dans l'app (page de discussion).
export const trouverParametresVoix = (cle: string): ParametresVoix | null => {
    for (const section of VOIX_FEMININES) {
        const item = section.items.find((v) => v.cle === cle);
        if (item) return { pitch: item.pitch, rate: item.rate, voiceName: VOIX_NOM_FEMININE };
    }
    for (const section of VOIX_MASCULINES) {
        const item = section.items.find((v) => v.cle === cle);
        if (item) return { pitch: item.pitch, rate: item.rate, voiceName: VOIX_NOM_MASCULINE };
    }
    return null;
};
