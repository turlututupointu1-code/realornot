/* src/utils/salutation.ts */

export interface SalutationParties {
    avant: string;
    apres: string;
}

// Tire un message au hasard dans une liste et le découpe autour du marqueur
// "{pseudo}" (remplacé à l'affichage par le pseudo ou le prénom réel, en
// gras) - partagé entre PopupPseudo.tsx (salutation générale) et
// RencontrePage.tsx (salutation "Personne réelle"), qui ne diffèrent que par
// la liste de messages utilisée.
export const decouperSalutation = (messages: string[]): SalutationParties => {
    const message = messages[Math.floor(Math.random() * messages.length)];
    const [avant, apres] = message.split('{pseudo}');
    return { avant, apres: apres ?? '' };
};
