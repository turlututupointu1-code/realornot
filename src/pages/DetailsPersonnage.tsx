/* src/pages/DetailsPersonnage.tsx */
import React, { useEffect, useState } from 'react';
import * as RouterDom from 'react-router-dom';
import { useUiLang, useThemeAssets, BanniereTitre, ChevronArrow } from '../communs';
import NavArrow from '../components/NavArrow';
import SelecteurGenre from '../components/SelecteurGenre';
import { addUserCreation, blobUrlToDataUrl, modifierUserCreation, type UserCreation } from '../utils/userCreations';
import { chargerVoixPersonnage, enregistrerVoixPersonnage } from '../utils/voixPersonnage';
import { getDeviceId } from '../utils/deviceId';
import { chargerPseudo } from '../utils/pseudo';
import { VOIX_CHOISIE_KEY, type VoixChoisie } from '../utils/voix';

const chargerVoixChoisie = (): VoixChoisie | null => {
    try {
        const raw = sessionStorage.getItem(VOIX_CHOISIE_KEY);
        return raw ? (JSON.parse(raw) as VoixChoisie) : null;
    } catch {
        return null;
    }
};

// Brouillon des champs du formulaire, sauvegardé le temps de la création
// (aller-retour vers la page Voix par exemple) : la page se démonte/remonte
// à chaque navigation, ce qui réinitialiserait sinon tous les champs déjà
// remplis. Effacé une fois le personnage enregistré.
const DETAILS_BROUILLON_KEY = 'realornot-details-personnage-en-cours';

interface DetailsBrouillon {
    nom: string;
    description: string;
    histoire: string;
    salutation: string;
    bio: string;
    categorie: string;
    genre: number | null;
}

const brouillonVide: DetailsBrouillon = {
    nom: '',
    description: '',
    histoire: '',
    salutation: '',
    bio: '',
    categorie: '',
    genre: null,
};

const chargerBrouillon = (): DetailsBrouillon => {
    try {
        const raw = sessionStorage.getItem(DETAILS_BROUILLON_KEY);
        if (raw) return { ...brouillonVide, ...JSON.parse(raw) };
    } catch {
        // ignore, on repart d'un formulaire vierge
    }
    return { ...brouillonVide };
};

interface LocationState {
    generatedImage?: string;
    description?: string;
    styleLabel?: string;
    // Présent quand on arrive depuis "Vos créations" pour modifier un
    // personnage existant, plutôt que d'en créer un nouveau.
    creationExistante?: UserCreation;
    // Vrai quand on arrive depuis la page de discussion (pas depuis "Vos créations") : affiche "Recommencer la conversation".
    depuisDiscussion?: boolean;
}

// Clés de catégorie canoniques (stables, indépendantes de la langue) -
// alignées par position avec t.categories en excluant "Tous" (index 0).
// C'est cette valeur qui est enregistrée, pour que le filtrage par catégorie
// fonctionne quelle que soit la langue de l'utilisateur qui a créé ou qui
// consulte le personnage.
const CATEGORY_CODES = ['Famille', 'Amis', 'Rencontres', 'People', 'Fiction', 'Histoire'];

