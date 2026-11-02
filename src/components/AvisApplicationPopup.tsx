/* src/components/AvisApplicationPopup.tsx */
import React, { useEffect, useState } from 'react';
import { useUiLang, PageDuBas } from '../communs';
import { envoyerAvisApplication } from '../utils/avisApplication';

// Fenêtre globale (montée une fois dans App.tsx, visible sur n'importe
// quelle page) demandant une note de 1 à 5 étoiles : affichée une heure
// après le premier lancement de l'app sur cet appareil, puis representée
// toutes les 24h tant que l'utilisateur n'a pas choisi de note (voir
// doitAfficher ci-dessous). Une fois une note envoyée, ne réapparaît plus.
const PREMIER_LANCEMENT_KEY = 'realornot-avis-premier-lancement';
const DERNIER_AFFICHAGE_KEY = 'realornot-avis-dernier-affichage';
const AVIS_DONNE_KEY = 'realornot-avis-donne';

const UNE_HEURE_MS = 60 * 60 * 1000;
const VINGT_QUATRE_HEURES_MS = 24 * 60 * 60 * 1000;
// Fréquence de vérification pendant que l'app reste ouverte - pas besoin
const INTERVALLE_VERIFICATION_MS = 60 * 1000;

const doitAfficher = (): boolean => {
    if (localStorage.getItem(AVIS_DONNE_KEY) === 'true') return false;

    let premierLancement = Number(localStorage.getItem(PREMIER_LANCEMENT_KEY));
    if (!premierLancement) {
        // Première fois qu'on voit cet appareil : on démarre le compteur
        // d'une heure à partir de maintenant, sans encore rien afficher.
        premierLancement = Date.now();
        localStorage.setItem(PREMIER_LANCEMENT_KEY, String(premierLancement));
        return false;
    }
    if (Date.now() - premierLancement < UNE_HEURE_MS) return false;

    const dernierAffichage = Number(localStorage.getItem(DERNIER_AFFICHAGE_KEY));
    if (dernierAffichage && Date.now() - dernierAffichage < VINGT_QUATRE_HEURES_MS) return false;

    return true;
};

const AvisApplicationPopup: React.FC = () => {
    const t = useUiLang();
    const [visible, setVisible] = useState(false);
    const [enCours, setEnCours] = useState(false);
    const [remercie, setRemercie] = useState(false);

    useEffect(() => {
        const verifier = () => {
            if (doitAfficher()) {
                localStorage.setItem(DERNIER_AFFICHAGE_KEY, String(Date.now()));
                setVisible(true);
            }
        };
        verifier();
        const id = window.setInterval(verifier, INTERVALLE_VERIFICATION_MS);
        return () => window.clearInterval(id);
    }, []);

    if (!visible) return null;

    const handleEtoile = async (note: number) => {
        if (enCours) return;
        setEnCours(true);
        try {
            await envoyerAvisApplication(note);
            localStorage.setItem(AVIS_DONNE_KEY, 'true');
            setRemercie(true);
        } catch (err) {
            console.log('Envoi de l\'avis échoué', err);
        } finally {
            setEnCours(false);
        }
    };

    // Page qui monte du bas (plus de popup), comme les autres pages : boutons annuler.png / continuer.png,
    // la croix en haut à droite et « Plus tard » ferment la page avec la même descente.
    return (
        <PageDuBas onFermer={() => setVisible(false)}>
            {(fermer) => (
                <div className="update-prompt-overlay">
                    <div className="update-prompt-box profil-recommencer-confirmation">
                        {remercie ? (
                            <>
                                <p className="update-prompt-text">{t.avisMerci ?? 'Merci pour ton avis !'}</p>
                                <div className="update-prompt-actions">
                                    <button
                                        type="button"
                                        className="update-prompt-btn update-prompt-btn-primary"
                                        onClick={fermer}
                                    >
                                        {t.valider}
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <p className="update-prompt-text">
                                    {t.avisApplicationTitre ?? "Que penses-tu de l'application ?"}
                                </p>
                                <div className="avis-etoiles">
                                    {[1, 2, 3, 4, 5].map((n) => (
                                        <button
                                            key={n}
                                            type="button"
                                            className="avis-etoile-btn"
                                            onClick={() => handleEtoile(n)}
                                            disabled={enCours}
                                            aria-label={`${n} ★`}
                                        >
                                            ★
                                        </button>
                                    ))}
                                </div>
                                <div className="update-prompt-actions">
                                    <button
                                        type="button"
                                        className="update-prompt-btn update-prompt-btn-secondary"
                                        onClick={fermer}
                                    >
                                        {t.plusTard}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </PageDuBas>
    );
};

export default AvisApplicationPopup;
