/* src/pages/HomePage.tsx (Version 1.1.0) */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as RouterDom from 'react-router-dom';
import { useTheme } from '../context/theme';
import { useUiLang, useThemeAssets } from '../communs';
import { getUserCreations, type UserCreation } from '../utils/userCreations';
import { getScrollTop, setScrollTop, addScrollListener } from '../utils/scrollElement';
import { traduireCreationsEnLot, type ChampsVignetteTraduits } from '../utils/traduction';
import CreationFrame from '../components/CreationFrame';

interface Creation {
    id: number;
    title: string;
    imageUrl: string;
    style: string;
    category: string;
    bio?: string;
    histoire?: string;
    salutation?: string;
    creatorPseudo?: string;
    nbMessages?: number; // nombre de messages adressés au personnage
}

const categories = ['Tous', 'Famille', 'Amis', 'Rencontres', 'People', 'Voyage', 'Fiction', 'Animaux', 'Science', 'Histoire'];

// Clés d'URL stables (indépendantes de la langue) -> nom de catégorie réel dans les données.
const CATEGORY_KEY_TO_NAME: Record<string, string> = {
    famille: 'Famille',
    amis: 'Amis',
    rencontres: 'Rencontres',
    people: 'People',
    fiction: 'Fiction',
    histoire: 'Histoire',
};

const NOUVEAU_LIMIT = 50;
const PAGE_SIZE = 50;

// Pour qu'une création faite sur un autre téléphone apparaisse ici sans
// avoir à quitter/revenir sur la page.
const RAFRAICHISSEMENT_MS = 7000;

// Mémorise la dernière page consultée par catégorie (persiste tant que l'app
// tourne, même si HomePage est démontée/remontée en changeant d'onglet) :
// première visite d'une catégorie -> page 1 ; retour sur une catégorie déjà
// visitée -> reprend là où on l'a laissée.
const paginationMemoire: Record<string, number> = {};

// Position de scroll mémorisée par "catégorie:page" (voir scrollKey plus bas).
const scrollMemoireAccueil: Record<string, number> = {};

const mockCreations: Creation[] = [
    { id: 101, title: "Portrait Famille Cyber", imageUrl: 'placeholder', style: 'Cyberpunk', category: 'Famille' },
    { id: 102, title: "Soirée entre Amis", imageUrl: 'placeholder', style: 'Néon', category: 'Amis' },
    { id: 103, title: "Dîner Romantique", imageUrl: 'placeholder', style: 'Rétro', category: 'Rencontres' },
    { id: 104, title: "Star sur Tapis Rouge", imageUrl: 'placeholder', style: 'Glamour', category: 'People' },
    { id: 105, title: "Réunion de Famille", imageUrl: 'placeholder', style: 'Classique', category: 'Famille' },
    { id: 106, title: "Groupe d'Amis", imageUrl: 'placeholder', style: 'Urbain', category: 'Amis' },
    { id: 107, title: "Premier Date", imageUrl: 'placeholder', style: 'Romantique', category: 'Rencontres' },
    { id: 108, title: "Influenceur Mode", imageUrl: 'placeholder', style: 'Moderne', category: 'People' },
    // 392 générées + 8 fixes = 400 -> exactement 8 pages de 50 sur "Tous", pour la démo de pagination.
    ...Array.from({ length: 392 }, (_, i) => ({
        id: 200 + i,
        title: `Création ${i + 1} - ${categories[i % categories.length]}`,
        imageUrl: 'placeholder',
        style: i % 2 === 0 ? 'Cyberpunk' : 'Fantaisie',
        category: categories[i % categories.length],
    })),
];



interface HomePageProps {
    searchTerm: string;
}

