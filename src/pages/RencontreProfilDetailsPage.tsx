/* src/pages/RencontreProfilDetailsPage.tsx */
import React, { useEffect, useMemo, useState } from 'react';
import * as RouterDom from 'react-router-dom';
import { useTheme } from '../context/theme';
import { useUiLang, HeaderRetour, BanniereTitre } from '../communs';
import type { ProfilRencontre, QuestionRencontre } from '../utils/rencontre';
import {
    obtenirProfilsRencontre,
    obtenirQuestionsRencontre,
    obtenirComparaisonRencontre,
    ordonnerQuestionsRencontre,
} from '../utils/rencontre';

// Valeur affichable d'une question pour un profil consulté (lecture seule) -
// null si la question n'a pas de réponse pour ce profil (ligne masquée).
const valeurAffichee = (question: QuestionRencontre, profil: ProfilRencontre): string | null => {
    if (question.libre) {
        const texte = profil.precisions?.[question.id];
        return texte ? texte : null;
    }
    if (question.multiple) {
        const indexes = profil.reponsesMultiples?.[question.id];
        if (!indexes || indexes.length === 0) return null;
        return indexes.map((i) => question.options[i]).filter(Boolean).join(', ');
    }
    const index = profil.reponses?.[question.id];
    if (index === undefined) return null;
    const option = question.options[index];
    if (index === question.indexAutre && profil.precisions?.[question.id]) {
        return `${option} : ${profil.precisions[question.id]}`;
    }
    return option;
};

// Bio + compatibilité + questionnaire complet d'un profil consulté (voir
// "Voir le profil" dans RencontreProfilPage.tsx) - anciennement le contenu
// de RencontreProfilPage.tsx elle-même, avant sa scission en page d'accueil
// (photo + boutons) et sous-pages.
const RencontreProfilDetailsPage: React.FC = () => {
    const { pseudo } = RouterDom.useParams<{ pseudo: string }>();
    const location = RouterDom.useLocation();
    const { lang } = useTheme();
    const t = useUiLang();
    const [profil, setProfil] = useState<ProfilRencontre | null>(
        (location.state as { profil?: ProfilRencontre } | null)?.profil ?? null
    );
    const [questions, setQuestions] = useState<QuestionRencontre[]>([]);
    // Point vert/rouge devant chaque titre : question absente = pas de
    // point (non comparable, voir obtenirComparaisonRencontre).
    const [comparaison, setComparaison] = useState<Record<string, boolean>>({});
    const [chargement, setChargement] = useState(true);
    // Avant le retour anticipé plus bas (chargement) - les Hooks doivent
    // s'exécuter dans le même ordre à chaque rendu.
    const questionsOrdonnees = useMemo(() => ordonnerQuestionsRencontre(questions), [questions]);

    useEffect(() => {
        (async () => {
            try {
                const [questionsChargees, profils, comparaisonChargee] = await Promise.all([
                    obtenirQuestionsRencontre(lang),
                    profil ? Promise.resolve<ProfilRencontre[]>([]) : obtenirProfilsRencontre(),
                    pseudo ? obtenirComparaisonRencontre(pseudo).catch(() => ({})) : Promise.resolve({}),
                ]);
                setQuestions(questionsChargees);
                setComparaison(comparaisonChargee);
                if (!profil) {
                    setProfil(profils.find((p) => p.pseudo === pseudo) ?? null);
                }
            } catch {
                // Page vide en cas d'échec (ex. hors-ligne).
            } finally {
                setChargement(false);
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (chargement) return null;

    return (
        <div className="page-content-container create-page rencontre-page rencontre-souspage">
            <HeaderRetour />
            <BanniereTitre texte={profil?.prenom ?? pseudo ?? 'Profil'} />

            {!profil && <p className="texte-vide-centre">{t.profilIntrouvable ?? 'Profil introuvable.'}</p>}

            {profil && (
                <>
                    {profil.compatibilite != null && (
                        <div className="create-box rencontre-bio-box">
                            <p className="details-field-label">{t.compatibiliteLabel ?? 'Compatibilité'}</p>
                            <p>{profil.compatibilite}%</p>
                        </div>
                    )}

                    {profil.bio && (
                        <div className="create-box rencontre-bio-box">
                            <p className="details-field-label">{profil.prenom}{profil.age ? ` (${profil.age} ${t.ansSuffixe ?? 'ans'})` : ''}</p>
                            <p>{profil.bio}</p>
                        </div>
                    )}

                    <div className="create-box rencontre-questions-box">
                        {questionsOrdonnees.map((question, i) => {
                            const valeur = valeurAffichee(question, profil);
                            if (valeur === null) return null;
                            const categoriePrecedente = i > 0 ? questionsOrdonnees[i - 1].categorie : undefined;
                            const nouvelleCategorie = question.categorie && question.categorie !== categoriePrecedente;
                            return (
                                <React.Fragment key={question.id}>
                                    {nouvelleCategorie && (
                                        <p className="rencontre-question-categorie">{question.categorie}</p>
                                    )}
                                    <div className="rencontre-question">
                                        <p className="details-field-label">
                                            {question.id in comparaison && (
                                                <span className={`rencontre-point-comparaison ${comparaison[question.id] ? 'rencontre-point-vert' : 'rencontre-point-rouge'}`} />
                                            )}
                                            {question.texte}
                                        </p>
                                        <p>{valeur}</p>
                                    </div>
                                </React.Fragment>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
};

export default RencontreProfilDetailsPage;
