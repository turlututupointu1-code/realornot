/* src/App.tsx (Version 1.3.0) */
import React, { Suspense, lazy, useEffect, useState } from 'react';
import * as RouterDom from 'react-router-dom';
//import './styles/base.css';
import './styles/base.scss';
//import './styles/images.scss';
import './styles/theme-common.css';
import './styles/fleches.css';
//import './styles/noir.css';
//import './styles/beige.css';
//import './styles/cyberpunk.css';
//import './styles/frosted.css';
//import './styles/coque.css';
import './styles/coque.scss';
import './styles/dentelle.scss';
import './styles/cyberpunk.scss';
import './styles/gothique.scss';
import './styles/frosted.scss';
import './styles/avatars.css';
import './styles/burger.css';
import './styles/personnage-bubble-erreur.css';
import './styles/personnage-bubble.css';
import './styles/personnage-menu-contextuel.css';
import ModeReelGuard from './pages/ModeReelGuard';
import TopBar from './components/TopBar';
import UpdatePrompt from './components/UpdatePrompt';
import AvisApplicationPopup from './components/AvisApplicationPopup';
import PopupPseudo from './components/PopupPseudo';
import { getScrollTop, setScrollTop, addScrollListener } from './utils/scrollElement';
import { ThemeProvider } from './context/ThemeContext';
import { useTheme } from './context/theme';

