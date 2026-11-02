/* src/utils/useAvatarUtilisateur.ts */
import { useState } from 'react';
import { AVATARS, chargerProfilVous } from './vousProfil';

// Avatar choisi par l'utilisateur (page "Vous") - utilisé aussi bien dans la
// conversation avec un personnage (PersonnagePage) que dans le profil pour
// cette conversation (ProfilConversationUtilisateurPage). Remonté ici pour
// éviter de dupliquer cette même logique de chargement dans chaque page.
export const useAvatarUtilisateur = (): string | undefined => {
    const [avatarUtilisateur] = useState<string | undefined>(() => {
        const { avatarChoisi } = chargerProfilVous();
        return avatarChoisi !== null ? AVATARS[avatarChoisi] : undefined;
    });
    return avatarUtilisateur;
};