const HomePage: React.FC<HomePageProps> = ({ searchTerm }) => {
    const navigate = RouterDom.useNavigate();
    const t = useUiLang();
    const { lang } = useTheme();
    const assets = useThemeAssets();
    const { categorie: categoryKey } = RouterDom.useParams<{ categorie?: string }>();
    const isNouveau = categoryKey === 'nouveau';
    const categoryName = categoryKey ? CATEGORY_KEY_TO_NAME[categoryKey] : undefined;

    const [userCreations, setUserCreations] = useState<UserCreation[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [isLoadingCreations, setIsLoadingCreations] = useState(true);
    const [traductions, setTraductions] = useState<Record<number, ChampsVignetteTraduits>>({});

    const categoryStorageKey = categoryKey ?? 'tous';

    // Réinitialise la page affichée quand on change de catégorie ou qu'une
    // recherche démarre/s'arrête, en comparant à la navigation précédente
    // pendant le rendu plutôt que via un effet (évite un rendu superflu).
    const navKey = `${categoryStorageKey}|${searchTerm ? '1' : '0'}`;
    const [prevNavKey, setPrevNavKey] = useState(navKey);
    if (navKey !== prevNavKey) {
        setPrevNavKey(navKey);
        setCurrentPage(searchTerm ? 1 : (paginationMemoire[categoryStorageKey] ?? 1));
    }

    useEffect(() => {
        paginationMemoire[categoryStorageKey] = currentPage;
    }, [currentPage, categoryStorageKey]);

    // Position de scroll mémorisée par combinaison catégorie+page (le
    // conteneur <main> reste monté d'une catégorie à l'autre, donc sans ça sa
    // position de scroll fuiterait d'une page à l'autre). Première visite
    // d'une page -> tout en haut ; retour sur une page déjà vue -> reprend
    // exactement où on l'avait laissée.
    const scrollKey = `${categoryStorageKey}:${currentPage}`;

    // Refait la restauration une fois les personnages chargés (isLoadingCreations
    // passe à false) : au tout premier essai, juste après le montage, la
    // grille peut ne pas encore être assez haute (chargement pas fini) pour
    // que la position mémorisée existe réellement, et la restauration
    // échoue silencieusement sans se redéclencher plus tard.
    useEffect(() => {
        setScrollTop(scrollMemoireAccueil[scrollKey] ?? 0);
    }, [scrollKey, isLoadingCreations]);

    useEffect(() => {
        return addScrollListener(() => {
            scrollMemoireAccueil[scrollKey] = getScrollTop();
        });
    }, [scrollKey]);

    // Quand le texte de recherche change, remonte la page tout en haut pour que les résultats
    // s'affichent sous la barre de recherche (et non dessous). Ignoré au premier affichage,
    // pour ne pas effacer la position mémorisée en revenant sur la page.
    const rechercheAvant = useRef(searchTerm);
    useEffect(() => {
        if (rechercheAvant.current !== searchTerm) {
            rechercheAvant.current = searchTerm;
            setScrollTop(0);
        }
    }, [searchTerm]);

    useEffect(() => {
        let cancelled = false;
        const charger = (afficherChargement: boolean) => {
            if (afficherChargement) setIsLoadingCreations(true);
            getUserCreations()
                .then((creations) => { if (!cancelled) setUserCreations(creations); })
                .catch((err) => console.log('Chargement des personnages échoué', err))
                .finally(() => { if (!cancelled && afficherChargement) setIsLoadingCreations(false); });
        };
        charger(true);
        const intervalId = window.setInterval(() => charger(false), RAFRAICHISSEMENT_MS);
        return () => { cancelled = true; window.clearInterval(intervalId); };
    }, []);

    const allCreations = useMemo(() => [...userCreations, ...mockCreations], [userCreations]);

    const filteredCreations = useMemo(() => {
        // Toujours la plus récente en premier (en haut à gauche), les plus
        // anciennes ensuite.
        let results = [...allCreations].sort((a, b) => b.id - a.id);

        if (categoryName) {
            results = results.filter(c => c.category === categoryName);
        }

        if (searchTerm) {
            const lowerSearchTerm = searchTerm.toLowerCase();
            results = results.filter(c =>
                c.title.toLowerCase().includes(lowerSearchTerm) ||
                c.style.toLowerCase().includes(lowerSearchTerm) ||
                c.category.toLowerCase().includes(lowerSearchTerm)
            );
        }

        if (isNouveau) {
            results = results.slice(0, NOUVEAU_LIMIT);
        }

        return results;
    }, [allCreations, searchTerm, categoryName, isNouveau]);

    const totalPages = isNouveau ? 1 : Math.max(1, Math.ceil(filteredCreations.length / PAGE_SIZE));
    const pageStart = (currentPage - 1) * PAGE_SIZE;
    const visibleCreations = isNouveau
        ? filteredCreations
        : filteredCreations.slice(pageStart, pageStart + PAGE_SIZE);
    const showPagination = !isNouveau && totalPages > 1;

    const idsVisibles = useMemo(() => visibleCreations.map((c) => c.id).join(','), [visibleCreations]);

    useEffect(() => {
        let annule = false;
        const ids = idsVisibles ? idsVisibles.split(',').map(Number) : [];
        traduireCreationsEnLot(ids, lang)
            .then((resultat) => { if (!annule) setTraductions(resultat); })
            .catch((err) => console.log('Traduction des vignettes échouée', err));
        return () => { annule = true; };
    }, [idsVisibles, lang]);

    const paginationBar = (
        <div className="pagination-bar">
            <button
                type="button"
                className="pagination-arrow"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
                <img src={assets.fleche} alt={t.pagePrecedente} className="pagination-arrow-img fleche-retour" />
            </button>
            <span className="pagination-label">{t.pageLabel} {currentPage} / {totalPages}</span>
            <button
                type="button"
                className="pagination-arrow"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
                <img src={assets.fleche} alt={t.pageSuivante} className="pagination-arrow-img" />
            </button>
        </div>
    );

    return (
        <div className={`page-content-container${showPagination ? ' has-pagination' : ''}`}>
            {isLoadingCreations && <div className="sync-spinner" aria-hidden="true" />}

            <div className="creation-grid">
                {visibleCreations.map((creation) => (
                    <CreationFrame
                    key={creation.id}
                    id={creation.id}
                    title={traductions[creation.id]?.title || creation.title}
                    imageUrl={creation.imageUrl}
                    bio={traductions[creation.id]?.bio || creation.bio}
                    creatorPseudo={creation.creatorPseudo}
                    nbMessages={creation.nbMessages}
                    onClick={() => navigate(`/personnage/${creation.id}`, { state: { creation } })}
                    />
                ))}
                {filteredCreations.length === 0 && (
                    <p style={{ color: 'white', gridColumn: '1/-1', textAlign: 'center', marginTop: '20px' }}>
                        {t.aucunResultat}{searchTerm ? ` "${searchTerm}"` : ''}.
                    </p>
                )}
            </div>

            {showPagination && paginationBar}

        </div>
    );
};

export default HomePage;
