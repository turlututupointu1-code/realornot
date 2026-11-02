import { createContext, useContext } from 'react';
import { Style } from '@capacitor/status-bar';
import { translations } from '../i18n/translations';
import type { Translations } from '../i18n/translations';

// Registre central des thèmes : le seul endroit à modifier pour en ajouter
// un (avec le fichier .scss correspondant et son import dans App.tsx).
// - couleur/style : barre de statut Android (voir STATUT_PAR_THEME plus bas).
// - dossier : nom du dossier dans src/images/, seulement si différent du nom
//   du thème (ex. frosted -> givre). Omis = même nom que le thème.
export const THEMES = {
    dentelle: { couleur: '#F0E6D6', style: Style.Light },
    gothique: { couleur: '#0a0a0a', style: Style.Dark },
    cyberpunk: { couleur: '#1A1A2E', style: Style.Dark },
    frosted: { couleur: '#dceaf2', style: Style.Light, dossier: 'frosted' },
} as const;

export type ThemeName = keyof typeof THEMES;

// Style des icônes (claires/sombres) et couleur de fond de la barre de
// statut/navigation Android, pour qu'elles suivent le thème actif. Les
// barres système sont transparentes par défaut (voir styles.xml, edge-to-edge)
// et la WebView affiche sa couleur de fond au travers sur la plupart des
// appareils ; mais certains (MIUI/Xiaomi notamment) ignorent la transparence
// de la barre de navigation et affichent un fond blanc par défaut, d'où la
// couleur forcée explicitement ici en complément.
export const STATUT_PAR_THEME: Record<ThemeName, { couleur: string; style: Style }> =
    Object.fromEntries(
        (Object.entries(THEMES) as [ThemeName, typeof THEMES[ThemeName]][])
            .map(([nom, valeurs]) => [nom, { couleur: valeurs.couleur, style: valeurs.style }])
    ) as Record<ThemeName, { couleur: string; style: Style }>;

// Nom du dossier images/ pour chaque thème (voir themeAssets.ts) - dérivé de
// THEMES : le nom du thème par défaut, sauf si `dossier` est précisé.
export const DOSSIER_PAR_THEME: Record<ThemeName, string> =
    Object.fromEntries(
        (Object.entries(THEMES) as [ThemeName, typeof THEMES[ThemeName]][])
            .map(([nom, valeurs]) => [nom, 'dossier' in valeurs ? valeurs.dossier : nom])
    ) as Record<ThemeName, string>;

export const SUPPORTED_LANGS = Object.keys(translations);

export const detectDefaultLang = (): string => {
    const code = navigator.language.slice(0, 2);
    return SUPPORTED_LANGS.includes(code) ? code : 'fr';
};

export interface ThemeContextValue {
    theme: ThemeName;
    setTheme: (theme: ThemeName) => void;
    lang: string;
    setLang: (lang: string) => void;
}

export const ThemeContext = createContext<ThemeContextValue>({
    theme: 'gothique',
    setTheme: () => {},
    lang: 'fr',
    setLang: () => {},
});

export const useTheme = () => useContext(ThemeContext);

export const useUiLang = (): Translations => {
    const { lang } = useTheme();
    return translations[lang] || translations.fr;
};
