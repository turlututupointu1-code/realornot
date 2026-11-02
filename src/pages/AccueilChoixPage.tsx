/* src/pages/AccueilChoixPage.tsx */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../homepage/HomePage.css';
import homeImage from '../homepage/homepage_with_logo.png';
import PopupPseudo from '../components/PopupPseudo';
import PageDuBas from '../components/PageDuBas';
import { marquerMotDePasseConfirme, motDePasseDejaConfirme } from './useModeReelAcces';

// Écran d'accueil "choix" (adapté depuis src/homepage/HomePage.tsx) : le
// point d'entrée de l'appli avant de choisir entre les personnages IA
// (/mode-ia, l'ancien accueil) et les vrais profils du site de rencontre
// (/mode-reel).
export default function AccueilChoixPage() {
    const navigate = useNavigate();
    // Cet écran gère uniquement la connexion/inscription du compte, affichée
    // par-dessus l'accueil (qui reste visible en fond). Le prénom, la date
    // de naissance et la vérification du profil déjà enregistré sont gérés
    // uniquement par ModeReelGuard, qui protège déjà la route /mode-reel
    // vers laquelle on navigue juste après - les gérer ici aussi faisait
    // tourner tout ce portail deux fois de suite (une fois ici, une seconde
    // fois en arrivant sur /mode-reel).
    const [compteOuvert, setCompteOuvert] = useState(false);

    return (
        <div className="home-page">
            <img src={homeImage} alt="" className="home-page__bg" />

            <div className="home-page__overlay" />

            <div className="home-page__buttons">
                <button
                    className="home-page__btn home-page__btn--real"
                    // Si le mot de passe a déjà été confirmé sur cet appareil (voir
                    // useModeReelAcces), on saute directement ce popup au lieu de le
                    // rouvrir à chaque fois.
                    onClick={() => (motDePasseDejaConfirme() ? navigate('/mode-reel') : setCompteOuvert(true))}
                >
                    Personne réelle
                </button>

                <button
                    className="home-page__btn home-page__btn--ai"
                    onClick={() => navigate('/mode-ia')}
                >
                    Intelligence Artificielle
                </button>
            </div>

            {compteOuvert && (
                // Même page de connexion que dans ModeReelGuard (voir PageDuBas) ;
                // la croix revient à l'accueil sans rien remplir
                <PageDuBas onFermer={() => setCompteOuvert(false)}>
                <div className="pseudo-popup-accueil">
                <PopupPseudo
                modeInitial="connecter"
                forcerReconnexion
                    onConnecte={() => {
                        marquerMotDePasseConfirme();
                        navigate('/mode-reel');
                    }}
                    />
                    </div>
                    </PageDuBas>
            )}
        </div>
    );
}
