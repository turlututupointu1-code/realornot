/* src/pages/ChoisirVoix.tsx */
import React, { useState } from 'react';
import { useUiLang, useThemeAssets, BanniereTitre, ChevronArrow } from '../communs';
import NavArrow from '../components/NavArrow';
import Voice from '../plugins/voice';
import { useUnSeulOuvert } from '../utils/useUnSeulOuvert';
import { VOIX_FEMININES, VOIX_MASCULINES, VOIX_NOM_FEMININE, VOIX_NOM_MASCULINE, VOIX_CHOISIE_KEY } from '../utils/voix';
import type { VoixSection, VoixChoisie } from '../utils/voix';

const jouerVoix = (pitch: number, rate: number, voiceName: string, phrase: string, langueTag: string) => {
    Voice.speak({ text: phrase, pitch, rate, voiceName, langueTag }).catch((err) => {
        console.log('Lecture de la voix échouée', err);
    });
};

const IconHautParleur: React.FC = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
);

// Toutes les voix d'un genre dans UNE seule grille, dans l'ordre de utils/voix.ts (pas de trou entre les
// sections, pas de bouton seul) : petits boutons (nom du trait + haut-parleur), la voix choisie est pleine.
const VoixSectionList: React.FC<{
    items: VoixSection['items'];
    voiceName: string;
    traits: string[];
    phrase: string;
    langueTag: string;
    voixSelectionnee: string | null;
    onSelect: (cle: string) => void;
}> = ({ items, voiceName, traits, phrase, langueTag, voixSelectionnee, onSelect }) => (
    <div className="details-suggestions-row voix-grille">
        {items.map((voix) => (
            <button
                type="button"
                key={voix.cle}
                className={`details-suggestion-chip voix-chip${voixSelectionnee === voix.cle ? ' details-suggestion-chip-active' : ''}`}
                onClick={() => {
                    onSelect(voix.cle);
                    const voixChoisie: VoixChoisie = { cle: voix.cle, index: voix.index };
                    sessionStorage.setItem(VOIX_CHOISIE_KEY, JSON.stringify(voixChoisie));
                    jouerVoix(voix.pitch, voix.rate, voiceName, phrase, langueTag);
                }}
            >
                <span className="voix-chip-label">{traits[voix.index] ?? voix.cle}</span>
                <span className="voix-chip-speaker">
                    <IconHautParleur />
                </span>
            </button>
        ))}
    </div>
);

const ChoisirVoix: React.FC = () => {
    const t = useUiLang();
    const assets = useThemeAssets();
    const [voixSelectionnee, setVoixSelectionnee] = useState<string | null>(null);
    // Un seul panneau ouvert à la fois : voix féminines ou voix masculines
    const panneau = useUnSeulOuvert<'f' | 'h'>();

    // Même système que « Langues parlées » du Profil de rencontre : barre + flèche, cadre dessous
    const renderGroupe = (code: 'f' | 'h', titre: string, sections: VoixSection[], voiceName: string) => {
        const ouvert = panneau.estOuvert(code);
        return (
            <div className="rencontre-categorie-accordeon details-categorie-accordeon">
                <button
                    type="button"
                    className="details-voix-row rencontre-categorie-toggle"
                    onClick={() => panneau.basculer(code)}
                >
                    <img src={assets.barre1} alt="" className="details-categories-bg" />
                    <div className="details-voix-content">
                        <span className="details-voix-label">{titre}</span>
                        <ChevronArrow sens={ouvert ? 'haut' : 'bas'} className="moi-avatar-chevron" />
                    </div>
                </button>
                <div className={`rencontre-categorie-contenu-wrapper${ouvert ? ' ouvert' : ''}`}>
                    <div className="rencontre-categorie-contenu-clip">
                        <div className="create-box rencontre-categorie-contenu">
                            <VoixSectionList
                                items={sections.flatMap((section) => section.items)}
                                voiceName={voiceName}
                                traits={t.voixTraits}
                                phrase={t.phraseExemple}
                                langueTag={t.langueCode}
                                voixSelectionnee={voixSelectionnee}
                                onSelect={setVoixSelectionnee}
                            />
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="page-content-container create-page voix-page">
            <div className="titre-ligne">
                <NavArrow direction="back" />
                <BanniereTitre texte={t.voix}>
                    <img src={assets.palette} alt="" className="create-banner-icon" />
                </BanniereTitre>
            </div>

            {renderGroupe('f', t.voixFeminines, VOIX_FEMININES, VOIX_NOM_FEMININE)}
            {renderGroupe('h', t.voixMasculines, VOIX_MASCULINES, VOIX_NOM_MASCULINE)}
        </div>
    );
};

export default ChoisirVoix;
