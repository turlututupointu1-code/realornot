/* src/pages/useModeReelAcces.ts */
import { useState } from 'react';
import { obtenirMonProfilRencontre } from '../utils/rencontre';

// Mot de passe redemandé à la première entrée dans "Personne réelle" sur cet
// appareil (voir AccueilChoixPage et ModeReelGuard), puis plus jamais tant
// que l'appli reste ouverte (même en arrière-plan - changement d'appli,
// écran éteint...), mais à nouveau au prochain lancement après une
// fermeture volontaire (voir handleFermerApp dans TopBar.tsx).
// sessionStorage plutôt que localStorage : lié à la durée de vie de la
// WebView elle-même (en mémoire, jamais écrit sur disque), donc jamais de
// course entre une suppression et la fermeture immédiate du processus
// (essayé avec localStorage.removeItem() + délai avant AppCloser.exitApp(),
// sans succès - l'écriture asynchrone sur disque n'avait pas le temps de se
// terminer avant que le processus soit tué). Une vraie fermeture détruit la
// WebView, donc la prochaine ouverture recrée une session vide de zéro,
// sans rien à effacer explicitement.
const MOT_DE_PASSE_CONFIRME_KEY = 'realornot-mode-reel-confirme';
export const motDePasseDejaConfirme = () => sessionStorage.getItem(MOT_DE_PASSE_CONFIRME_KEY) === 'true';
export const marquerMotDePasseConfirme = () => { sessionStorage.setItem(MOT_DE_PASSE_CONFIRME_KEY, 'true'); };
export const oublierMotDePasseConfirme = () => { sessionStorage.removeItem(MOT_DE_PASSE_CONFIRME_KEY); };

// Un compte a-t-il déjà terminé le portail prénom/date au moins une fois
// (peu importe l'appareil) ? Demandé au serveur plutôt que déduit d'un
// marqueur local : un marqueur purement local (essayé auparavant) ne
// survit ni à un changement d'appareil/réinstallation, ni à un pseudo
// local désynchronisé (ex. modifié depuis la page "Vous", côté IA, sans
// jamais renommer le vrai compte côté serveur) - dans les deux cas, un
// compte pourtant déjà enregistré était à tort renvoyé vers tout le
// portail d'inscription. `profilEnregistre` (voir ProfilRencontre) est la
// seule source fiable : posée par le serveur dès le premier enregistrement
// réel du questionnaire de rencontre.
export const profilRencontreDejaEnregistre = async (): Promise<boolean> => {
    try {
        const profil = await obtenirMonProfilRencontre();
        return profil.profilEnregistre === true;
    } catch {
        return false;
    }
};

// Utilisé par ModeReelGuard, seul et unique portail d'entrée dans "Personne
// réelle" (voir son en-tête). `verifie` vaut `null` tant que la vérification
// serveur n'a pas encore répondu. La validité du jeton (voir sessionValide)
// est vérifiée directement dans ModeReelGuard, qui peut seul revenir en
// arrière sur motDePasseOk si le jeton s'avère périmé.
export function useModeReelAcces() {
    const [verifie, setVerifie] = useState<boolean | null>(null);
    return { verifie, setVerifie };
}
