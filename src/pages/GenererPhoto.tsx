/* src/pages/GenererPhoto.tsx */
import React, { useState, useEffect, useRef } from 'react';
import * as RouterDom from 'react-router-dom';
import { useUiLang, useThemeAssets, HeaderRetour, BanniereTitre, ProgressBar } from '../communs';
import { SERVER_BASE_URL } from '../config';
import previewRealiste from '../images/styles/realiste.png';
import previewAnime from '../images/styles/anime.png';
import previewPeinture from '../images/styles/peinture.png';
import previewFantaisie from '../images/styles/fantaisie.png';
import previewCyberpunk from '../images/styles/cyberpunk.png';
import previewAquarelle from '../images/styles/aquarelle.png';
import previewFurry from '../images/styles/furry.png';

interface StyleOption {
    key: string;
    gradient: string;
    preview: string;
}

// Le libellé affiché vient de t.styleNames (traduit) ; l'ordre ci-dessous doit
// rester aligné avec l'ordre de t.styleNames dans translations.ts.
const STYLE_OPTIONS: StyleOption[] = [
    { key: 'realiste', gradient: 'linear-gradient(135deg, #d9c2a0, #8a6f4f)', preview: previewRealiste },
    { key: 'anime', gradient: 'linear-gradient(135deg, #f2a9c9, #b98ac9)', preview: previewAnime },
    { key: 'peinture', gradient: 'linear-gradient(135deg, #c4a876, #4a3728)', preview: previewPeinture },
    { key: 'fantaisie', gradient: 'linear-gradient(135deg, #5a4a5c, #00bcd4)', preview: previewFantaisie },
    { key: 'cyberpunk', gradient: 'linear-gradient(135deg, #FE34E0, #00bcd4)', preview: previewCyberpunk },
    { key: 'aquarelle', gradient: 'linear-gradient(135deg, #9fd8cb, #6fa8dc)', preview: previewAquarelle },
    { key: 'furry', gradient: 'linear-gradient(135deg, #f2b880, #c96f4a)', preview: previewFurry },
];

const MAX_DESCRIPTION_LENGTH = 400;
// Limite de générations par 24 h (mettre 10 en production ; 100 = test sans blocage)
const DAILY_GENERATION_LIMIT = 100;
const GENERATION_HISTORY_KEY = 'generationTimestamps';
const ACTIVE_JOB_KEY = 'activeGenerationJob';
const DAY_MS = 24 * 60 * 60 * 1000;

interface ActiveJob {
    jobId: string;
    startTime: number;
    description: string;
    styleKey: string;
}

const getRecentGenerationTimestamps = (): number[] => {
    try {
        const raw = localStorage.getItem(GENERATION_HISTORY_KEY);
        const timestamps: number[] = raw ? JSON.parse(raw) : [];
        const cutoff = Date.now() - DAY_MS;
        return timestamps.filter((timestamp) => timestamp > cutoff);
    } catch {
        return [];
    }
};

// Génération déjà en cours côté serveur au moment où la page se (re)monte
// (l'app a été relancée pendant qu'un job tournait) : lue une fois pour
// initialiser directement les états concernés, plutôt que via un effet.
const chargerJobActif = (): ActiveJob | null => {
    const raw = localStorage.getItem(ACTIVE_JOB_KEY);
    if (!raw) return null;
    try {
        return JSON.parse(raw) as ActiveJob;
    } catch {
        localStorage.removeItem(ACTIVE_JOB_KEY);
        return null;
    }
};

