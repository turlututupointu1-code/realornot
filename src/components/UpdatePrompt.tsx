/* src/components/UpdatePrompt.tsx */
import React, { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { useUiLang, PageDuBas } from '../communs';
import { SERVER_BASE_URL, APP_VERSION_CODE } from '../config';
import AppUpdate from '../plugins/appUpdate';

// Mécanisme de mise à jour par APK téléchargé, propre à Android - le plugin
// natif "AppUpdate" n'existe que là (voir android/), pas sur Electron/web.
const EST_ANDROID = Capacitor.getPlatform() === 'android';

const UpdatePrompt: React.FC = () => {
    const t = useUiLang();
    const [available, setAvailable] = useState(false);
    const [installing, setInstalling] = useState(false);
    const [progress, setProgress] = useState(0);
    // Le state React ne se reflète pas immédiatement sur le bouton (délai de
    // rendu) : quelques appuis rapprochés peuvent tous passer avant qu'il ne
    // se désactive, et lancer plusieurs installations en parallèle (plusieurs
    // fenêtres d'installateur système à la suite). Cette ref bloque tout de
    // suite, avant même le premier rendu.
    const installLanceRef = useRef(false);

    useEffect(() => {
        if (!EST_ANDROID) return;
        let cancelled = false;
        fetch(`${SERVER_BASE_URL}/app/version`)
            .then((res) => res.json())
            .then((data) => {
                if (!cancelled && typeof data.versionCode === 'number' && data.versionCode > APP_VERSION_CODE) {
                    setAvailable(true);
                }
            })
            .catch(() => {});
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        if (!EST_ANDROID) return;
        const handlePromise = AppUpdate.addListener('downloadProgress', (data) => {
            setProgress(data.percent);
        });
        return () => { handlePromise.then((handle) => handle.remove()); };
    }, []);

    if (!available) return null;

    const handleInstall = async () => {
        if (installLanceRef.current) return;
        installLanceRef.current = true;
        setInstalling(true);
        try {
            // downloadAndInstall se résout dès que l'installation système est
            // lancée (avant même que l'utilisateur ne la confirme) : à ce
            // stade, l'écran système prend le relais, donc on referme tout de
            // suite notre propre popup pour qu'il ne reste pas bloqué à
            // l'écran (ce qu'on prenait pour "une fenêtre qui ne s'efface pas").
            await AppUpdate.downloadAndInstall({ url: `${SERVER_BASE_URL}/app/latest.apk` });
            setAvailable(false);
        } catch (err) {
            console.log('Mise à jour échouée', err);
            installLanceRef.current = false;
            setInstalling(false);
        }
    };

    // Page qui monte du bas (plus de popup) : boutons annuler.png / continuer.png ;
    // la croix et « Plus tard » ferment la page avec la même descente.
    return (
        <PageDuBas onFermer={() => setAvailable(false)} sansCroix={installing}>
            {(fermer) => (
                <div className="update-prompt-overlay">
                    <div className="update-prompt-box profil-recommencer-confirmation">
                        <p className="update-prompt-text">{t.miseAJourDisponible}</p>
                        {installing ? (
                            <>
                                <p className="update-prompt-text">
                                    {t.telechargementEnCours.replace('{percent}', String(progress))}
                                </p>
                                <div className="update-prompt-progress">
                                    <div className="update-prompt-progress-fill" style={{ width: `${progress}%` }} />
                                </div>
                            </>
                        ) : (
                            <div className="update-prompt-actions">
                                <button
                                    type="button"
                                    className="update-prompt-btn update-prompt-btn-secondary"
                                    onClick={fermer}
                                >
                                    {t.plusTard}
                                </button>
                                <button
                                    type="button"
                                    className="update-prompt-btn update-prompt-btn-primary"
                                    onClick={handleInstall}
                                >
                                    {t.installerMaintenant}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </PageDuBas>
    );
};

export default UpdatePrompt;
