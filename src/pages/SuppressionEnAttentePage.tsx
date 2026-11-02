/* src/pages/SuppressionEnAttentePage.tsx */
import { useState } from 'react';
import '../homepage/AgeGate.css';
import { useUiLang, useThemeAssets } from '../communs';
import { annulerSuppressionCompte, effacerCompte } from '../utils/compte';
import { oublierMotDePasseConfirme } from './useModeReelAcces';

interface SuppressionEnAttentePageProps {
    joursRestants: number;
    onAnnule: () => void;
}

// Affiché par ModeReelGuard à la place du site dès qu'un compte reconnecté
// est en attente de suppression (voir spec_suppression_compte.md) - se
// reconnecter seul ne suffit pas à annuler la suppression, il faut cliquer
// explicitement sur le bouton ci-dessous.
export default function SuppressionEnAttentePage({ joursRestants, onAnnule }: SuppressionEnAttentePageProps) {
    const t = useUiLang();
    const assets = useThemeAssets();
    const [chargement, setChargement] = useState(false);
    const [erreur, setErreur] = useState('');

    const handleAnnuler = async () => {
        if (chargement) return;
        setChargement(true);
        setErreur('');
        try {
            await annulerSuppressionCompte();
            onAnnule();
        } catch (err) {
            setErreur(err instanceof Error ? err.message : (t.compteErreurGenerique ?? 'Erreur, réessaie.'));
        } finally {
            setChargement(false);
        }
    };

    const handleDeconnexion = () => {
        effacerCompte();
        oublierMotDePasseConfirme();
        window.location.reload();
    };

    const texte = (t.suppressionEnAttenteTexte
        ?? "La suppression de ce compte a été demandée. Il reste {jours} jour(s) avant l'effacement définitif. Tu peux annuler cette suppression ci-dessous.")
        .replace('{jours}', String(joursRestants));

    return (
        <div className="age-gate">
            <div className="age-gate__card">
                <h2>{t.suppressionEnAttenteTitre ?? 'Compte en attente de suppression'}</h2>
                <p>{texte}</p>

                {erreur && <p className="age-gate__error">{erreur}</p>}

                <div className="update-prompt-actions-images">
                    <button
                        type="button"
                        className="create-btn create-btn-image btn-bouton-png"
                        onClick={handleDeconnexion}
                        disabled={chargement}
                    >
                        <img src={assets.barre1} alt="" />
                        <div className="create-btn-caption">
                            <span className="create-btn-title">{t.deconnexionBtn ?? 'Se déconnecter'}</span>
                        </div>
                    </button>
                    <button
                        type="button"
                        className="create-btn create-btn-image btn-bouton-png"
                        onClick={handleAnnuler}
                        disabled={chargement}
                    >
                        <img src={assets.barre1} alt="" />
                        <div className="create-btn-caption">
                            <span className="create-btn-title">{t.suppressionAnnulerBtn ?? 'Annuler la suppression'}</span>
                        </div>
                    </button>
                </div>
            </div>
        </div>
    );
}
