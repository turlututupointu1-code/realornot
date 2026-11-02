/* src/pages/RencontrePage.tsx */
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '../context/theme';
import { useUiLang, useThemeAssets, ChevronArrow } from '../communs';
import type { Translations } from '../i18n/translations';
import type { QuestionRencontre } from '../utils/rencontre';
import {
    obtenirQuestionsRencontre,
    obtenirMonProfilRencontre,
    enregistrerProfilRencontre,
    construireBlocsRencontre,
    obtenirCompteurVuesRencontre,
} from '../utils/rencontre';
import { decouperSalutation, type SalutationParties } from '../utils/salutation';

// Repli si la langue de l'interface n'a pas encore de traduction pour
// rencontreSalutationsRetour (voir translations.ts).
const MESSAGES_RENCONTRE_PAR_DEFAUT = [
    'Content de te revoir, {pseudo} !',
    '{pseudo} est de retour !',
    'Prêt(e) pour de nouvelles rencontres, {pseudo} ?',
    'Salut {pseudo}, qui va faire chavirer ton cœur aujourd\'hui ?',
    '{pseudo}, une nouvelle rencontre t\'attend peut-être...',
    'On t\'a manqué, {pseudo} !',
    'Alors {pseudo}, le grand amour, c\'est pour aujourd\'hui ?',
    '{pseudo} a encore trouvé le temps de revenir voir qui matche !',
    'Ravi de te revoir, {pseudo} 😊',
    '{pseudo}, ton profil a peut-être fait des heureux depuis ta dernière visite.',
    'Bonne pêche, {pseudo} !',
    'Toujours partant(e) pour l\'aventure, {pseudo} ?',
    '{pseudo} revient à la charge !',
    'Une nouvelle journée, une nouvelle chance, {pseudo}.',
    '{pseudo}, quelqu\'un t\'a peut-être déjà repéré...',
    'Salut {pseudo}, prêt(e) à faire des étincelles ?',
    '{pseudo} est connecté(e) — que l\'aventure commence !',
    'Content de te croiser à nouveau, {pseudo}.',
    '{pseudo}, le cœur a ses raisons, et toi tu as ton profil !',
    'Rebonjour {pseudo}, voyons qui t\'attend aujourd\'hui.',
    '{pseudo}, patience et bonnes rencontres sur le site !',
    'Toujours là, {pseudo} — c\'est bon signe !',
    '{pseudo}, le hasard fait bien les choses parfois...',
    'Bienvenue de retour, {pseudo}.',
    '{pseudo}, une belle rencontre n\'attend peut-être qu\'un clic.',
];

const salutationRencontreAleatoire = (t: Translations): SalutationParties =>
    decouperSalutation(t.rencontreSalutationsRetour ?? MESSAGES_RENCONTRE_PAR_DEFAUT);

