/* src/pages/RencontreListePage.tsx */
import React, { useEffect, useState } from 'react';
import * as RouterDom from 'react-router-dom';
import { useUiLang, HeaderRetour, BanniereTitre } from '../communs';
import type { ProfilRencontre } from '../utils/rencontre';
import { obtenirProfilsRencontre, urlPhotoRencontre } from '../utils/rencontre';

// Page "Personne réelle" : même interface visuelle que l'accueil IA
// (creation-grid/creation-card) mais avec les vrais profils du site de
// rencontre à la place des personnages IA.
const CarteProfil: React.FC<{ profil: ProfilRencontre }> = ({ profil }) => {
    const navigate = RouterDom.useNavigate();
    const photoPresentation = profil.photos?.find((p) => p.id === profil.photoPresentationId);
    return (
        <div
            className="creation-card"
            role="button"
            aria-label={`Profil : ${profil.prenom}`}
            onClick={() => navigate(`/rencontre/voir/${profil.pseudo}`, { state: { profil } })}
        >
            <div
                className="creation-card-image"
                style={photoPresentation ? { backgroundImage: `url(${urlPhotoRencontre(photoPresentation)})` } : undefined}
            >
                {profil.compatibilite != null && (
                    <span className="creation-card-compat">{profil.compatibilite}%</span>
                )}
                {!photoPresentation && <span className="creation-card-creator">{profil.prenom[0]?.toUpperCase()}</span>}
            </div>
            <div className="creation-card-info">
                <div className="creation-card-title">{profil.prenom}</div>
                {profil.bio && <div className="creation-card-bio">{profil.bio}</div>}
            </div>
        </div>
    );
};

const RencontreListePage: React.FC = () => {
    const t = useUiLang();
    const navigate = RouterDom.useNavigate();
    const [searchParams] = RouterDom.useSearchParams();
    const [profils, setProfils] = useState<ProfilRencontre[]>([]);
    const [chargement, setChargement] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                setProfils(await obtenirProfilsRencontre());
            } catch {
                // Liste vide en cas d'échec (ex. hors-ligne).
            } finally {
                setChargement(false);
            }
        })();
    }, []);

    // Filtre optionnel par tranche de compatibilité (voir les entrées
    // "Compatible de X à Y%" du menu burger, qui naviguent ici avec ces
    // paramètres) - un profil sans score calculable (pas assez de réponses
    // en commun) est exclu dès qu'un filtre est actif, faute de pouvoir le
    // classer dans une tranche.
    const min = searchParams.get('min');
    const max = searchParams.get('max');
    const filtreActif = min !== null && max !== null;
    // Listes de compatibilité : triées du plus grand pourcentage au plus petit ;
    // à pourcentage égal, par prénom (ordre alphabétique).
    const profilsAffiches = filtreActif
    ? profils
    .filter((p) => p.compatibilite != null && p.compatibilite >= Number(min) && p.compatibilite <= Number(max))
    .sort((a, b) => (b.compatibilite ?? 0) - (a.compatibilite ?? 0) || a.prenom.localeCompare(b.prenom))
    : profils;
    // Relie visiblement la page à la tranche cliquée dans le menu burger
    // ("Compatible de X à Y%") plutôt que de garder un titre générique.
    const titre = filtreActif
        ? (t.compatibleDeTexte ?? 'Compatible de {min} à {max}%').replace('{min}', min).replace('{max}', max)
        : (t.rencontreListeTitre ?? 'Profils');

    return (
        <div className="page-content-container create-page moi-page">
            <HeaderRetour onClick={() => navigate('/mode-reel')} />

            <BanniereTitre texte={titre} />

            {!chargement && profilsAffiches.length === 0 && (
                <p className="texte-vide-centre">{t.aucunProfilPourInstant ?? "Aucun profil pour l'instant."}</p>
            )}
            <div className="creation-grid">
                {profilsAffiches.map((profil) => (
                    <CarteProfil key={profil.pseudo} profil={profil} />
                ))}
            </div>
        </div>
    );
};

export default RencontreListePage;
