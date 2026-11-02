/* src/pages/RencontreVuesPage.tsx */
import React, { useEffect, useState } from 'react';
import * as RouterDom from 'react-router-dom';
import { useUiLang, HeaderRetour, BanniereTitre } from '../communs';
import type { VisiteRencontre } from '../utils/rencontre';
import { obtenirVuesRencontre } from '../utils/rencontre';

const CarteVue: React.FC<{ visite: VisiteRencontre; onClick: () => void }> = ({ visite, onClick }) => (
    <div className="creation-card" role="button" onClick={onClick}>
    <div className="creation-card-image">
    <span className="creation-card-creator">{visite.prenom[0]?.toUpperCase()}</span>
    </div>
    <div className="creation-card-info">
    <div className="creation-card-title">{visite.prenom}</div>
    </div>
    </div>
);

// Page "vues de profil" (voir compteurs_visites.md) : qui a consulté ma
// bio, les nouvelles visites (depuis la dernière fois que j'ai ouvert cette
// page) en haut, les anciennes en dessous. Consulter cette page remet à
// zéro le compteur de "nouvelles vues" côté serveur (voir
// obtenirVuesRencontre).
const RencontreVuesPage: React.FC = () => {
    const t = useUiLang();
    const navigate = RouterDom.useNavigate();
    const [nouvelles, setNouvelles] = useState<VisiteRencontre[]>([]);
    const [anciennes, setAnciennes] = useState<VisiteRencontre[]>([]);
    const [chargement, setChargement] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const vues = await obtenirVuesRencontre();
                setNouvelles(vues.nouvelles);
                setAnciennes(vues.anciennes);
            } catch {
                // Page vide en cas d'échec (ex. hors-ligne).
            } finally {
                setChargement(false);
            }
        })();
    }, []);

    if (chargement) return null;

    const listeVide = nouvelles.length === 0 && anciennes.length === 0;

    return (
        <div className="page-content-container create-page moi-page">
            <HeaderRetour />
            <BanniereTitre texte={t.vuesPageTitre ?? 'Vues de profil'} />

            {listeVide && (
                <p className="texte-vide-centre">{t.aucuneVueTexte ?? 'Personne n\'a encore vu ton profil.'}</p>
            )}

            {nouvelles.length > 0 && (
                <>
                    <p className="rencontre-question-categorie">{t.vuesNouvellesTitre ?? 'Nouvelles visites'}</p>
                    <div className="creation-grid">
                    {nouvelles.map((v) => (
                        <CarteVue key={v.pseudo} visite={v} onClick={() => navigate(`/rencontre/voir/${v.pseudo}`)} />
                    ))}
                    </div>
                </>
            )}

            {anciennes.length > 0 && (
                <>
                    <p className="rencontre-question-categorie">{t.vuesAnciennesTitre ?? 'Visites précédentes'}</p>
                    <div className="creation-grid">
                    {anciennes.map((v) => (
                        <CarteVue key={v.pseudo} visite={v} onClick={() => navigate(`/rencontre/voir/${v.pseudo}`)} />
                    ))}
                    </div>
                </>
            )}
        </div>
    );
};

export default RencontreVuesPage;
