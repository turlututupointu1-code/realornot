/* src/pages/VosCreationsPage.tsx */
import React, { useEffect, useState } from 'react';
import * as RouterDom from 'react-router-dom';
import { useUiLang, useThemeAssets, HeaderRetour, BanniereTitre } from '../communs';
import { getMesCreations, type UserCreation } from '../utils/userCreations';
import CreationFrame from '../components/CreationFrame';


// Pour qu'une création faite sur un autre téléphone apparaisse ici sans
// avoir à quitter/revenir sur la page.
const RAFRAICHISSEMENT_MS = 7000;

const VosCreationsPage: React.FC = () => {
    // useNavigate doit être appelé ici, dans le corps du composant (règle des hooks de React).
    const navigate = RouterDom.useNavigate();
    const t = useUiLang();
    const assets = useThemeAssets();
    const [creations, setCreations] = useState<UserCreation[]>([]);

    useEffect(() => {
        let cancelled = false;
        const charger = () => {
            getMesCreations()
                .then((c) => { if (!cancelled) setCreations(c); })
                .catch((err) => console.log('Chargement des créations échoué', err));
        };
        charger();
        const intervalId = window.setInterval(charger, RAFRAICHISSEMENT_MS);
        return () => { cancelled = true; window.clearInterval(intervalId); };
    }, []);

    return (
        <div className="page-content-container create-page moi-page vos-creations-page">
            <HeaderRetour />

            <BanniereTitre texte={t.vosCreations}>
                <img src={assets.palette} alt="" className="create-banner-icon" />
            </BanniereTitre>

            <div className="creation-grid">
                {/* La plus récente en premier (en haut à gauche). */}
                {[...creations].sort((a, b) => b.id - a.id).map((creation) => (
                    <CreationFrame
                    key={creation.id}
                    id={creation.id}
                    title={creation.title}
                    imageUrl={creation.imageUrl}
                    bio={creation.bio}
                    creatorPseudo={creation.creatorPseudo}
                    onClick={() => navigate('/creer/personnage', { state: { creationExistante: creation } })}
                    />
                ))}
            </div>
        </div>
    );
};

export default VosCreationsPage;
