/* src/assets/themeAssets.ts */
import { useTheme, DOSSIER_PAR_THEME } from '../context/theme';
import type { ThemeName } from '../context/theme';

// Charge une bonne fois pour toutes les images des dossiers de thème -
// remplace les ~90 lignes d'imports individuels d'avant. eager:true les
// charge toutes au démarrage (fichiers légers, pas de souci) ; import:
// 'default' retourne directement l'URL de chaque image, comme le faisait
// chaque `import xxx from '...png'`.
const images = import.meta.glob('../images/*/*.png', { eager: true, import: 'default' }) as Record<string, string>;

function img(theme: ThemeName, name: string): string {
    const folder = DOSSIER_PAR_THEME[theme];
    const path = `../images/${folder}/${name}.png`;
    const image = images[path];
    if (!image && import.meta.env.DEV) {
        console.warn(`[themeAssets] image introuvable : ${path}`);
    }
    return image;
}

// Assets graphiques (barres, boutons, cadre de titre) qui changent selon le
// thème actif. Chaque thème fournit son propre fichier pour chaque clé ;
// les composants lisent ces images via useThemeAssets() au lieu d'un chemin
// codé en dur, pour basculer automatiquement d'un thème à l'autre.
export interface ThemeAssets {
    barre1: string;
    barre2: string;
    // Image de la barre de progression (recadrage photo, génération...) :
    // chaque thème fournit son propre progression.png, distinct de barre2 -
    // une clé à part évite que "barre2" désigne des fichiers différents
    // selon le thème.
    barreProgression: string;
    zoom: string;
    titre: string;
    titre2: string;
    fermer: string;
    capture: string;
    flash: string;
    basculer: string;
    smartphone: string;
    repertoire: string;
    drapeau: string;
    burger: string;
    creer: string;
    messages: string;
    compatibilite: string;
    cadenas: string;
    supprimer: string;
    profilHomme: string;
    profilFemme: string;
    palette: string;
    fleche: string;
    appareilphoto: string;
    silhouette: string;
    recherche: string;
    fond: string;
    fondecran: string;
}

function buildAssets(theme: ThemeName): ThemeAssets {
    return {
        barre1: img(theme, 'barre1'),
        barre2: img(theme, 'barre2'),
        barreProgression: img(theme, 'progression'),
        zoom: img(theme, 'progression'),
        titre: img(theme, 'titre'),
        titre2: img(theme, 'titre'),

        fermer: img(theme, 'fermer'),
        capture: img(theme, 'capture'),
        flash: img(theme, 'flash'),
        basculer: img(theme, 'basculer'),
        smartphone: img(theme, 'smartphone'),
        repertoire: img(theme, 'repertoire'),
        drapeau: img(theme, 'drapeau'),
        burger: img(theme, 'burger'),
        creer: img(theme, 'creer'),
        messages: img(theme, 'messages'),
        compatibilite: img(theme, 'compatibilite'),
        cadenas: img(theme, 'cadenas'),
        supprimer: img(theme, 'supprimer'),
        profilHomme: img(theme, 'profil-homme'),
        profilFemme: img(theme, 'profil-femme'),
        palette: img(theme, 'palette'),
        fleche: img(theme, 'fleche'),
        appareilphoto: img(theme, 'appareilphoto'),
        silhouette: img(theme, 'silhouette'),
        recherche: img(theme, 'recherche'),
        fond: img(theme, 'fond'),
        fondecran: img(theme, 'fondecran'),
    };
}

const themeAssets: Record<ThemeName, ThemeAssets> = Object.fromEntries(
    (Object.keys(DOSSIER_PAR_THEME) as ThemeName[]).map((theme) => [theme, buildAssets(theme)])
) as Record<ThemeName, ThemeAssets>;

export const useThemeAssets = (): ThemeAssets => {
    const { theme } = useTheme();
    const assets = themeAssets[theme];
    if (!assets) {
        // Filet de sécurité : une valeur sauvegardée avant le renommage
        // beige/noir -> dentelle/gothique (localStorage, Preferences...) ne
        // correspond plus à aucune clé. Idéalement à corriger à la source
        // (migration au chargement), ceci évite juste le crash en attendant.
        if (import.meta.env.DEV) {
            console.warn(`[themeAssets] thème inconnu : "${theme}", repli sur "gothique"`);
        }
        return themeAssets.gothique;
    }
    return assets;
};
