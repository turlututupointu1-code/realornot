/* src/pages/ModeReelGuard.tsx */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PopupPseudo from '../components/PopupPseudo';
import PageDuBas from '../components/PageDuBas';
import DateNaissanceGate from '../homepage/DateNaissanceGate';
import SuppressionEnAttentePage from './SuppressionEnAttentePage';
import { effacerCompte, sessionValide, obtenirInfoCompte, type InfoCompte } from '../utils/compte';
import {
    useModeReelAcces,
    motDePasseDejaConfirme,
    marquerMotDePasseConfirme,
    oublierMotDePasseConfirme,
    profilRencontreDejaEnregistre,
} from './useModeReelAcces';

// Protège l'accès à la partie "personne réelle" (site de rencontre) - seul
// et unique endroit qui gère ce portail (compte, puis prénom + date de
// naissance), que l'entrée se fasse directement (lien "Passer en mode réel"
// depuis le côté IA, ou lien profond) ou via le bouton "Personne réelle" de
// l'accueil (voir AccueilChoixPage, qui se contente de connecter/créer le
// compte puis de naviguer ici). Étapes : d'abord le compte pseudo/mot de
// passe - redemandé systématiquement (voir PopupPseudo forcerReconnexion)
// tant qu'il ne l'a pas déjà été durant cette session (voir
// motDePasseDejaConfirme), sans pré-remplissage ni salutation, même si un
// compte est déjà connu sur ce téléphone - puis prénom et date de naissance
// sur un seul écran (voir DateNaissanceGate). Une fois ce portail passé, on
// enchaîne directement sur le site (questionnaire).
const ModeReelGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const navigate = useNavigate();
    const { verifie, setVerifie } = useModeReelAcces();
    const [motDePasseOk, setMotDePasseOk] = useState(motDePasseDejaConfirme);
    const [suppressionInfo, setSuppressionInfo] = useState<InfoCompte | null>(null);

    // Vérifie auprès du serveur si ce compte a déjà enregistré son profil de
    // rencontre (voir profilRencontreDejaEnregistre) - seulement une fois le
    // mot de passe confirmé, et seulement si ce n'est pas déjà connu (ex.
    // juste après onConnecte, plus bas, qui le fixe directement, ou le mot
    // de passe déjà confirmé avant même le montage de ce composant - voir
    // AccueilChoixPage, qui navigue ici après connexion/inscription).
    // D'abord la validité du jeton (voir sessionValide) : un jeton périmé
    // (ex. reconnexion du même compte depuis un autre appareil, qui
    // régénère le jeton) faisait échouer silencieusement l'appel suivant et
    // affichait à tort l'écran prénom/date au lieu de redemander le mot de
    // passe - motDePasseOk doit repasser à false dans ce cas précis, pas
    // seulement le marqueur local (qui, lui, ne redéclenche pas ce rendu).
    useEffect(() => {
        if (!motDePasseOk || verifie !== null) return;
        let annule = false;
        (async () => {
            const valide = await sessionValide();
            if (annule) return;
            if (!valide) {
                effacerCompte();
                oublierMotDePasseConfirme();
                setMotDePasseOk(false);
                return;
            }
            // Compte en attente de suppression (voir spec_suppression_compte.md)
            // - se reconnecter seul ne suffit pas à l'annuler : bloque l'accès
            // au site tant que SuppressionEnAttentePage n'a pas été traitée.
            const info = await obtenirInfoCompte();
            if (annule) return;
            if (info?.suppressionEnAttente) {
                setSuppressionInfo(info);
                return;
            }
            const deja = await profilRencontreDejaEnregistre();
            if (!annule) setVerifie(deja);
        })();
        return () => { annule = true; };
    }, [motDePasseOk, verifie, setVerifie]);

    if (!motDePasseOk) {
        return (
            // Même page de connexion que dans AccueilChoixPage (voir PageDuBas) ;
            // la croix ferme la page et ramène à la page recherche (mode IA)
            <PageDuBas onFermer={() => navigate('/mode-ia')}>
            <div className="pseudo-popup-accueil">
                <PopupPseudo
                    modeInitial="connecter"
                    forcerReconnexion
                    onConnecte={async () => {
                        marquerMotDePasseConfirme();
                        setMotDePasseOk(true);
                        // Même vérification "en attente de suppression" que
                        // l'effet ci-dessus (voir spec_suppression_compte.md)
                        // - indispensable ici aussi : une connexion fraîche
                        // passe par ce callback, jamais par l'effet (déjà
                        // court-circuité par motDePasseOk qui vient de
                        // passer à true).
                        const info = await obtenirInfoCompte();
                        if (info?.suppressionEnAttente) {
                            setSuppressionInfo(info);
                            return;
                        }
                        // Recalculé pour le compte qui vient de se connecter,
                        // pas hérité d'un compte précédent dans la même
                        // session.
                        setVerifie(await profilRencontreDejaEnregistre());
                    }}
                />
            </div>
            </PageDuBas>
        );
    }

    if (suppressionInfo) {
        return (
            <SuppressionEnAttentePage
                joursRestants={suppressionInfo.joursRestants ?? 30}
                onAnnule={() => {
                    setSuppressionInfo(null);
                    setVerifie(null);
                }}
            />
        );
    }

    if (verifie === null) {
        return <div className="pseudo-popup-accueil" />;
    }

    if (!verifie) {
        return (
            <DateNaissanceGate
                onConfirme={() => setVerifie(true)}
                onRejete={() => navigate('/')}
            />
        );
    }

    return <>{children}</>;
};

export default ModeReelGuard;