const DetailsPersonnage: React.FC = () => {
    const t = useUiLang();
    const assets = useThemeAssets();
    const location = RouterDom.useLocation();
    const navigate = RouterDom.useNavigate();
    const state = (location.state || {}) as LocationState;
    const creationExistante = state.creationExistante;
    const isEdition = Boolean(creationExistante);
    const depuisDiscussion = isEdition && Boolean(state.depuisDiscussion);
    // Efface la conversation enregistrée de ce personnage (même clé que la page de discussion), puis retourne à la discussion.
    const confirmerRecommencer = () => {
        if (creationExistante) {
            localStorage.removeItem(`realornot-chat-${creationExistante.id}`);
            navigate(`/personnage/${creationExistante.id}`, { state: { creation: creationExistante } });
        }
    };

    const [brouillonInitial] = useState(() => (isEdition ? brouillonVide : chargerBrouillon()));
    const [nom, setNom] = useState(creationExistante?.title ?? brouillonInitial.nom);
    const [description, setDescription] = useState(creationExistante?.description ?? brouillonInitial.description);
    const [histoire, setHistoire] = useState(creationExistante?.histoire ?? brouillonInitial.histoire);
    const [salutation, setSalutation] = useState(creationExistante?.salutation ?? brouillonInitial.salutation);
    const [bio, setBio] = useState(creationExistante?.bio ?? brouillonInitial.bio);
    const [categorie, setCategorie] = useState(creationExistante?.category ?? brouillonInitial.categorie);
    const [categorieOuverte, setCategorieOuverte] = useState(false);
    const [isPublic, setIsPublic] = useState(creationExistante?.isPublic ?? true);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [genre, setGenre] = useState<number | null>(creationExistante?.genre ?? brouillonInitial.genre);
    const [voixChoisie] = useState<VoixChoisie | null>(() => (
        creationExistante
            ? (creationExistante.voix ?? chargerVoixPersonnage(creationExistante.id) ?? chargerVoixChoisie())
            : chargerVoixChoisie()
    ));

    useEffect(() => {
        if (isEdition) return;
        sessionStorage.setItem(
            DETAILS_BROUILLON_KEY,
            JSON.stringify({ nom, description, histoire, salutation, bio, categorie, genre })
        );
    }, [isEdition, nom, description, histoire, salutation, bio, categorie, genre]);

    const canContinue = Boolean(
        nom.trim() && description.trim() && histoire.trim() && salutation.trim() && bio.trim() && categorie
        && (isEdition || voixChoisie)
    );

    const handleCreer = async (publier: boolean) => {
        if (!canContinue || isSaving) return;
        setIsSaving(true);
        setSaveError(null);
        try {
            const imageUrl = state.generatedImage
                ? await blobUrlToDataUrl(state.generatedImage)
                : '';
            // Import dynamique : @vladmandic/face-api (voir utils/faceAvatar.ts)
            // pèse ~1,3 Mo à lui seul - ne le charger qu'au moment réel de la
            // sauvegarde plutôt qu'avec le reste de cette page, visitée bien
            // plus souvent que ce bouton n'est cliqué.
            const avatarUrl = imageUrl
                ? (await (await import('../utils/faceAvatar')).creerAvatarDepuisPhoto(imageUrl)) || ''
                : '';
            const creation = await addUserCreation({
                title: nom.trim(),
                imageUrl,
                avatarUrl,
                style: state.styleLabel || '',
                category: categorie,
                bio: bio.trim(),
                description: description.trim(),
                histoire: histoire.trim(),
                salutation: salutation.trim(),
                creatorId: getDeviceId(),
                creatorPseudo: chargerPseudo() ?? '',
                isPublic: publier,
                genre,
                voix: voixChoisie,
            });
            if (voixChoisie) enregistrerVoixPersonnage(creation.id, voixChoisie);
            sessionStorage.removeItem(VOIX_CHOISIE_KEY);
            sessionStorage.removeItem(DETAILS_BROUILLON_KEY);
            navigate('/mode-ia');
        } catch (err) {
            console.log('Sauvegarde du personnage échouée', err);
            setSaveError(err instanceof Error && err.message ? err.message : t.enregistrementEchoue);
            setIsSaving(false);
        }
    };

    const handleEnregistrerModifications = async () => {
        if (!canContinue || isSaving || !creationExistante) return;
        setIsSaving(true);
        setSaveError(null);
        try {
            if (voixChoisie) enregistrerVoixPersonnage(creationExistante.id, voixChoisie);
            await modifierUserCreation(creationExistante.id, {
                title: nom.trim(),
                category: categorie,
                bio: bio.trim(),
                description: description.trim(),
                histoire: histoire.trim(),
                salutation: salutation.trim(),
                isPublic,
                genre,
                voix: voixChoisie,
            });
            const creationMiseAJour: UserCreation = {
                ...creationExistante,
                title: nom.trim(),
                category: categorie,
                bio: bio.trim(),
                description: description.trim(),
                histoire: histoire.trim(),
                salutation: salutation.trim(),
                isPublic,
                genre,
                voix: voixChoisie,
            };
            navigate(`/personnage/${creationExistante.id}`, { state: { creation: creationMiseAJour } });
        } catch (err) {
            console.log('Modification du personnage échouée', err);
            setSaveError(err instanceof Error && err.message ? err.message : t.enregistrementEchoue);
            setIsSaving(false);
        }
    };

    return (
        <div className="page-content-container create-page details-personnage-page">
            <div className="titre-ligne">
                <NavArrow direction="back" />
                <BanniereTitre texte={t.detailsPersonnageTitre}>
                    <img src={assets.palette} alt="" className="create-banner-icon" />
                </BanniereTitre>
            </div>

            {(state.generatedImage || creationExistante?.imageUrl) && (
                <div className="create-box create-preview-box details-photo-preview">
                    <img
                        src={state.generatedImage || creationExistante?.imageUrl}
                        alt={t.detailsPersonnageTitre}
                        className="create-preview-img"
                    />
                </div>
            )}

            {isEdition && (
                <div className="details-categories-row">
                    <img src={assets.barre1} alt="" className="details-categories-bg" />
                    <div className="details-suggestions-row details-categories-buttons">
                        <button
                            type="button"
                            className={`details-suggestion-chip${isPublic ? ' details-suggestion-chip-active' : ''}`}
                            onClick={() => setIsPublic(true)}
                        >
                            {t.publicLabel}
                        </button>
                        <button
                            type="button"
                            className={`details-suggestion-chip${!isPublic ? ' details-suggestion-chip-active' : ''}`}
                            onClick={() => setIsPublic(false)}
                        >
                            {t.priveLabel}
                        </button>
                    </div>
                </div>
            )}

            <div className="rencontre-categorie-accordeon details-categorie-accordeon">
                <button type="button" className="details-voix-row rencontre-categorie-toggle" onClick={() => setCategorieOuverte((o) => !o)}>
                    <img src={assets.barre1} alt="" className="details-categories-bg" />
                    <div className="details-voix-content">
                        <span className="details-voix-label">{t.categorieTitre}</span>
                        {/* Flèche vers le bas (fermé) ou vers le haut (ouvert), comme « Langues parlées » */}
                        <ChevronArrow sens={categorieOuverte ? 'haut' : 'bas'} className="moi-avatar-chevron" />
                    </div>
                </button>
                <div className={`rencontre-categorie-contenu-wrapper${categorieOuverte ? ' ouvert' : ''}`}>
                    <div className="rencontre-categorie-contenu-clip">
                        <div className="create-box rencontre-categorie-contenu rencontre-reponses-verticales">
                            <div className="details-suggestions-row">
                                {CATEGORY_CODES.map((code, i) => (
                                    <button
                                        type="button"
                                        key={code}
                                        className={`details-suggestion-chip${categorie === code ? ' details-suggestion-chip-active' : ''}`}
                                        onClick={() => setCategorie(code)}
                                    >
                                        {t.categories[i + 1]}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <SelecteurGenre genre={genre} onChange={setGenre} />

            <button type="button" className="details-voix-row voix-choisie-row" onClick={() => navigate('/creer/voix')}>
                <img src={assets.barre1} alt="" className="details-categories-bg" />
                <div className="details-voix-content">
                    <span className="details-voix-label">
                        {voixChoisie
                            ? t.voixChoisieLabel.replace('{voix}', t.voixTraits[voixChoisie.index] ?? voixChoisie.cle)
                            : t.voix}
                    </span>
                    <img src={assets.fleche} alt="" className="details-voix-arrow" />
                </div>
            </button>

            <div className="create-buttons">
            <div className="profil-dossier">
            <p className="profil-dossier-onglet">{t.nomLabel}*</p>
                    <div className="create-box">
                        <input
                            type="text"
                            className="create-textarea"
                            placeholder={t.nomPlaceholder}
                            value={nom}
                            onChange={(e) => setNom(e.target.value)}
                            maxLength={30}
                        />
                    </div>
                </div>

                <div className="profil-dossier">
                <p className="profil-dossier-onglet">{t.descriptionLabel}* <span className="details-field-hint">{t.vuEnPrive}</span></p>
                    <div className="create-box">
                        <textarea
                            className="create-textarea"
                            placeholder={t.descriptionPlaceholder}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={4}
                            maxLength={200}
                        />
                    </div>
                </div>

                <div className="profil-dossier">
                <p className="profil-dossier-onglet">{t.histoireLabel}* <span className="details-field-hint">{t.vuPubliquement}</span></p>
                    <div className="create-box">
                        <textarea
                            className="create-textarea"
                            placeholder={t.histoirePlaceholder}
                            value={histoire}
                            onChange={(e) => setHistoire(e.target.value)}
                            rows={4}
                            maxLength={1000}
                        />
                    </div>
                </div>

                <div className="profil-dossier">
                <p className="profil-dossier-onglet">{t.salutationLabel}* <span className="details-field-hint">{t.vuPubliquement}</span></p>
                    <div className="create-box">
                        <textarea
                            className="create-textarea"
                            placeholder={t.salutationPlaceholder}
                            value={salutation}
                            onChange={(e) => setSalutation(e.target.value)}
                            rows={2}
                            maxLength={100}
                        />
                    </div>
                </div>

                <div className="profil-dossier">
                <p className="profil-dossier-onglet">{t.bio}*</p>
                    <div className="create-box">
                        <textarea
                            className="create-textarea"
                            placeholder={t.bioPlaceholder}
                            value={bio}
                            onChange={(e) => setBio(e.target.value)}
                            rows={3}
                            maxLength={100}
                        />
                    </div>
                </div>

                {isEdition ? (
                    <>
                        <button
                            className="create-btn create-btn-image btn-bouton-png"
                            disabled={!canContinue || isSaving}
                            onClick={handleEnregistrerModifications}
                        >
                            <img src={assets.barre1} alt="" />
                            <img src={assets.palette} alt="" className="create-banner-icon" />
                            <div className="create-btn-caption">
                                <span className="create-btn-title">
                                    {isSaving ? t.enregistrementEnCours : t.enregistrerModifications}
                                </span>
                            </div>
                        </button>
                        <button
                            className="create-btn create-btn-image btn-bouton-png"
                            disabled={isSaving}
                            onClick={() => navigate(`/personnage/${creationExistante!.id}`, { state: { creation: creationExistante } })}
                        >
                            <img src={assets.barre1} alt="" />
                            <img src={assets.palette} alt="" className="create-banner-icon" />
                            <div className="create-btn-caption">
                            <span className="create-btn-title">{t.discuterBtn}</span>
                            </div>
                            </button>
                            {depuisDiscussion && (
                                <button
                                className="create-btn create-btn-image btn-bouton-png"
                                disabled={isSaving}
                                onClick={confirmerRecommencer}
                                >
                                <img src={assets.barre1} alt="" />
                                <img src={assets.palette} alt="" className="create-banner-icon" />
                                <div className="create-btn-caption">
                                <span className="create-btn-title">{t.recommencerConversation}</span>
                                </div>
                                </button>
                            )}
                            </>
                ) : (
                    <>
                        <button
                            className="create-btn create-btn-image btn-bouton-png"
                            disabled={!canContinue || isSaving}
                            onClick={() => handleCreer(true)}
                        >
                            <img src={assets.barre1} alt="" />
                            <img src={assets.palette} alt="" className="create-banner-icon" />
                            <div className="create-btn-caption">
                                <span className="create-btn-title">
                                    {isSaving ? t.enregistrementEnCours : t.publierPublicBtn}
                                </span>
                            </div>
                        </button>
                        <button
                            className="create-btn create-btn-image btn-bouton-png"
                            disabled={!canContinue || isSaving}
                            onClick={() => handleCreer(false)}
                        >
                            <img src={assets.barre1} alt="" />
                            <img src={assets.palette} alt="" className="create-banner-icon" />
                            <div className="create-btn-caption">
                                <span className="create-btn-title">
                                    {isSaving ? t.enregistrementEnCours : t.garderPriveBtn}
                                </span>
                            </div>
                        </button>
                    </>
                )}
                {saveError && <p className="generating-text">{saveError}</p>}
            </div>
        </div>
    );
};

export default DetailsPersonnage;
