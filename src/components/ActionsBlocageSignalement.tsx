/* src/components/ActionsBlocageSignalement.tsx */
import React, { useState } from 'react';
import { useUiLang, PageDuBas } from '../communs';
import { bloquerProfilRencontre, signalerProfilRencontre, MOTIFS_SIGNALEMENT_RENCONTRE } from '../utils/rencontre';

interface Props {
    pseudo: string;
    // Boutons pleine largeur façon RencontreProfilPage ("grand") ou petits
    // boutons dans l'en-tête d'une conversation ("compact", peu de place) -
    // voir spec_bloquer_signaler.md : les deux actions doivent être
    // accessibles depuis ces deux endroits.
    variante: 'grand' | 'compact';
    // Le profil bloqué devient invisible (voir /rencontre/bloquer côté
    // serveur) - l'appelant décide où naviguer une fois le blocage confirmé.
    onBloque: () => void;
}

// Réutilise le modal générique de sélection de motif déjà utilisé pour le
// signalement d'un personnage IA (voir .signaler-motifs/.update-prompt-*
// dans base.css, partagés par UpdatePrompt/PopupPseudo/PersonnagePage) -
// même mécanisme visuel, mais route et motifs propres à un profil de
// rencontre (voir /rencontre/signaler, distinct de /reports).
const ActionsBlocageSignalement: React.FC<Props> = ({ pseudo, variante, onBloque }) => {
    const t = useUiLang();
    const [signalementOuvert, setSignalementOuvert] = useState(false);
    const [signalementEnvoye, setSignalementEnvoye] = useState(false);
    const [motifChoisi, setMotifChoisi] = useState<string | null>(null);
    const [envoiEnCours, setEnvoiEnCours] = useState(false);
    const [erreur, setErreur] = useState<string | null>(null);
    // Confirmation de blocage (voir consigne_prudence_popups.md) - remplace
    // window.confirm/window.alert par la même fenêtre interne que le
    // signalement ci-dessous ; la logique de blocage elle-même
    // (bloquerProfilRencontre puis onBloque) est strictement inchangée,
    // seul son déclencheur visuel change.
    const [confirmationBlocageOuverte, setConfirmationBlocageOuverte] = useState(false);
    const [blocageEnCours, setBlocageEnCours] = useState(false);
    const [erreurBlocage, setErreurBlocage] = useState<string | null>(null);

    // Mêmes libellés/traductions que le signalement d'un personnage IA (voir
    // PersonnagePage.tsx) - un seul jeu de motifs pour toute l'appli.
    const motifsLibelles: Record<string, string> = {
        'Contenu sexuel': t.motifContenuSexuel,
        'Suicide ou automutilation': t.motifSuicideAutomutilation,
        'Sécurité des enfants': t.motifSecuriteEnfants,
        'Harcèlement ou intimidation': t.motifHarcelement,
        'Discours haineux et discrimination': t.motifDiscoursHaineux,
        'Autre': t.motifAutre,
    };

    const handleBloquer = () => {
        setErreurBlocage(null);
        setConfirmationBlocageOuverte(true);
    };

    const confirmerBlocage = async () => {
        if (blocageEnCours) return;
        setBlocageEnCours(true);
        setErreurBlocage(null);
        try {
            await bloquerProfilRencontre(pseudo);
            setConfirmationBlocageOuverte(false);
            onBloque();
        } catch (err) {
            setErreurBlocage(err instanceof Error ? err.message : 'Erreur.');
        } finally {
            setBlocageEnCours(false);
        }
    };

    const fermerConfirmationBlocage = () => {
        setConfirmationBlocageOuverte(false);
        setErreurBlocage(null);
    };

    const handleEnvoyerSignalement = async () => {
        if (!motifChoisi || envoiEnCours) return;
        setEnvoiEnCours(true);
        setErreur(null);
        try {
            await signalerProfilRencontre(pseudo, motifChoisi);
            setSignalementEnvoye(true);
        } catch (err) {
            setErreur(err instanceof Error ? err.message : 'Erreur.');
        } finally {
            setEnvoiEnCours(false);
        }
    };

    const fermerSignalement = () => {
        setSignalementOuvert(false);
        setSignalementEnvoye(false);
        setMotifChoisi(null);
        setErreur(null);
    };

    const classeBouton = variante === 'grand' ? 'rencontre-action-bouton-grand' : 'rencontre-action-bouton-compact';

    return (
        <>
            <div className={variante === 'grand' ? 'rencontre-actions-blocage' : 'rencontre-header-actions'}>
                <button type="button" className={classeBouton} onClick={handleBloquer}>
                    {t.bloquerBtn ?? 'Bloquer'}
                </button>
                <button type="button" className={classeBouton} onClick={() => setSignalementOuvert(true)}>
                    {t.signalerBtn ?? 'Signaler'}
                </button>
            </div>

            {confirmationBlocageOuverte && (
                // Page qui monte du bas (plus de popup) : boutons annuler.png / continuer.png,
                // la croix et « Annuler » ferment la page avec la même descente.
                <PageDuBas onFermer={fermerConfirmationBlocage}>
                    {(fermer) => (
                        <div className="update-prompt-overlay">
                            <div className="update-prompt-box profil-recommencer-confirmation">
                                <p className="update-prompt-text">{t.confirmerBlocage ?? 'Bloquer cette personne ?'}</p>
                                {erreurBlocage && <p className="compte-erreur-texte">{erreurBlocage}</p>}
                                <div className="update-prompt-actions">
                                    <button
                                        type="button"
                                        className="update-prompt-btn update-prompt-btn-secondary"
                                        onClick={fermer}
                                        disabled={blocageEnCours}
                                    >
                                        {t.annuler}
                                    </button>
                                    <button
                                        type="button"
                                        className="update-prompt-btn update-prompt-btn-primary"
                                        onClick={confirmerBlocage}
                                        disabled={blocageEnCours}
                                    >
                                        {t.bloquerBtn ?? 'Bloquer'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </PageDuBas>
            )}

            {signalementOuvert && (
                // Page qui monte du bas (plus de popup) pour choisir le motif du signalement
                <PageDuBas onFermer={fermerSignalement}>
                    {(fermer) => (
                        <div className="update-prompt-overlay">
                            <div className="update-prompt-box profil-recommencer-confirmation">
                                {signalementEnvoye ? (
                                    <p className="update-prompt-text">{t.rencontreSignalementEnvoye ?? 'Signalement envoyé.'}</p>
                                ) : (
                                    <>
                                        <p className="update-prompt-text">{t.signalerPersonneTitre}</p>
                                        <div className="signaler-motifs">
                                            {MOTIFS_SIGNALEMENT_RENCONTRE.map((motif) => (
                                                <button
                                                    key={motif}
                                                    type="button"
                                                    className={`signaler-motif-btn${motifChoisi === motif ? ' signaler-motif-btn-actif' : ''}`}
                                                    onClick={() => setMotifChoisi(motif)}
                                                >
                                                    {motifsLibelles[motif]}
                                                </button>
                                            ))}
                                        </div>
                                        {erreur && <p className="compte-erreur-texte">{erreur}</p>}
                                    </>
                                )}
                                <div className="update-prompt-actions">
                                    {signalementEnvoye ? (
                                        <button type="button" className="update-prompt-btn update-prompt-btn-primary" onClick={fermer}>
                                            {t.valider}
                                        </button>
                                    ) : (
                                        <>
                                            <button
                                                type="button"
                                                className="update-prompt-btn update-prompt-btn-secondary"
                                                onClick={fermer}
                                                disabled={envoiEnCours}
                                            >
                                                {t.annuler}
                                            </button>
                                            <button
                                                type="button"
                                                className="update-prompt-btn update-prompt-btn-primary"
                                                onClick={handleEnvoyerSignalement}
                                                disabled={!motifChoisi || envoiEnCours}
                                            >
                                                {t.envoyer}
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </PageDuBas>
            )}
        </>
    );
};

export default ActionsBlocageSignalement;
