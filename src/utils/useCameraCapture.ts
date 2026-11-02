/* src/hooks/useCameraCapture.ts */
import { useEffect, useState } from 'react';
import { CameraPreview } from '@capgo/camera-preview';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { StatusBar } from '@capacitor/status-bar';
import { useTheme, STATUT_PAR_THEME } from '../context/theme';

type FlashState = 'off' | 'auto' | 'on';
const NEXT_FLASH: Record<FlashState, FlashState> = { off: 'auto', auto: 'on', on: 'off' };
type CameraFace = 'rear' | 'front';
const NEXT_FACE: Record<CameraFace, CameraFace> = { rear: 'front', front: 'rear' };

interface PlageZoom {
    min: number;
    max: number;
}

// Logique caméra/galerie partagée par TelechargerPhoto.tsx (création de
// personnage IA) et RencontreAjouterPhoto.tsx ("Mes photos" côté Personne
// réelle) - onEchecAcces est appelé quand la caméra ou la galerie échoue ou
// est annulée (chaque page décide alors où naviguer, ou ne fait rien).
export function useCameraCapture(onEchecAcces?: () => void) {
    const { theme } = useTheme();
    const [photoACadrer, setPhotoACadrer] = useState<string | null>(null);
    const [photoDepuisCamera, setPhotoDepuisCamera] = useState(false);
    const [cameraActive, setCameraActive] = useState(false);
    const [flash, setFlash] = useState<FlashState>('off');
    const [face, setFace] = useState<CameraFace>('rear');
    const [plageZoom, setPlageZoom] = useState<PlageZoom>({ min: 1, max: 1 });
    const [niveauZoom, setNiveauZoom] = useState(1);

    useEffect(() => {
        const root = document.querySelector('.app-root-container') as HTMLElement | null;
        if (cameraActive) {
            document.documentElement.style.background = 'transparent';
            document.body.style.background = 'transparent';
            if (root) root.style.background = 'transparent';
        } else {
            document.documentElement.style.background = '';
            document.body.style.background = '';
            if (root) root.style.background = '';
        }
        return () => {
            document.documentElement.style.background = '';
            document.body.style.background = '';
            if (root) root.style.background = '';
        };
    }, [cameraActive]);

    useEffect(() => {
        if (!cameraActive) return undefined;
        const { couleur } = STATUT_PAR_THEME[theme];
        StatusBar.setBackgroundColor({ color: couleur }).catch(() => {});
    }, [cameraActive, theme]);

    const ouvrirCamera = async () => {
        try {
            const perm = await CameraPreview.requestPermissions({ disableAudio: true, showSettingsAlert: true });
            if (perm.camera !== 'granted') {
                console.log('Permission caméra refusée:', perm.camera);
                return;
            }
            await CameraPreview.start({
                toBack: true,
                position: 'rear',
                aspectMode: 'cover',
                aspectRatio: 'fill',
                disableAudio: true,
                positioning: 'top',
                includeSafeAreaInsets: true,
            });
            setCameraActive(true);
            try {
                const zoom = await CameraPreview.getZoom();
                setPlageZoom({ min: zoom.min, max: zoom.max });
                setNiveauZoom(zoom.current);
            } catch (err) {
                console.log('Zoom indisponible', err);
            }
        } catch (err) {
            console.log('Ouverture caméra annulée ou refusée', err);
            onEchecAcces?.();
        }
    };

    const appliquerZoom = (niveau: number) => {
        setNiveauZoom(niveau);
        CameraPreview.setZoom({ level: niveau }).catch((err) => console.log('Réglage du zoom échoué', err));
    };

    const fermerCamera = async () => {
        try {
            await CameraPreview.stop();
        } catch (err) {
            console.log('Erreur fermeture caméra', err);
        }
        setCameraActive(false);
        setFlash('off');
        setFace('rear');
        setPlageZoom({ min: 1, max: 1 });
        setNiveauZoom(1);
        StatusBar.setBackgroundColor({ color: STATUT_PAR_THEME[theme].couleur }).catch(() => {});
    };

    const capturerPhoto = async () => {
        try {
            const result = await CameraPreview.capture({ quality: 90 });
            setPhotoACadrer(`data:image/jpeg;base64,${result.value}`);
            setPhotoDepuisCamera(true);
        } catch (err) {
            console.log('Capture annulée ou échouée', err);
        } finally {
            await fermerCamera();
        }
    };

    const basculerFlash = async () => {
        const next = NEXT_FLASH[flash];
        try {
            await CameraPreview.setFlashMode({ flashMode: next });
            setFlash(next);
        } catch (err) {
            console.log('Flash indisponible', err);
        }
    };

    const basculerCamera = async () => {
        try {
            await CameraPreview.flip();
            setFace(NEXT_FACE[face]);
        } catch (err) {
            console.log('Bascule caméra indisponible', err);
        }
    };

    const choisirDansGalerie = async () => {
        try {
            const photo = await Camera.getPhoto({
                resultType: CameraResultType.DataUrl,
                source: CameraSource.Photos,
                quality: 90,
            });
            if (photo.dataUrl) {
                setPhotoACadrer(photo.dataUrl);
                setPhotoDepuisCamera(false);
            } else {
                onEchecAcces?.();
            }
        } catch (err) {
            console.log('Sélection galerie annulée', err);
            onEchecAcces?.();
        } finally {
            document.body.style.backgroundColor = '';
        }
    };

    return {
        photoACadrer, setPhotoACadrer, photoDepuisCamera,
        cameraActive, flash, face, plageZoom, niveauZoom,
        ouvrirCamera, fermerCamera, capturerPhoto,
        basculerFlash, basculerCamera, appliquerZoom, choisirDansGalerie,
    };
}
