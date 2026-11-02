/* src/utils/faceAvatar.ts */
import * as faceapi from '@vladmandic/face-api';

// Modèle de détection de visage : chargé une seule fois, à la demande
// (fichiers dans public/models, ~200 Ko), pas au démarrage de l'app.
let modelesCharges = false;
let chargementEnCours: Promise<void> | null = null;

const chargerModeles = async (): Promise<void> => {
    if (modelesCharges) return;
    if (!chargementEnCours) {
        chargementEnCours = faceapi.nets.tinyFaceDetector.loadFromUri('/models').then(() => {
            modelesCharges = true;
        });
    }
    await chargementEnCours;
};

const chargerImage = (src: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Chargement image échoué'));
        img.src = src;
    });

const TAILLE_SORTIE = 256;

// Détecte le visage principal d'une photo et retourne un avatar carré
// recadré et centré autour de ce visage (avec une marge), en data URL JPEG.
// Retourne null si aucun visage n'est détecté (l'appelant garde alors la
// photo telle quelle, sans avatar dédié).
export const creerAvatarDepuisPhoto = async (imageSrc: string): Promise<string | null> => {
    try {
        await chargerModeles();
        const img = await chargerImage(imageSrc);

        const detection = await faceapi.detectSingleFace(
            img,
            new faceapi.TinyFaceDetectorOptions({ inputSize: 512, scoreThreshold: 0.2 })
        );
        if (!detection) return null;

        const { x, y, width, height } = detection.box;
        const centreX = x + width / 2;
        const centreY = y + height / 2;

        // Marge autour du visage détecté, pour ne pas recadrer trop serré.
        const marge = Math.max(width, height) * 0.6;
        const tailleSouhaitee = Math.max(width, height) + marge * 2;
        const tailleFinale = Math.max(1, Math.min(tailleSouhaitee, img.width, img.height));

        let sx = centreX - tailleFinale / 2;
        let sy = centreY - tailleFinale / 2;
        sx = Math.max(0, Math.min(sx, img.width - tailleFinale));
        sy = Math.max(0, Math.min(sy, img.height - tailleFinale));

        const canvas = document.createElement('canvas');
        canvas.width = TAILLE_SORTIE;
        canvas.height = TAILLE_SORTIE;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        ctx.drawImage(img, sx, sy, tailleFinale, tailleFinale, 0, 0, TAILLE_SORTIE, TAILLE_SORTIE);
        return canvas.toDataURL('image/jpeg', 0.9);
    } catch (err) {
        console.log('Détection de visage échouée', err);
        return null;
    }
};
