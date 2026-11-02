/* src/utils/useUnSeulOuvert.ts */
import { useState } from 'react';

// Un seul panneau ouvert à la fois (menu burger, page « Moi »).
// basculer(id) : ouvre ce panneau et ferme les autres ; si déjà ouvert, le ferme.
export const useUnSeulOuvert = <T extends string>() => {
    const [ouvert, setOuvert] = useState<T | null>(null);
    const estOuvert = (id: T) => ouvert === id; // vrai si ce panneau est ouvert
    const basculer = (id: T) => setOuvert((actuel) => (actuel === id ? null : id));
    const fermer = () => setOuvert(null); // ferme tous les panneaux
    return { estOuvert, basculer, fermer };
};
