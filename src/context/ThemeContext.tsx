import React, { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { StatusBar } from '@capacitor/status-bar';
import NavigationBar from '../plugins/navigationBar';
import { ThemeContext, SUPPORTED_LANGS, detectDefaultLang, STATUT_PAR_THEME } from './theme';
import type { ThemeName } from './theme';

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [theme, setThemeState] = useState<ThemeName>(() => {
        const stored = localStorage.getItem('realornot-theme');
        const themesValides: ThemeName[] = ['dentelle', 'gothique', 'cyberpunk', 'frosted'];
        if (stored && themesValides.includes(stored as ThemeName)) return stored as ThemeName;
        return 'frosted';
    });

    useEffect(() => {
        const { couleur, style } = STATUT_PAR_THEME[theme];
        const appliquer = () => {
            StatusBar.setStyle({ style }).catch(() => {});
            StatusBar.setBackgroundColor({ color: couleur }).catch(() => {});
            NavigationBar.setColor({ color: couleur }).catch(() => {});
        };
        appliquer();
        // Au tout premier lancement, le pont natif n'est parfois pas encore
        // prêt à ce stade (la barre de statut reste alors sur sa couleur par
        // défaut) : plusieurs tentatives échelonnées plutôt qu'une seule.
        const delais = [100, 300, 600, 1000, 1500, 2500];
        const retries = delais.map((delai) => window.setTimeout(appliquer, delai));
        return () => retries.forEach((id) => window.clearTimeout(id));
    }, [theme]);

    const [lang, setLangState] = useState<string>(() => {
        const stored = localStorage.getItem('realornot-lang');
        return (stored && SUPPORTED_LANGS.includes(stored)) ? stored : detectDefaultLang();
    });

    const setTheme = (newTheme: ThemeName) => {
        setThemeState(newTheme);
        localStorage.setItem('realornot-theme', newTheme);
    };

    const setLang = (newLang: string) => {
        setLangState(newLang);
        localStorage.setItem('realornot-lang', newLang);
    };

    return (
        <ThemeContext.Provider value={{ theme, setTheme, lang, setLang }}>
            {children}
        </ThemeContext.Provider>
    );
};
