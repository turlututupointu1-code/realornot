/* src/utils/scrollElement.ts */
// <main> est censé être la zone défilante de l'app (voir app-structure.css),
// mais un bug de calcul de 100vh dans la WebView Android fait qu'il grandit
// parfois pour englober tout le contenu au lieu de rester à la hauteur de
// l'écran : c'est alors le document qui défile réellement, pas <main>. On
// détecte dynamiquement lequel des deux est effectivement scrollable.
const getMainSiScrollable = (): HTMLElement | null => {
    const main = document.querySelector('main');
    return main && main.scrollHeight > main.clientHeight + 1 ? main : null;
};

export const getScrollTop = (): number => {
    const main = getMainSiScrollable();
    if (main) return main.scrollTop;
    return document.documentElement.scrollTop || document.body.scrollTop;
};

export const setScrollTop = (value: number): void => {
    const main = getMainSiScrollable();
    if (main) {
        main.scrollTop = value;
        return;
    }
    document.documentElement.scrollTop = value;
    document.body.scrollTop = value;
};

// Retourne une fonction de nettoyage (à appeler dans le cleanup du useEffect).
export const addScrollListener = (callback: () => void): (() => void) => {
    const main = getMainSiScrollable();
    const target: { addEventListener: Window['addEventListener']; removeEventListener: Window['removeEventListener'] } =
        main || window;
    target.addEventListener('scroll', callback, { passive: true });
    return () => target.removeEventListener('scroll', callback);
};