// Chargées à la demande (voir <Suspense> plus bas) plutôt qu'importées ici
// directement : sinon toutes les pages de l'appli (IA et Personne réelle)
// finissaient dans un seul gros fichier JS (~1,8 Mo, avertissement de build
// "chunks larger than 500 kB"), téléchargé et exécuté en entier même pour
// n'afficher qu'un simple écran de connexion.
const HomePage = lazy(() => import('./pages/HomePage'));
const CreatePhoto = lazy(() => import('./pages/CreatePhoto'));
const GenererPhoto = lazy(() => import('./pages/GenererPhoto'));
const TelechargerPhoto = lazy(() => import('./pages/TelechargerPhoto'));
const DetailsPersonnage = lazy(() => import('./pages/DetailsPersonnage'));
const ChoisirVoix = lazy(() => import('./pages/ChoisirVoix'));
const PersonnagePage = lazy(() => import('./pages/PersonnagePage'));
const ProfilConversationUtilisateurPage = lazy(() => import('./pages/ProfilConversationUtilisateurPage'));
const MoiPage = lazy(() => import('./pages/MoiPage'));
const VosCreationsPage = lazy(() => import('./pages/VosCreationsPage'));
const VosDiscussionsPage = lazy(() => import('./pages/VosDiscussionsPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const RencontrePage = lazy(() => import('./pages/RencontrePage'));
const RencontreListePage = lazy(() => import('./pages/RencontreListePage'));
const RencontreProfilPage = lazy(() => import('./pages/RencontreProfilPage'));
const RencontreProfilPhotosPage = lazy(() => import('./pages/RencontreProfilPhotosPage'));
const RencontreProfilDetailsPage = lazy(() => import('./pages/RencontreProfilDetailsPage'));
const RencontrePhotosPage = lazy(() => import('./pages/RencontrePhotosPage'));
const RencontreAjouterPhoto = lazy(() => import('./pages/RencontreAjouterPhoto'));
const RencontreVuesPage = lazy(() => import('./pages/RencontreVuesPage'));
const RencontreMessagesPage = lazy(() => import('./pages/RencontreMessagesPage'));
const RencontreConversationPage = lazy(() => import('./pages/RencontreConversationPage'));
const AccueilChoixPage = lazy(() => import('./pages/AccueilChoixPage'));
const TelechargerPage = lazy(() => import('./pages/TelechargerPage'));

// Pages sans TopBar / BottomBar (flux de création plein écran)
const HIDDEN_CHROME_PREFIXES = ['/creer', '/personnage', '/moi', '/admin', '/rencontre', '/mode-reel/messages', '/mode-reel/vues', '/mode-reel/photos', '/telecharger'];

// Position de scroll mémorisée par route, pour toutes les pages sauf
// l'accueil (qui gère sa propre mémoire, plus fine, par catégorie+page dans
// HomePage.tsx). Première visite d'une page -> tout en haut ; retour sur une
// page déjà visitée -> reprend exactement où on l'avait laissée.
// Demande de pseudo/mot de passe (popup de compte) réactivée : nécessaire
// pour se connecter et pouvoir publier un personnage (le serveur exige un
// compte authentifié pour /creations, indépendamment de ce flag).
const EXIGER_COMPTE = false;

const scrollMemoireGlobale: Record<string, number> = {};
const estPageAccueil = (pathname: string) => pathname === '/mode-ia' || pathname.startsWith('/mode-ia/categorie') || pathname === '/mode-reel';

// Clé de transition entre pages (voir <main key=...> plus bas) : les
// catégories de l'accueil (/mode-ia/categorie/xxx) sont des onglets d'une
// même page, pas des pages différentes - regroupées sous une clé stable
// pour ne pas la remonter (et donc rejouer l'animation) à chaque changement
// de catégorie, contrairement à une vraie navigation vers une autre page.
const cleTransition = (pathname: string) => (
    pathname === '/mode-ia' || pathname.startsWith('/mode-ia/categorie') ? '/mode-ia' : pathname
);

const AppContent: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const { theme } = useTheme();
    const location = RouterDom.useLocation();
    // POP = flèche retour (ou geste retour du téléphone) - la page qui
    // réapparaît vient de la gauche ; PUSH/REPLACE = navigation vers l'avant
    // - la nouvelle page vient de la droite (voir .page-transition-* dans
    // base.css).
    const navigationType = RouterDom.useNavigationType();

    const hideChrome = location.pathname === '/' || HIDDEN_CHROME_PREFIXES.some(prefix => location.pathname.startsWith(prefix));
    // Page "Personne réelle" : le menu burger reste utile (thème, langue,
    // accès admin...), mais la barre de recherche n'a pas de sens ici et
    // chevauchait le contenu de la page.
    const masquerRecherche = location.pathname.startsWith('/mode-reel');
    // Popup de bienvenue/compte : propre au mode IA pour l'instant (soumis à
    // EXIGER_COMPTE) - pas sur l'écran de choix ni côté rencontre, qui a son
    // propre écran (voir ModeReelGuard, seul endroit où il se déclenche,
    // uniquement après avoir choisi "Personne réelle").
    const estModeIA = location.pathname !== '/'
        && !location.pathname.startsWith('/mode-reel')
        && !location.pathname.startsWith('/rencontre');

        // Côté « Personne réelle » : sert à choisir fondecran2 et coque2 (classe mode-reel plus bas)
        const estModeReel = location.pathname.startsWith('/mode-reel') || location.pathname.startsWith('/rencontre');

        useEffect(() => {
            if (estPageAccueil(location.pathname)) return;
            setScrollTop(scrollMemoireGlobale[location.pathname] ?? 0);
    }, [location.pathname]);

    useEffect(() => {
        if (estPageAccueil(location.pathname)) return undefined;
        return addScrollListener(() => {
            scrollMemoireGlobale[location.pathname] = getScrollTop();
        });
    }, [location.pathname]);

    return (
        <div className={`app-root-container theme-${theme}${estModeReel ? ' mode-reel' : ''}`}>            {!hideChrome && (
                <TopBar searchTerm={searchTerm} onSearchChange={setSearchTerm} sansRecherche={masquerRecherche} />
            )}
            <main
                key={cleTransition(location.pathname)}
                className={navigationType === 'POP' ? 'page-transition-back' : 'page-transition-forward'}
            >
                <Suspense fallback={null}>
                <RouterDom.Routes>
                    <RouterDom.Route path="/" element={<AccueilChoixPage />} />
                    <RouterDom.Route path="/mode-ia" element={<HomePage searchTerm={searchTerm} />} />
                    <RouterDom.Route path="/mode-ia/categorie/:categorie" element={<HomePage searchTerm={searchTerm} />} />
                    <RouterDom.Route path="/mode-reel" element={<ModeReelGuard><RencontrePage /></ModeReelGuard>} />
                    <RouterDom.Route path="/mode-reel/photos" element={<ModeReelGuard><RencontrePhotosPage /></ModeReelGuard>} />
                    <RouterDom.Route path="/mode-reel/photos/ajouter" element={<ModeReelGuard><RencontreAjouterPhoto /></ModeReelGuard>} />
                    <RouterDom.Route path="/mode-reel/vues" element={<ModeReelGuard><RencontreVuesPage /></ModeReelGuard>} />
                    <RouterDom.Route path="/mode-reel/messages" element={<ModeReelGuard><RencontreMessagesPage /></ModeReelGuard>} />
                    <RouterDom.Route path="/mode-reel/messages/:pseudo" element={<ModeReelGuard><RencontreConversationPage /></ModeReelGuard>} />
                    <RouterDom.Route path="/creer" element={<CreatePhoto />} />
                    <RouterDom.Route path="/creer/generer" element={<GenererPhoto />} />
                    {/* TODO: remplacer par une vraie page de choix de style quand elle existera */}
                    <RouterDom.Route path="/creer/style" element={<GenererPhoto />} />
                    <RouterDom.Route path="/creer/telecharger" element={<TelechargerPhoto />} />
                    <RouterDom.Route path="/creer/personnage" element={<DetailsPersonnage />} />
                    <RouterDom.Route path="/creer/voix" element={<ChoisirVoix />} />
                    <RouterDom.Route path="/personnage/:id" element={<PersonnagePage />} />
                    <RouterDom.Route path="/personnage/:id/utilisateur" element={<ProfilConversationUtilisateurPage />} />
                    <RouterDom.Route path="/moi" element={<MoiPage />} />
                    <RouterDom.Route path="/moi/creations" element={<VosCreationsPage />} />
                    <RouterDom.Route path="/moi/discussions" element={<VosDiscussionsPage />} />
                    <RouterDom.Route path="/admin" element={<AdminPage />} />
                    <RouterDom.Route path="/telecharger" element={<TelechargerPage />} />
                    <RouterDom.Route path="/rencontre" element={<ModeReelGuard><RencontreListePage /></ModeReelGuard>} />
                    <RouterDom.Route path="/rencontre/voir/:pseudo" element={<ModeReelGuard><RencontreProfilPage /></ModeReelGuard>} />
                    <RouterDom.Route path="/rencontre/voir/:pseudo/photos" element={<ModeReelGuard><RencontreProfilPhotosPage /></ModeReelGuard>} />
                    <RouterDom.Route path="/rencontre/voir/:pseudo/details" element={<ModeReelGuard><RencontreProfilDetailsPage /></ModeReelGuard>} />
                </RouterDom.Routes>
                </Suspense>
            </main>
            <UpdatePrompt />
            <AvisApplicationPopup />
            {estModeIA && EXIGER_COMPTE && <PopupPseudo />}
        </div>
    );
};

const App: React.FC = () => {
    return (
        <ThemeProvider>
            <RouterDom.BrowserRouter>
                <AppContent />
            </RouterDom.BrowserRouter>
        </ThemeProvider>
    );
};

export default App;