// Première étape du site de rencontre : le profil (bio + questionnaire de
// compatibilité façon OkCupid, simplifié). La liste des profils compatibles
// et la messagerie viendront dans une étape suivante. Un profil déjà rempli
// (voir profilDejaRempli) affiche un message de bienvenue à la place du
// questionnaire plutôt que de le refaire remplir à chaque visite.
const RencontrePage: React.FC = () => {
    const t = useUiLang();
    const navigate = useNavigate();
    const location = useLocation();
    // Depuis le menu burger ("Mon profil", voir TopBar.tsx) : voir/modifier
    // les réponses du questionnaire directement, plutôt que le message de
    // bienvenue affiché par défaut sur cette même route après une connexion.
    const voirQuestionnaire = (location.state as { voirQuestionnaire?: boolean } | null)?.voirQuestionnaire === true;
    const { lang } = useTheme();
    const assets = useThemeAssets();
    const [prenom, setPrenom] = useState('');
    // Enregistré par DateNaissanceGate (voir src/homepage/DateNaissanceGate.tsx)
    // lors de la vérification d'âge - absent si celle-ci a été passée avant
    // l'ajout de cet enregistrement.
    const [age] = useState(() => localStorage.getItem('realornot-age'));
    const [questions, setQuestions] = useState<QuestionRencontre[]>([]);
    const [bio, setBio] = useState('');
    const [reponses, setReponses] = useState<Record<string, number>>({});
    const [reponsesMultiples, setReponsesMultiples] = useState<Record<string, number[]>>({});
    const [precisions, setPrecisions] = useState<Record<string, string>>({});
    const [chargement, setChargement] = useState(true);
    const [enregistrement, setEnregistrement] = useState(false);
    const [categorieOuverte, setCategorieOuverte] = useState<string | null>(null);
    const [profilDejaRempli, setProfilDejaRempli] = useState(false);
    const [salutation, setSalutation] = useState<SalutationParties | null>(null);
    const [compteurVues, setCompteurVues] = useState<{ total: number; nouvelles: number } | null>(null);
    // Message de bienvenue : visible 5 secondes après le chargement, puis il disparaît (il reste le fond d'écran)
    const [bienvenueVisible, setBienvenueVisible] = useState(true);
    // Avant les retours anticipés plus bas (chargement/salutation) - les
    // Hooks doivent s'exécuter dans le même ordre à chaque rendu. Ne dépend
    // que de `questions`, qui ne change quasiment jamais après le chargement
    // initial : évite de refaire ce calcul (filtres/regroupements) à chaque
    // frappe dans la bio ou changement de réponse.
    const blocsQuestions = useMemo(() => construireBlocsRencontre(questions), [questions]);

    useEffect(() => {
        (async () => {
            try {
                // Le questionnaire n'est montré que juste après une création
                // de compte (voir handleCreerCompte dans PopupPseudo.tsx) -
                // un compte déjà existant (connexion normale ou mot de passe
                // oublié) voit toujours le message de bienvenue, même s'il
                // n'a encore aucune réponse enregistrée. Ne dépend d'aucune
                // donnée serveur : lancé avant le Promise.all plutôt
                // qu'après, pour que le compteur de vues démarre en
                // parallèle des deux autres requêtes plutôt qu'à leur suite.
                const compteFraichementCree = sessionStorage.getItem('realornot-compte-fraichement-cree') === 'true';
                sessionStorage.removeItem('realornot-compte-fraichement-cree');
                if (!compteFraichementCree) {
                    setProfilDejaRempli(true);
                    setSalutation(salutationRencontreAleatoire(t));
                    obtenirCompteurVuesRencontre().then(setCompteurVues).catch(() => {});
                }

                const [questionsChargees, profil] = await Promise.all([
                    obtenirQuestionsRencontre(lang),
                    obtenirMonProfilRencontre(),
                ]);
                setQuestions(questionsChargees);
                setPrenom(profil.prenom);
                setBio(profil.bio);
                setReponses(profil.reponses);
                setReponsesMultiples(profil.reponsesMultiples ?? {});
                setPrecisions(profil.precisions ?? {});
            } catch {
                // Silencieux : formulaire vide utilisable même si le
                // chargement initial échoue (ex. hors-ligne).
            } finally {
                setChargement(false);
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Si la langue change après le chargement initial, seul le texte des
    // questions se retraduit (pas de re-fetch du profil, qui écraserait des
    // réponses pas encore enregistrées).
    useEffect(() => {
        if (chargement) return;
        obtenirQuestionsRencontre(lang).then(setQuestions).catch(() => {});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lang]);

    const handleEnregistrer = async () => {
        setEnregistrement(true);
        try {
            await enregistrerProfilRencontre(bio, reponses, reponsesMultiples, precisions, age ? parseInt(age, 10) : undefined);
            if (voirQuestionnaire) {
                // Modification depuis "Mon profil" (voir TopBar.tsx) sur un
                // profil déjà rempli - pas de redirection vers l'ajout de
                // photos comme pour un premier remplissage, juste retour à
                // l'affichage normal (message de bienvenue).
                navigate('/mode-reel');
            } else {
                // Voir spec_page_photos.md : après le questionnaire (premier
                // remplissage), direction la page d'ajout des photos plutôt
                // qu'un simple message confirmant l'enregistrement sur place.
                navigate('/mode-reel/photos', { state: { premiereVisite: true } });
            }
        } catch {
            // Pas de remontée d'erreur bloquante ici pour l'instant.
        } finally {
            setEnregistrement(false);
        }
    };

    // Lance le minuteur de 5 secondes quand le chargement est terminé (doit rester avant les « return » ci-dessous)
    useEffect(() => {
        if (chargement) return;
        const minuteur = window.setTimeout(() => setBienvenueVisible(false), 5000);
        return () => window.clearTimeout(minuteur);
    }, [chargement]);

    if (chargement) return null;

    if (profilDejaRempli && salutation && !voirQuestionnaire) {
        return (
            <div className="page-content-container create-page rencontre-page rencontre-accueil">
            <div className="rencontre-bienvenue-centre">
            {bienvenueVisible && (
                <div className="create-box rencontre-bio-box">
                        <p className="details-field-label" style={{ textAlign: 'center' }}>
                            {salutation.avant}
                            <br />
                            {prenom && <strong>{prenom}</strong>}
                            <br />
                            {salutation.apres}
                        </p>
                        {compteurVues && (
                            <p style={{ textAlign: 'center' }}>
                                {(t.vuesTotalTexte ?? '{total} vues au total sur ton profil').replace('{total}', String(compteurVues.total))}
                                {compteurVues.nouvelles > 0 && (
                                    <>
                                        <br />
                                        {(t.nouvellesVuesTexte ?? '{nouvelles} nouvelles vues depuis ta dernière visite').replace('{nouvelles}', String(compteurVues.nouvelles))}
                                    </>
                                )}
                                </p>
                        )}
                        </div>
            )}
            </div>
            </div>
        );
    }

    const renderReponses = (question: QuestionRencontre) => {
        if (question.libre) {
            return (
                <input
                    type="text"
                    className="pseudo-popup-input rencontre-precision-input"
                    value={precisions[question.id] ?? ''}
                    onChange={(e) => setPrecisions((prev) => ({ ...prev, [question.id]: e.target.value }))}
                    placeholder={t.maVillePlaceholder ?? 'Ma ville...'}
                    maxLength={60}
                />
            );
        }

        if (question.multiple) {
            const indexesChoisis = reponsesMultiples[question.id] ?? [];
            const indexAutre = question.indexAutre ?? -1;
            return (
                <>
                    <div className="details-suggestions-row">
                        {question.options.map((option, i) => (
                            <button
                                type="button"
                                key={option}
                                className={`details-suggestion-chip${indexesChoisis.includes(i) ? ' details-suggestion-chip-active' : ''}`}
                                onClick={() => setReponsesMultiples((prev) => {
                                    const actuel = prev[question.id] ?? [];
                                    const suivant = actuel.includes(i)
                                        ? actuel.filter((v) => v !== i)
                                        : [...actuel, i];
                                    return { ...prev, [question.id]: suivant };
                                })}
                            >
                                {option}
                            </button>
                        ))}
                    </div>
                    {indexAutre !== -1 && indexesChoisis.includes(indexAutre) && (
                        <input
                            type="text"
                            className="pseudo-popup-input rencontre-precision-input"
                            value={precisions[question.id] ?? ''}
                            onChange={(e) => setPrecisions((prev) => ({ ...prev, [question.id]: e.target.value }))}
                            placeholder={t.preciseSiTuVeux ?? 'Précise si tu veux...'}
                            maxLength={100}
                        />
                    )}
                </>
            );
        }

        const indexChoisi = reponses[question.id];
        return (
            <>
                <div className="details-suggestions-row">
                    {question.options.map((option, i) => (
                        <button
                            type="button"
                            key={option}
                            className={`details-suggestion-chip${indexChoisi === i ? ' details-suggestion-chip-active' : ''}`}
                            onClick={() => setReponses((prev) => ({ ...prev, [question.id]: i }))}
                        >
                            {option}
                        </button>
                    ))}
                </div>
                {question.indexAutre !== undefined && indexChoisi === question.indexAutre && (
                    <input
                        type="text"
                        className="pseudo-popup-input rencontre-precision-input"
                        value={precisions[question.id] ?? ''}
                        onChange={(e) => setPrecisions((prev) => ({ ...prev, [question.id]: e.target.value }))}
                        placeholder="Précise si tu veux..."
                        maxLength={100}
                    />
                )}
            </>
        );
    };

    return (
        <div className="page-content-container create-page rencontre-page rencontre-accueil">
            <div className="create-box rencontre-bio-box">
                <p className="details-field-label">
                    {prenom
                        ? `${t.presenteToiSuffixe ?? 'Je me présente'}, ${prenom}${age ? ` (${age} ${t.ansSuffixe ?? 'ans'})` : ''}`
                        : (t.rencontreBioLabel ?? 'Présentez-vous')}
                </p>
                <textarea
                    className="create-textarea"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder={t.rencontreBioPlaceholder ?? 'Parlez un peu de moi...'}
                    maxLength={280}
                    rows={3}
                />
            </div>

            {blocsQuestions.map((bloc) => {
                if (bloc.type === 'question') {
                    const { question, verticale } = bloc;
                    return (
                        <div className="rencontre-categorie-accordeon" key={question.id}>
                            <button
                                type="button"
                                className="details-voix-row rencontre-categorie-toggle"
                                onClick={() => setCategorieOuverte((prev) => (prev === question.id ? null : question.id))}
                            >
                                <img src={assets.barre1} alt="" className="details-categories-bg" />
                                <div className="details-voix-content">
                                    <span className="details-voix-label">{question.texte}</span>
                                    {/* Flèche vers le bas (fermé) ou vers le haut (ouvert), comme dans le menu burger */}
                                    <ChevronArrow sens={categorieOuverte === question.id ? 'haut' : 'bas'} className="moi-avatar-chevron" />
                                </div>
                            </button>
                            <div className={`rencontre-categorie-contenu-wrapper${categorieOuverte === question.id ? ' ouvert' : ''}`}>
                                <div className="rencontre-categorie-contenu-clip">
                                    <div className={`create-box rencontre-categorie-contenu${verticale ? ' rencontre-reponses-verticales' : ''}`}>
                                        {renderReponses(question)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                }

                const { groupe } = bloc;
                return (
                    <div className="rencontre-categorie-accordeon" key={groupe.categorie}>
                        <button
                            type="button"
                            className="details-voix-row rencontre-categorie-toggle"
                            onClick={() => setCategorieOuverte((prev) => (prev === groupe.categorie ? null : groupe.categorie))}
                        >
                            <img src={assets.barre1} alt="" className="details-categories-bg" />
                            <div className="details-voix-content">
                                <span className="details-voix-label">{groupe.categorie}</span>
                                {/* Flèche vers le bas (fermé) ou vers le haut (ouvert), comme dans le menu burger */}
                                <ChevronArrow sens={categorieOuverte === groupe.categorie ? 'haut' : 'bas'} className="moi-avatar-chevron" />
                            </div>
                        </button>
                        <div className={`rencontre-categorie-contenu-wrapper${categorieOuverte === groupe.categorie ? ' ouvert' : ''}`}>
                            <div className="rencontre-categorie-contenu-clip">
                                <div className="create-box rencontre-categorie-contenu">
                                    {groupe.questions.map((question) => (
                                        <div className="rencontre-question" key={question.id}>
                                            <p className="details-field-label">{question.texte}</p>
                                            {renderReponses(question)}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}

            <button
                className="create-btn create-btn-image btn-bouton-png rencontre-btn-enregistrer"
                disabled={enregistrement}
                onClick={handleEnregistrer}
            >
                <img src={assets.barre1} alt="" />
                <div className="create-btn-caption">
                    <span className="create-btn-title">
                        {t.rencontreEnregistrer ?? 'Enregistrer'}
                    </span>
                </div>
            </button>
        </div>
    );
};

export default RencontrePage;
