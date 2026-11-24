/* src/components/BanniereTitre.tsx */
import React, { useLayoutEffect, useRef } from 'react';
import { useThemeAssets } from '../assets/themeAssets';

interface BanniereTitreProps {
    texte: string;
    children?: React.ReactNode;
}

// Part de la hauteur de la bannière utilisable par le texte (le reste = ornements en haut et en bas).
// Si deux lignes semblent trop tassées ou trop petites, ajuster cette valeur.
const HAUTEUR_UTILE = 0.62;
// Réduction maximale du texte (0.5 = moitié de la taille).
const ECHELLE_MIN = 0.5;

interface Mesure {
    largeur: number; // largeur de la ligne la plus large
    hauteur: number; // hauteur de toutes les lignes
    dispo: number; // largeur disponible (cartouche moins marges)
}

function mesurer(el: HTMLElement): Mesure {
    const cs = getComputedStyle(el);
    const dispo = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const range = document.createRange();
    range.selectNodeContents(el);
    const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0);
    if (rects.length === 0) return { largeur: 0, hauteur: 0, dispo };
    const largeur = Math.max(...rects.map((r) => r.width));
    const hauteur = Math.max(...rects.map((r) => r.bottom)) - Math.min(...rects.map((r) => r.top));
    return { largeur, hauteur, dispo };
}

// Échelle nécessaire pour que le texte tienne (1 = tient déjà).
function echelleNecessaire(m: Mesure, dispoH: number): number {
    const sL = m.largeur > 0 ? m.dispo / m.largeur : 1;
    const sH = m.hauteur > 0 ? dispoH / m.hauteur : 1;
    return Math.min(1, sL, sH);
}

// Ajuste le texte du titre au cartouche : d'abord une ligne, sinon deux lignes, sinon réduction.
function ajuster(el: HTMLElement): void {
    const parent = el.parentElement;
    if (!parent) return;
    const dispoH = parent.clientHeight * HAUTEUR_UTILE;

    el.style.scale = '1';
    el.style.whiteSpace = '';
    const nowrap = getComputedStyle(el).whiteSpace === 'nowrap';

    const sA = echelleNecessaire(mesurer(el), dispoH);
    if (sA >= 1) return;

    if (nowrap) {
        el.style.whiteSpace = 'normal';
        const sB = echelleNecessaire(mesurer(el), dispoH);
        if (sB >= 1) return; // tient sur deux lignes
        if (sB > sA) {
            el.style.scale = String(Math.max(ECHELLE_MIN, sB));
            return;
        }
        el.style.whiteSpace = '';
    }
    el.style.scale = String(Math.max(ECHELLE_MIN, sA));
}

// Bloc "bannière titre" (fond titre + icône/avatar + texte), répété à
// l'identique en haut de la plupart des pages de création. Le contenu du
// milieu (icône simple, avatar, bouton...) varie selon la page et se passe
// en children. Le texte s'ajuste tout seul au cartouche (voir ajuster).
const BanniereTitre: React.FC<BanniereTitreProps> = ({ texte, children }) => {
    const assets = useThemeAssets();
    const texteRef = useRef<HTMLSpanElement>(null);

    useLayoutEffect(() => {
        const el = texteRef.current;
        const parent = el?.parentElement;
        if (!el || !parent) return;
        let annule = false;
        const lancer = () => {
            if (!annule) ajuster(el);
        };
        lancer();
        // La police du thème peut arriver après le premier rendu : on remesure à ce moment-là.
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(lancer);
        const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(lancer) : null;
        if (ro) ro.observe(parent);
        return () => {
            annule = true;
            if (ro) ro.disconnect();
        };
    }, [texte, assets.titre]);

    return (
        <div className="create-banner-title">
            <img src={assets.titre} alt="" className="create-banner-bg" />
            {children}
            <span ref={texteRef} className="create-banner-text">{texte}</span>
        </div>
    );
};

export default BanniereTitre;
