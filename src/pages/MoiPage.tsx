/* src/pages/MoiPage.tsx */
import React, { useEffect, useState } from 'react';
import * as RouterDom from 'react-router-dom';
import { useUiLang, useThemeAssets, HeaderRetour, BanniereTitre } from '../communs';
import { AVATARS, chargerProfilVous, enregistrerProfilVous } from '../utils/vousProfil';
import { chargerPseudo, enregistrerPseudo } from '../utils/pseudo';
import { useUnSeulOuvert } from '../utils/useUnSeulOuvert';
import PanneauDeroulant from '../components/PanneauDeroulant';

// Symboles de genre, alignés par position avec t.genres (mêmes couleurs que
// sur la page Détails du personnage).
const GENRE_SYMBOLS = ['♀', '♂', '⚧', '⚥', '⚪'];

// Non-binaire : petit drapeau (jaune, blanc, violet, noir) plutôt qu'un
// symbole, à la place du rond de GENRE_SYMBOLS[4] (voir IconGenreNonBinaire
// dans le rendu ci-dessous).
const IconGenreNonBinaire: React.FC = () => (
    <svg viewBox="0 0 24 16" className="details-genre-flag">
        <rect width="24" height="4" y="0" fill="#FCF434" />
        <rect width="24" height="4" y="4" fill="#FFFFFF" />
        <rect width="24" height="4" y="8" fill="#9C59D1" />
        <rect width="24" height="4" y="12" fill="#2C2C2C" />
    </svg>
);

// Intersexe : drapeau officiel (fond jaune, cercle violet centré) à la place
// du symbole GENRE_SYMBOLS[3].
const IconGenreIntersexe: React.FC = () => (
    <svg viewBox="0 0 24 16" className="details-genre-flag">
        <rect width="24" height="16" fill="#FFD800" />
        <circle cx="12" cy="8" r="5" fill="none" stroke="#7902AA" strokeWidth="2.5" />
    </svg>
);

