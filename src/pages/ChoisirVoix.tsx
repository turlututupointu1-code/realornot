/* src/pages/ChoisirVoix.tsx */
import React, { useState } from 'react';
import { useUiLang, useThemeAssets, HeaderRetour, BanniereTitre } from '../communs';
import Voice from '../plugins/voice';
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

const VoixSectionList: React.FC<{
    section: VoixSection;
    voiceName: string;
    traits: string[];
    phrase: string;
    langueTag: string;
    voixSelectionnee: string | null;
    onSelect: (cle: string) => void;
}> = ({ section, voiceName, traits, phrase, langueTag, voixSelectionnee, onSelect }) => {
    const assets = useThemeAssets();
    return (
        <div className="voix-subsection">
            <div className="voix-list">
                {section.items.map((voix) => (
                    <button
                        type="button"
                        key={voix.cle}
                        className="voix-item"
                        onClick={() => {
                            onSelect(voix.cle);
                            const voixChoisie: VoixChoisie = { cle: voix.cle, index: voix.index };
                            sessionStorage.setItem(VOIX_CHOISIE_KEY, JSON.stringify(voixChoisie));
                            jouerVoix(voix.pitch, voix.rate, voiceName, phrase, langueTag);
                        }}
                    >
                        <img
                            src={assets.barre1}
                            alt=""
                            className={`details-categories-bg${voixSelectionnee === voix.cle ? ' details-categories-bg-selected' : ''}`}
                        />
                        <div className="voix-item-content">
                            <span className="voix-item-label">{traits[voix.index] ?? voix.cle}</span>
                            <span className="voix-item-speaker">
                                <IconHautParleur />
                            </span>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
};

const ChoisirVoix: React.FC = () => {
    const t = useUiLang();
    const assets = useThemeAssets();
    const [voixSelectionnee, setVoixSelectionnee] = useState<string | null>(null);

    return (
        <div className="page-content-container create-page">
           <HeaderRetour />
            <BanniereTitre texte={t.voix}>
                <img src={assets.palette} alt="" className="create-banner-icon" />
            </BanniereTitre>

            <p className="details-field-label voix-section-title">{t.voixFeminines}</p>
            {VOIX_FEMININES.map((section) => (
                <VoixSectionList
                    key={section.titre}
                    section={section}
                    voiceName={VOIX_NOM_FEMININE}
                    traits={t.voixTraits}
                    phrase={t.phraseExemple}
                    langueTag={t.langueCode}
                    voixSelectionnee={voixSelectionnee}
                    onSelect={setVoixSelectionnee}
                />
            ))}

            <p className="details-field-label voix-section-title">{t.voixMasculines}</p>
            {VOIX_MASCULINES.map((section) => (
                <VoixSectionList
                    key={section.titre}
                    section={section}
                    voiceName={VOIX_NOM_MASCULINE}
                    traits={t.voixTraits}
                    phrase={t.phraseExemple}
                    langueTag={t.langueCode}
                    voixSelectionnee={voixSelectionnee}
                    onSelect={setVoixSelectionnee}
                />
            ))}
        </div>
    );
};

export default ChoisirVoix;
