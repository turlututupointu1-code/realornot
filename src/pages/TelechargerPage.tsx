/* src/pages/TelechargerPage.tsx */
import React, { useEffect, useState } from 'react';
import { useThemeAssets, BanniereTitre, HeaderRetour } from '../communs';
import { obtenirReleases, urlTelechargementRelease, type Releases, type Plateforme } from '../utils/releases';

// Page publique de téléchargement (voir spec_page_telechargement.md) -
// accessible sans compte ni connexion, distincte de la mise à jour in-app
// Android (UpdatePrompt.tsx) qui reste inchangée.
const PLATEFORMES: { cle: Plateforme; label: string }[] = [
    { cle: 'android', label: 'Android' },
    { cle: 'windows', label: 'Windows' },
    { cle: 'linux', label: 'Linux (.deb)' },
];

const TelechargerPage: React.FC = () => {
    const assets = useThemeAssets();
    const [releases, setReleases] = useState<Releases | null>(null);
    const [erreur, setErreur] = useState<string | null>(null);

    useEffect(() => {
        obtenirReleases().then(setReleases).catch((e) => setErreur(e.message));
    }, []);

    return (
        <div className="page-content-container create-page telechargement-page">
            <HeaderRetour />

            <BanniereTitre texte="Télécharger l'application" />

            {erreur && <p className="compte-erreur-texte">{erreur}</p>}
            {!releases && !erreur && <p>Chargement...</p>}

            {releases && PLATEFORMES.map(({ cle, label }) => {
                const derniere = releases[cle]?.[0];
                return (
                    <div key={cle} className="create-box telechargement-carte">
                        <h3 className="telechargement-plateforme">{label}</h3>
                        {derniere ? (
                            <>
                                <p className="telechargement-version">
                                    Version {derniere.version} — {derniere.date}
                                </p>
                                {derniere.changelog && (
                                    <p className="telechargement-changelog">{derniere.changelog}</p>
                                )}
                                <a
                                    className="create-btn create-btn-image btn-bouton-png telechargement-bouton"
                                    href={urlTelechargementRelease(cle, derniere.filename)}
                                >
                                    <img src={assets.barre1} alt="" />
                                    <div className="create-btn-caption">
                                        <span className="create-btn-title">Télécharger</span>
                                    </div>
                                </a>
                            </>
                        ) : (
                            <p>Pas encore disponible.</p>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default TelechargerPage;