const MoiPage: React.FC = () => {
    const t = useUiLang();
    const assets = useThemeAssets();
    const navigate = RouterDom.useNavigate();
    const [activeGenreTooltip, setActiveGenreTooltip] = useState<number | null>(null);
    const [genre, setGenre] = useState<number | null>(() => chargerProfilVous().genre);
    // Un seul panneau ouvert à la fois : avatar, pseudo ou caractère (ouvrir l'un ferme les autres)
    const panneau = useUnSeulOuvert<'avatar' | 'pseudo' | 'caractere'>();
    const avatarOuvert = panneau.estOuvert('avatar');
    const pseudoOuvert = panneau.estOuvert('pseudo');
    const caractereOuvert = panneau.estOuvert('caractere');
    const [avatarChoisi, setAvatarChoisi] = useState<number | null>(() => chargerProfilVous().avatarChoisi);
    const [caractere, setCaractere] = useState<string>(() => chargerProfilVous().caractere);
    // null = pas encore de réponse (aucun bouton actif) ; les anciens profils enregistrés n'ont pas ce champ, d'où le ?? null
    const [prevenirNouvelleIA, setPrevenirNouvelleIA] = useState<boolean | null>(() => chargerProfilVous().prevenirNouvelleIA ?? null);
    const [pseudo, setPseudo] = useState<string>(() => chargerPseudo() ?? '');
    const [pseudoSaisie, setPseudoSaisie] = useState(pseudo);

    const handleOuvrirPseudo = () => {
        if (!pseudoOuvert) setPseudoSaisie(pseudo);
        panneau.basculer('pseudo');
    };

    const handleValiderPseudo = () => {
        const valeur = pseudoSaisie.trim();
        if (!valeur) return;
        enregistrerPseudo(valeur);
        setPseudo(valeur);
        panneau.fermer();
    };

    useEffect(() => {
        if (activeGenreTooltip === null) return;
        const timer = window.setTimeout(() => setActiveGenreTooltip(null), 5000);
        return () => window.clearTimeout(timer);
    }, [activeGenreTooltip]);

    useEffect(() => {
        enregistrerProfilVous({ genre, avatarChoisi, caractere, prevenirNouvelleIA });
    }, [genre, avatarChoisi, caractere, prevenirNouvelleIA]);

    return (
        <div className="page-content-container create-page moi-page">
            <HeaderRetour />
            <BanniereTitre texte={t.messages}>
                {avatarChoisi !== null ? (
                    <button
                        type="button"
                        className="profil-conversation-avatar-btn"
                        onClick={() => panneau.basculer('avatar')}
                        aria-label={t.avatar}
                    >
                        <img src={AVATARS[avatarChoisi]} alt="" className="profil-conversation-avatar-img" />
                    </button>
                ) : (
                    <img src={assets.palette} alt="" className="create-banner-icon" />
                )}
            </BanniereTitre>

            <div className="create-box moi-info-box">
                <p className="personnage-field-text">{t.vousInfoMemoire}</p>
            </div>

            <div className="details-genre-row moi-genre-row">
                <img src={assets.barre1} alt="" className="details-categories-bg" />
                <div className="details-genre-items">
                    {GENRE_SYMBOLS.map((symbol, i) => (
                        <div key={symbol} className="details-genre-item">
                            <button
                                type="button"
                                className={`details-genre-symbol details-genre-symbol-${i}${genre === i ? ' details-genre-symbol-active' : ''}`}
                                onClick={() => {
                                    setGenre(i);
                                    setActiveGenreTooltip(activeGenreTooltip === i ? null : i);
                                }}
                            >
                                {i === 3 ? <IconGenreIntersexe /> : i === 4 ? <IconGenreNonBinaire /> : symbol}
                            </button>
                            {activeGenreTooltip === i && (
                                <span className="details-genre-tooltip">{t.genres[i]}</span>
                            )}
                        </div>
                    ))}
                </div>
            </div>
            {/* Avatar, pseudonyme, caractère : même composant PanneauDeroulant (barre + flèche + panneau collé sous la barre) */}
            <PanneauDeroulant
            classe="moi-avatar-toggle"
            titre={t.avatar}
            ouvert={avatarOuvert}
            onBasculer={() => panneau.basculer('avatar')}
            droite={avatarChoisi !== null && <img src={AVATARS[avatarChoisi]} alt="" className="moi-avatar-toggle-img" />}
            >
            <div className="moi-avatar-grid">
            {AVATARS.map((avatar, i) => (
                <button
                type="button"
                key={i}
                className={`moi-avatar-item${avatarChoisi === i ? ' moi-avatar-item-active' : ''}`}
                onClick={() => setAvatarChoisi(i)}
                >
                <img src={avatar} alt="" className="moi-avatar-img" />
                </button>
            ))}
            </div>
            </PanneauDeroulant>

            <PanneauDeroulant
            classe="moi-pseudo-toggle"
            titre={t.pseudonyme}
            ouvert={pseudoOuvert}
            onBasculer={handleOuvrirPseudo}
            >
            <div className="moi-panel">
            <input
            type="text"
            className="moi-champ"
            placeholder={t.pseudoPlaceholder}
            value={pseudoSaisie}
            onChange={(e) => {
                setPseudoSaisie(e.target.value);
                // Enregistré dès la saisie : plus besoin d'appuyer sur Entrée pour le garder
                const valeur = e.target.value.trim();
                // Enregistré même vide : effacer toutes les lettres efface le pseudo (« Moi » redevient incomplète)
                enregistrerPseudo(valeur);
                setPseudo(valeur);            }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleValiderPseudo(); }}
            maxLength={30}
            spellCheck={false}
            autoFocus
            />
            </div>
            </PanneauDeroulant>

            <PanneauDeroulant
            classe="moi-caractere-toggle"
            titre={t.caractere}
            ouvert={caractereOuvert}
            onBasculer={() => panneau.basculer('caractere')}
            >
            <div className="moi-panel">
            <textarea
            className="moi-champ"
            placeholder={t.caracterePlaceholder}
            value={caractere}
            onChange={(e) => setCaractere(e.target.value)}
            rows={6}
            spellCheck={false}
            autoFocus
            />
            </div>
            </PanneauDeroulant>

            {/* Prévenir si nouvelle IA : Oui / Non. Aucun bouton actif = pas de réponse, « Moi » reste incomplète */}
            <div className="details-voix-row moi-prevenir-row">
            <img src={assets.barre1} alt="" className="details-categories-bg" />
            <div className="details-voix-content">
            {/* 3 choix dans la barre : Oui (1er quart), phrase au milieu = pas de réponse (état de départ), Non (dernier quart). Le choix actif est vert, les autres rouges */}
            <button type="button" className={`moi-prevenir-btn moi-prevenir-btn-oui${prevenirNouvelleIA === true ? ' moi-prevenir-btn-actif' : ''}`} onClick={() => setPrevenirNouvelleIA(true)}>{t.oui}</button>
            <button type="button" className={`moi-prevenir-btn moi-prevenir-btn-milieu${prevenirNouvelleIA === null ? ' moi-prevenir-btn-actif' : ''}`} onClick={() => setPrevenirNouvelleIA(null)}>{t.prevenirNouvelleIA}</button>
            <button type="button" className={`moi-prevenir-btn moi-prevenir-btn-non${prevenirNouvelleIA === false ? ' moi-prevenir-btn-actif' : ''}`} onClick={() => setPrevenirNouvelleIA(false)}>{t.non}</button>
            </div>
            </div>

            <button type="button" className="details-voix-row moi-nav-row" onClick={() => navigate('/moi/creations')}>
                <img src={assets.barre1} alt="" className="details-categories-bg" />
                <div className="details-voix-content">
                    <span className="details-voix-label">{t.vosCreations}</span>
                    <img src={assets.fleche} alt="" className="details-voix-arrow" />
                </div>
            </button>

            <button type="button" className="details-voix-row moi-nav-row" onClick={() => navigate('/moi/discussions')}>
                <img src={assets.barre1} alt="" className="details-categories-bg" />
                <div className="details-voix-content">
                    <span className="details-voix-label">{t.vosDiscussions}</span>
                    <img src={assets.fleche} alt="" className="details-voix-arrow" />
                </div>
            </button>
        </div>
    );
};

export default MoiPage;