const GenererPhoto: React.FC = () => {
    const t = useUiLang();
    const assets = useThemeAssets();
    const navigate = RouterDom.useNavigate();
    const [selectedStyle, setSelectedStyle] = useState<StyleOption | null>(() => {
        const job = chargerJobActif();
        return job ? STYLE_OPTIONS.find((s) => s.key === job.styleKey) ?? null : null;
    });
    const [description, setDescription] = useState(() => chargerJobActif()?.description ?? '');
    // Aucune photo tant qu'aucune génération n'est terminée
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(() => chargerJobActif() !== null);
    const [generationError, setGenerationError] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);
    const [generationCount, setGenerationCount] = useState(() => getRecentGenerationTimestamps().length);
    const [hasFocusedDescription, setHasFocusedDescription] = useState(() => chargerJobActif() !== null);
    const [lastGeneratedDescription, setLastGeneratedDescription] = useState<string | null>(null);

    const styleLabel = (key: string) => {
        const index = STYLE_OPTIONS.findIndex((s) => s.key === key);
        return index >= 0 ? t.styleNames[index] : key;
    };

    const ESTIMATED_DURATION_MS = 220000;
    const limitReached = generationCount >= DAILY_GENERATION_LIMIT;
    const isSameAsLastGenerated = lastGeneratedDescription !== null && description === lastGeneratedDescription;
    const isButtonFaded = !hasFocusedDescription || isGenerating || isSameAsLastGenerated;

    const progressTimerRef = useRef<number | null>(null);
    const statusTimerRef = useRef<number | null>(null);

    const stopPolling = () => {
        if (progressTimerRef.current !== null) window.clearInterval(progressTimerRef.current);
        if (statusTimerRef.current !== null) window.clearInterval(statusTimerRef.current);
        progressTimerRef.current = null;
        statusTimerRef.current = null;
    };

    // Le serveur génère en tâche de fond ; on interroge périodiquement son état.
    // Ainsi, si le téléphone met l'app en arrière-plan et coupe la connexion,
    // la génération continue côté serveur et reprend dès que l'app revient.
    const pollJob = (jobId: string, startTime: number, jobDescription: string) => {
        stopPolling();

        progressTimerRef.current = window.setInterval(() => {
            const elapsed = Date.now() - startTime;
            const estimated = Math.min(92, (elapsed / ESTIMATED_DURATION_MS) * 100);
            setProgress(estimated);
        }, 300);

        statusTimerRef.current = window.setInterval(async () => {
            try {
                const statusRes = await fetch(`${SERVER_BASE_URL}/status/${jobId}`);
                if (!statusRes.ok) return;
                const statusData = await statusRes.json();

                if (statusData.status === 'done') {
                    stopPolling();
                    const imageRes = await fetch(`${SERVER_BASE_URL}/result/${jobId}`);
                    const blob = await imageRes.blob();
                    setProgress(100);
                    setGeneratedImage(URL.createObjectURL(blob));
                    setLastGeneratedDescription(jobDescription);
                    setIsGenerating(false);
                    localStorage.removeItem(ACTIVE_JOB_KEY);

                    const timestamps = getRecentGenerationTimestamps();
                    timestamps.push(Date.now());
                    localStorage.setItem(GENERATION_HISTORY_KEY, JSON.stringify(timestamps));
                    setGenerationCount(timestamps.length);
                } else if (statusData.status === 'error' || statusData.status === 'not_found') {
                    stopPolling();
                    setGenerationError(t.generationEchouee);
                    setIsGenerating(false);
                    localStorage.removeItem(ACTIVE_JOB_KEY);
                }
                // sinon "running" : on continue à interroger
            } catch {
                // coupure réseau temporaire (app en arrière-plan) : on réessaiera au prochain tick
            }
        }, 3000);
    };

    // Au chargement de la page, reprendre le suivi d'une génération déjà en
    // cours si l'app a été relancée pendant qu'un job tournait sur le serveur
    // (les états ci-dessus sont déjà initialisés à partir du même job).
    useEffect(() => {
        const job = chargerJobActif();
        if (job) pollJob(job.jobId, job.startTime, job.description);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleGenerateImage = async () => {
        if (!description.trim() || isGenerating) return;
        if (limitReached) {
            setGenerationError(
                t.limiteQuotidienne
                    .replace('{count}', String(DAILY_GENERATION_LIMIT))
                    .replace('{limit}', String(DAILY_GENERATION_LIMIT))
            );
            return;
        }
        setIsGenerating(true);
        setGenerationError(null);
        setGeneratedImage(null);
        setProgress(0);

        try {
            const response = await fetch(`${SERVER_BASE_URL}/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: description, style: selectedStyle?.key }),
            });
            if (!response.ok) {
                const errData = await response.json().catch(() => null);
                throw new Error(errData?.error || `Erreur serveur (${response.status})`);
            }
            const data = await response.json();
            const startTime = Date.now();

            const job: ActiveJob = {
                jobId: data.job_id,
                startTime,
                description,
                styleKey: selectedStyle?.key || '',
            };
            localStorage.setItem(ACTIVE_JOB_KEY, JSON.stringify(job));
            pollJob(job.jobId, startTime, description);
        } catch (err) {
            console.log('Génération échouée', err);
            setGenerationError(err instanceof Error && err.message ? err.message : t.generationImpossible);
            setIsGenerating(false);
        }
    };

    if (!selectedStyle) {
        return (
            <div className="page-content-container create-page">
                <HeaderRetour />

                <BanniereTitre texte={t.genererTitre}>
                    <img src={assets.palette} alt="" className="create-banner-icon" />
                </BanniereTitre>

                <div className="style-grid">
                    {STYLE_OPTIONS.map((style) => (
                        <button
                            type="button"
                            key={style.key}
                            className="style-card"
                            onClick={() => setSelectedStyle(style)}
                        >
                            <span className="style-card-image-wrap" style={{ background: style.gradient }}>
                                <img src={style.preview} alt="" className="style-card-preview" />
                            </span>
                            <span className="style-card-label">{styleLabel(style.key)}</span>
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    // Annuler : on oublie la photo et on revient à la description (qui reste modifiable et régénérable)
    const annulerResultat = () => {
        setGeneratedImage(null);
        setLastGeneratedDescription(null);
    };

    // Page résultat : affichée dès qu'une photo est créée.
    // Annuler = retour à la description ; Continuer = page « Détails du personnage ».
    if (generatedImage) {
        return (
            <div className="page-content-container create-page generer-resultat-page">
            <HeaderRetour onClick={annulerResultat} />
            <BanniereTitre texte={t.genere}>
            <img src={assets.palette} alt="" className="create-banner-icon" />
            </BanniereTitre>
            <div className="create-buttons">
            <div className="create-box create-preview-box">
            <img src={generatedImage} alt={t.genere} className="create-preview-img" />
            </div>
            <div className="crop-actions">
            <button type="button" className="crop-btn crop-btn-cancel" onClick={annulerResultat}>
            {t.annuler}
            </button>
            <button
            type="button"
            className="crop-btn crop-btn-confirm"
            onClick={() => navigate('/creer/personnage', {
                state: { generatedImage, description, styleLabel: styleLabel(selectedStyle.key) },
            })}
            >
            {t.continuer}
            </button>
            </div>
            </div>
            </div>
        );
    }

    return (
        <div className="page-content-container create-page generer-photo-page">
        <HeaderRetour onClick={() => setSelectedStyle(null)} />

        <div className="generer-title-group">
                <BanniereTitre texte={t.generer}>
                    <img src={assets.palette} alt="" className="create-banner-icon" />
                    </BanniereTitre>
                    </div>

                    <div className="create-buttons">
                    {/* Onglet de dossier au-dessus du champ : style choisi + compteur de générations du jour (remplace la plaque et titrebas.png) */}
                    <div className="profil-dossier">
                    <p className="profil-dossier-onglet">{`${styleLabel(selectedStyle.key)}  ${generationCount}/${DAILY_GENERATION_LIMIT}`}</p>
                    <div className="create-box">
                    <textarea
                    className="create-textarea"
                    placeholder={t.placeholder}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        onFocus={() => setHasFocusedDescription(true)}
                        rows={4}
                        maxLength={MAX_DESCRIPTION_LENGTH}
                        spellCheck={false}
                        />
                        </div>
                        </div>
                        <button
                        className={`create-btn create-btn-image btn-bouton-png${isButtonFaded ? ' create-btn-faded' : ''}`}
                    onClick={handleGenerateImage}
                    disabled={isGenerating}
                >
                    <img src={assets.barre1} alt="" />
                    <img src={assets.palette} alt="" className="create-banner-icon" />
                    <div className="create-btn-caption">
                        <span className="create-btn-title">{t.generer}</span>
                    </div>
                </button>
                {isGenerating && <ProgressBar progress={progress} />}
                {generationError && <p className="generating-text">{generationError}</p>}
                {/* Silhouette du thème, sous le bouton Générer */}
                <img src={assets.silhouette} alt="" className="create-silhouette" />
                {generatedImage && (
                    <>
                        <button
                            className="create-btn create-btn-image btn-bouton-png"
                            onClick={() => navigate('/creer/personnage', {
                                state: { generatedImage, description, styleLabel: selectedStyle ? styleLabel(selectedStyle.key) : '' },
                            })}
                        >
                            <img src={assets.barre1} alt="" />
                            <img src={assets.palette} alt="" className="create-banner-icon" />
                            <div className="create-btn-caption">
                                <span className="create-btn-title">{t.detailsPersonnageTitre}</span>
                            </div>
                        </button>
                        <div className="create-box create-preview-box">
                            <img src={generatedImage} alt={t.genere} className="create-preview-img" />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default GenererPhoto;
