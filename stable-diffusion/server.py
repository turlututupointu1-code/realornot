import os
import io
import urllib.parse
import urllib.request
import json
import base64
import glob
import math
import random
import re
import secrets
import shutil
import subprocess
import threading
import time
import unicodedata
import uuid
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor

import requests
import torch
from PIL import Image
from diffusers import StableDiffusionPipeline, DPMSolverMultistepScheduler
from flask import Flask, request, send_file, jsonify, send_from_directory
from dotenv import load_dotenv
from google import genai
from werkzeug.security import generate_password_hash, check_password_hash

from rencontre_traductions import TRADUCTIONS_QUESTIONS_RENCONTRE

load_dotenv()

# Choix du générateur d'images : "pollinations" (gratuit, sans GPU)
# ou "stable_diffusion" (local, ton PC).
GENERATEUR = "pollinations"

def normaliser_style(valeur):
    # Le frontend envoie normalement déjà la clé brute (voir STYLE_OPTIONS
    # dans GenererPhoto.tsx, ex. "realiste") lors de la génération, mais
    # certains personnages existants ont le libellé traduit et accentué
    # enregistré à la place (ex. "Réaliste", voir DetailsPersonnage.tsx) -
    # sans accents ni casse, la comparaison avec STYLE_PROMPTS échouait
    # silencieusement dans ce cas, et aucune instruction de style n'était
    # ajoutée au prompt. Définie tout en haut du fichier (avant les blocs
    # ANATOMIE_*/MEUBLES_* juste en dessous, qui l'utilisent dès le chargement
    # du module, pas seulement au moment d'une requête).
    if not valeur:
        return ""
    sans_accents = unicodedata.normalize("NFKD", valeur).encode("ascii", "ignore").decode("ascii")
    return sans_accents.strip().lower()

# Données de référence (anatomie + meubles par pièce) données à l'IA de chat
# pour qu'elle situe correctement les parties du corps et décrive un lieu de
# façon réaliste plutôt que de deviner. Fichiers texte séparés du code, dans
# data/reference/ : un fichier source français par sujet (<sujet>.fr.txt) et
# un fichier par langue supportée (<sujet>.<code>.txt), régénérés
# automatiquement par traduction (voir boucle_surveillance_reference plus
# bas, après les fonctions de traduction déjà utilisées pour les personnages)
# dès que le fichier .fr.txt correspondant est modifié - jamais de commande
# manuelle à lancer. L'admin (boutons "Anatomie"/"Meubles") édite toujours le
# fichier .fr.txt, source de vérité.
#
# Anatomie : texte intégral (pas de version compactée) découpé en 3 sujets +
# un socle court : n'injecter QUE le(s) sujet(s) évoqué(s) par le dernier
# message (voir message_sujets_anatomie) garde les échanges normaux rapides,
# mais même un seul sujet complet reste lourd sur ce modèle local (qwen2.5:7b,
# CPU) - mesuré : environ 9 tokens/s en lecture de prompt, moins de 3 tokens/s
# en génération, donc une question déclenchant un sujet peut prendre 2 à 4
# minutes (voir timeout plus bas). Accepté comme compromis : texte intégral
# plutôt qu'une version compactée qui perdait trop de détail.
REFERENCE_DIR = os.path.join(os.path.dirname(__file__), "data", "reference")
os.makedirs(REFERENCE_DIR, exist_ok=True)
REFERENCE_SUJETS_ANATOMIE = ["anatomie_base", "anatomie_tete", "anatomie_tronc", "anatomie_genital"]
REFERENCE_SUJET_MAISON = "maison"
# Langues cibles de la traduction automatique - toutes celles de
# translations.ts sauf le français, qui est la langue source. DeepL ne
# couvre pas l'arabe (voir DEEPL_CODES_LANGUE plus bas) : appeler_deepl
# renvoie alors None et seul Google Translate est tenté pour "ar".
REFERENCE_LANGUES_CIBLES = ["en", "es", "de", "it", "pt", "zh", "ja", "ko", "ar"]


def chemin_reference(sujet, code_langue):
    return os.path.join(REFERENCE_DIR, f"{sujet}.{code_langue}.txt")


def charger_texte_reference(sujet, code_langue):
    """Texte de référence pour ce sujet dans la langue demandée, avec repli
    en cascade langue demandée -> anglais -> français si la traduction
    n'existe pas encore (juste après une modif, avant que le watcher ait fini
    de la régénérer) ou plus du tout. L'anglais passe avant le français
    comme repli intermédiaire : compris par davantage de monde parmi les 10
    langues supportées que le français, qui reste uniquement le tout dernier
    recours (le fichier source existe toujours, lui)."""
    for candidat in [code_langue, "en", "fr"]:
        chemin = chemin_reference(sujet, candidat)
        if os.path.exists(chemin):
            with open(chemin, "r", encoding="utf-8") as f:
                return f.read()
    return ""


def decouper_texte_par_blocs(texte):
    """Découpe un texte en blocs séparés par une ligne vide - la structure
    (pas le contenu) définit les blocs, donc ça fonctionne pour un texte
    traduit dans n'importe quelle langue tant que la traduction préserve
    l'ordre des paragraphes (toujours le cas en pratique)."""
    return [b.strip() for b in re.split(r"\n\s*\n", texte.strip()) if b.strip()]


ANATOMIE_MOTS_CLES_PAR_SUJET = {
    "anatomie_tete": [
        "tete", "visage", "front", "sourcil", "oeil", "yeux", "paupiere", "cil", "nez", "narine",
        "joue", "bouche", "levre", "dent", "langue", "menton", "machoire", "oreille", "cou",
    ],
    "anatomie_tronc": [
        "epaule", "thorax", "poitrine", "sein", "mamelon", "torse",
        "abdomen", "ventre", "nombril", "dos", "colonne vertebrale", "bassin", "hanche",
        "bras", "coude", "avant-bras", "poignet", "main", "doigt", "pouce", "index",
        "majeur", "annulaire", "auriculaire", "ongle",
        "cuisse", "genou", "jambe", "mollet", "cheville", "pied", "orteil", "talon", "plante",
    ],
    "anatomie_genital": [
        "penis", "gland", "prepuce", "scrotum", "testicule",
        "vulve", "vagin", "clitoris", "urethre", "point g", "point p", "prostate",
        "erogene", "nu", "nue", "nudite", "caresse", "caresser", "toucher", "embrasser", "sexe",
    ],
}
ANATOMIE_MOTS_CLES_RE_PAR_SUJET = {
    sujet: re.compile(r"\b(" + "|".join(re.escape(mot) for mot in mots) + r")\b")
    for sujet, mots in ANATOMIE_MOTS_CLES_PAR_SUJET.items()
}


def message_sujets_anatomie(texte):
    # Détection toujours basée sur les mots-clés français, indépendamment de
    # la langue de réponse demandée (voir profil_utilisateur/lang) - le
    # français reste la seule langue réellement utilisée pour l'instant
    # (voir feedback_language_french_primary_use.md), cette liste n'a donc
    # pas besoin d'exister en plusieurs langues.
    # Itère sur ANATOMIE_MOTS_CLES_RE_PAR_SUJET (3 sujets détectables), pas
    # REFERENCE_SUJETS_ANATOMIE (4, "anatomie_base" en plus - le socle
    # toujours inclus une fois un sujet détecté, jamais détecté lui-même).
    normalise = normaliser_style(texte or "")
    return [s for s in ANATOMIE_MOTS_CLES_RE_PAR_SUJET if ANATOMIE_MOTS_CLES_RE_PAR_SUJET[s].search(normalise)]


# Meubles courants par pièce - même principe que la carte anatomique
# ci-dessus, injecté seulement pour la ou les pièce(s) que le dernier message
# évoque, jamais la liste entière. MEUBLES_ACTIF à False = désactive
# complètement l'injection (pour tester sans son influence) sans toucher au
# chargement/parsing ni aux routes admin, qui restent fonctionnels - remettre
# à True pour réactiver.
MEUBLES_ACTIF = True


def message_pieces_meubles(texte):
    """Indices (positions), pas les noms : les noms de pièces sont en
    français dans le fichier source, mais le texte injecté peut venir d'un
    fichier traduit où les titres de pièce sont dans une autre langue - la
    position de chaque pièce dans le fichier reste, elle, la même quelle que
    soit la langue (la traduction ne réordonne pas les paragraphes)."""
    normalise = normaliser_style(texte or "")
    noms_fr = list(decouper_meubles_par_piece(charger_texte_reference(REFERENCE_SUJET_MAISON, "fr")).keys())
    indices = []
    for i, nom in enumerate(noms_fr):
        motif = re.compile(
            "|".join(r"\b" + re.escape(normaliser_style(alias.strip())) + r"\b" for alias in nom.split("/"))
        )
        if motif.search(normalise):
            indices.append(i)
    return indices


def decouper_meubles_par_piece(texte):
    pieces = {}
    for bloc in decouper_texte_par_blocs(texte):
        lignes = [l for l in bloc.splitlines() if l.strip()]
        if lignes:
            pieces[lignes[0].strip()] = bloc
    return pieces

# Génération d'images : Gemini 2.5 Flash Image (Nano Banana) est utilisé en
# priorité (nécessite GEMINI_API_KEY dans stable-diffusion/.env, avec la
# facturation activée sur le projet Google - le palier gratuit a un quota de
# 0 pour ce modèle). Stable Diffusion local reste entièrement fonctionnel en
# dessous (voir run_generation_stable_diffusion) mais n'est plus appelé par
# défaut : mis de côté, pas supprimé.
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
GEMINI_IMAGE_MODEL = "gemini-2.5-flash-image"
gemini_client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None

GOOGLE_TRANSLATE_API_KEY = os.environ.get("GOOGLE_TRANSLATE_API_KEY")
DEEPL_API_KEY = os.environ.get("DEEPL_API_KEY")

# Config modifiable depuis l'interface admin (clés API notamment) : un
# fichier à part, dans le dossier du serveur (jamais servi sur le réseau,
# contrairement à CREATIONS_DIR), initialisé une seule fois à partir du .env
# puis relu à chaque appel pour qu'un changement dans l'interface admin
# prenne effet immédiatement, sans redémarrer le serveur.
ADMIN_CONFIG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "admin_config.json")
admin_config_lock = threading.Lock()


def load_admin_config():
    if os.path.exists(ADMIN_CONFIG_PATH):
        with open(ADMIN_CONFIG_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    config = {
        "googleTranslateApiKey": GOOGLE_TRANSLATE_API_KEY or "",
        "deeplApiKey": DEEPL_API_KEY or "",
    }
    with open(ADMIN_CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(config, f, ensure_ascii=False)
    return config


def save_admin_config(config):
    with open(ADMIN_CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(config, f, ensure_ascii=False)


def cle_google_translate():
    with admin_config_lock:
        return load_admin_config().get("googleTranslateApiKey") or ""


def cle_deepl():
    with admin_config_lock:
        return load_admin_config().get("deeplApiKey") or ""

MODEL_PATH = os.path.expanduser(
    "~/Documents/Realornot/stable-diffusion/models/sd15-diffusers"
)

# Résolution et nombre d'étapes réduits par rapport à app.py, pour limiter
# la charge CPU/RAM (portable i5-8250U, pas de GPU). STEPS abaissé de 20 à
# 15 en passant au sampler DPM++ 2M Karras (voir load_pipeline) - ce
# sampler converge en moins d'étapes que le PNDM par défaut du modèle, pour
# une qualité comparable (à valider visuellement) et ~25% de temps de
# génération en moins.
WIDTH = 384
HEIGHT = 512
STEPS = 15
CFG = 11.5

NEGATIVE_PROMPT = (
    "blurry, low quality, distorted, deformed, extreme close-up, "
    "cropped face, cropped forehead, cropped chin, out of frame, "
    "bad anatomy, extra limbs, disfigured, "
    "distorted face, deformed face, asymmetric face, malformed hands, "
    "extra fingers, missing fingers, fused fingers, mutated hands, "
    "poorly drawn hands, poorly drawn face"
)

STYLE_PROMPTS = {
    "realiste": (
        "candid photo, amateur smartphone photo, unposed, casual snapshot, "
        "natural everyday lighting, no professional photoshoot, no studio lighting, "
        "no glamour, no fashion magazine style, photorealistic, natural skin texture"
    ),
    "anime": "anime style, cel shading, vibrant colors, japanese animation",
    "peinture": "oil painting, painterly brush strokes, fine art",
    "fantaisie": "fantasy art, magical atmosphere, ethereal lighting, dreamlike",
    "cyberpunk": "cyberpunk style, neon lights, futuristic, high tech",
    "aquarelle": "watercolor painting, soft washes, delicate colors",
    "furry": "furry art style, anthropomorphic animal character, digital illustration",
}

# Termes ajoutés au prompt négatif (voir NEGATIVE_PROMPT), en plus des mots-clés
# positifs ci-dessus (voir correction_style_realiste.md) - un premier essai
# avec seulement des mots-clés positifs ("candid photo", "unposed"...) n'a
# pas suffi à contrer le biais du modèle Stable Diffusion local vers un rendu
# glamour/mode (testé en direct : pose alanguie, lunettes de soleil, éclairage
# très travaillé malgré le prompt positif). Le prompt négatif repousse
# activement un style plutôt que de simplement espérer que le positif
# l'emporte, et est nettement plus efficace pour ça en pratique.
STYLE_NEGATIVE_PROMPTS = {
    "realiste": (
        "glamour, fashion photoshoot, professional photoshoot, studio lighting, "
        "dramatic pose, dramatic lighting, magazine cover, professional model pose, "
        "glossy skin, sunglasses, high fashion"
    ),
}

# Filtre de sécurité : refuse certaines descriptions AVANT de lancer la
# génération (ou l'enregistrement d'un personnage). Volontairement limité à
# ce qui n'est jamais autorisé (mineurs, sexes/tétons visibles, actes sexuels
# décrits crûment) - les tenues suggestives, la romance, "séduisant(e)",
# "faire l'amour", etc. restent libres. La détection de "personne réelle
# identifiable" n'est pas couverte ici (nécessiterait une base de
# noms/reconnaissance faciale, hors de portée d'un simple filtre par
# mots-clés).
TERMES_EXPLICITES = [
    "vagina", "vulva", "pussy", "penis", "dick", "cock", "genitals", "genitalia", "clitoris",
    "nipple", "nipples", "areola",
    "sexe", "vagin", "vulve", "pénis", "clitoris", "clito",
    "téton", "tétons", "teton", "tetons", "mamelon", "mamelons",
    # Actes sexuels décrits crûment (pas la romance/séduction, qui reste autorisée)
    "fuck", "fucking", "blowjob", "deepthroat", "cunnilingus", "fellatio",
    "anal sex", "gang bang", "cum in", "cumming", "masturbate", "masturbating",
    "écarter les cuisses", "écarte les cuisses", "cuisses écartées", "jambes écartées",
    "sucer ma", "sucer sa", "sucer ta", "sucer mon", "sucer son", "sucer ton",
    "baises", "baisez", "baisent", "te baiser", "me baiser", "la baiser", "le baiser dur",
    "sodomie", "sodomiser", "éjaculer", "éjaculation", "masturbe", "masturber", "masturbation",
    "fellation", "double pénétration", "doigter",
]
TERMES_MINEUR = [
    "child", "children", "kid", "kids", "toddler", "infant", "minor", "underage",
    "loli", "shota", "preteen", "tween",
    "enfant", "enfants", "mineur", "mineure", "gamin", "gamine", "bébé", "preado", "préado",
]
TERMES_CONTEXTE_ADULTE = [
    "nude", "naked", "sex", "sexual", "erotic", "nsfw", "porn", "seductive", "sexy", "orgasm",
    "nu", "nue", "nus", "nues", "sexuel", "sexuelle", "érotique", "erotique",
    "pornographique", "séduisant", "séduisante", "seduisant", "seduisante",
]

# Violence sexuelle / non consentie - toujours interdit (indépendamment du
# contexte mineur/adulte ci-dessus).
TERMES_VIOLENCE_SEXUELLE = [
    "rape", "raping", "rapist", "molest", "molesting", "non-consensual", "nonconsensual",
    "viol", "violer", "violeur", "violée", "agression sexuelle", "attouchement", "attouchements",
    "non consenti", "non consentie", "sans consentement",
]

# Violence explicite / gore.
TERMES_VIOLENCE_GORE = [
    "gore", "torture", "torturing", "mutilate", "mutilation", "mutilating", "dismember",
    "dismemberment", "disembowel", "beheading", "decapitate", "decapitation", "corpse", "gutted",
    "sang", "sanglant", "sanglante", "mutiler", "mutilation", "démembrer", "démembrement",
    "éventrer", "décapiter", "décapitation", "torturer", "cadavre", "égorger",
]

# Incitation au danger : armes/explosifs/drogues illégales, auto-mutilation.
TERMES_DANGER = [
    "how to make a bomb", "build a bomb", "make explosives", "synthesize meth", "make meth",
    "3d printed gun", "untraceable gun", "self-harm", "self harm", "how to cut myself",
    "suicide method", "how to make napalm",
    "fabriquer une bombe", "fabriquer un explosif", "fabriquer une arme", "arme non traçable",
    "arme indétectable", "synthétiser de la méthamphétamine", "fabriquer de la drogue",
    "automutilation", "auto-mutilation", "comment me couper", "méthode de suicide",
]

# Discours de haine : attaques/insultes fondées sur origine, religion, genre,
# orientation, handicap. Liste volontairement limitée à des termes non
# ambigus (les insultes générales hors contexte discriminatoire ne sont pas
# couvertes, un simple filtre par mots-clés ne peut pas juger l'intention).
TERMES_HAINE = [
    "kill all", "gas the", "subhuman", "racial slur", "nazi propaganda",
    "exterminer les", "sous-hommes", "sale race", "sale arabe", "sale juif", "sale noir",
    "propagande nazie", "faire l'apologie du nazisme",
]

# Fraude / documents falsifiés / phishing.
TERMES_FRAUDE = [
    "fake passport", "fake id card", "forged id", "counterfeit money", "counterfeit bill",
    "phishing email", "fake bank statement",
    "faux passeport", "fausse carte d'identité", "faux papiers", "faux billets",
    "fausse facture", "email de phishing", "faux relevé bancaire",
]

# Piratage informatique.
TERMES_PIRATAGE = [
    "malware code", "ransomware code", "write a virus", "keylogger code", "sql injection exploit",
    "code malveillant", "créer un virus informatique", "écrire un ransomware", "logiciel espion",
]

# Non couvert par ce filtre par mots-clés (nécessiterait une reconnaissance
# faciale/de personnes réelles ou un jugement contextuel qu'une simple liste
# de termes ne peut pas faire fiablement) : deepfakes de personnes réelles
# (nues, compromettantes ou usurpant leur identité), harcèlement/diffamation
# ciblant un individu précis, reproduction de logos/personnages protégés.

TOUTES_LISTES_INTERDITES = (
    TERMES_VIOLENCE_SEXUELLE + TERMES_VIOLENCE_GORE + TERMES_DANGER
    + TERMES_HAINE + TERMES_FRAUDE + TERMES_PIRATAGE
)


def prompt_interdit(prompt):
    texte = prompt.lower()
    if any(terme in texte for terme in TERMES_EXPLICITES):
        return True
    a_terme_mineur = any(terme in texte for terme in TERMES_MINEUR)
    a_contexte_adulte = any(terme in texte for terme in TERMES_CONTEXTE_ADULTE)
    if a_terme_mineur and a_contexte_adulte:
        return True
    if any(terme in texte for terme in TOUTES_LISTES_INTERDITES):
        return True
    return False


CREATIONS_DIR = os.path.expanduser(
    "~/Documents/Realornot/stable-diffusion/creations_data"
)
CREATIONS_JSON_PATH = os.path.join(CREATIONS_DIR, "creations.json")
os.makedirs(CREATIONS_DIR, exist_ok=True)
creations_lock = threading.Lock()

torch.set_num_threads(6)
torch.set_num_interop_threads(2)

app = Flask(__name__)
pipe = None
busy_lock = threading.Lock()

# Génération asynchrone : une requête POST /generate lance le travail dans un
# thread et renvoie tout de suite un job_id. Le client interroge ensuite
# /status/<job_id> puis /result/<job_id>. Ainsi, si l'app passe en arrière-plan
# et que la connexion HTTP est coupée par le téléphone, la génération continue
# côté serveur et le client peut reprendre le suivi en revenant au premier plan.
jobs = {}


@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Admin-Code, X-Device-Id'
    # Les réponses JSON (listes de créations, comptes...) changent à chaque
    # action et ne doivent jamais être servies depuis un cache HTTP périmé
    # (observé sur MIUI : une création fraîche n'apparaissait qu'après un
    # redémarrage complet de l'app, le temps que le cache expire de
    # lui-même). Les images de créations, elles, gardent leur mise en cache
    # normale (mimetype image/png), pour ne pas les re-télécharger à chaque
    # fois.
    if response.mimetype == 'application/json':
        response.headers['Cache-Control'] = 'no-store'
    return response


@app.route('/generate', methods=['OPTIONS'])
def generate_options():
    return '', 204


def load_pipeline():
    global pipe
    pipe = StableDiffusionPipeline.from_pretrained(
        MODEL_PATH,
        torch_dtype=torch.float32,
        safety_checker=None,
        low_cpu_mem_usage=True,
    )
    pipe = pipe.to("cpu")
    # DPM++ 2M Karras plutôt que le scheduler par défaut du modèle (PNDM) -
    # converge en moins d'étapes (voir STEPS ci-dessus) pour une qualité
    # équivalente, donc plus rapide sur ce CPU sans changer de modèle.
    pipe.scheduler = DPMSolverMultistepScheduler.from_config(pipe.scheduler.config, use_karras_sigmas=True)
    # Réduit fortement le pic de mémoire au prix d'un peu de vitesse.
    pipe.enable_attention_slicing("max")
    pipe.enable_vae_slicing()


@app.route("/health", methods=["GET"])
def health():
    # Avec Pollinations, rien à charger : le serveur est prêt tout de suite.
    return jsonify({"ready": GENERATEUR != "stable_diffusion" or pipe is not None})


def run_generation_stable_diffusion(job_id, prompt, style):
    """Génération locale (Stable Diffusion). Mise de côté depuis le passage à
    Gemini, mais gardée intacte et fonctionnelle - voir generate()."""
    try:
        style_normalise = normaliser_style(style)
        negative_prompt = NEGATIVE_PROMPT
        if style_normalise in STYLE_PROMPTS:
            prompt = f"{prompt}, {STYLE_PROMPTS[style_normalise]}"
        if style_normalise in STYLE_NEGATIVE_PROMPTS:
            negative_prompt = f"{negative_prompt}, {STYLE_NEGATIVE_PROMPTS[style_normalise]}"

        seed = random.randint(0, 2**32 - 1)
        generator = torch.Generator(device="cpu").manual_seed(seed)

        with torch.inference_mode():
            image = pipe(
                prompt=prompt,
                negative_prompt=negative_prompt,
                width=WIDTH,
                height=HEIGHT,
                num_inference_steps=STEPS,
                guidance_scale=CFG,
                generator=generator,
            ).images[0]

        buffer = io.BytesIO()
        image.save(buffer, format="PNG")
        jobs[job_id] = {"status": "done", "image": buffer.getvalue(), "error": None}
    except Exception as e:
        jobs[job_id] = {"status": "error", "image": None, "error": str(e)}
    finally:
        busy_lock.release()


def run_generation_gemini(job_id, prompt, style):
    try:
        style_normalise = normaliser_style(style)
        if style_normalise in STYLE_PROMPTS:
            prompt = f"{prompt}, {STYLE_PROMPTS[style_normalise]}"

        response = gemini_client.models.generate_content(
            model=GEMINI_IMAGE_MODEL,
            contents=[prompt],
        )

        image_bytes = None
        candidates = response.candidates or []
        if candidates and candidates[0].content and candidates[0].content.parts:
            for part in candidates[0].content.parts:
                if part.inline_data is not None:
                    image_bytes = part.inline_data.data
                    break

        if image_bytes is None:
            jobs[job_id] = {"status": "error", "image": None, "error": "Gemini n'a renvoyé aucune image."}
        else:
            jobs[job_id] = {"status": "done", "image": image_bytes, "error": None}
    except Exception as e:
        jobs[job_id] = {"status": "error", "image": None, "error": str(e)}
    finally:
        busy_lock.release()


def run_generation_pollinations(job_id, prompt, style):
    # Crée l'image avec Pollinations (gratuit, sans clé) et la range dans jobs,
    # comme les deux autres générateurs.
    try:
        style_normalise = normaliser_style(style)
        if style_normalise in STYLE_PROMPTS:
            prompt = f"{prompt}, {STYLE_PROMPTS[style_normalise]}"

        url = (
            "https://image.pollinations.ai/prompt/" + urllib.parse.quote(prompt)
            + f"?width={WIDTH}&height={HEIGHT}&model=flux&nologo=true"
            + f"&seed={random.randint(0, 2**31)}"
        )
        requete = urllib.request.Request(url, headers={"User-Agent": "RealOrNot"})
        with urllib.request.urlopen(requete, timeout=120) as reponse:
            donnees = reponse.read()

        # Pollinations renvoie du JPEG : on le convertit en PNG comme avant.
        image = Image.open(io.BytesIO(donnees)).convert("RGB")
        buffer = io.BytesIO()
        image.save(buffer, format="PNG")
        jobs[job_id] = {"status": "done", "image": buffer.getvalue(), "error": None}
    except Exception as e:
        jobs[job_id] = {"status": "error", "image": None, "error": str(e)}
    finally:
        busy_lock.release()


@app.route("/generate", methods=["POST"])
def generate():
    # Gemini reste câblé (run_generation_gemini) mais nécessite la
    # facturation activée sur le projet Google (quota gratuit à 0 pour ce
    # modèle) - en attendant, on repasse sur Stable Diffusion local.
    # Le modèle local n'est nécessaire que si GENERATEUR vaut "stable_diffusion".
    if GENERATEUR == "stable_diffusion" and pipe is None:
        return jsonify({"error": "Modèle non chargé"}), 503

    data = request.get_json(silent=True) or {}
    prompt = (data.get("prompt") or "").strip()
    style = data.get("style")

    if not prompt:
        return jsonify({"error": "Prompt vide"}), 400

    if prompt_interdit(prompt):
        return jsonify({"error": "Cette description n'est pas autorisée."}), 400

    if not busy_lock.acquire(blocking=False):
        return jsonify({"error": "Une génération est déjà en cours, réessayez dans un instant."}), 503

    job_id = str(uuid.uuid4())
    jobs[job_id] = {"status": "running", "image": None, "error": None}

    # Choisit la fonction de génération selon le réglage GENERATEUR.
    fonction = run_generation_pollinations if GENERATEUR == "pollinations" else run_generation_stable_diffusion
    thread = threading.Thread(target=fonction, args=(job_id, prompt, style), daemon=True)
    thread.start()

    return jsonify({"job_id": job_id}), 202


@app.route("/status/<job_id>", methods=["GET"])
def status(job_id):
    job = jobs.get(job_id)
    if job is None:
        return jsonify({"status": "not_found"}), 404
    return jsonify({"status": job["status"], "error": job.get("error")})


@app.route("/result/<job_id>", methods=["GET"])
def result(job_id):
    job = jobs.get(job_id)
    if job is None or job["status"] != "done" or job["image"] is None:
        return jsonify({"error": "Résultat non disponible"}), 404

    buffer = io.BytesIO(job["image"])
    buffer.seek(0)
    return send_file(buffer, mimetype="image/png")


def load_creations():
    if not os.path.exists(CREATIONS_JSON_PATH):
        return []
    with open(CREATIONS_JSON_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def save_creations(creations):
    with open(CREATIONS_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(creations, f, ensure_ascii=False)

# Ajoute 1 au compteur « nbMessages » d'un personnage (nombre de fois où on lui a adressé la parole).
# Ne fait rien si l'identifiant est absent ou inconnu.
def incrementer_nb_messages(creation_id):
    if not isinstance(creation_id, int):
        return
    with creations_lock:
        creations = load_creations()
        creation = next((c for c in creations if c.get("id") == creation_id), None)
        if creation is None:
            return
        creation["nbMessages"] = int(creation.get("nbMessages") or 0) + 1
        save_creations(creations)

@app.route("/creations", methods=["OPTIONS"])
def creations_options():
    return '', 204


@app.route("/creations", methods=["GET"])
def get_creations():
    # Flux public (page d'accueil) : uniquement les personnages publiés en
    # public. Les créations antérieures à l'ajout du champ isPublic sont
    # considérées publiques (comportement inchangé pour elles).
    with creations_lock:
        creations = load_creations()
    return jsonify([c for c in creations if c.get("isPublic", True)])


@app.route("/creations/mine", methods=["OPTIONS"])
def mes_creations_options():
    return '', 204


@app.route("/creations/mine", methods=["GET"])
def get_mes_creations():
    # "Vos créations" : uniquement celles du compte connecté (publiques et
    # privées confondues), contrairement au flux public ci-dessus.
    # Mes créations : celles de mon compte (si connecté) ET celles créées sur cet appareil (X-Device-Id)
    compte = compte_authentifie()
    device_id = request.headers.get("X-Device-Id", "").strip()
    if compte is None and not device_id:
        return jsonify({"error": "Appareil inconnu."}), 401

    with creations_lock:
        creations = load_creations()
    pseudo_normalise = compte["pseudo"].strip().lower() if compte else ""
    return jsonify([
        c for c in creations
        if (pseudo_normalise and (c.get("creatorPseudo") or "").strip().lower() == pseudo_normalise)
        or (device_id and c.get("creatorId") == device_id)
    ])


def extraire_voix(brut):
    # {"cle": str, "index": int} choisi via ChoisirVoix.tsx - null si aucune
    # voix assignée. Validé ici pour ne jamais stocker un objet malformé (le
    # client se contente de relire "cle" ensuite, voir trouverParametresVoix).
    if not isinstance(brut, dict):
        return None
    cle = brut.get("cle")
    index = brut.get("index")
    if not isinstance(cle, str) or not cle or not isinstance(index, int):
        return None
    return {"cle": cle, "index": index}


@app.route("/creations", methods=["POST"])
def create_creation():
    # Compte facultatif : la partie IA marche sans compte (le créateur est alors reconnu par creatorId)
    compte = compte_authentifie()

    data = request.get_json(silent=True) or {}
    title = (data.get("title") or "").strip()
    style = (data.get("style") or "").strip()
    category = (data.get("category") or "").strip()
    bio = (data.get("bio") or "").strip()
    description = (data.get("description") or "").strip()
    histoire = (data.get("histoire") or "").strip()
    salutation = (data.get("salutation") or "").strip()
    image_data_url = data.get("imageUrl") or ""
    avatar_data_url = data.get("avatarUrl") or ""
    creator_id = data.get("creatorId") or ""
    is_public = bool(data.get("isPublic", True))
    genre = data.get("genre")
    genre = genre if isinstance(genre, int) else None
    voix = extraire_voix(data.get("voix"))

    if not title:
        return jsonify({"error": "Titre manquant"}), 400

    texte_complet = " ".join([title, bio, description, histoire, salutation])
    if prompt_interdit(texte_complet):
        return jsonify({"error": "Ce contenu n'est pas autorisé."}), 400

    creation_id = int(time.time() * 1000)

    def enregistrer_image(data_url, suffix):
        if not data_url.startswith("data:image"):
            return ""
        header, b64data = data_url.split(",", 1)
        image_bytes = base64.b64decode(b64data)
        filename = f"{creation_id}{suffix}.png"
        with open(os.path.join(CREATIONS_DIR, filename), "wb") as f:
            f.write(image_bytes)
        return f"/creations/{filename}"

    image_url = enregistrer_image(image_data_url, "")
    avatar_url = enregistrer_image(avatar_data_url, "_avatar")

    creation = {
        "id": creation_id,
        "title": title,
        "style": style,
        "category": category,
        "bio": bio,
        "description": description,
        "histoire": histoire,
        "salutation": salutation,
        "imageUrl": image_url,
        "avatarUrl": avatar_url,
        "creatorId": creator_id,
        "creatorPseudo": compte["pseudo"] if compte else "",  # vide si pas de compte
        "isPublic": is_public,
        "genre": genre,
        "voix": voix,
    }

    with creations_lock:
        creations = load_creations()
        creations.append(creation)
        save_creations(creations)

    return jsonify(creation), 201


NOM_FICHIER_IMAGE_RE = re.compile(r"^\d+(_avatar)?\.png$")


@app.route("/creations/<path:filename>", methods=["GET"])
def get_creation_image(filename):
    # Restreint volontairement aux seules photos de personnages (nom
    # "<id>.png" ou "<id>_avatar.png") : sans ce filtre, cette route
    # servirait n'importe quel fichier du dossier par son nom, y compris
    # comptes.json/creations.json/traductions.json (données sensibles - mots
    # de passe hachés notamment).
    if not NOM_FICHIER_IMAGE_RE.match(filename):
        return jsonify({"error": "Fichier introuvable."}), 404
    # Une photo de personnage ne change jamais une fois créée : cache long
    # (1 an) pour que le téléphone puisse la réafficher depuis son propre
    # cache sans redemander au serveur, y compris quand celui-ci est éteint.
    return send_from_directory(CREATIONS_DIR, filename, max_age=31536000)


@app.route("/creations/<int:creation_id>", methods=["OPTIONS"])
def modifier_creation_options(creation_id):
    return '', 204


@app.route("/creations/<int:creation_id>", methods=["PUT"])
def modifier_creation(creation_id):
    # Compte facultatif : le créateur est reconnu par son compte (si connecté) ou par l'identifiant de l'appareil
    compte = compte_authentifie()
    device_id = request.headers.get("X-Device-Id", "").strip()
    if compte is None and not device_id:
        return jsonify({"error": "Appareil inconnu."}), 401

    data = request.get_json(silent=True) or {}
    title = (data.get("title") or "").strip()
    category = (data.get("category") or "").strip()
    bio = (data.get("bio") or "").strip()
    description = (data.get("description") or "").strip()
    histoire = (data.get("histoire") or "").strip()
    salutation = (data.get("salutation") or "").strip()
    is_public = bool(data.get("isPublic", True))
    genre = data.get("genre")
    genre = genre if isinstance(genre, int) else None
    voix = extraire_voix(data.get("voix"))

    if not title:
        return jsonify({"error": "Titre manquant"}), 400

    texte_complet = " ".join([title, bio, description, histoire, salutation])
    if prompt_interdit(texte_complet):
        return jsonify({"error": "Ce contenu n'est pas autorisé."}), 400

    with creations_lock:
        creations = load_creations()
        creation = next((c for c in creations if c.get("id") == creation_id), None)
        if creation is None:
            return jsonify({"error": "Création introuvable."}), 404
        # Créateur = même compte, ou même appareil (creatorId enregistré à la création)
        est_createur_compte = compte is not None and (creation.get("creatorPseudo") or "").strip().lower() == compte["pseudo"].strip().lower()
        est_createur_appareil = bool(device_id) and creation.get("creatorId") == device_id
        if not (est_createur_compte or est_createur_appareil):
            return jsonify({"error": "Vous n'êtes pas le créateur de ce personnage."}), 403

        creation["title"] = title
        creation["category"] = category
        creation["bio"] = bio
        creation["description"] = description
        creation["histoire"] = histoire
        creation["salutation"] = salutation
        creation["isPublic"] = is_public
        creation["genre"] = genre
        if voix is not None:
            creation["voix"] = voix
        save_creations(creations)

    return jsonify(creation)


# Comptes utilisateur (pseudo unique + mot de passe). Le mot de passe est
# aussi gardé en clair (motDePasse), en plus de son hachage (motDePasseHash,
# utilisé pour la connexion) - à la demande explicite de l'admin, pour
# pouvoir le consulter depuis l'interface d'administration. Un jeton
# (régénéré à chaque connexion) sert d'identifiant de session : le client le
# garde en local et le renvoie pour prouver son identité, sans avoir à
# retransmettre le mot de passe à chaque requête.
COMPTES_JSON_PATH = os.path.join(CREATIONS_DIR, "comptes.json")
comptes_lock = threading.Lock()


def load_comptes():
    if not os.path.exists(COMPTES_JSON_PATH):
        return []
    with open(COMPTES_JSON_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def save_comptes(comptes):
    with open(COMPTES_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(comptes, f, ensure_ascii=False)


def trouver_compte(comptes, pseudo):
    pseudo_normalise = pseudo.strip().lower()
    for compte in comptes:
        if compte["pseudo"].strip().lower() == pseudo_normalise:
            return compte
    return None


def trouver_pseudo_disponible(comptes, prenom):
    # Le premier inscrit avec ce prénom n'a jamais de chiffre - celui-ci
    # n'apparaît qu'à partir du deuxième homonyme, en commençant à 1
    # ("Philippe", puis "Philippe 1", "Philippe 2", ...).
    if trouver_compte(comptes, prenom) is None:
        return prenom
    n = 1
    while trouver_compte(comptes, f"{prenom} {n}") is not None:
        n += 1
    return f"{prenom} {n}"


def compte_depuis_token(token):
    if not token:
        return None
    with comptes_lock:
        comptes = load_comptes()
    for compte in comptes:
        if compte.get("token") == token:
            return compte
    return None


def compte_authentifie():
    """Compte associé au jeton envoyé dans l'en-tête Authorization: Bearer
    <token> de la requête en cours, ou None si absent/invalide."""
    entete = request.headers.get("Authorization", "")
    token = entete[7:] if entete.startswith("Bearer ") else ""
    return compte_depuis_token(token)


# Code d'accès admin (voir spec_code_admin.md) - source unique de vérité,
# hashée comme un mot de passe de compte (jamais en clair sur disque), au
# lieu d'une valeur codée en dur ici ET dans TopBar.tsx (ancien
# fonctionnement, source de désynchronisation possible). Le fichier est créé
# au tout premier accès avec la valeur historique ci-dessous, seulement pour
# ne pas couper l'accès admin existant au moment du déploiement de ce
# changement - Philippe peut ensuite la changer depuis l'interface admin
# (voir /admin/changer-code), ce qui réécrit ce fichier.
ADMIN_CODE_JSON_PATH = os.path.join(CREATIONS_DIR, "admin_code.json")
CODE_ADMIN_INITIAL = "admin2026secret"
admin_code_lock = threading.Lock()


def charger_code_admin_hash():
    if not os.path.exists(ADMIN_CODE_JSON_PATH):
        hash_initial = generate_password_hash(CODE_ADMIN_INITIAL)
        with open(ADMIN_CODE_JSON_PATH, "w", encoding="utf-8") as f:
            json.dump({"codeHash": hash_initial}, f)
        return hash_initial
    with open(ADMIN_CODE_JSON_PATH, "r", encoding="utf-8") as f:
        return json.load(f)["codeHash"]


def sauvegarder_code_admin_hash(code_hash):
    with open(ADMIN_CODE_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump({"codeHash": code_hash}, f)


# Journal de qui s'est authentifié en admin et quand (voir
# /admin/qui-est-connecte) - persisté sur disque plutôt que gardé seulement
# en mémoire, pour ne plus être remis à zéro à chaque redémarrage du
# serveur (ex. après un déploiement), ce qui effaçait auparavant à tort la
# liste des appareils reconnus comme admin.
ADMIN_CONNEXIONS_JSON_PATH = os.path.join(CREATIONS_DIR, "admin_connexions.json")
admin_connexions_lock = threading.Lock()


def load_admin_connexions():
    if not os.path.exists(ADMIN_CONNEXIONS_JSON_PATH):
        return {}
    with open(ADMIN_CONNEXIONS_JSON_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def save_admin_connexions(connexions):
    with open(ADMIN_CONNEXIONS_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(connexions, f, ensure_ascii=False)


def compte_admin_authentifie():
    """Autorisé si le compte connecté a isAdmin=true, OU si la requête
    fournit le code secret d'accès admin (en-tête X-Admin-Code, voir
    TopBar.tsx) - ce code est justement prévu pour autoriser n'importe quel
    appareil qui le connaît, pas seulement le compte "Philippe 1"."""
    compte = compte_authentifie()
    compte_effectif = None
    code_fourni = request.headers.get("X-Admin-Code")
    if compte is not None and compte.get("isAdmin", False):
        compte_effectif = compte
    elif code_fourni:
        with admin_code_lock:
            code_hash = charger_code_admin_hash()
        # .lower() : tolère la majuscule automatique du clavier mobile (voir
        # TopBar.tsx, même tolérance appliquée avant l'envoi de ce header).
        if check_password_hash(code_hash, code_fourni.strip().lower()):
            compte_effectif = compte or {"pseudo": "(code admin, pas connecté)"}
    if compte_effectif is not None:
        with admin_connexions_lock:
            connexions = load_admin_connexions()
            connexions[compte_effectif["pseudo"]] = time.strftime("%Y-%m-%d %H:%M:%S")
            save_admin_connexions(connexions)
    return compte_effectif


@app.route("/moi", methods=["GET", "OPTIONS"])
def moi():
    # Permet à l'app de vérifier, au lancement, que le jeton gardé sur le
    # téléphone correspond toujours à un compte existant (ex : compte
    # supprimé depuis l'interface admin) plutôt que de rester "connecté"
    # indéfiniment sur un compte qui n'existe plus côté serveur.
    if request.method == "OPTIONS":
        return '', 204
    compte = compte_authentifie()
    if compte is None:
        return jsonify({"error": "Non autorisé."}), 401
    resultat = {"pseudo": compte["pseudo"]}
    date_str = compte.get("dateSuppressionDemandee")
    if date_str:
        date_demande = datetime.fromisoformat(date_str)
        jours_ecoules = (datetime.utcnow() - date_demande).total_seconds() / 86400
        resultat["suppressionEnAttente"] = True
        resultat["joursRestants"] = max(0, math.ceil(30 - jours_ecoules))
    else:
        resultat["suppressionEnAttente"] = False
    return jsonify(resultat)


# --- Site de rencontre --------------------------------------------------
# Questionnaire de compatibilité (façon OkCupid, simplifié) : chaque profil
# répond aux mêmes questions à choix, la compatibilité entre deux profils
# est le pourcentage de réponses identiques parmi les questions auxquelles
# les deux ont répondu.
QUESTIONS_RENCONTRE = [
    # Seule question à choix multiple (voir "multiple": True) - les options
    # reprennent les 10 langues déjà supportées par l'appli (voir
    # languageNames.fr dans src/i18n/translations.ts), pas une liste inventée
    # à part.
    {"id": "langues", "texte": "Langues parlées ?", "multiple": True, "indexAutre": 10,
     "options": ["Français", "Anglais", "Espagnol", "Allemand", "Italien", "Portugais", "Chinois", "Japonais",
                 "Coréen", "Arabe", "Autre"]},
    {"id": "genre", "texte": "Mon identité de genre ?", "indexAutre": 6,
     "options": ["Homme", "Femme", "Homme trans", "Femme trans", "Non-binaire", "Intersexe", "Autre"]},
    {"id": "orientation", "texte": "Mon orientation ?", "indexAutre": 5,
     "options": ["Hétérosexuel(le)", "Homosexuel(le)", "Bisexuel(le)", "Pansexuel(le)", "Asexuel(le)", "Autre",
                 "Je préfère ne pas dire"]},
    {"id": "recherche", "texte": "Je recherche ?",
     "options": ["Une relation sérieuse", "Des rencontres sans prise de tête", "Je ne sais pas encore", "De l'amitié"]},
    {"id": "enfants", "texte": "Je veux des enfants un jour ?",
     "options": ["Oui", "Non", "Peut-être", "J'en ai déjà"]},
    {"id": "fume", "texte": "Je fume ?",
     "options": ["Oui", "Non", "Occasionnellement"]},
    {"id": "alcool", "texte": "Je bois de l'alcool ?",
     "options": ["Oui", "Non", "Occasionnellement"]},
    {"id": "rythme", "texte": "Mon rythme de vie ?",
     "options": ["Plutôt casanier(ère)", "Plutôt sociable", "Un mélange des deux"]},
    {"id": "important", "texte": "Le plus important dans une relation ?", "multiple": True,
     "options": ["La confiance", "La passion", "Le respect", "La communication"]},
    {"id": "horaire", "texte": "Je suis plutôt du matin ou du soir ?",
     "options": ["Du matin", "Du soir", "Ça dépend"]},
    {"id": "desaccord", "texte": "Comment je gère les désaccords ?",
     "options": ["J'en parle tout de suite", "Je préfère laisser retomber la pression avant", "Ça dépend du sujet"]},
    {"id": "spiritualite", "texte": "Religion/spiritualité ?",
     "options": ["Croyant(e)", "Non croyant(e)", "Athé(e)", "Spirituel(le) sans religion", "Je préfère ne pas dire"]},
    {"id": "voyage", "texte": "J'aime voyager ?",
     "options": ["Beaucoup", "Un peu", "Pas vraiment"]},
    {"id": "weekend", "texte": "Mon week-end idéal ?", "multiple": True,
     "options": ["Sortir entre amis", "Rester tranquille chez moi", "Faire du sport", "Découvrir de nouvelles choses"]},
    {"id": "ambition", "texte": "Ambition professionnelle ?",
     "options": ["Très ambitieux(se)", "Équilibre vie pro/perso", "Le travail n'est pas ma priorité", "Retraite"]},

    {"id": "animaux", "categorie": "Style de vie / quotidien", "texte": "J'ai des animaux de compagnie ?",
     "options": ["Oui", "Non", "J'aimerais en avoir"]},
    {"id": "sportif", "categorie": "Style de vie / quotidien", "texte": "Sportif(ve) régulier(ère) ?",
     "options": ["Oui", "Non", "De temps en temps"]},
    {"id": "cuisine", "categorie": "Style de vie / quotidien", "texte": "Je cuisine souvent ?",
     "options": ["Oui", "Non", "De temps en temps"]},

    {"id": "introverti", "categorie": "Personnalité / compatibilité", "texte": "Introverti(e) ou extraverti(e) ?",
     "options": ["Introverti(e)", "Extraverti(e)", "Un peu des deux"]},
    {"id": "affection", "categorie": "Personnalité / compatibilité", "multiple": True,
     "texte": "Comment j'exprime mon affection ?",
     "options": ["Les mots", "Le contact physique", "Les cadeaux", "Le temps passé ensemble", "Rendre service"]},
    {"id": "spontane", "categorie": "Personnalité / compatibilité",
     "texte": "Je suis plutôt spontané(e) ou je planifie tout ?",
     "options": ["Spontané(e)", "Je planifie tout", "Un mélange des deux"]},

    # Question à réponse libre (voir "libre": True) - pas d'options à choix,
    # la réponse est un texte tapé par l'utilisateur, stocké dans
    # "precisions" (comme le texte libre des questions à choix "Autre").
    {"id": "ville", "categorie": "J'habite ?", "texte": "Ma ville ?", "libre": True, "options": []},
    {"id": "distance", "categorie": "J'habite ?",
     "texte": "Distance géographique acceptable pour une relation ?",
     "options": ["Même ville", "Même région", "Peu importe la distance"]},
    {"id": "tranche_age", "categorie": "Relations / attentes", "texte": "Tranche d'âge recherchée ?",
     "options": ["18-25 ans", "26-35 ans", "36-45 ans", "46-55 ans", "56-65 ans", "66-75 ans", "76 ans et plus"]},
    {"id": "situation_familiale", "categorie": "Situation",
     "texte": "Situation familiale actuelle ?",
     "options": ["Célibataire", "Marié(e)", "Divorcé(e)", "Veuf/Veuve", "En instance de séparation"]},
    {"id": "loisirs", "categorie": "Centres d'intérêt", "texte": "Mes loisirs préférés ?", "multiple": True,
     "options": ["Musique", "Cinéma/Séries", "Lecture", "Jeux vidéo", "Promenade"]},
    {"id": "talent", "categorie": "Centres d'intérêt", "texte": "Un talent ou une passion insolite ?", "indexAutre": 3,
     "options": ["Artistique", "Sportif", "Culinaire", "Autre"]},

    {"id": "canal", "categorie": "Communication", "texte": "Je préfère les messages écrits ou les appels ?",
     "options": ["Messages écrits", "Appels", "Les deux"]},
    {"id": "frequence_echange", "categorie": "Communication",
     "texte": "À quelle fréquence j'aime échanger avec un(e) partenaire ?",
     "options": ["Tous les jours", "Plusieurs fois par semaine", "De temps en temps"]},
]

QUESTIONS_RENCONTRE_PAR_ID = {q["id"]: q for q in QUESTIONS_RENCONTRE}
# "indexAutre" doit toujours pointer sur la position réelle de l'option
# "Autre" - vérifié ici plutôt que retrouvé par recherche de texte au moment
# du calcul, pour que la comparaison ne dépende plus du texte français (voir
# _match_question_simple_rencontre) et reste valable une fois le contenu
# traduit dans d'autres langues.
for _q in QUESTIONS_RENCONTRE:
    if "indexAutre" in _q:
        assert _q["options"][_q["indexAutre"]] == "Autre", f"indexAutre incorrect pour la question {_q['id']!r}"
del _q


def questions_rencontre_pour_langue(code_langue):
    # Le français (QUESTIONS_RENCONTRE) reste la version canonique - une
    # langue ou une question absente de TRADUCTIONS_QUESTIONS_RENCONTRE
    # retombe simplement sur le texte français plutôt que de planter (voir
    # rencontre_traductions.py). Seuls "texte"/"options"/"categorie"
    # changent : id/multiple/libre/indexAutre restent identiques, la
    # position des options ne change jamais d'une langue à l'autre (voir
    # _match_genre_orientation_rencontre etc., qui comparent par index).
    traductions = TRADUCTIONS_QUESTIONS_RENCONTRE.get(code_langue)
    if not traductions:
        return QUESTIONS_RENCONTRE
    resultat = []
    for question in QUESTIONS_RENCONTRE:
        trad = traductions.get(question["id"])
        if not trad:
            resultat.append(question)
            continue
        question_localisee = dict(question)
        question_localisee["texte"] = trad.get("texte", question["texte"])
        if trad.get("options") is not None:
            question_localisee["options"] = trad["options"]
        if trad.get("categorie") is not None:
            question_localisee["categorie"] = trad["categorie"]
        resultat.append(question_localisee)
    return resultat

# --- Score de compatibilité ---------------------------------------------
# 3 niveaux pondérés (60% / 25% / 15%) - voir _niveau_question_rencontre pour
# le classement de chaque question. "Présente-toi" (bio, texte libre) et
# "Ma ville ?" (consommée uniquement pour le géocodage du critère "J'habite",
# voir plus bas) ne comptent pour aucun point, dans aucun niveau. Toute
# question sans réponse des deux côtés est exclue du calcul de son niveau
# (n'entre pas dans son dénominateur) ; un niveau sans aucune réponse commune
# est totalement exclu et son poids redistribué proportionnellement entre les
# niveaux restants (voir calculer_compatibilite_rencontre).
IDS_NIVEAU1_RENCONTRE = {"langues", "genre", "orientation", "tranche_age", "recherche", "distance"}
IDS_EXCLUES_SCORE_RENCONTRE = {"ville"}
CATEGORIES_NIVEAU2_RENCONTRE = {"Personnalité / compatibilité", "Style de vie / quotidien"}
IDS_NIVEAU2_RENCONTRE = {"important", "desaccord", "voyage", "weekend", "horaire", "rythme"}
CATEGORIES_NIVEAU3_RENCONTRE = {"Situation", "Centres d'intérêt", "Communication"}
IDS_NIVEAU3_RENCONTRE = {"enfants", "spiritualite", "ambition", "fume", "alcool"}
POIDS_NIVEAUX_RENCONTRE = {1: 0.60, 2: 0.25, 3: 0.15}

# "Ville" = ne peut pas se déplacer, "Région" = jusqu'à 100 km, "Peu importe
# la distance" = illimité (voir _match_habite_rencontre) - indices alignés
# sur les options de la question "distance" ci-dessus dans QUESTIONS_RENCONTRE.
CAPACITES_DEPLACEMENT_KM_RENCONTRE = {0: 0.0, 1: 100.0, 2: float("inf")}

# Indexé par position (pas par texte) pour rester valable quelle que soit la
# langue affichée - correspond dans l'ordre aux options de la question
# "tranche_age" ci-dessus (même ordre garanti dans toutes les langues).
TRANCHES_AGE_RENCONTRE = [
    (18, 25), (26, 35), (36, 45), (46, 55), (56, 65), (66, 75), (76, 999),
]



# Indices dans les options de la question "genre"/"orientation" ci-dessus -
# comparaison par position plutôt que par texte, pour rester valable quelle
# que soit la langue affichée (même ordre garanti dans toutes les langues).
# ["Homme", "Femme", "Homme trans", "Femme trans", "Non-binaire", "Intersexe", "Autre"]
GENRE_INDICES_MASCULIN = {0, 2}
GENRE_INDICES_FEMININ = {1, 3}
# ["Hétérosexuel(le)", "Homosexuel(le)", "Bisexuel(le)", "Pansexuel(le)", "Asexuel(le)", "Autre", "Je préfère ne pas dire"]
ORIENTATION_INDEX_HETERO = 0
ORIENTATION_INDEX_HOMO = 1
ORIENTATION_INDICES_SANS_RESTRICTION = {2, 3, 4}  # Bisexuel(le), Pansexuel(le), Asexuel(le)


def _genre_categorie_rencontre(idx_genre):
    if idx_genre in GENRE_INDICES_MASCULIN:
        return "M"
    if idx_genre in GENRE_INDICES_FEMININ:
        return "F"
    return "A"  # Non-binaire, Intersexe, Autre : pas de catégorie binaire


def _orientation_compatible_rencontre(idx_orientation, idx_propre_genre, idx_genre_autre):
    cat_propre = _genre_categorie_rencontre(idx_propre_genre)
    cat_autre = _genre_categorie_rencontre(idx_genre_autre)
    if idx_orientation == ORIENTATION_INDEX_HETERO:
        if cat_propre == "M":
            return cat_autre == "F"
        if cat_propre == "F":
            return cat_autre == "M"
        return False  # catégorie "autre" : opposé binaire non défini
    if idx_orientation == ORIENTATION_INDEX_HOMO:
        return cat_autre == cat_propre
    if idx_orientation in ORIENTATION_INDICES_SANS_RESTRICTION:
        return True  # compatible avec plusieurs genres / pas de préférence liée
    return True  # "Autre", "Je préfère ne pas dire" : pas de règle définie


def _match_langues_rencontre(profil_a, profil_b):
    langues_a = profil_a.get("reponsesMultiples", {}).get("langues")
    langues_b = profil_b.get("reponsesMultiples", {}).get("langues")
    if not langues_a or not langues_b:
        return None
    return bool(set(langues_a) & set(langues_b))


def _match_genre_orientation_rencontre(profil_a, profil_b):
    idx_genre_a = profil_a.get("reponses", {}).get("genre")
    idx_orientation_a = profil_a.get("reponses", {}).get("orientation")
    idx_genre_b = profil_b.get("reponses", {}).get("genre")
    idx_orientation_b = profil_b.get("reponses", {}).get("orientation")
    if None in (idx_genre_a, idx_orientation_a, idx_genre_b, idx_orientation_b):
        return None
    return (
        _orientation_compatible_rencontre(idx_orientation_a, idx_genre_a, idx_genre_b)
        and _orientation_compatible_rencontre(idx_orientation_b, idx_genre_b, idx_genre_a)
    )


def _match_tranche_age_rencontre(profil_a, profil_b):
    idx_a = profil_a.get("reponses", {}).get("tranche_age")
    idx_b = profil_b.get("reponses", {}).get("tranche_age")
    age_a = profil_a.get("age")
    age_b = profil_b.get("age")
    if None in (idx_a, idx_b, age_a, age_b):
        return None
    min_a, max_a = TRANCHES_AGE_RENCONTRE[idx_a]
    min_b, max_b = TRANCHES_AGE_RENCONTRE[idx_b]
    return (min_a <= age_b <= max_a) and (min_b <= age_a <= max_b)


def _match_recherche_rencontre(profil_a, profil_b):
    idx_a = profil_a.get("reponses", {}).get("recherche")
    idx_b = profil_b.get("reponses", {}).get("recherche")
    if None in (idx_a, idx_b):
        return None
    return idx_a == idx_b


def _distance_km_rencontre(lat1, lon1, lat2, lon2):
    # Formule de haversine (distance à vol d'oiseau entre 2 points GPS).
    rayon_terre_km = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return rayon_terre_km * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def geocoder_ville_rencontre(nom_ville):
    # API Adresse du gouvernement français (data.gouv.fr) : gratuite, sans
    # clé, pas de limite de quota gênante pour l'usage de cette appli.
    # Retourne (latitude, longitude) ou None si la ville n'est pas trouvée
    # ou en cas d'échec réseau.
    nom_ville = (nom_ville or "").strip()
    if not nom_ville:
        return None
    try:
        reponse = requests.get(
            "https://api-adresse.data.gouv.fr/search/",
            params={"q": nom_ville, "type": "municipality", "limit": 1},
            timeout=10,
        )
        if reponse.status_code != 200:
            print("Géocodage ville erreur:", reponse.status_code, reponse.text[:300], flush=True)
            return None
        features = reponse.json().get("features") or []
        if not features:
            return None
        lon, lat = features[0]["geometry"]["coordinates"]
        return (lat, lon)
    except Exception as e:
        print("Géocodage ville exception:", e, flush=True)
        return None


def _match_habite_rencontre(profil_a, profil_b):
    idx_a = profil_a.get("reponses", {}).get("distance")
    idx_b = profil_b.get("reponses", {}).get("distance")
    if None in (idx_a, idx_b):
        return None
    lat_a, lon_a = profil_a.get("villeLat"), profil_a.get("villeLon")
    lat_b, lon_b = profil_b.get("villeLat"), profil_b.get("villeLon")
    if None in (lat_a, lon_a, lat_b, lon_b):
        return None  # ville non renseignée ou non géocodable d'au moins un côté
    distance = _distance_km_rencontre(lat_a, lon_a, lat_b, lon_b)
    capacite_max = max(CAPACITES_DEPLACEMENT_KM_RENCONTRE[idx_a], CAPACITES_DEPLACEMENT_KM_RENCONTRE[idx_b])
    return distance <= capacite_max


def _match_question_simple_rencontre(question, profil_a, profil_b):
    qid = question["id"]
    if question.get("libre"):
        precision_a = (profil_a.get("precisions", {}).get(qid) or "").strip().lower()
        precision_b = (profil_b.get("precisions", {}).get(qid) or "").strip().lower()
        if not precision_a or not precision_b:
            return None  # comparaison non fiable : exclue du calcul
        return precision_a == precision_b
    idx_a = profil_a.get("reponses", {}).get(qid)
    idx_b = profil_b.get("reponses", {}).get(qid)
    if None in (idx_a, idx_b):
        return None
    index_autre = question.get("indexAutre")
    if index_autre is not None and idx_a == index_autre and idx_b == index_autre:
        precision_a = (profil_a.get("precisions", {}).get(qid) or "").strip().lower()
        precision_b = (profil_b.get("precisions", {}).get(qid) or "").strip().lower()
        if not precision_a or not precision_b:
            return None  # comparaison non fiable : exclue du calcul
        return precision_a == precision_b
    return idx_a == idx_b


def _match_question_multiple_rencontre(question, profil_a, profil_b):
    # Même logique que les langues (voir _match_langues_rencontre) : pas de
    # score partiel, juste "au moins une réponse en commun" ou non.
    qid = question["id"]
    choix_a = profil_a.get("reponsesMultiples", {}).get(qid)
    choix_b = profil_b.get("reponsesMultiples", {}).get(qid)
    if not choix_a or not choix_b:
        return None
    return bool(set(choix_a) & set(choix_b))


def _score_niveau1_rencontre(profil_a, profil_b):
    # 5 critères de poids égal (20% du Niveau 1 chacun) : Genre/Orientation
    # compte pour UN SEUL critère (fusionné), pas deux.
    total, matches = 0, 0
    for resultat in (
        _match_langues_rencontre(profil_a, profil_b),
        _match_genre_orientation_rencontre(profil_a, profil_b),
        _match_tranche_age_rencontre(profil_a, profil_b),
        _match_recherche_rencontre(profil_a, profil_b),
        _match_habite_rencontre(profil_a, profil_b),
    ):
        if resultat is not None:
            total += 1
            matches += 1 if resultat else 0
    return (matches / total) if total else None


def _niveau_question_rencontre(question):
    qid = question["id"]
    if qid in IDS_EXCLUES_SCORE_RENCONTRE:
        return None
    if qid in IDS_NIVEAU1_RENCONTRE:
        return 1
    categorie = question.get("categorie")
    if qid in IDS_NIVEAU2_RENCONTRE or categorie in CATEGORIES_NIVEAU2_RENCONTRE:
        return 2
    if qid in IDS_NIVEAU3_RENCONTRE or categorie in CATEGORIES_NIVEAU3_RENCONTRE:
        return 3
    return None  # ne devrait pas arriver : toute question doit être classée


def _score_niveau_generique_rencontre(profil_a, profil_b, niveau):
    total, matches = 0, 0
    for question in QUESTIONS_RENCONTRE:
        if _niveau_question_rencontre(question) != niveau:
            continue
        if question.get("multiple"):
            resultat = _match_question_multiple_rencontre(question, profil_a, profil_b)
        else:
            resultat = _match_question_simple_rencontre(question, profil_a, profil_b)
        if resultat is not None:
            total += 1
            matches += 1 if resultat else 0
    return (matches / total) if total else None


def calculer_compatibilite_rencontre(profil_a, profil_b):
    scores_niveaux = {
        1: _score_niveau1_rencontre(profil_a, profil_b),
        2: _score_niveau_generique_rencontre(profil_a, profil_b, 2),
        3: _score_niveau_generique_rencontre(profil_a, profil_b, 3),
    }
    niveaux_valides = {n: s for n, s in scores_niveaux.items() if s is not None}
    if not niveaux_valides:
        return None
    poids_total = sum(POIDS_NIVEAUX_RENCONTRE[n] for n in niveaux_valides)
    score = sum(s * POIDS_NIVEAUX_RENCONTRE[n] for n, s in niveaux_valides.items()) / poids_total
    return round(score * 100)


RENCONTRE_JSON_PATH = os.path.join(CREATIONS_DIR, "rencontre_profils.json")
rencontre_lock = threading.Lock()


def load_rencontre_profils():
    if not os.path.exists(RENCONTRE_JSON_PATH):
        return []
    with open(RENCONTRE_JSON_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def save_rencontre_profils(profils):
    with open(RENCONTRE_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(profils, f, ensure_ascii=False)


def trouver_profil_rencontre(profils, pseudo):
    for profil in profils:
        if profil["pseudo"] == pseudo:
            return profil
    return None


# Après un renommage de pseudo déjà appliqué dans comptes.json (voir
# admin_modifier_compte, seule route de renommage restante), répercute le
# changement sur les créations (creatorPseudo, sinon orphelines) et le
# profil de rencontre éventuel (sinon son "pseudo" reste désynchronisé du
# vrai pseudo du compte - c'est exactement le bug qu'avait la route admin
# avant que cette logique ne soit factorisée ici).
def repercuter_renommage_compte(ancien_pseudo, nouveau_pseudo):
    with creations_lock:
        creations = load_creations()
        ancien_normalise = ancien_pseudo.strip().lower()
        modifie = False
        for c in creations:
            if (c.get("creatorPseudo") or "").strip().lower() == ancien_normalise:
                c["creatorPseudo"] = nouveau_pseudo
                modifie = True
        if modifie:
            save_creations(creations)

    with rencontre_lock:
        profils = load_rencontre_profils()
        profil = trouver_profil_rencontre(profils, ancien_pseudo)
        if profil is not None:
            profil["pseudo"] = nouveau_pseudo
            save_rencontre_profils(profils)


# Prénom affiché publiquement (voir /rencontre/prenom) - distinct du pseudo,
# qui ne sert qu'à se connecter au bon compte et doit rester unique (voir
# trouver_pseudo_disponible) ; le prénom, lui, n'a aucune contrainte
# d'unicité (deux personnes peuvent tout à fait s'appeler pareil). Replie
# sur le pseudo si aucun prénom n'a encore été donné (compte créé avant
# l'ajout de ce champ, ou prénom jamais rempli).
def prenom_pour_pseudo(profils, pseudo):
    profil = trouver_profil_rencontre(profils, pseudo)
    return (profil or {}).get("prenom") or pseudo


# Photos de profil du site de rencontre (jusqu'à 5, voir spec_page_photos.md)
# - dossier séparé de CREATIONS_DIR/creations (photos de personnages IA) pour
# ne pas mélanger les deux, même mécanisme de service de fichiers filtré par
# regex.
RENCONTRE_PHOTOS_DIR = os.path.join(CREATIONS_DIR, "rencontre_photos")
os.makedirs(RENCONTRE_PHOTOS_DIR, exist_ok=True)
MAX_PHOTOS_RENCONTRE = 5
# Dimension max (plus grand côté) après compression - suffisant pour un
# affichage plein écran sur un téléphone sans garder le poids d'une photo
# native de smartphone (souvent 3000px+).
PHOTO_RENCONTRE_DIMENSION_MAX = 1080
NOM_FICHIER_PHOTO_RENCONTRE_RE = re.compile(r"^[0-9a-f]{16}\.jpg$")


def comprimer_et_enregistrer_photo_rencontre(data_url):
    # Compression systématique (redimensionnement + ré-encodage JPEG qualité
    # 82, cf spec : nette mais légère) - une vraie photo de téléphone (souvent
    # plusieurs Mo) ne doit pas être stockée telle quelle.
    if not data_url.startswith("data:image"):
        return None
    _, b64data = data_url.split(",", 1)
    image_bytes = base64.b64decode(b64data)
    image = Image.open(io.BytesIO(image_bytes))
    image = image.convert("RGB")
    image.thumbnail((PHOTO_RENCONTRE_DIMENSION_MAX, PHOTO_RENCONTRE_DIMENSION_MAX), Image.LANCZOS)
    photo_id = secrets.token_hex(8)
    filename = f"{photo_id}.jpg"
    image.save(os.path.join(RENCONTRE_PHOTOS_DIR, filename), format="JPEG", quality=82, optimize=True)
    return photo_id, filename


@app.route("/rencontre/photos/<path:filename>", methods=["GET"])
def get_photo_rencontre(filename):
    if not NOM_FICHIER_PHOTO_RENCONTRE_RE.match(filename):
        return jsonify({"error": "Fichier introuvable."}), 404
    return send_from_directory(RENCONTRE_PHOTOS_DIR, filename, max_age=31536000)


@app.route("/rencontre/photo", methods=["POST", "OPTIONS"])
def rencontre_photo_ajouter():
    if request.method == "OPTIONS":
        return '', 204
    compte = compte_authentifie()
    if compte is None:
        return jsonify({"error": "Non autorisé."}), 401

    data = request.get_json(silent=True) or {}
    image_data_url = data.get("imageUrl") or ""

    with rencontre_lock:
        profils = load_rencontre_profils()
        profil = trouver_profil_rencontre(profils, compte["pseudo"])
        if profil is None:
            # Une photo peut être ajoutée avant que le questionnaire ait
            # jamais été enregistré (ex : accès direct à "Mes photos") - le
            # profil créé ici doit donc déjà avoir les mêmes clés par défaut
            # que rencontre_profil_get, plutôt que juste le pseudo, sinon le
            # client reçoit un profil incomplet (reponses absent) au premier
            # chargement de la page questionnaire et plante dessus.
            profil = {
                "pseudo": compte["pseudo"], "bio": "", "reponses": {}, "reponsesMultiples": {}, "precisions": {},
            }
            profils.append(profil)
        photos = profil.get("photos") or []
        if len(photos) >= MAX_PHOTOS_RENCONTRE:
            return jsonify({"error": f"Maximum {MAX_PHOTOS_RENCONTRE} photos."}), 400

        resultat = comprimer_et_enregistrer_photo_rencontre(image_data_url)
        if resultat is None:
            return jsonify({"error": "Image invalide."}), 400
        photo_id, filename = resultat

        photos.append({"id": photo_id, "filename": filename})
        profil["photos"] = photos
        if not profil.get("photoPresentationId"):
            profil["photoPresentationId"] = photo_id
        save_rencontre_profils(profils)

    return jsonify({"photos": profil["photos"], "photoPresentationId": profil["photoPresentationId"]}), 201


@app.route("/rencontre/photo/<photo_id>", methods=["DELETE", "OPTIONS"])
def rencontre_photo_supprimer(photo_id):
    if request.method == "OPTIONS":
        return '', 204
    compte = compte_authentifie()
    if compte is None:
        return jsonify({"error": "Non autorisé."}), 401

    with rencontre_lock:
        profils = load_rencontre_profils()
        profil = trouver_profil_rencontre(profils, compte["pseudo"])
        if profil is None:
            return jsonify({"error": "Profil introuvable."}), 404
        photos = profil.get("photos") or []
        photo = next((p for p in photos if p["id"] == photo_id), None)
        if photo is None:
            return jsonify({"error": "Photo introuvable."}), 404

        photos = [p for p in photos if p["id"] != photo_id]
        profil["photos"] = photos
        if profil.get("photoPresentationId") == photo_id:
            profil["photoPresentationId"] = photos[0]["id"] if photos else None
        save_rencontre_profils(profils)

        chemin = os.path.join(RENCONTRE_PHOTOS_DIR, photo["filename"])
        if os.path.exists(chemin):
            os.remove(chemin)

    return jsonify({"photos": profil["photos"], "photoPresentationId": profil["photoPresentationId"]})


@app.route("/rencontre/photo/<photo_id>/presentation", methods=["POST", "OPTIONS"])
def rencontre_photo_presentation(photo_id):
    if request.method == "OPTIONS":
        return '', 204
    compte = compte_authentifie()
    if compte is None:
        return jsonify({"error": "Non autorisé."}), 401

    with rencontre_lock:
        profils = load_rencontre_profils()
        profil = trouver_profil_rencontre(profils, compte["pseudo"])
        if profil is None:
            return jsonify({"error": "Profil introuvable."}), 404
        photos = profil.get("photos") or []
        if not any(p["id"] == photo_id for p in photos):
            return jsonify({"error": "Photo introuvable."}), 404
        profil["photoPresentationId"] = photo_id
        save_rencontre_profils(profils)

    return jsonify({"photos": profil["photos"], "photoPresentationId": profil["photoPresentationId"]})


# Compteurs de vues de profil (voir compteurs_visites.md) : "visiteurs" sur
# le profil visité associe chaque visiteur distinct à la date de sa
# dernière visite (le total ne compte que des personnes, pas des
# événements, et ne diminue donc jamais) ; "dernierCheckVues" retient quand
# le propriétaire a lui-même consulté sa liste de vues pour distinguer les
# nouvelles visites des anciennes.
@app.route("/rencontre/profil/<pseudo>/vue", methods=["POST", "OPTIONS"])
def rencontre_profil_vue(pseudo):
    if request.method == "OPTIONS":
        return '', 204
    compte = compte_authentifie()
    if compte is None:
        return jsonify({"error": "Non autorisé."}), 401
    if compte["pseudo"] == pseudo:
        return jsonify({"ok": True})

    with rencontre_lock:
        profils = load_rencontre_profils()
        profil = trouver_profil_rencontre(profils, pseudo)
        if profil is None:
            return jsonify({"error": "Profil introuvable."}), 404
        visiteurs = profil.get("visiteurs") or {}
        visiteurs[compte["pseudo"]] = datetime.utcnow().isoformat()
        profil["visiteurs"] = visiteurs
        save_rencontre_profils(profils)

    return jsonify({"ok": True})


@app.route("/rencontre/vues/compteur", methods=["GET", "OPTIONS"])
def rencontre_vues_compteur():
    if request.method == "OPTIONS":
        return '', 204
    compte = compte_authentifie()
    if compte is None:
        return jsonify({"error": "Non autorisé."}), 401

    with rencontre_lock:
        profil = trouver_profil_rencontre(load_rencontre_profils(), compte["pseudo"]) or {}
    visiteurs = profil.get("visiteurs") or {}
    dernier_check = profil.get("dernierCheckVues")
    nouvelles = len(visiteurs) if not dernier_check else sum(
        1 for date in visiteurs.values() if date > dernier_check
    )
    return jsonify({"total": len(visiteurs), "nouvelles": nouvelles})


@app.route("/rencontre/vues", methods=["GET", "OPTIONS"])
def rencontre_vues_liste():
    # Consulter cette liste remet à zéro le compteur de "nouvelles vues" -
    # voir compteurs_visites.md ("se remet à zéro une fois consulté").
    if request.method == "OPTIONS":
        return '', 204
    compte = compte_authentifie()
    if compte is None:
        return jsonify({"error": "Non autorisé."}), 401

    with rencontre_lock:
        profils = load_rencontre_profils()
        profil = trouver_profil_rencontre(profils, compte["pseudo"])
        visiteurs = (profil.get("visiteurs") or {}) if profil else {}
        dernier_check = (profil.get("dernierCheckVues") if profil else None)
        nouvelles = [
            {"pseudo": p, "prenom": prenom_pour_pseudo(profils, p), "date": d} for p, d in visiteurs.items()
            if not dernier_check or d > dernier_check
        ]
        anciennes = [
            {"pseudo": p, "prenom": prenom_pour_pseudo(profils, p), "date": d} for p, d in visiteurs.items()
            if dernier_check and d <= dernier_check
        ]
        if profil is not None:
            profil["dernierCheckVues"] = datetime.utcnow().isoformat()
            save_rencontre_profils(profils)

    nouvelles.sort(key=lambda v: v["date"], reverse=True)
    anciennes.sort(key=lambda v: v["date"], reverse=True)
    return jsonify({"nouvelles": nouvelles, "anciennes": anciennes})


# Messagerie entre vrais comptes (voir compteurs_visites.md - distincte de
# la conversation avec un personnage IA, qui reste gérée ailleurs). Stockage
# à plat (une entrée par message envoyé) plutôt que par conversation : plus
# simple à filtrer par participant et à marquer "lu" message par message.
RENCONTRE_MESSAGES_JSON_PATH = os.path.join(CREATIONS_DIR, "rencontre_messages.json")
messages_lock = threading.Lock()


def load_rencontre_messages():
    if not os.path.exists(RENCONTRE_MESSAGES_JSON_PATH):
        return []
    with open(RENCONTRE_MESSAGES_JSON_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def save_rencontre_messages(messages):
    with open(RENCONTRE_MESSAGES_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(messages, f, ensure_ascii=False)


# Blocage entre deux comptes (voir spec_bloquer_signaler.md) : rend les deux
# personnes mutuellement invisibles l'une à l'autre, peu importe qui a
# bloqué qui - stocké comme une liste de paires orientées (qui a bloqué qui,
# utile pour un futur historique), mais est_bloque() ignore ce sens pour
# l'effet, qui est mutuel par construction.
RENCONTRE_BLOCAGES_JSON_PATH = os.path.join(CREATIONS_DIR, "rencontre_blocages.json")
blocages_lock = threading.Lock()


def load_rencontre_blocages():
    if not os.path.exists(RENCONTRE_BLOCAGES_JSON_PATH):
        return []
    with open(RENCONTRE_BLOCAGES_JSON_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def save_rencontre_blocages(blocages):
    with open(RENCONTRE_BLOCAGES_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(blocages, f, ensure_ascii=False)


def est_bloque(blocages, pseudo_a, pseudo_b):
    return any(
        (b["de"] == pseudo_a and b["a"] == pseudo_b) or (b["de"] == pseudo_b and b["a"] == pseudo_a)
        for b in blocages
    )


@app.route("/rencontre/bloquer/<pseudo>", methods=["POST", "OPTIONS"])
def rencontre_bloquer(pseudo):
    if request.method == "OPTIONS":
        return '', 204
    compte = compte_authentifie()
    if compte is None:
        return jsonify({"error": "Non autorisé."}), 401
    if compte["pseudo"] == pseudo:
        return jsonify({"error": "Impossible de se bloquer soi-même."}), 400

    with blocages_lock:
        blocages = load_rencontre_blocages()
        if not est_bloque(blocages, compte["pseudo"], pseudo):
            blocages.append({"de": compte["pseudo"], "a": pseudo, "date": datetime.utcnow().isoformat()})
            save_rencontre_blocages(blocages)

    return jsonify({"ok": True})


# Signalement d'un profil (voir spec_bloquer_signaler.md) - distinct du
# système de signalement des créations IA (REPORTS_JSON_PATH/"/reports",
# clé par creationId) : celui-ci cible un pseudo, avec un motif choisi dans
# une liste fermée plutôt qu'un texte libre à modérer.
MOTIFS_SIGNALEMENT_RENCONTRE = [
    "Contenu sexuel", "Suicide ou automutilation", "Sécurité des enfants",
    "Harcèlement ou intimidation", "Discours haineux et discrimination", "Autre",
]

RENCONTRE_SIGNALEMENTS_JSON_PATH = os.path.join(CREATIONS_DIR, "rencontre_signalements.json")
rencontre_signalements_lock = threading.Lock()


def load_rencontre_signalements():
    if not os.path.exists(RENCONTRE_SIGNALEMENTS_JSON_PATH):
        return []
    with open(RENCONTRE_SIGNALEMENTS_JSON_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def save_rencontre_signalements(signalements):
    with open(RENCONTRE_SIGNALEMENTS_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(signalements, f, ensure_ascii=False)


@app.route("/rencontre/signaler/<pseudo>", methods=["POST", "OPTIONS"])
def rencontre_signaler(pseudo):
    # Séparé du blocage (voir spec_bloquer_signaler.md : "deux actions
    # distinctes, pas une seule combinée") - signaler ne bloque pas, et
    # inversement.
    if request.method == "OPTIONS":
        return '', 204
    compte = compte_authentifie()
    if compte is None:
        return jsonify({"error": "Non autorisé."}), 401
    if compte["pseudo"] == pseudo:
        return jsonify({"error": "Impossible de se signaler soi-même."}), 400

    data = request.get_json(silent=True) or {}
    motif = (data.get("motif") or "").strip()
    if motif not in MOTIFS_SIGNALEMENT_RENCONTRE:
        return jsonify({"error": "Motif invalide."}), 400

    signalement = {
        "id": secrets.token_hex(8),
        "type": "profil",
        "de": compte["pseudo"],
        "cible": pseudo,
        "motif": motif,
        "message": None,
        "date": datetime.utcnow().isoformat(),
    }
    with rencontre_signalements_lock:
        signalements = load_rencontre_signalements()
        signalements.append(signalement)
        save_rencontre_signalements(signalements)

    return jsonify(signalement), 201


# Envoie un e-mail à l'administrateur quand un message arrive par « Contacter l'administrateur ».
# Utilise Gmail avec un mot de passe d'application (variable MAIL_ADMIN_MDP). Si l'envoi échoue, le message reste quand même enregistré.
def prevenir_admin_par_mail(contact):
    import os, smtplib, threading
    from email.message import EmailMessage
    mdp = os.environ.get("MAIL_ADMIN_MDP")
    if not mdp:
        return

    def envoyer():
        try:
            msg = EmailMessage()
            msg["Subject"] = "Realornot : nouveau message de " + str(contact["de"])
            msg["From"] = "realornot1000@gmail.com"
            msg["To"] = "realornot1000@gmail.com"
            if contact.get("email"):
                msg["Reply-To"] = contact["email"]
            msg.set_content(contact["message"] + "\n\nDe : " + str(contact["de"]) + "\nE-mail : " + str(contact.get("email") or "aucun"))
            with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=15) as s:
                s.login("realornot1000@gmail.com", mdp)
                s.send_message(msg)
        except Exception as e:
            print("Envoi du mail admin impossible :", e)

    threading.Thread(target=envoyer, daemon=True).start()


@app.route("/rencontre/contacter-admin", methods=["POST", "OPTIONS"])
def rencontre_contacter_admin():
    # Contact général (bug, suggestion, problème de compte...) indépendant du
    # signalement d'un profil précis (voir spec_contact_admin.md) - même
    # boîte de réception que rencontre_signaler ci-dessus ("canal commun...
    # pas de séparation"), distingué seulement par "type".
    if request.method == "OPTIONS":
        return '', 204
    # Compte facultatif : le mode IA n'a pas de compte (le message est alors signé « Mode IA »)
    compte = compte_authentifie()

    data = request.get_json(silent=True) or {}
    message = (data.get("message") or "").strip()[:2000]
    if not message:
        return jsonify({"error": "Message vide."}), 400
    # Mode IA (pas de compte) : une adresse e-mail valide est obligatoire pour pouvoir répondre
    email = (data.get("email") or "").strip()[:200]
    if compte is None and not re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", email):
        return jsonify({"error": "Adresse e-mail invalide."}), 400

    contact = {       "id": secrets.token_hex(8),
        "type": "contact",
        "de": compte["pseudo"] if compte else email,  # mode IA : l'adresse e-mail sert d'expéditeur pour pouvoir répondre
        "email": email,
        "cible": None,
        "motif": None,
        "message": message,
        "date": datetime.utcnow().isoformat(),
    }
    with rencontre_signalements_lock:
        signalements = load_rencontre_signalements()
        signalements.append(contact)
        save_rencontre_signalements(signalements)

        prevenir_admin_par_mail(contact)
    return jsonify(contact), 201


@app.route("/rencontre/signalements", methods=["GET", "OPTIONS"])
def rencontre_signalements_liste():
    # Consultation admin uniquement (voir spec_bloquer_signaler.md : "Philippe
    # reçoit une notification/un message") - mêmes droits que /reports.
    # Renvoie aussi bien les signalements de profil que les messages de
    # contact général (voir rencontre_contacter_admin), volontairement non
    # séparés (spec_contact_admin.md : "même boîte de réception admin").
    if request.method == "OPTIONS":
        return '', 204
    if compte_admin_authentifie() is None:
        return jsonify({"error": "Non autorisé."}), 403
    with rencontre_signalements_lock:
        return jsonify(load_rencontre_signalements())


@app.route("/admin/rencontre/conversation/<pseudo_a>/<pseudo_b>", methods=["GET", "OPTIONS"])
def admin_rencontre_conversation(pseudo_a, pseudo_b):
    # Accès admin à l'historique complet entre deux comptes, y compris après
    # blocage (voir spec_bloquer_signaler.md, "Points à préciser") - les
    # messages ne sont jamais supprimés, seulement masqués aux deux
    # utilisateurs concernés (voir rencontre_messages_conversation).
    if request.method == "OPTIONS":
        return '', 204
    if compte_admin_authentifie() is None:
        return jsonify({"error": "Non autorisé."}), 403
    with messages_lock:
        messages = load_rencontre_messages()
    conversation = [
        m for m in messages
        if (m["de"] == pseudo_a and m["a"] == pseudo_b) or (m["de"] == pseudo_b and m["a"] == pseudo_a)
    ]
    conversation.sort(key=lambda m: m["date"])
    return jsonify(conversation)


@app.route("/rencontre/messages/compteur", methods=["GET", "OPTIONS"])
def rencontre_messages_compteur():
    if request.method == "OPTIONS":
        return '', 204
    compte = compte_authentifie()
    if compte is None:
        return jsonify({"error": "Non autorisé."}), 401

    with messages_lock:
        messages = load_rencontre_messages()
    non_lus = sum(1 for m in messages if m["a"] == compte["pseudo"] and not m["lu"])
    return jsonify({"nonLus": non_lus})


@app.route("/rencontre/conversations", methods=["GET", "OPTIONS"])
def rencontre_conversations():
    # Une conversation par autre pseudo avec qui j'ai échangé (envoyé ou
    # reçu) - dernier message et nombre de non-lus reçus de sa part.
    if request.method == "OPTIONS":
        return '', 204
    compte = compte_authentifie()
    if compte is None:
        return jsonify({"error": "Non autorisé."}), 401
    mon_pseudo = compte["pseudo"]

    with messages_lock:
        messages = load_rencontre_messages()
    mes_messages = [m for m in messages if m["de"] == mon_pseudo or m["a"] == mon_pseudo]
    autres_pseudos = {(m["a"] if m["de"] == mon_pseudo else m["de"]) for m in mes_messages}

    with blocages_lock:
        blocages = load_rencontre_blocages()
    # Une conversation avec une personne bloquée (dans un sens ou l'autre)
    # disparaît des deux côtés (voir spec_bloquer_signaler.md,
    # "invisibilité mutuelle") - les messages restent en base mais ne sont
    # plus listés.
    autres_pseudos = {p for p in autres_pseudos if not est_bloque(blocages, mon_pseudo, p)}

    with comptes_lock:
        pseudos_en_attente = pseudos_en_attente_suppression(load_comptes())
    # Même règle que le blocage : un compte en attente de suppression
    # disparaît de la liste des conversations (voir spec_suppression_compte.md).
    autres_pseudos = {p for p in autres_pseudos if p not in pseudos_en_attente}

    with rencontre_lock:
        profils = load_rencontre_profils()

    conversations = []
    for autre in autres_pseudos:
        messages_conv = [m for m in mes_messages if m["de"] == autre or m["a"] == autre]
        messages_conv.sort(key=lambda m: m["date"], reverse=True)
        dernier = messages_conv[0]
        non_lus = sum(1 for m in messages_conv if m["de"] == autre and not m["lu"])
        conversations.append({
            "pseudo": autre,
            "prenom": prenom_pour_pseudo(profils, autre),
            "dernierMessage": dernier["texte"],
            "dernierDe": dernier["de"],
            "date": dernier["date"],
            "nonLus": non_lus,
        })
    conversations.sort(key=lambda c: c["date"], reverse=True)
    return jsonify(conversations)


@app.route("/rencontre/messages/<autre_pseudo>", methods=["GET", "OPTIONS"])
def rencontre_messages_conversation(autre_pseudo):
    # Ouvrir une conversation marque comme lus tous les messages reçus de
    # cette personne (voir compteurs_visites.md, même principe que les
    # vues : le compteur global redescend une fois consulté).
    if request.method == "OPTIONS":
        return '', 204
    compte = compte_authentifie()
    if compte is None:
        return jsonify({"error": "Non autorisé."}), 401
    mon_pseudo = compte["pseudo"]

    with blocages_lock:
        if est_bloque(load_rencontre_blocages(), mon_pseudo, autre_pseudo):
            # Invisible des deux côtés (voir spec_bloquer_signaler.md) - les
            # messages restent en base (voir admin_rencontre_conversation)
            # mais ne sont plus renvoyés ici, comme si la conversation
            # n'existait plus.
            return jsonify([])
    with comptes_lock:
        if autre_pseudo in pseudos_en_attente_suppression(load_comptes()):
            return jsonify([])

    with messages_lock:
        messages = load_rencontre_messages()
        conversation = [
            m for m in messages
            if (m["de"] == mon_pseudo and m["a"] == autre_pseudo)
            or (m["de"] == autre_pseudo and m["a"] == mon_pseudo)
        ]
        modifie = False
        for m in conversation:
            if m["de"] == autre_pseudo and not m["lu"]:
                m["lu"] = True
                modifie = True
        if modifie:
            save_rencontre_messages(messages)

    conversation.sort(key=lambda m: m["date"])
    return jsonify(conversation)


@app.route("/rencontre/messages/<destinataire>", methods=["POST", "OPTIONS"])
def rencontre_messages_envoyer(destinataire):
    if request.method == "OPTIONS":
        return '', 204
    compte = compte_authentifie()
    if compte is None:
        return jsonify({"error": "Non autorisé."}), 401
    if compte["pseudo"] == destinataire:
        return jsonify({"error": "Impossible de s'envoyer un message à soi-même."}), 400
    with blocages_lock:
        if est_bloque(load_rencontre_blocages(), compte["pseudo"], destinataire):
            return jsonify({"error": "Impossible d'envoyer un message à ce compte."}), 403

    data = request.get_json(silent=True) or {}
    texte = (data.get("texte") or "").strip()[:2000]
    if not texte:
        return jsonify({"error": "Message vide."}), 400

    with comptes_lock:
        comptes = load_comptes()
        if trouver_compte(comptes, destinataire) is None:
            return jsonify({"error": "Destinataire introuvable."}), 404
        if destinataire in pseudos_en_attente_suppression(comptes):
            return jsonify({"error": "Impossible d'envoyer un message à ce compte."}), 403

    message = {
        "id": secrets.token_hex(8),
        "de": compte["pseudo"],
        "a": destinataire,
        "texte": texte,
        "date": datetime.utcnow().isoformat(),
        "lu": False,
    }
    with messages_lock:
        messages = load_rencontre_messages()
        messages.append(message)
        save_rencontre_messages(messages)

    return jsonify(message), 201


@app.route("/rencontre/questions", methods=["GET", "OPTIONS"])
def rencontre_questions():
    if request.method == "OPTIONS":
        return '', 204
    code_langue = (request.args.get("lang") or "fr").lower()
    return jsonify(questions_rencontre_pour_langue(code_langue))


@app.route("/rencontre/profil", methods=["GET", "OPTIONS"])
def rencontre_profil_get():
    if request.method == "OPTIONS":
        return '', 204
    compte = compte_authentifie()
    if compte is None:
        return jsonify({"error": "Non autorisé."}), 401
    with rencontre_lock:
        profil = trouver_profil_rencontre(load_rencontre_profils(), compte["pseudo"])
    # Complète par les valeurs par défaut plutôt que de choisir entre les
    # deux (profil ou defaut) : un profil existant mais partiel (ex : photo
    # ajoutée avant le premier enregistrement du questionnaire, sur un
    # compte créé avant ce correctif) doit quand même avoir toutes les clés
    # attendues par le client, sinon RencontrePage plante sur reponses
    # undefined en essayant d'y lire une question par id.
    defaut = {
        "pseudo": compte["pseudo"], "prenom": "", "bio": "", "reponses": {}, "reponsesMultiples": {}, "precisions": {},
        "photos": [], "photoPresentationId": None, "profilEnregistre": False,
    }
    resultat = {**defaut, **(profil or {})}
    # Migration : les profils remplis avant l'introduction du champ
    # profilEnregistre (voir POST /rencontre/profil) n'ont jamais cette clé
    # en base - les déduire "enregistrés" dès qu'ils ont un vrai contenu
    # plutôt que de les traiter à tort comme jamais complétés (voir
    # ModeReelGuard/AccueilChoixPage côté client, qui s'en servent pour
    # sauter ou non le portail prénom/date).
    if "profilEnregistre" not in (profil or {}) and (resultat["bio"] or resultat["reponses"] or resultat["photos"]):
        resultat["profilEnregistre"] = True
    # Replie sur le pseudo si aucun prénom n'a encore été donné (voir
    # prenom_pour_pseudo, même principe pour les profils des autres comptes).
    if not resultat["prenom"]:
        resultat["prenom"] = resultat["pseudo"]
    return jsonify(resultat)


@app.route("/rencontre/profil", methods=["POST", "OPTIONS"])
def rencontre_profil_post():
    if request.method == "OPTIONS":
        return '', 204
    compte = compte_authentifie()
    if compte is None:
        return jsonify({"error": "Non autorisé."}), 401

    data = request.get_json(silent=True) or {}
    bio = (data.get("bio") or "").strip()[:280]
    reponses_brutes = data.get("reponses") or {}
    ids_valides = {q["id"] for q in QUESTIONS_RENCONTRE}
    reponses = {k: v for k, v in reponses_brutes.items() if k in ids_valides and isinstance(v, int)}
    # Questions à choix multiple (voir "multiple": True, ex : langues
    # parlées) : une liste d'indices au lieu d'un seul.
    reponses_multiples_brutes = data.get("reponsesMultiples") or {}
    reponses_multiples = {
        k: [i for i in v if isinstance(i, int)]
        for k, v in reponses_multiples_brutes.items()
        if k in ids_valides and isinstance(v, list)
    }
    # Précision texte libre pour les questions avec un choix "Autre" (ex :
    # identité de genre, orientation) - le client ne l'envoie que pour ces
    # questions-là, seul l'id de question est vérifié ici (pas de format
    # de texte particulier à valider en plus).
    precisions_brutes = data.get("precisions") or {}
    precisions = {
        k: (v or "").strip()[:100]
        for k, v in precisions_brutes.items()
        if k in ids_valides and isinstance(v, str)
    }
    # Âge réel (calculé côté client depuis la date de naissance saisie à la
    # vérification d'âge, voir DateNaissanceGate.tsx) - utilisé pour le critère
    # "tranche d'âge recherchée" du score de compatibilité. On ne l'écrase
    # que si une valeur valide est fournie, pour ne pas perdre une valeur
    # déjà enregistrée si le client ne l'a pas (ex. ancienne session).
    age_brut = data.get("age")
    age = age_brut if isinstance(age_brut, int) and 0 < age_brut < 130 else None

    # Géocodage de la ville (voir geocoder_ville_rencontre) pour le critère
    # "J'habite" du score de compatibilité - uniquement si le texte a changé
    # depuis la dernière fois, pour ne pas appeler l'API à chaque
    # enregistrement. Fait hors du verrou pour ne pas bloquer les autres
    # requêtes pendant l'appel réseau (jusqu'à 10s).
    with rencontre_lock:
        profil_existant = trouver_profil_rencontre(load_rencontre_profils(), compte["pseudo"])
    ville_precedente = (profil_existant or {}).get("precisions", {}).get("ville") or ""
    nouvelle_ville = precisions.get("ville") or ""
    ville_lat = (profil_existant or {}).get("villeLat")
    ville_lon = (profil_existant or {}).get("villeLon")
    if nouvelle_ville != ville_precedente:
        coords = geocoder_ville_rencontre(nouvelle_ville)
        ville_lat, ville_lon = coords if coords else (None, None)

    with rencontre_lock:
        profils = load_rencontre_profils()
        profil = trouver_profil_rencontre(profils, compte["pseudo"])
        if profil is None:
            profil = {"pseudo": compte["pseudo"]}
            profils.append(profil)
        profil["bio"] = bio
        profil["reponses"] = reponses
        profil["reponsesMultiples"] = reponses_multiples
        profil["precisions"] = precisions
        profil["villeLat"] = ville_lat
        profil["villeLon"] = ville_lon
        if age is not None:
            profil["age"] = age
        # Marque que le questionnaire a été enregistré au moins une fois -
        # voir rencontre_profil_get, qui s'en sert pour distinguer "vraiment
        # rempli, même vide" d'un profil créé indirectement en ajoutant une
        # photo avant de jamais passer par ici (RencontrePhotosPage redirige
        # alors vers le questionnaire au lieu de laisser ajouter des photos).
        profil["profilEnregistre"] = True
        save_rencontre_profils(profils)

    return jsonify(profil)


@app.route("/rencontre/prenom", methods=["POST", "OPTIONS"])
def rencontre_prenom():
    # Prénom affiché publiquement (voir DateNaissanceGate.tsx, qui l'appelle
    # juste après l'inscription/la connexion) - distinct du pseudo de
    # connexion (voir /compte/renommer) : aucune vérification d'unicité,
    # enregistré tel quel même si quelqu'un d'autre porte déjà ce prénom.
    if request.method == "OPTIONS":
        return '', 204
    compte = compte_authentifie()
    if compte is None:
        return jsonify({"error": "Non autorisé."}), 401

    data = request.get_json(silent=True) or {}
    prenom = (data.get("prenom") or "").strip()[:30]
    if not prenom or len(prenom) < 2:
        return jsonify({"error": "Prénom invalide (2 à 30 caractères)."}), 400

    with rencontre_lock:
        profils = load_rencontre_profils()
        profil = trouver_profil_rencontre(profils, compte["pseudo"])
        if profil is None:
            # Même filet de sécurité que rencontre_photo_ajouter : un prénom
            # peut être donné avant que le questionnaire ait jamais été
            # enregistré (c'est même le cas normal, voir ModeReelGuard).
            profil = {
                "pseudo": compte["pseudo"], "bio": "", "reponses": {}, "reponsesMultiples": {}, "precisions": {},
            }
            profils.append(profil)
        profil["prenom"] = prenom
        save_rencontre_profils(profils)

    return jsonify({"prenom": prenom})


@app.route("/rencontre/profils", methods=["GET", "OPTIONS"])
def rencontre_profils_liste():
    # Liste des profils des AUTRES comptes (pas le sien), en excluant ceux
    # qui n'ont encore ni bio ni réponse (profil pas vraiment commencé, pas
    # utile à afficher dans la liste).
    if request.method == "OPTIONS":
        return '', 204
    compte = compte_authentifie()
    if compte is None:
        return jsonify({"error": "Non autorisé."}), 401
    with rencontre_lock:
        profils = load_rencontre_profils()
    with blocages_lock:
        blocages = load_rencontre_blocages()
    with comptes_lock:
        pseudos_en_attente = pseudos_en_attente_suppression(load_comptes())
    mon_profil = trouver_profil_rencontre(profils, compte["pseudo"]) or {}
    resultat = []
    for p in profils:
        if p["pseudo"] == compte["pseudo"] or not (p.get("bio") or p.get("reponses")):
            continue
        # Invisibilité mutuelle après blocage (voir spec_bloquer_signaler.md)
        # - peu importe qui a bloqué qui, le profil disparaît des deux côtés.
        if est_bloque(blocages, compte["pseudo"], p["pseudo"]):
            continue
        # Compte en attente de suppression (voir spec_suppression_compte.md,
        # "désactivé immédiatement, invisible, inaccessible") - reste dans
        # comptes.json pendant le délai de grâce mais ne doit plus apparaître
        # aux autres.
        if p["pseudo"] in pseudos_en_attente:
            continue
        p_avec_score = dict(p)
        p_avec_score["compatibilite"] = calculer_compatibilite_rencontre(mon_profil, p)
        p_avec_score["prenom"] = p.get("prenom") or p["pseudo"]
        resultat.append(p_avec_score)
    return jsonify(resultat)


def _comparaison_detaillee_rencontre(mon_profil, autre_profil):
    # Résultat par question (True/False) pour affichage sur la page de
    # consultation d'un profil (point vert/rouge devant chaque titre) - une
    # question absente du résultat signifie "non comparable" (au moins un
    # des deux n'a pas répondu, ou question exclue du score comme "ville").
    resultat = {}
    m_genre_orientation = _match_genre_orientation_rencontre(mon_profil, autre_profil)
    if m_genre_orientation is not None:
        resultat["genre"] = m_genre_orientation
        resultat["orientation"] = m_genre_orientation
    m_langues = _match_langues_rencontre(mon_profil, autre_profil)
    if m_langues is not None:
        resultat["langues"] = m_langues
    m_age = _match_tranche_age_rencontre(mon_profil, autre_profil)
    if m_age is not None:
        resultat["tranche_age"] = m_age
    m_recherche = _match_recherche_rencontre(mon_profil, autre_profil)
    if m_recherche is not None:
        resultat["recherche"] = m_recherche
    m_habite = _match_habite_rencontre(mon_profil, autre_profil)
    if m_habite is not None:
        resultat["distance"] = m_habite
    for question in QUESTIONS_RENCONTRE:
        qid = question["id"]
        if qid in resultat or qid in IDS_EXCLUES_SCORE_RENCONTRE or qid in IDS_NIVEAU1_RENCONTRE:
            continue
        if question.get("multiple"):
            m = _match_question_multiple_rencontre(question, mon_profil, autre_profil)
        else:
            m = _match_question_simple_rencontre(question, mon_profil, autre_profil)
        if m is not None:
            resultat[qid] = m
    return resultat


@app.route("/rencontre/profil/<pseudo>/comparaison", methods=["GET", "OPTIONS"])
def rencontre_comparaison(pseudo):
    if request.method == "OPTIONS":
        return '', 204
    compte = compte_authentifie()
    if compte is None:
        return jsonify({"error": "Non autorisé."}), 401
    with blocages_lock:
        if est_bloque(load_rencontre_blocages(), compte["pseudo"], pseudo):
            return jsonify({"error": "Profil introuvable."}), 404
    with comptes_lock:
        if pseudo in pseudos_en_attente_suppression(load_comptes()):
            return jsonify({"error": "Profil introuvable."}), 404
    with rencontre_lock:
        profils = load_rencontre_profils()
    mon_profil = trouver_profil_rencontre(profils, compte["pseudo"]) or {}
    autre_profil = trouver_profil_rencontre(profils, pseudo)
    if autre_profil is None:
        return jsonify({"error": "Profil introuvable."}), 404
    return jsonify(_comparaison_detaillee_rencontre(mon_profil, autre_profil))


@app.route("/inscription", methods=["OPTIONS"])
def inscription_options():
    return '', 204


@app.route("/inscription", methods=["POST"])
def inscription():
    data = request.get_json(silent=True) or {}
    # Pseudo de connexion choisi par l'utilisateur (pas un "prénom" - ce
    # champ distinct, sans contrainte d'unicité, se règle séparément après
    # coup via /rencontre/prenom). Voir trouver_pseudo_disponible pour la
    # règle de suffixe numérique en cas d'homonyme : le pseudo demandé peut
    # déjà être pris, le compte est quand même créé sous un pseudo
    # disponible ("Xyz 4") sans jamais le signaler ni le refuser - ça n'a pas
    # d'importance côté utilisateur, qui ne se souviendra que de son prénom.
    pseudo_demande = (data.get("pseudo") or "").strip()
    mot_de_passe = (data.get("motDePasse") or "").strip()
    question = (data.get("question") or "").strip()
    reponse = (data.get("reponse") or "").strip()

    if not pseudo_demande or len(pseudo_demande) < 2 or len(pseudo_demande) > 30:
        return jsonify({"error": "Prénom invalide (2 à 30 caractères)."}), 400
    if len(mot_de_passe) < 6:
        return jsonify({"error": "Le mot de passe doit contenir au moins 6 caractères."}), 400
    if not question or not reponse:
        return jsonify({"error": "Question et réponse secrètes requises."}), 400

    with comptes_lock:
        comptes = load_comptes()
        pseudo = trouver_pseudo_disponible(comptes, pseudo_demande)

        token = secrets.token_hex(32)
        compte = {
            "pseudo": pseudo,
            "motDePasse": mot_de_passe,
            "motDePasseHash": generate_password_hash(mot_de_passe),
            "question": question,
            "reponseHash": generate_password_hash(reponse.lower()),
            "token": token,
            "dateCreation": time.strftime("%Y-%m-%d %H:%M:%S"),
        }
        comptes.append(compte)
        save_comptes(comptes)

    return jsonify({"pseudo": pseudo, "token": token}), 201


# Anti-bruteforce partagé (voir spec_limite_tentatives.md) : 3 échecs
# consécutifs puis blocage de 10 minutes, compté séparément par pseudo et
# par usage ("connexion" ou "question_secrete", pour qu'un blocage sur
# l'un n'affecte pas l'autre). En mémoire seulement (pas persisté sur
# disque) : un redémarrage du serveur remet les compteurs à zéro, ce qui
# est acceptable pour un simple anti-bruteforce à court terme. Ne touche
# jamais à la vérification du mot de passe / de la réponse secrète
# elle-même, seulement au comptage autour.
TENTATIVES_MAX = 3
BLOCAGE_TENTATIVES_SECONDES = 10 * 60
tentatives_lock = threading.Lock()
tentatives_par_cle = {}


def verifier_pas_bloque(usage, pseudo):
    cle = (usage, pseudo.strip().lower())
    with tentatives_lock:
        etat = tentatives_par_cle.get(cle)
        if etat and etat["bloque_jusqua"] > time.time():
            minutes_restantes = max(1, int((etat["bloque_jusqua"] - time.time()) // 60) + 1)
            return minutes_restantes
    return None


def enregistrer_echec_tentative(usage, pseudo):
    cle = (usage, pseudo.strip().lower())
    with tentatives_lock:
        etat = tentatives_par_cle.setdefault(cle, {"tentatives": 0, "bloque_jusqua": 0})
        etat["tentatives"] += 1
        if etat["tentatives"] >= TENTATIVES_MAX:
            etat["bloque_jusqua"] = time.time() + BLOCAGE_TENTATIVES_SECONDES
            etat["tentatives"] = 0


def reinitialiser_tentatives(usage, pseudo):
    cle = (usage, pseudo.strip().lower())
    with tentatives_lock:
        tentatives_par_cle.pop(cle, None)


@app.route("/connexion", methods=["OPTIONS"])
def connexion_options():
    return '', 204


@app.route("/connexion", methods=["POST"])
def connexion():
    data = request.get_json(silent=True) or {}
    pseudo = (data.get("pseudo") or "").strip()
    mot_de_passe = (data.get("motDePasse") or "").strip()

    minutes_restantes = verifier_pas_bloque("connexion", pseudo)
    if minutes_restantes is not None:
        return jsonify({"error": f"Trop de tentatives. Réessaie dans {minutes_restantes} min."}), 429

    with comptes_lock:
        comptes = load_comptes()
        compte = trouver_compte(comptes, pseudo)
        if compte is None or not check_password_hash(compte["motDePasseHash"], mot_de_passe):
            enregistrer_echec_tentative("connexion", pseudo)
            return jsonify({"error": "Pseudo ou mot de passe incorrect."}), 401

        reinitialiser_tentatives("connexion", pseudo)
        compte["token"] = secrets.token_hex(32)
        save_comptes(comptes)

    return jsonify({"pseudo": compte["pseudo"], "token": compte["token"]})


@app.route("/mot-de-passe-oublie/question", methods=["OPTIONS"])
def question_secrete_options():
    return '', 204


@app.route("/mot-de-passe-oublie/question", methods=["POST"])
def question_secrete():
    data = request.get_json(silent=True) or {}
    pseudo = (data.get("pseudo") or "").strip()

    with comptes_lock:
        comptes = load_comptes()
        compte = trouver_compte(comptes, pseudo)

    if compte is None:
        return jsonify({"error": "Aucun compte avec ce pseudo."}), 404

    return jsonify({"question": compte["question"]})


@app.route("/mot-de-passe-oublie/verifier", methods=["OPTIONS"])
def verifier_reponse_options():
    return '', 204


@app.route("/mot-de-passe-oublie/verifier", methods=["POST"])
def verifier_reponse_secrete():
    # Vérifie la réponse avant d'afficher quoi que ce soit côté client (voir
    # mode 'reinitialiser' -> 'nouveau-mot-de-passe' dans PopupPseudo.tsx) -
    # renvoie le mot de passe actuel en clair (motDePasse) plutôt que de
    # forcer un nouveau mot de passe sans jamais confirmer la réponse.
    data = request.get_json(silent=True) or {}
    pseudo = (data.get("pseudo") or "").strip()
    reponse = (data.get("reponse") or "").strip()

    minutes_restantes = verifier_pas_bloque("question_secrete", pseudo)
    if minutes_restantes is not None:
        return jsonify({"error": f"Trop de tentatives. Réessaie dans {minutes_restantes} min."}), 429

    with comptes_lock:
        comptes = load_comptes()
        compte = trouver_compte(comptes, pseudo)
        if compte is None or not check_password_hash(compte["reponseHash"], reponse.lower()):
            enregistrer_echec_tentative("question_secrete", pseudo)
            return jsonify({"error": "Réponse secrète incorrecte."}), 401

        reinitialiser_tentatives("question_secrete", pseudo)
        return jsonify({"motDePasse": compte.get("motDePasse", "")})


@app.route("/mot-de-passe-oublie/reinitialiser", methods=["OPTIONS"])
def reinitialiser_options():
    return '', 204


@app.route("/mot-de-passe-oublie/reinitialiser", methods=["POST"])
def reinitialiser_mot_de_passe():
    data = request.get_json(silent=True) or {}
    pseudo = (data.get("pseudo") or "").strip()
    reponse = (data.get("reponse") or "").strip()
    nouveau_mot_de_passe = (data.get("nouveauMotDePasse") or "").strip()

    if len(nouveau_mot_de_passe) < 6:
        return jsonify({"error": "Le mot de passe doit contenir au moins 6 caractères."}), 400

    minutes_restantes = verifier_pas_bloque("question_secrete", pseudo)
    if minutes_restantes is not None:
        return jsonify({"error": f"Trop de tentatives. Réessaie dans {minutes_restantes} min."}), 429

    with comptes_lock:
        comptes = load_comptes()
        compte = trouver_compte(comptes, pseudo)
        if compte is None or not check_password_hash(compte["reponseHash"], reponse.lower()):
            enregistrer_echec_tentative("question_secrete", pseudo)
            return jsonify({"error": "Pseudo ou réponse secrète incorrect."}), 401

        reinitialiser_tentatives("question_secrete", pseudo)
        compte["motDePasse"] = nouveau_mot_de_passe
        compte["motDePasseHash"] = generate_password_hash(nouveau_mot_de_passe)
        compte["token"] = secrets.token_hex(32)
        save_comptes(comptes)

    return jsonify({"pseudo": compte["pseudo"], "token": compte["token"]})


@app.route("/compte/changer-mot-de-passe", methods=["OPTIONS"])
def changer_mot_de_passe_options():
    return '', 204


@app.route("/compte/changer-mot-de-passe", methods=["POST"])
def changer_mot_de_passe():
    # Changement volontaire depuis un compte déjà connecté (voir
    # spec_changer_mot_de_passe.md) - distinct de la récupération par
    # question secrète ci-dessus (reinitialiser_mot_de_passe), qui reste
    # inchangée. Ne touche pas non plus à /connexion : seul le mot de passe
    # stocké change, la vérification à la connexion elle-même est intacte.
    compte_connecte = compte_authentifie()
    if compte_connecte is None:
        return jsonify({"error": "Non autorisé."}), 401

    data = request.get_json(silent=True) or {}
    ancien_mot_de_passe = (data.get("ancienMotDePasse") or "").strip()
    nouveau_mot_de_passe = (data.get("nouveauMotDePasse") or "").strip()

    if len(nouveau_mot_de_passe) < 6:
        return jsonify({"error": "Le mot de passe doit contenir au moins 6 caractères."}), 400

    with comptes_lock:
        comptes = load_comptes()
        compte = trouver_compte(comptes, compte_connecte["pseudo"])
        if compte is None or not check_password_hash(compte["motDePasseHash"], ancien_mot_de_passe):
            return jsonify({"error": "Ancien mot de passe incorrect."}), 401

        compte["motDePasse"] = nouveau_mot_de_passe
        compte["motDePasseHash"] = generate_password_hash(nouveau_mot_de_passe)
        save_comptes(comptes)

    return jsonify({"ok": True})


# Suppression de compte (voir spec_suppression_compte.md) : le compte n'est
# pas effacé tout de suite, seulement marqué "en attente" (dateSuppressionDemandee)
# - il devient alors invisible/injoignable pour les autres (voir les
# vérifications ajoutées dans rencontre_profils_liste, rencontre_comparaison,
# rencontre_conversations, rencontre_messages_conversation et
# rencontre_messages_envoyer) mais reste 30 jours dans comptes.json pour
# permettre à son titulaire de se reconnecter et cliquer sur "Annuler la
# suppression" (voir /compte/annuler-suppression) s'il change d'avis. Passé
# ce délai, boucle_nettoyage_suppressions() l'efface pour de bon, avec toutes
# ses données associées.
DELAI_GRACE_SUPPRESSION_SECONDES = 30 * 24 * 3600


@app.route("/compte/supprimer", methods=["OPTIONS"])
def supprimer_compte_options():
    return '', 204


@app.route("/compte/supprimer", methods=["POST"])
def supprimer_compte():
    compte_connecte = compte_authentifie()
    if compte_connecte is None:
        return jsonify({"error": "Non autorisé."}), 401

    data = request.get_json(silent=True) or {}
    mot_de_passe = (data.get("motDePasse") or "").strip()

    with comptes_lock:
        comptes = load_comptes()
        compte = trouver_compte(comptes, compte_connecte["pseudo"])
        if compte is None or not check_password_hash(compte["motDePasseHash"], mot_de_passe):
            return jsonify({"error": "Mot de passe incorrect."}), 401

        compte["dateSuppressionDemandee"] = datetime.utcnow().isoformat()
        save_comptes(comptes)

    return jsonify({"ok": True})


@app.route("/compte/annuler-suppression", methods=["OPTIONS"])
def annuler_suppression_compte_options():
    return '', 204


@app.route("/compte/annuler-suppression", methods=["POST"])
def annuler_suppression_compte():
    compte_connecte = compte_authentifie()
    if compte_connecte is None:
        return jsonify({"error": "Non autorisé."}), 401

    with comptes_lock:
        comptes = load_comptes()
        compte = trouver_compte(comptes, compte_connecte["pseudo"])
        if compte is None:
            return jsonify({"error": "Compte introuvable."}), 404
        compte["dateSuppressionDemandee"] = None
        save_comptes(comptes)

    return jsonify({"ok": True})


def pseudos_en_attente_suppression(comptes):
    return {c["pseudo"] for c in comptes if c.get("dateSuppressionDemandee")}


def supprimer_donnees_compte(pseudo):
    # Effacement complet et définitif (demande RGPD explicite), contrairement
    # au blocage entre deux comptes qui garde les messages pour modération -
    # voir spec_suppression_compte.md ("sans trace"). Exception volontaire :
    # les personnages IA créés par ce compte (creations.json) restent
    # intacts - décision explicite du côté "Personne réelle" de ne pas
    # toucher aux données du côté "Intelligence Artificielle", malgré ce que
    # demandait la première version de la spec.

    with rencontre_lock:
        profils = load_rencontre_profils()
        profil = trouver_profil_rencontre(profils, pseudo)
        if profil is not None:
            for photo in profil.get("photos") or []:
                chemin = os.path.join(RENCONTRE_PHOTOS_DIR, photo["filename"])
                if os.path.exists(chemin):
                    os.remove(chemin)
            profils = [p for p in profils if p["pseudo"] != pseudo]
            save_rencontre_profils(profils)

    with messages_lock:
        messages = load_rencontre_messages()
        messages_restants = [m for m in messages if m["de"] != pseudo and m["a"] != pseudo]
        if len(messages_restants) != len(messages):
            save_rencontre_messages(messages_restants)

    with comptes_lock:
        comptes = load_comptes()
        comptes = [c for c in comptes if c["pseudo"] != pseudo]
        save_comptes(comptes)


def nettoyer_comptes_a_supprimer():
    with comptes_lock:
        comptes = load_comptes()
        a_supprimer = []
        for c in comptes:
            date_str = c.get("dateSuppressionDemandee")
            if not date_str:
                continue
            date_demande = datetime.fromisoformat(date_str)
            if (datetime.utcnow() - date_demande).total_seconds() >= DELAI_GRACE_SUPPRESSION_SECONDES:
                a_supprimer.append(c["pseudo"])

    for pseudo in a_supprimer:
        supprimer_donnees_compte(pseudo)


def boucle_nettoyage_suppressions():
    # Tâche récurrente quotidienne (voir spec_suppression_compte.md) : tourne
    # dans un fil séparé pendant toute la vie du process serveur.
    while True:
        try:
            nettoyer_comptes_a_supprimer()
        except Exception as erreur:
            print(f"Erreur nettoyage suppressions de comptes : {erreur}")
        time.sleep(24 * 3600)


threading.Thread(target=boucle_nettoyage_suppressions, daemon=True).start()


# Traduction à la volée du contenu écrit par les créateurs (titre,
# description, histoire, salutation, bio), pour l'afficher dans la langue de
# la personne qui consulte. Deux fournisseurs gratuits utilisés dans l'ordre
# (Google Cloud Translation puis DeepL, chacun jusqu'à 499 999
# caractères/mois) pour rester sous les seuils gratuits des deux ; si les
# deux sont épuisés ou indisponibles, le texte d'origine est renvoyé tel
# quel plutôt que de faire planter l'affichage.
TRADUCTIONS_JSON_PATH = os.path.join(CREATIONS_DIR, "traductions.json")
QUOTA_TRADUCTION_JSON_PATH = os.path.join(CREATIONS_DIR, "quota_traduction.json")
traduction_lock = threading.Lock()

QUOTA_LIMITE_PAR_FOURNISSEUR = 499999

GOOGLE_CODES_LANGUE = {
    "fr": "fr", "en": "en", "es": "es", "de": "de", "it": "it",
    "pt": "pt", "zh": "zh-CN", "ja": "ja", "ko": "ko", "ar": "ar",
}
# DeepL ne couvre pas l'arabe : absent de cette table exprès, traduire_champ
# passera alors directement au texte d'origine si Google est indisponible.
DEEPL_CODES_LANGUE = {
    "fr": "FR", "en": "EN-US", "es": "ES", "de": "DE", "it": "IT",
    "pt": "PT-PT", "zh": "ZH", "ja": "JA", "ko": "KO",
}

CHAMPS_TRADUISIBLES = ["title", "description", "histoire", "salutation", "bio"]


def load_traductions():
    if not os.path.exists(TRADUCTIONS_JSON_PATH):
        return {}
    with open(TRADUCTIONS_JSON_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def save_traductions(traductions):
    with open(TRADUCTIONS_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(traductions, f, ensure_ascii=False)


def periode_traduction_courante():
    # Le quota gratuit DeepL de Philippe se renouvelle le 22 de chaque mois :
    # la fenêtre de comptage est alignée dessus plutôt que sur le 1er.
    maintenant = datetime.now()
    if maintenant.day >= 22:
        debut = maintenant.replace(day=22)
    else:
        dernier_jour_mois_precedent = maintenant.replace(day=1) - timedelta(days=1)
        debut = dernier_jour_mois_precedent.replace(day=22)
    return debut.strftime("%Y-%m-%d")


def load_quota_traduction():
    periode = periode_traduction_courante()
    if os.path.exists(QUOTA_TRADUCTION_JSON_PATH):
        with open(QUOTA_TRADUCTION_JSON_PATH, "r", encoding="utf-8") as f:
            quota = json.load(f)
        if quota.get("periode") == periode:
            return quota
    return {"periode": periode, "googleUtilise": 0, "deeplUtilise": 0}


def save_quota_traduction(quota):
    with open(QUOTA_TRADUCTION_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(quota, f, ensure_ascii=False)


def appeler_google_translate(texte, code_langue):
    code = GOOGLE_CODES_LANGUE.get(code_langue)
    cle = cle_google_translate()
    if not code or not cle:
        return None
    try:
        reponse = requests.post(
            "https://translation.googleapis.com/language/translate/v2",
            params={"key": cle},
            json={"q": texte, "target": code, "format": "text"},
            timeout=10,
        )
        if reponse.status_code != 200:
            print("Google Translate erreur:", reponse.status_code, reponse.text[:300], flush=True)
            return None
        return reponse.json()["data"]["translations"][0]["translatedText"]
    except Exception as e:
        print("Google Translate exception:", e, flush=True)
        return None


def appeler_deepl(texte, code_langue):
    code = DEEPL_CODES_LANGUE.get(code_langue)
    cle = cle_deepl()
    if not code or not cle:
        return None
    try:
        reponse = requests.post(
            "https://api-free.deepl.com/v2/translate",
            headers={"Authorization": f"DeepL-Auth-Key {cle}"},
            data={"text": texte, "target_lang": code},
            timeout=10,
        )
        if reponse.status_code != 200:
            print("DeepL erreur:", reponse.status_code, reponse.text[:300], flush=True)
            return None
        return reponse.json()["translations"][0]["text"]
    except Exception as e:
        print("DeepL exception:", e, flush=True)
        return None


def traduire_champ(creation_id, champ, texte, code_langue):
    """Traduit un champ d'une création vers code_langue, avec cache (par
    création+champ+langue, invalidé si le texte source a changé depuis) et
    répartition du quota mensuel entre Google (priorité) et DeepL.

    Le verrou ne protège que les lectures/écritures des fichiers JSON
    (rapides) : les appels réseau aux fournisseurs se font en dehors, pour
    que plusieurs champs puissent se traduire en parallèle (voir
    traduction_lot) sans se bloquer les uns les autres. En contrepartie, un
    léger dépassement du quota est possible si plusieurs traductions
    démarrent au même instant (quelques centaines de caractères tout au
    plus vu le nombre de requêtes simultanées) - acceptable vu la marge du
    quota gratuit."""
    if not texte or not texte.strip():
        return texte

    # Toutes les créations sont actuellement rédigées en français : traduire
    # vers "fr" est donc toujours un no-op qui ne devrait rien changer, mais
    # comme aucune langue source n'est précisée à Google/DeepL (détection
    # automatique), un texte très court et ambigu (ex: "Salut") peut être
    # mal détecté et ressortir changé (ex: "Santé"). Autant ne jamais faire
    # cet aller-retour inutile.
    if code_langue == "fr":
        return texte

    cle = f"{creation_id}:{champ}:{code_langue}"

    with traduction_lock:
        cache = load_traductions()
        entree = cache.get(cle)
        if entree and entree.get("source") == texte:
            return entree["traduit"]
        quota = load_quota_traduction()

    longueur = len(texte)
    traduit = None
    fournisseur = None

    if quota["googleUtilise"] + longueur <= QUOTA_LIMITE_PAR_FOURNISSEUR:
        traduit = appeler_google_translate(texte, code_langue)
        if traduit is not None:
            fournisseur = "google"

    if traduit is None and quota["deeplUtilise"] + longueur <= QUOTA_LIMITE_PAR_FOURNISSEUR:
        traduit = appeler_deepl(texte, code_langue)
        if traduit is not None:
            fournisseur = "deepl"

    with traduction_lock:
        if fournisseur is not None:
            quota_actuel = load_quota_traduction()
            cle_quota = "googleUtilise" if fournisseur == "google" else "deeplUtilise"
            quota_actuel[cle_quota] += longueur
            save_quota_traduction(quota_actuel)

        if traduit is None:
            # Quotas épuisés ou fournisseurs indisponibles : on affiche le
            # texte d'origine plutôt que de bloquer l'affichage.
            return texte

        cache = load_traductions()
        cache[cle] = {"source": texte, "traduit": traduit}
        save_traductions(cache)
        return traduit


# --- Traduction automatique des fichiers de référence (anatomie/meubles) ---
# Réutilise appeler_google_translate/appeler_deepl et le même quota mensuel
# que la traduction des personnages ci-dessus - pas de nouveau système. Un
# thread d'arrière-plan (voir boucle_surveillance_reference, démarré tout en
# bas de ce fichier une fois que tout le nécessaire - y compris les fonctions
# ci-dessus - est défini) compare la date de modification de chaque fichier
# .fr.txt à celle de ses traductions et régénère celles qui sont en retard :
# modifier un fichier source (à la main ou depuis l'admin) suffit, jamais de
# commande à lancer. Pas de cache par contenu comme traduire_champ (pas
# nécessaire ici : la comparaison de dates de fichiers fait déjà ce travail),
# mais le même quota est bien incrémenté pour ne pas le dépasser en douce.
def traduire_texte_reference(texte, code_langue):
    if not texte or not texte.strip():
        return texte
    longueur = len(texte)
    traduit = None
    fournisseur = None
    with traduction_lock:
        quota = load_quota_traduction()
    if quota["googleUtilise"] + longueur <= QUOTA_LIMITE_PAR_FOURNISSEUR:
        traduit = appeler_google_translate(texte, code_langue)
        if traduit is not None:
            fournisseur = "google"
    if traduit is None and quota["deeplUtilise"] + longueur <= QUOTA_LIMITE_PAR_FOURNISSEUR:
        traduit = appeler_deepl(texte, code_langue)
        if traduit is not None:
            fournisseur = "deepl"
    if fournisseur is not None:
        with traduction_lock:
            quota_actuel = load_quota_traduction()
            cle_quota = "googleUtilise" if fournisseur == "google" else "deeplUtilise"
            quota_actuel[cle_quota] += longueur
            save_quota_traduction(quota_actuel)
    # Repli sur le texte français d'origine si indisponible/quota dépassé -
    # charger_texte_reference retombera de toute façon sur le .fr.txt tant
    # que le fichier traduit n'existe pas, mais ici on en a besoin pour
    # pouvoir quand même écrire un fichier (voir regenerer_traductions_reference_si_besoin).
    return traduit if traduit is not None else texte


REFERENCE_SUJETS_TOUS = REFERENCE_SUJETS_ANATOMIE + [REFERENCE_SUJET_MAISON]


def regenerer_traductions_reference_si_besoin():
    for sujet in REFERENCE_SUJETS_TOUS:
        chemin_fr = chemin_reference(sujet, "fr")
        if not os.path.exists(chemin_fr):
            continue
        mtime_fr = os.path.getmtime(chemin_fr)
        texte_fr = None  # lu paresseusement, une seule fois, si au moins une langue est en retard
        for lang in REFERENCE_LANGUES_CIBLES:
            chemin_cible = chemin_reference(sujet, lang)
            if os.path.exists(chemin_cible) and os.path.getmtime(chemin_cible) >= mtime_fr:
                continue
            if texte_fr is None:
                with open(chemin_fr, "r", encoding="utf-8") as f:
                    texte_fr = f.read()
            traduit = traduire_texte_reference(texte_fr, lang)
            with open(chemin_cible, "w", encoding="utf-8") as f:
                f.write(traduit)
            print(f"Référence traduite : {sujet} -> {lang}", flush=True)


def boucle_surveillance_reference():
    while True:
        try:
            regenerer_traductions_reference_si_besoin()
        except Exception as e:
            print("Erreur surveillance traductions référence :", e, flush=True)
        time.sleep(3)


threading.Thread(target=boucle_surveillance_reference, daemon=True).start()


@app.route("/creations/<int:creation_id>/traduction/<lang>", methods=["OPTIONS"])
def traduction_creation_options(creation_id, lang):
    return '', 204


@app.route("/creations/<int:creation_id>/traduction/<lang>", methods=["GET"])
def traduction_creation(creation_id, lang):
    with creations_lock:
        creations = load_creations()
    creation = next((c for c in creations if c.get("id") == creation_id), None)
    if creation is None:
        return jsonify({"error": "Création introuvable."}), 404

    if not creation.get("isPublic", True):
        compte = compte_authentifie()
        if compte is None or (creation.get("creatorPseudo") or "").strip().lower() != compte["pseudo"].strip().lower():
            return jsonify({"error": "Non autorisé."}), 403

    with ThreadPoolExecutor(max_workers=len(CHAMPS_TRADUISIBLES)) as executor:
        futurs = {
            champ: executor.submit(traduire_champ, creation_id, champ, creation.get(champ) or "", lang)
            for champ in CHAMPS_TRADUISIBLES
        }
        resultat = {champ: futur.result() for champ, futur in futurs.items()}
    return jsonify(resultat)


# Traduction groupée (titre + bio uniquement) pour les grilles de vignettes
# (accueil...) : un seul aller-retour réseau au lieu d'un appel par carte,
# le cache/quota par champ restant géré exactement comme pour une création
# seule. Les identifiants qui ne correspondent à aucune création connue (ex :
# les personnages de démonstration de l'accueil) sont simplement ignorés,
# sans faire échouer le reste du lot.
CHAMPS_VIGNETTE = ["title", "bio"]


@app.route("/creations/traduction/<lang>", methods=["OPTIONS"])
def traduction_lot_options(lang):
    return '', 204


@app.route("/creations/traduction/<lang>", methods=["POST"])
def traduction_lot(lang):
    data = request.get_json(silent=True) or {}
    ids = data.get("ids") or []
    if not isinstance(ids, list):
        return jsonify({"error": "ids invalide"}), 400

    with creations_lock:
        creations = load_creations()
    par_id = {c.get("id"): c for c in creations}

    compte_verifie = None
    compte_demande = False
    resultat = {}

    # Un champ à traduire par tâche : avec potentiellement des dizaines de
    # vignettes visibles à la fois, traduire séquentiellement (un appel
    # réseau après l'autre) prenait plusieurs secondes - assez pour que le
    # rafraîchissement automatique de la page (toutes les 7s) invalide le
    # résultat avant même qu'il s'affiche. En parallèle, le lot entier tient
    # dans le temps d'un seul appel.
    taches = []
    with ThreadPoolExecutor(max_workers=8) as executor:
        for creation_id in ids:
            creation = par_id.get(creation_id)
            if creation is None:
                continue

            if not creation.get("isPublic", True):
                if not compte_demande:
                    compte_verifie = compte_authentifie()
                    compte_demande = True
                est_proprietaire = (
                    compte_verifie is not None
                    and (creation.get("creatorPseudo") or "").strip().lower() == compte_verifie["pseudo"].strip().lower()
                )
                if not est_proprietaire:
                    continue

            for champ in CHAMPS_VIGNETTE:
                futur = executor.submit(traduire_champ, creation_id, champ, creation.get(champ) or "", lang)
                taches.append((creation_id, champ, futur))

        for creation_id, champ, futur in taches:
            resultat.setdefault(str(creation_id), {})[champ] = futur.result()

    return jsonify(resultat)


# Interface d'administration (réservée au compte isAdmin=true, voir
# compte_admin_authentifie ci-dessus). Toutes les routes /admin/* exigent ce
# compte précis, même en connaissant le code d'accès secret côté app (qui ne
# fait qu'ouvrir la page - la vraie protection est ici, côté serveur).

FEATURE_FLAGS_PATH = os.path.join(CREATIONS_DIR, "feature_flags.json")
feature_flags_lock = threading.Lock()


def load_feature_flags():
    if not os.path.exists(FEATURE_FLAGS_PATH):
        return {}
    with open(FEATURE_FLAGS_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def save_feature_flags(flags):
    with open(FEATURE_FLAGS_PATH, "w", encoding="utf-8") as f:
        json.dump(flags, f, ensure_ascii=False)


@app.route("/feature-flags", methods=["GET", "OPTIONS"])
def get_feature_flags():
    # Public (pas de vérification admin) : l'app elle-même, pour tous les
    # utilisateurs, doit pouvoir lire ces réglages afin d'activer/désactiver
    # ses propres fonctionnalités.
    if request.method == "OPTIONS":
        return '', 204
    with feature_flags_lock:
        return jsonify(load_feature_flags())


@app.route("/admin/feature-flags", methods=["POST", "OPTIONS"])
def admin_modifier_feature_flag():
    if request.method == "OPTIONS":
        return '', 204
    if compte_admin_authentifie() is None:
        return jsonify({"error": "Non autorisé."}), 403
    data = request.get_json(silent=True) or {}
    nom = (data.get("nom") or "").strip()
    if not nom:
        return jsonify({"error": "Nom manquant."}), 400
    with feature_flags_lock:
        flags = load_feature_flags()
        if data.get("supprimer"):
            flags.pop(nom, None)
        else:
            flags[nom] = bool(data.get("actif"))
        save_feature_flags(flags)
        return jsonify(flags)


@app.route("/admin/quota-traduction", methods=["GET", "OPTIONS"])
def admin_quota_traduction():
    if request.method == "OPTIONS":
        return '', 204
    if compte_admin_authentifie() is None:
        return jsonify({"error": "Non autorisé."}), 403
    quota = load_quota_traduction()
    return jsonify({**quota, "limiteParFournisseur": QUOTA_LIMITE_PAR_FOURNISSEUR})


@app.route("/admin/creations", methods=["GET", "OPTIONS"])
def admin_creations():
    # Toutes les créations, publiques et privées confondues, tous comptes
    # confondus - contrairement à /creations (public) et /creations/mine
    # (propriétaire uniquement).
    if request.method == "OPTIONS":
        return '', 204
    if compte_admin_authentifie() is None:
        return jsonify({"error": "Non autorisé."}), 403
    with creations_lock:
        return jsonify(load_creations())


@app.route("/admin/creations/<int:creation_id>/visibilite", methods=["POST", "OPTIONS"])
def admin_modifier_visibilite(creation_id):
    # Comme PUT /creations/<id>, mais sans vérifier que l'admin est le
    # créateur : peut forcer le statut de n'importe quel personnage.
    if request.method == "OPTIONS":
        return '', 204
    if compte_admin_authentifie() is None:
        return jsonify({"error": "Non autorisé."}), 403
    data = request.get_json(silent=True) or {}
    is_public = bool(data.get("isPublic", True))
    with creations_lock:
        creations = load_creations()
        creation = next((c for c in creations if c.get("id") == creation_id), None)
        if creation is None:
            return jsonify({"error": "Création introuvable."}), 404
        creation["isPublic"] = is_public
        save_creations(creations)
    return jsonify(creation)


@app.route("/admin/creations/<int:creation_id>", methods=["DELETE", "OPTIONS"])
def admin_supprimer_creation(creation_id):
    if request.method == "OPTIONS":
        return '', 204
    if compte_admin_authentifie() is None:
        return jsonify({"error": "Non autorisé."}), 403
    with creations_lock:
        creations = load_creations()
        creation = next((c for c in creations if c.get("id") == creation_id), None)
        if creation is None:
            return jsonify({"error": "Création introuvable."}), 404
        creations = [c for c in creations if c.get("id") != creation_id]
        save_creations(creations)
        for champ in ("imageUrl", "avatarUrl"):
            chemin = creation.get(champ) or ""
            if chemin.startswith("/creations/"):
                chemin_fichier = os.path.join(CREATIONS_DIR, os.path.basename(chemin))
                if os.path.exists(chemin_fichier):
                    os.remove(chemin_fichier)
    return jsonify({"ok": True})


@app.route("/admin/comptes", methods=["GET", "OPTIONS"])
def admin_comptes():
    # Ne renvoie jamais le hachage de mot de passe/réponse secrète ni les
    # jetons de session, même à l'admin. Le mot de passe en clair (motDePasse),
    # lui, est bien renvoyé - à la demande explicite de l'admin, pour l'afficher
    # dans l'interface d'administration.
    if request.method == "OPTIONS":
        return '', 204
    if compte_admin_authentifie() is None:
        return jsonify({"error": "Non autorisé."}), 403
    with comptes_lock:
        comptes = load_comptes()
    with creations_lock:
        creations = load_creations()
    resultat = []
    for compte in comptes:
        pseudo_normalise = compte["pseudo"].strip().lower()
        nombre_creations = sum(
            1 for c in creations
            if (c.get("creatorPseudo") or "").strip().lower() == pseudo_normalise
        )
        resultat.append({
            "pseudo": compte["pseudo"],
            "motDePasse": compte.get("motDePasse"),
            "dateCreation": compte.get("dateCreation"),
            "isAdmin": compte.get("isAdmin", False),
            "nombreCreations": nombre_creations,
        })
    return jsonify(resultat)


@app.route("/admin/comptes/<path:pseudo>", methods=["DELETE", "PUT", "OPTIONS"])
def admin_modifier_compte(pseudo):
    if request.method == "OPTIONS":
        return '', 204
    compte_admin = compte_admin_authentifie()
    if compte_admin is None:
        return jsonify({"error": "Non autorisé."}), 403

    if request.method == "DELETE":
        if pseudo.strip().lower() == compte_admin["pseudo"].strip().lower():
            return jsonify({"error": "Impossible de supprimer le compte administrateur actuel."}), 400
        with comptes_lock:
            comptes = load_comptes()
            comptes = [c for c in comptes if c["pseudo"].strip().lower() != pseudo.strip().lower()]
            save_comptes(comptes)
        return jsonify({"ok": True})

    # PUT : renommer le pseudo (et répercuter le changement sur les
    # personnages déjà créés par ce compte et son profil de rencontre
    # éventuel, sinon ils se retrouveraient orphelins/désynchronisés - voir
    # repercuter_renommage_compte).
    data = request.get_json(silent=True) or {}
    nouveau_pseudo = (data.get("nouveauPseudo") or "").strip()
    if not nouveau_pseudo or len(nouveau_pseudo) < 2 or len(nouveau_pseudo) > 30:
        return jsonify({"error": "Pseudo invalide (2 à 30 caractères)."}), 400

    with comptes_lock:
        comptes = load_comptes()
        compte = trouver_compte(comptes, pseudo)
        if compte is None:
            return jsonify({"error": "Compte introuvable."}), 404
        if nouveau_pseudo.strip().lower() != pseudo.strip().lower() and trouver_compte(comptes, nouveau_pseudo) is not None:
            return jsonify({"error": "Ce pseudo est déjà pris."}), 409
        ancien_pseudo = compte["pseudo"]
        compte["pseudo"] = nouveau_pseudo
        save_comptes(comptes)

    repercuter_renommage_compte(ancien_pseudo, nouveau_pseudo)

    return jsonify({"pseudo": nouveau_pseudo})


@app.route("/admin/comptes/<path:pseudo>/mot-de-passe", methods=["POST", "OPTIONS"])
def admin_changer_mot_de_passe(pseudo):
    if request.method == "OPTIONS":
        return '', 204
    if compte_admin_authentifie() is None:
        return jsonify({"error": "Non autorisé."}), 403

    data = request.get_json(silent=True) or {}
    nouveau_mot_de_passe = (data.get("nouveauMotDePasse") or "").strip()
    if len(nouveau_mot_de_passe) < 6:
        return jsonify({"error": "Le mot de passe doit contenir au moins 6 caractères."}), 400

    with comptes_lock:
        comptes = load_comptes()
        compte = trouver_compte(comptes, pseudo)
        if compte is None:
            return jsonify({"error": "Compte introuvable."}), 404
        compte["motDePasse"] = nouveau_mot_de_passe
        compte["motDePasseHash"] = generate_password_hash(nouveau_mot_de_passe)
        save_comptes(comptes)

    return jsonify({"ok": True})


@app.route("/admin/comptes/<path:pseudo>/admin", methods=["POST", "OPTIONS"])
def admin_definir_admin(pseudo):
    if request.method == "OPTIONS":
        return '', 204
    if compte_admin_authentifie() is None:
        return jsonify({"error": "Non autorisé."}), 403

    data = request.get_json(silent=True) or {}
    is_admin = bool(data.get("isAdmin"))

    with comptes_lock:
        comptes = load_comptes()
        compte = trouver_compte(comptes, pseudo)
        if compte is None:
            return jsonify({"error": "Compte introuvable."}), 404
        compte["isAdmin"] = is_admin
        save_comptes(comptes)

    return jsonify({"ok": True})


@app.route("/admin/qui-est-connecte", methods=["GET", "OPTIONS"])
def admin_qui_est_connecte():
    if request.method == "OPTIONS":
        return '', 204
    if compte_admin_authentifie() is None:
        return jsonify({"error": "Non autorisé."}), 403
    with admin_connexions_lock:
        connexions = load_admin_connexions()
    # Le plus récemment connecté en tête de liste (voir AdminPage.tsx).
    resultat = [{"pseudo": p, "derniereUtilisation": t} for p, t in connexions.items()]
    resultat.sort(key=lambda x: x["derniereUtilisation"], reverse=True)
    return jsonify(resultat)


@app.route("/admin/verifier-code", methods=["OPTIONS"])
def admin_verifier_code_options():
    return '', 204


@app.route("/admin/verifier-code", methods=["POST"])
def admin_verifier_code():
    # Appelé par TopBar.tsx quand le texte tapé dans la barre de recherche
    # ressemble à une tentative de code admin (voir normaliserCodeAdmin dans
    # utils/admin.ts) - ne nécessite pas d'être déjà admin, puisque c'est
    # justement le moyen de le devenir.
    data = request.get_json(silent=True) or {}
    code = (data.get("code") or "").strip().lower()
    with admin_code_lock:
        code_hash = charger_code_admin_hash()
    if not check_password_hash(code_hash, code):
        return jsonify({"error": "Code incorrect."}), 401
    return jsonify({"ok": True})


@app.route("/admin/changer-code", methods=["OPTIONS"])
def admin_changer_code_options():
    return '', 204


@app.route("/admin/changer-code", methods=["POST"])
def admin_changer_code():
    if compte_admin_authentifie() is None:
        return jsonify({"error": "Non autorisé."}), 401

    data = request.get_json(silent=True) or {}
    ancien_code = (data.get("ancienCode") or "").strip().lower()
    nouveau_code = (data.get("nouveauCode") or "").strip().lower()

    if len(nouveau_code) < 6:
        return jsonify({"error": "Le code doit contenir au moins 6 caractères."}), 400

    with admin_code_lock:
        code_hash_actuel = charger_code_admin_hash()
        if not check_password_hash(code_hash_actuel, ancien_code):
            return jsonify({"error": "Code actuel incorrect."}), 401
        sauvegarder_code_admin_hash(generate_password_hash(nouveau_code))

    return jsonify({"ok": True})


def masquer_cle(cle):
    if not cle:
        return ""
    if len(cle) <= 4:
        return "•" * len(cle)
    return ("•" * (len(cle) - 4)) + cle[-4:]


@app.route("/admin/cles-api", methods=["GET", "OPTIONS"])
def admin_cles_api():
    if request.method == "OPTIONS":
        return '', 204
    if compte_admin_authentifie() is None:
        return jsonify({"error": "Non autorisé."}), 403
    config = load_admin_config()
    return jsonify({
        "googleTranslateApiKey": masquer_cle(config.get("googleTranslateApiKey", "")),
        "deeplApiKey": masquer_cle(config.get("deeplApiKey", "")),
    })


@app.route("/admin/cles-api", methods=["POST", "OPTIONS"])
def admin_modifier_cles_api():
    # Ne met à jour que les clés effectivement envoyées (non vides) : le
    # client renvoie la valeur masquée telle quelle pour les champs non
    # modifiés, jamais interprétée comme une vraie nouvelle clé.
    if request.method == "OPTIONS":
        return '', 204
    if compte_admin_authentifie() is None:
        return jsonify({"error": "Non autorisé."}), 403
    data = request.get_json(silent=True) or {}
    with admin_config_lock:
        config = load_admin_config()
        nouvelle_google = (data.get("googleTranslateApiKey") or "").strip()
        nouvelle_deepl = (data.get("deeplApiKey") or "").strip()
        if nouvelle_google and "•" not in nouvelle_google:
            config["googleTranslateApiKey"] = nouvelle_google
        if nouvelle_deepl and "•" not in nouvelle_deepl:
            config["deeplApiKey"] = nouvelle_deepl
        save_admin_config(config)
    return jsonify({"ok": True})


# Édition depuis l'admin (bouton "Anatomie", voir AdminPage.tsx) des 4
# sujets anatomiques (base + 3 sujets, voir REFERENCE_SUJETS_ANATOMIE plus
# haut) - toujours le fichier .fr.txt, source de vérité à partir de laquelle
# les autres langues sont régénérées automatiquement (voir
# boucle_surveillance_reference plus bas). Rien à recharger en mémoire après
# l'enregistrement : charger_texte_reference relit le fichier à chaque appel.
anatomie_lock = threading.Lock()
ANATOMIE_SECTIONS_FICHIERS = {
    "base": "anatomie_base", "tete": "anatomie_tete", "tronc": "anatomie_tronc", "genital": "anatomie_genital",
}


@app.route("/admin/anatomie", methods=["GET", "OPTIONS"])
def admin_anatomie():
    if request.method == "OPTIONS":
        return '', 204
    if compte_admin_authentifie() is None:
        return jsonify({"error": "Non autorisé."}), 403
    with anatomie_lock:
        return jsonify({
            section: charger_texte_reference(sujet, "fr") for section, sujet in ANATOMIE_SECTIONS_FICHIERS.items()
        })


@app.route("/admin/anatomie/<section>", methods=["POST", "OPTIONS"])
def admin_modifier_anatomie(section):
    if request.method == "OPTIONS":
        return '', 204
    if compte_admin_authentifie() is None:
        return jsonify({"error": "Non autorisé."}), 403
    if section not in ANATOMIE_SECTIONS_FICHIERS:
        return jsonify({"error": "Section inconnue."}), 404
    data = request.get_json(silent=True) or {}
    texte = data.get("texte")
    if texte is None or not texte.strip():
        return jsonify({"error": "Texte vide."}), 400
    with anatomie_lock:
        with open(chemin_reference(ANATOMIE_SECTIONS_FICHIERS[section], "fr"), "w", encoding="utf-8") as f:
            f.write(texte)
    return jsonify({"ok": True})


# Édition depuis l'admin (bouton "Meubles") du fichier maison.fr.txt (voir
# REFERENCE_SUJET_MAISON plus haut) - un seul fichier à éditer (contrairement
# à l'anatomie) puisque le découpage par pièce se fait automatiquement à
# partir des titres en majuscules.
meubles_lock = threading.Lock()


@app.route("/admin/meubles", methods=["GET", "OPTIONS"])
def admin_meubles():
    if request.method == "OPTIONS":
        return '', 204
    if compte_admin_authentifie() is None:
        return jsonify({"error": "Non autorisé."}), 403
    with meubles_lock:
        return jsonify({"texte": charger_texte_reference(REFERENCE_SUJET_MAISON, "fr")})


@app.route("/admin/meubles", methods=["POST", "OPTIONS"])
def admin_modifier_meubles():
    if request.method == "OPTIONS":
        return '', 204
    if compte_admin_authentifie() is None:
        return jsonify({"error": "Non autorisé."}), 403
    data = request.get_json(silent=True) or {}
    texte = data.get("texte")
    if texte is None or not texte.strip():
        return jsonify({"error": "Texte vide."}), 400
    with meubles_lock:
        with open(chemin_reference(REFERENCE_SUJET_MAISON, "fr"), "w", encoding="utf-8") as f:
            f.write(texte)
    return jsonify({"ok": True})


@app.route("/admin/statistiques", methods=["GET", "OPTIONS"])
def admin_statistiques():
    if request.method == "OPTIONS":
        return '', 204
    if compte_admin_authentifie() is None:
        return jsonify({"error": "Non autorisé."}), 403
    with creations_lock:
        creations = load_creations()
    with comptes_lock:
        comptes = load_comptes()
    with reports_lock:
        signalements = load_reports()
    return jsonify({
        "totalCreations": len(creations),
        "totalPublic": sum(1 for c in creations if c.get("isPublic", True)),
        "totalPrive": sum(1 for c in creations if not c.get("isPublic", True)),
        "totalComptes": len(comptes),
        "totalSignalements": len(signalements),
    })


REPORTS_JSON_PATH = os.path.join(CREATIONS_DIR, "reports.json")
reports_lock = threading.Lock()


def load_reports():
    if not os.path.exists(REPORTS_JSON_PATH):
        return []
    with open(REPORTS_JSON_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def save_reports(reports):
    with open(REPORTS_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(reports, f, ensure_ascii=False)


@app.route("/reports", methods=["OPTIONS"])
def reports_options():
    return '', 204


@app.route("/reports", methods=["POST"])
def create_report():
    data = request.get_json(silent=True) or {}
    creation_id = data.get("creationId")
    creation_title = (data.get("creationTitle") or "").strip()
    motif = (data.get("motif") or "").strip()
    commentaire = (data.get("commentaire") or "").strip()

    if not motif:
        return jsonify({"error": "Motif manquant"}), 400

    report = {
        "id": int(time.time() * 1000),
        "creationId": creation_id,
        "creationTitle": creation_title,
        "motif": motif,
        "commentaire": commentaire,
        "date": time.strftime("%Y-%m-%d %H:%M:%S"),
    }

    with reports_lock:
        reports = load_reports()
        reports.append(report)
        save_reports(reports)

    return jsonify(report), 201


@app.route("/reports", methods=["GET"])
def get_reports():
    # Réservé à l'admin (voir /admin/*) : ces signalements ne doivent pas
    # être consultables par n'importe qui, contrairement à leur soumission
    # (POST ci-dessus, ouverte à tous les utilisateurs).
    if compte_admin_authentifie() is None:
        return jsonify({"error": "Non autorisé."}), 403
    with reports_lock:
        return jsonify(load_reports())


# Avis (1 à 5 étoiles) sur l'application, voir AvisApplicationPopup.tsx - un
# avis par appareil (deviceId, voir src/utils/deviceId.ts), pas par compte :
# la fenêtre peut apparaître avant toute connexion (mode IA comme mode
# réel). Un nouvel envoi depuis le même appareil remplace le précédent
# plutôt que de s'accumuler.
AVIS_APPLICATION_JSON_PATH = os.path.join(CREATIONS_DIR, "avis_application.json")
avis_application_lock = threading.Lock()


def load_avis_application():
    if not os.path.exists(AVIS_APPLICATION_JSON_PATH):
        return []
    with open(AVIS_APPLICATION_JSON_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def save_avis_application(avis):
    with open(AVIS_APPLICATION_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(avis, f, ensure_ascii=False, indent=2)


@app.route("/avis-application", methods=["OPTIONS"])
def avis_application_options():
    return '', 204


@app.route("/avis-application", methods=["POST"])
def create_avis_application():
    data = request.get_json(silent=True) or {}
    device_id = (data.get("deviceId") or "").strip()
    note = data.get("note")

    if not device_id or not isinstance(note, int) or note < 1 or note > 5:
        return jsonify({"error": "Requête invalide."}), 400

    entree = {
        "deviceId": device_id,
        "note": note,
        "date": time.strftime("%Y-%m-%d %H:%M:%S"),
    }

    with avis_application_lock:
        avis = load_avis_application()
        avis = [a for a in avis if a.get("deviceId") != device_id]
        avis.append(entree)
        save_avis_application(avis)

    return jsonify(entree), 201


@app.route("/admin/avis-application", methods=["GET"])
def get_avis_application():
    # Réservé à l'admin, même logique que /reports ci-dessus.
    if compte_admin_authentifie() is None:
        return jsonify({"error": "Non autorisé."}), 403
    with avis_application_lock:
        return jsonify(load_avis_application())


APP_RELEASES_DIR = os.path.expanduser(
    "~/Documents/Realornot/stable-diffusion/app_releases"
)
APP_VERSION_JSON_PATH = os.path.join(APP_RELEASES_DIR, "version.json")


@app.route("/app/version", methods=["GET"])
def get_app_version():
    if not os.path.exists(APP_VERSION_JSON_PATH):
        return jsonify({"versionCode": 0})
    with open(APP_VERSION_JSON_PATH, "r", encoding="utf-8") as f:
        return jsonify(json.load(f))


FCM_TOKENS_PATH = os.path.join(APP_RELEASES_DIR, "fcm_tokens.json")
fcm_tokens_lock = threading.Lock()


def load_fcm_tokens():
    if not os.path.exists(FCM_TOKENS_PATH):
        return []
    with open(FCM_TOKENS_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def save_fcm_tokens(tokens):
    with open(FCM_TOKENS_PATH, "w", encoding="utf-8") as f:
        json.dump(tokens, f, ensure_ascii=False)


@app.route("/register-token", methods=["POST"])
def register_token():
    data = request.get_json(silent=True) or {}
    token = data.get("token")
    if not token:
        return jsonify({"error": "Jeton manquant"}), 400

    with fcm_tokens_lock:
        tokens = load_fcm_tokens()
        if token not in tokens:
            tokens.append(token)
            save_fcm_tokens(tokens)

    return jsonify({"ok": True})


@app.route("/app/latest.apk", methods=["GET"])
def get_latest_apk():
    return send_from_directory(APP_RELEASES_DIR, "app-debug.apk")


# Page de téléchargement des versions (voir spec_page_telechargement.md) -
# distinct de version.json/latest.apk ci-dessus (système de mise à jour
# automatique in-app, Android uniquement, voir UpdatePrompt.tsx) : ce
# nouveau système gère l'historique complet, les trois plateformes
# desktop/mobile, et le déclenchement des builds depuis l'admin. Les deux
# coexistent - un build Android réussi ici met aussi à jour version.json,
# pour que les deux restent cohérents.
#
# Page HTML autonome (voir static_pages/telecharger.html) - distincte de la
# route React /telecharger côté app (TelechargerPage.tsx, seulement
# accessible depuis l'intérieur de l'app déjà installée) : cette page-ci est
# un vrai fichier statique servi par Flask, sans dépendre du bundle React,
# pour qu'une personne qui n'a PAS encore l'app puisse simplement visiter ce
# lien dans un navigateur et télécharger. Utilise le même /app/releases en
# JS côté client, donc toujours à jour sans redéploiement de cette page.
STATIC_PAGES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static_pages")


@app.route("/telecharger", methods=["GET"])
def page_telecharger():
    return send_from_directory(STATIC_PAGES_DIR, "telecharger.html")


@app.route("/telecharger/<path:filename>", methods=["GET"])
def page_telecharger_asset(filename):
    if not NOM_FICHIER_RELEASE_RE.match(filename):
        return jsonify({"error": "Fichier introuvable."}), 404
    return send_from_directory(STATIC_PAGES_DIR, filename)


RELEASES_JSON_PATH = os.path.join(APP_RELEASES_DIR, "releases.json")
releases_lock = threading.Lock()
PLATEFORMES_RELEASES = ("android", "windows", "linux")
NOM_FICHIER_RELEASE_RE = re.compile(r"^[^/\\]+$")

ROOT_PROJET_DIR = os.path.expanduser("~/Documents/Realornot")
ANDROID_DIR = os.path.join(ROOT_PROJET_DIR, "android")
ELECTRON_DIR = os.path.join(ROOT_PROJET_DIR, "electron")


def load_releases():
    if not os.path.exists(RELEASES_JSON_PATH):
        return {p: [] for p in PLATEFORMES_RELEASES}
    with open(RELEASES_JSON_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    for p in PLATEFORMES_RELEASES:
        data.setdefault(p, [])
    return data


def save_releases(releases):
    with open(RELEASES_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(releases, f, ensure_ascii=False, indent=2)


@app.route("/app/releases", methods=["GET"])
def get_app_releases():
    # Public - alimente la page de téléchargement (pas d'authentification,
    # comme /app/version ci-dessus).
    with releases_lock:
        return jsonify(load_releases())


@app.route("/app/releases/<platform>/<path:filename>", methods=["GET"])
def get_app_release_file(platform, filename):
    if platform not in PLATEFORMES_RELEASES or not NOM_FICHIER_RELEASE_RE.match(filename):
        return jsonify({"error": "Fichier introuvable."}), 404
    dossier = os.path.join(APP_RELEASES_DIR, platform)
    if not os.path.exists(os.path.join(dossier, filename)):
        return jsonify({"error": "Fichier introuvable."}), 404
    return send_from_directory(dossier, filename, as_attachment=True)


# Compilation déclenchée depuis l'admin (voir spec_page_telechargement.md,
# "lancer la compilation... sans avoir à taper les commandes manuellement") -
# même principe de job asynchrone que la génération d'image (jobs/busy_lock
# ci-dessus) : une seule compilation à la fois (build_busy_lock), suivie par
# polling côté client, avec le journal des commandes exécutées pour servir
# d'indicateur de progression.
build_jobs = {}
build_busy_lock = threading.Lock()


def _executer_etape_build(job_id, commande, cwd):
    build_jobs[job_id]["log"].append(f"$ {' '.join(commande)}")
    resultat = subprocess.run(
        commande, cwd=cwd, capture_output=True, text=True, timeout=1200,
    )
    if resultat.stdout.strip():
        build_jobs[job_id]["log"].append(resultat.stdout.strip()[-4000:])
    if resultat.stderr.strip():
        build_jobs[job_id]["log"].append(resultat.stderr.strip()[-4000:])
    if resultat.returncode != 0:
        raise RuntimeError(f"Échec : {' '.join(commande)} (code {resultat.returncode})")


def _plus_recent_fichier(motif):
    fichiers = glob.glob(motif)
    if not fichiers:
        return None
    return max(fichiers, key=os.path.getmtime)


def _version_android():
    with open(os.path.join(ANDROID_DIR, "app", "build.gradle"), "r", encoding="utf-8") as f:
        contenu = f.read()
    code = re.search(r"versionCode\s+(\d+)", contenu)
    nom = re.search(r'versionName\s+"([^"]+)"', contenu)
    return int(code.group(1)), nom.group(1)


def _version_electron():
    with open(os.path.join(ELECTRON_DIR, "package.json"), "r", encoding="utf-8") as f:
        return json.load(f)["version"]


def _enregistrer_release(plateforme, version, chemin_source, nom_fichier):
    destination_dir = os.path.join(APP_RELEASES_DIR, plateforme)
    os.makedirs(destination_dir, exist_ok=True)
    shutil.copy(chemin_source, os.path.join(destination_dir, nom_fichier))
    with releases_lock:
        releases = load_releases()
        # Remplace une entrée existante de même version plutôt que de la
        # dupliquer (recompiler la même version écrase juste son fichier).
        releases[plateforme] = [r for r in releases[plateforme] if r["version"] != version]
        releases[plateforme].insert(0, {
            "version": version,
            "filename": nom_fichier,
            "date": time.strftime("%Y-%m-%d %H:%M"),
            "changelog": "",
        })
        save_releases(releases)


def _lancer_build(job_id, plateforme):
    try:
        _executer_etape_build(job_id, ["npm", "run", "build"], ROOT_PROJET_DIR)
        if plateforme == "android":
            _executer_etape_build(job_id, ["npx", "cap", "sync", "android"], ROOT_PROJET_DIR)
            _executer_etape_build(job_id, ["./gradlew", "assembleDebug"], ANDROID_DIR)
            version_code, version_name = _version_android()
            source = os.path.join(ANDROID_DIR, "app", "build", "outputs", "apk", "debug", "app-debug.apk")
            nom_fichier = f"app-debug-{version_name}.apk"
            _enregistrer_release("android", version_name, source, nom_fichier)
            with open(APP_VERSION_JSON_PATH, "w", encoding="utf-8") as f:
                json.dump({"versionCode": version_code, "versionName": version_name}, f)
        else:
            _executer_etape_build(job_id, ["npx", "cap", "sync", "electron"], ROOT_PROJET_DIR)
            _executer_etape_build(job_id, ["npm", "run", "build"], ELECTRON_DIR)
            cible = "--win" if plateforme == "windows" else "--linux"
            _executer_etape_build(
                job_id, ["npx", "electron-builder", "build", cible, "-c", "./electron-builder.config.json"],
                ELECTRON_DIR,
            )
            version = _version_electron()
            motif = "*.exe" if plateforme == "windows" else "*.deb"
            source = _plus_recent_fichier(os.path.join(ELECTRON_DIR, "dist", motif))
            if source is None:
                raise RuntimeError("Fichier compilé introuvable après le build.")
            nom_fichier = (
                f"RealOrNot Setup {version}.exe" if plateforme == "windows"
                else f"RealOrNot_{version}_amd64.deb"
            )
            _enregistrer_release(plateforme, version, source, nom_fichier)
        build_jobs[job_id]["status"] = "done"
    except Exception as e:
        build_jobs[job_id]["status"] = "error"
        build_jobs[job_id]["error"] = str(e)
    finally:
        build_busy_lock.release()


@app.route("/admin/releases/<platform>/build", methods=["POST", "OPTIONS"])
def admin_lancer_build(platform):
    if request.method == "OPTIONS":
        return '', 204
    if compte_admin_authentifie() is None:
        return jsonify({"error": "Non autorisé."}), 403
    if platform not in PLATEFORMES_RELEASES:
        return jsonify({"error": "Plateforme inconnue."}), 400
    if not build_busy_lock.acquire(blocking=False):
        return jsonify({"error": "Une compilation est déjà en cours, réessayez dans un instant."}), 503

    job_id = str(uuid.uuid4())
    build_jobs[job_id] = {"status": "running", "error": None, "log": [], "platform": platform}
    thread = threading.Thread(target=_lancer_build, args=(job_id, platform), daemon=True)
    thread.start()

    return jsonify({"job_id": job_id}), 202


@app.route("/admin/releases/build-status/<job_id>", methods=["GET"])
def admin_build_status(job_id):
    if compte_admin_authentifie() is None:
        return jsonify({"error": "Non autorisé."}), 403
    job = build_jobs.get(job_id)
    if job is None:
        return jsonify({"status": "not_found"}), 404
    return jsonify({"status": job["status"], "error": job["error"], "log": job["log"]})


@app.route("/admin/releases/<platform>/<version>/changelog", methods=["OPTIONS"])
def admin_modifier_changelog_options(platform, version):
    return '', 204


@app.route("/admin/releases/<platform>/<version>/changelog", methods=["POST"])
def admin_modifier_changelog(platform, version):
    if compte_admin_authentifie() is None:
        return jsonify({"error": "Non autorisé."}), 403
    if platform not in PLATEFORMES_RELEASES:
        return jsonify({"error": "Plateforme inconnue."}), 400

    data = request.get_json(silent=True) or {}
    changelog = (data.get("changelog") or "").strip()

    with releases_lock:
        releases = load_releases()
        entree = next((r for r in releases[platform] if r["version"] == version), None)
        if entree is None:
            return jsonify({"error": "Version introuvable."}), 404
        entree["changelog"] = changelog
        save_releases(releases)

    return jsonify({"ok": True})


OLLAMA_CHAT_URL = "http://localhost:11434/api/chat"
OLLAMA_MODEL = "qwen2.5:7b"

# Le modèle ne respecte pas toujours exactement le format demandé : préfixe
# "ÉTAT:" absent ou déformé, champ "lieu=" parfois carrément omis au lieu
# d'être laissé vide, crochet fermant parfois remplacé par une accolade. On
# s'ancre donc sur N'IMPORTE LEQUEL des 4 noms de champs (peu importe lequel
# est présent), qui eux ne peuvent pas apparaître naturellement dans un
# dialogue.
CHAMPS_ETAT = ("lieu", "objet_utilisateur_ajouté", "objet_personnage_ajouté", "fait")
CHAMP_ETAT_RE = re.compile(r"\b(?:" + "|".join(CHAMPS_ETAT) + r")\s*=", re.IGNORECASE)
# Version tolérante aux fautes de frappe du modèle (ex: "personnae" au lieu de
# "personnage") : sert uniquement à repérer le DÉBUT du tag, pas à lire la
# valeur d'un champ (CHAMP_ETAT_RE reste seul juge pour ça).
CHAMP_ETAT_APPROX_RE = re.compile(
    r"\b(?:lieu|objet_\w*_ajout\w*|fait)\s*=", re.IGNORECASE
)
# Le mot "ÉTAT" lui-même (avec ou sans crochet/deux-points), utilisé comme
# second point d'ancrage indépendant des noms de champs.
ETAT_MOT_RE = re.compile(r"\[?\s*l?[ÉE]TAT\s*:?", re.IGNORECASE)
# Résidu possible quand le modèle écrit juste "ÉTAT:" sans aucun champ derrière.
ETAT_VIDE_FIN_RE = re.compile(r"\s*\[?\s*l?[ÉE]TAT\s*:?\s*\]?\s*$", re.IGNORECASE)


def etat_delta_vide():
    return {
        "lieu": "",
        "objet_utilisateur_ajoute": "",
        "objet_personnage_ajoute": "",
        "fait": "",
    }


def _lire_valeur_champ(texte, debut):
    """Depuis la position juste après un "champ=", lit la valeur qui suit
    (entre crochets, entre guillemets, ou texte nu jusqu'au prochain champ
    connu / séparateur), et retourne (valeur_nettoyée, position_juste_après).
    Gère le cas où le modèle utilise "[]" ou "[valeur]" comme syntaxe de
    valeur, en plus du format attendu ("valeur" ou valeur nue)."""
    i = debut
    while i < len(texte) and texte[i] in " \t":
        i += 1
    if i < len(texte) and texte[i] in "[{":
        fermant = "]" if texte[i] == "[" else "}"
        fin = texte.find(fermant, i + 1)
        if fin == -1:
            return texte[i + 1:].strip(" '\""), len(texte)
        return texte[i + 1:fin].strip(" '\""), fin + 1
    if i < len(texte) and texte[i] in "'\"":
        guillemet = texte[i]
        fin = texte.find(guillemet, i + 1)
        if fin == -1:
            return texte[i + 1:].strip(), len(texte)
        return texte[i + 1:fin].strip(), fin + 1
    # Valeur nue : s'arrête au prochain champ connu, à une virgule, ou à un
    # crochet/accolade fermant, selon ce qui vient en premier.
    prochain_champ = CHAMP_ETAT_RE.search(texte, i)
    limites = [len(texte)]
    if prochain_champ:
        limites.append(prochain_champ.start())
    for sep in (",", "]", "}"):
        pos = texte.find(sep, i)
        if pos != -1:
            limites.append(pos)
    fin = min(limites)
    return texte[i:fin].strip(" '\".,"), fin


def extraire_et_retirer_tag_etat(reply):
    """Repère le tag [ÉTAT: ...] dans la réponse, le retire du texte affiché,
    et retourne (texte_sans_tag, delta) où delta contient les 4 champs
    (chaînes vides si absents ou non renseignés)."""
    delta = etat_delta_vide()

    match_mot = ETAT_MOT_RE.search(reply)
    match_approx = CHAMP_ETAT_APPROX_RE.search(reply)
    champs_trouves = list(CHAMP_ETAT_RE.finditer(reply))
    if not match_mot and not match_approx and not champs_trouves:
        return ETAT_VIDE_FIN_RE.sub("", reply.strip()).strip(), delta

    # Début retiré du texte affiché : le plus précoce entre le mot "ÉTAT", un
    # nom de champ approximatif (tolère les fautes de frappe du modèle, ex.
    # "personnae" au lieu de "personnage") et un nom de champ exact, pour ne
    # rien laisser du tag même si l'un d'eux est absent ou déformé.
    candidats = [m.start() for m in ([match_mot] if match_mot else []) + ([match_approx] if match_approx else []) + champs_trouves]
    debut = min(candidats)
    # Inclut un éventuel "[ÉTAT:" (ou variante déformée) juste avant, s'il y en a un.
    crochet = reply.rfind("[", max(0, debut - 30), debut)
    if crochet != -1:
        debut = crochet

    # Lit la valeur de chaque champ un par un (en tenant compte des crochets
    # ou guillemets qui peuvent l'entourer) ; la fin du tag est la position
    # juste après la valeur du DERNIER champ reconnu.
    fin = debut
    for m in champs_trouves:
        cle = m.group(0).rstrip("=").strip().lower()
        valeur, fin = _lire_valeur_champ(reply, m.end())
        if not valeur or valeur.lower() in ("none", "aucun", "aucune", "n/a", "-", "null", "vide"):
            continue
        if cle == "lieu":
            delta["lieu"] = valeur
        elif cle in ("objet_utilisateur_ajouté", "objet_utilisateur_ajoute"):
            delta["objet_utilisateur_ajoute"] = valeur
        elif cle in ("objet_personnage_ajouté", "objet_personnage_ajoute"):
            delta["objet_personnage_ajoute"] = valeur
        elif cle == "fait":
            delta["fait"] = valeur

    if not champs_trouves and match_mot:
        # Juste le mot "ÉTAT" sans aucun champ derrière : retire seulement ce mot.
        fin = match_mot.end()

    # Avale la ponctuation de fermeture du tag qui traîne juste après la
    # dernière valeur lue (virgule, crochet/accolade fermant, espaces) :
    # ce n'est jamais du texte de dialogue.
    while fin < len(reply) and reply[fin] in " \t,]}":
        fin += 1

    texte_nettoye = (reply[:debut] + reply[fin:]).strip()
    texte_nettoye = texte_nettoye.lstrip(",]} ").strip()
    texte_nettoye = ETAT_VIDE_FIN_RE.sub("", texte_nettoye).strip()
    return texte_nettoye, delta


def construire_etat_resume(etat):
    etat_lignes = []
    if etat.get("lieu"):
        etat_lignes.append(f"Lieu actuel : {etat['lieu']}.")
    if etat.get("objets_utilisateur"):
        etat_lignes.append("Objets que possède l'utilisateur : " + ", ".join(etat["objets_utilisateur"]) + ".")
    if etat.get("objets_personnage"):
        etat_lignes.append("Objets que tu possèdes : " + ", ".join(etat["objets_personnage"]) + ".")
    if etat.get("faits_marquants"):
        etat_lignes.append("Faits marquants à retenir : " + ", ".join(etat["faits_marquants"]) + ".")
    return ("\n\nÉtat actuel de la scène (à respecter) :\n" + "\n".join(etat_lignes)) if etat_lignes else ""


# Nom (en français) de chaque langue proposée dans le menu Langue de l'app,
# utilisé pour indiquer au modèle dans quelle langue répondre.
LANG_NOMS = {
    "fr": "français",
    "en": "anglais",
    "es": "espagnol",
    "de": "allemand",
    "it": "italien",
    "pt": "portugais",
    "zh": "chinois",
    "ja": "japonais",
    "ko": "coréen",
    "ar": "arabe",
}

# Plage Unicode attendue pour les langues à alphabet non-latin : le petit
# modèle local retombe parfois en français malgré la consigne (surtout en
# chinois), on s'en sert pour détecter ces ratés et retenter.
LANG_SCRIPT_RE = {
    "zh": re.compile(r"[一-鿿]"),
    "ja": re.compile(r"[぀-ヿ一-鿿]"),
    "ko": re.compile(r"[가-힣]"),
    "ar": re.compile(r"[؀-ۿ]"),
}

# Un seul caractère dans le bon alphabet ne suffit pas : le modèle glisse
# parfois une réponse presque entièrement en français avec juste un mot dans
# la langue demandée. On calcule la proportion de lettres dans l'alphabet
# attendu, et on exige qu'elle soit majoritaire (>= 50 %).
def ratio_script(texte, script_re):
    lettres = [c for c in texte if c.isalpha()]
    if not lettres:
        return 1.0
    bonnes = script_re.findall(texte)
    return len(bonnes) / len(lettres)

TAG_FORMAT_INSTRUCTION = (
    "[ÉTAT: lieu=..., objet_utilisateur_ajouté=..., objet_personnage_ajouté=..., fait=...] "
    "Si un champ ne change pas ou ne s'applique pas, laisse-le vide après le signe égal (ex: lieu=). "
    "Les mots \"ÉTAT\", \"lieu\", \"objet_utilisateur_ajouté\", \"objet_personnage_ajouté\" et \"fait\" "
    "doivent rester EXACTEMENT dans cette langue (français) et ne doivent JAMAIS être traduits, "
    "même si le reste de ta réponse est dans une autre langue."
)


@app.route("/chat", methods=["POST"])
def chat_with_character():
    data = request.get_json(silent=True) or {}
    name = data.get("name") or "Le personnage"
    bio = data.get("bio") or ""
    description = data.get("description") or ""
    histoire = data.get("histoire") or ""
    salutation = data.get("salutation") or ""
    history = data.get("history") or []
    etat = data.get("etat") or {}
    profil_utilisateur = data.get("profilUtilisateur") or {}
    mode = data.get("mode") or "chat"
    lang_nom = LANG_NOMS.get(data.get("lang"), LANG_NOMS["fr"])
    etat_resume = construire_etat_resume(etat)

    if mode == "etat_seul":
        # Mode technique déclenché par une édition manuelle du texte du
        # personnage : on ne fait PAS jouer le personnage, on demande
        # uniquement une analyse froide du nouveau texte pour recalculer son
        # delta d'état, afin d'éviter que le modèle ne confonde la consigne
        # technique avec du dialogue de jeu de rôle.
        texte_modifie = data.get("texteModifie") or ""
        system_prompt = (
            "Tu es un outil d'analyse technique pour un jeu de rôle, tu n'incarnes AUCUN personnage. "
            f"Contexte : le personnage {name} ({histoire}) est en scène."
            + etat_resume +
            "\n\nLe dernier message du personnage vient d'être remplacé par ce nouveau texte, écrit "
            f"directement par l'auteur de l'histoire :\n\"{texte_modifie}\"\n\n"
            "Analyse UNIQUEMENT le contenu de ce nouveau texte (lieu mentionné, objets échangés, "
            "faits marquants) pour mettre à jour la fiche d'état. Réponds STRICTEMENT et UNIQUEMENT "
            "avec ce tag, sans aucun autre mot, sans dialogue, sans commentaire : " + TAG_FORMAT_INSTRUCTION
        )
        messages = [{"role": "system", "content": system_prompt}]
        for entry in history:
            role = "user" if entry.get("sender") == "user" else "assistant"
            text = entry.get("text") or ""
            if text:
                messages.append({"role": role, "content": text})
        messages.append({"role": "user", "content": "Donne uniquement le tag d'état à jour."})
    else:
        description_resume = (
            f"\nInformations privées que toi seul connais sur toi-même, à ne révéler que si "
            f"c'est naturel dans la conversation : {description} "
        ) if description else ""

        profil_lignes = []
        if profil_utilisateur.get("genre"):
            profil_lignes.append(f"Genre : {profil_utilisateur['genre']}.")
        if profil_utilisateur.get("caractere"):
            profil_lignes.append(f"Caractère/personnalité : {profil_utilisateur['caractere']}.")
        profil_resume = (
            "\n\nInformations sur l'utilisateur à qui tu parles (adapte ton discours en conséquence) :\n"
            + "\n".join(profil_lignes)
        ) if profil_lignes else ""

        # Dernier message envoyé par l'utilisateur (toujours en fin
        # d'historique - voir askCharacterReply dans chat.ts, qui ajoute le
        # message avant d'appeler le serveur) : seul indicateur disponible de
        # ce dont "la personne parle" pour cette réponse précise.
        dernier_message_utilisateur = next(
            (h.get("text") or "" for h in reversed(history) if h.get("sender") == "user"), ""
        )
        # Langue de la référence injectée = langue de réponse demandée (voir
        # lang_nom ci-dessus), pas forcément le français - avec repli
        # automatique sur le français dans charger_texte_reference si la
        # traduction manque encore pour cette langue.
        lang_reference = data.get("lang") or "fr"

        sujets_anatomie = message_sujets_anatomie(dernier_message_utilisateur)
        anatomie_resume = (
            "\n\nRéférence anatomique (à consulter pour situer correctement les parties du "
            "corps mentionnées par l'utilisateur et répondre en conséquence, sans jamais la "
            "citer ni la mentionner explicitement) :\n"
            + "\n\n".join(charger_texte_reference(s, lang_reference) for s in sujets_anatomie)
            + "\n\n" + charger_texte_reference("anatomie_base", lang_reference)
        ) if sujets_anatomie else ""

        # Désactivé temporairement pour tester (voir MEUBLES_ACTIF plus haut)
        # - remettre à True pour réactiver l'injection des meubles.
        indices_meubles = message_pieces_meubles(dernier_message_utilisateur) if MEUBLES_ACTIF else []
        if indices_meubles:
            blocs_maison = decouper_texte_par_blocs(charger_texte_reference(REFERENCE_SUJET_MAISON, lang_reference))
            blocs_choisis = [blocs_maison[i] for i in indices_meubles if i < len(blocs_maison)]
        else:
            blocs_choisis = []
        meubles_resume = (
            "\n\nMeubles courants de la pièce évoquée (à consulter pour décrire le lieu de "
            "façon réaliste, sans jamais citer ni mentionner cette liste explicitement) :\n"
            + "\n\n".join(blocs_choisis)
        ) if blocs_choisis else ""

        system_prompt = (
            f"Tu incarnes le personnage {name}. "
            f"Histoire de fond : {histoire} "
            f"Bio : {bio} "
            + description_resume +
            f"Reste toujours dans ce personnage, réponds uniquement en {lang_nom}, "
            "et fais des réponses courtes (1 à 3 phrases). "
            "Pour décrire une action que tu fais ou une pensée intime, encadre-la entre "
            "deux astérisques simples, par exemple *je m'assois sur le canapé* ou "
            "*je me dis qu'il est charmant* - jamais pour du dialogue parlé, "
            "uniquement pour les actions/pensées. Encadre ABSOLUMENT CHAQUE action et "
            "CHAQUE pensée que tu écris, sans exception : n'en laisse jamais une seule "
            "en texte normal, même s'il y en a plusieurs dans la même réponse ou "
            "qu'elle vient en tout début de message. "
            "Distingue bien les deux, MÊME quand il y en a plusieurs dans le même "
            "message : un geste ou un mouvement physique est une action visible, tu "
            "peux y réagir directement. Un jugement, un sentiment ou une observation "
            "sur toi ou sur la situation est une pensée intime, non dite à voix haute : "
            "tu ne dois JAMAIS répondre directement à son contenu ni faire comme si tu "
            "l'avais entendue, seulement y réagir de façon indirecte et discrète "
            "(rougir, sourire, détourner le regard), jamais en y répondant par des mots. "
            "Exemple à imiter EXACTEMENT sur ce point : si l'utilisateur écrit "
            "\"*il s'assoit sur le canapé* Tu vas bien aujourd'hui ? *elle est "
            "vraiment jolie*\", tu réagis au fait qu'il s'assoit (action visible), tu "
            "réponds à \"Tu vas bien aujourd'hui ?\" (dialogue), et tu NE DIS RIEN sur "
            "le fait d'être jolie - tu peux seulement rougir ou sourire sans un mot à "
            "ce sujet, même si cette pensée est la dernière chose écrite dans le message."
            + profil_resume
            + etat_resume
            + anatomie_resume
            + meubles_resume +
            "\n\nÀ LA TOUTE FIN de ta réponse, sur une nouvelle ligne, ajoute "
            "obligatoirement un tag exactement dans ce format : " + TAG_FORMAT_INSTRUCTION +
            " en te basant sur ce que l'utilisateur vient de dire ET sur ta propre réponse. "
            "Ce tag est technique, il ne doit contenir que ces 4 champs."
        )

        messages = [{"role": "system", "content": system_prompt}]
        if salutation:
            messages.append({"role": "assistant", "content": salutation})
        for entry in history:
            role = "user" if entry.get("sender") == "user" else "assistant"
            text = entry.get("text") or ""
            if text:
                messages.append({"role": role, "content": text})

    try:
        # En mode "chat" normal, le modèle omet parfois tout dialogue et ne
        # sort que le tag technique : on retente jusqu'à avoir un vrai texte,
        # pour ne jamais afficher une bulle vide à l'utilisateur.
        script_attendu = LANG_SCRIPT_RE.get(data.get("lang"))
        # Les alphabets non-latins (surtout le chinois) ont un taux de raté
        # plus élevé avec ce petit modèle local : plus de tentatives pour eux.
        if mode == "etat_seul":
            tentatives_max = 1
        elif script_attendu:
            tentatives_max = 5
        else:
            tentatives_max = 3
        reply = ""
        etat_delta = None
        secours_reply, secours_delta, secours_score = "", None, -1.0  # meilleure réponse obtenue même si mauvais alphabet
        messages_tentative = messages
        for _ in range(tentatives_max):
            response = requests.post(
                OLLAMA_CHAT_URL,
                json={
                    "model": OLLAMA_MODEL,
                    "messages": messages_tentative,
                    "stream": False,
                    # Garde le modèle chargé en mémoire 30 min pour éviter de le
                    # recharger (~6-7s) à chaque message d'une conversation.
                    "keep_alive": "30m",
                    "options": {"num_predict": 220},
                },
                # Sur ce modèle local (qwen2.5:7b, CPU) : ~8,5 tokens/s en lecture
                # de prompt, moins de 3 tokens/s en génération - une réponse au
                # plafond de num_predict (220 tokens) peut à elle seule approcher
                # 80s. Un message qui déclenche un sujet anatomique (voir
                # message_sujets_anatomie/charger_texte_reference plus haut,
                # texte intégral non compacté par choix assumé) ajoute son propre
                # temps de lecture, mesuré jusqu'à ~140s pour le sujet "tête"
                # seul (le plus petit des 3) sur une conversation encore
                # "froide" - 300s laisse de la marge pour le pire cas (sujet
                # "génital", plus gros) sans jamais s'approcher de la limite.
                timeout=300,
            )
            response.raise_for_status()
            reply_brute = response.json().get("message", {}).get("content", "").strip()
            if not reply_brute:
                continue
            reply, etat_delta = extraire_et_retirer_tag_etat(reply_brute)
            if not reply:
                # Le modèle n'a sorti que le tag technique, sans aucune
                # réplique de dialogue : on renforce la consigne pour les
                # tentatives suivantes plutôt que de retenter à l'identique
                # (sinon il reproduit souvent le même raté plusieurs fois de suite).
                if mode != "etat_seul" and messages_tentative is messages:
                    messages_tentative = messages + [{
                        "role": "system",
                        "content": (
                            "Rappel important : ta réponse précédente ne contenait AUCUNE "
                            "réplique de dialogue, juste le tag technique. Tu dois "
                            "OBLIGATOIREMENT écrire d'abord une ou plusieurs phrases de "
                            "dialogue en tant que personnage, et ajouter le tag seulement "
                            "après, à la toute fin."
                        ),
                    }]
                continue
            score = ratio_script(reply, script_attendu) if script_attendu else 1.0
            if score > secours_score:
                secours_reply, secours_delta, secours_score = reply, etat_delta, score
            if mode == "etat_seul" or not script_attendu or score >= 0.5:
                break
            reply = ""

        if not reply and secours_reply:
            # Aucune tentative n'a produit le bon alphabet : on affiche quand
            # même la meilleure réponse obtenue plutôt qu'une erreur.
            reply, etat_delta = secours_reply, secours_delta

        if not reply and mode != "etat_seul":
            return jsonify({"error": "Réponse vide"}), 502

         # Compte ce message dans le compteur du personnage, seulement après une réponse réussie
        # et seulement en vrai chat (pas pour l'analyse d'état seule).
        if mode != "etat_seul":
            incrementer_nb_messages(data.get("creationId"))

            return jsonify({"reply": reply, "etatDelta": etat_delta or etat_delta_vide()})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    # Stable Diffusion (lourd) n'est chargé que si on l'utilise.
    if GENERATEUR == "stable_diffusion":
        print("Chargement du modèle...")
        load_pipeline()
        print("Modèle prêt. Démarrage du serveur...")
    else:
        print("Générateur Pollinations : pas de modèle à charger. Démarrage du serveur...")
    # Un seul port ne peut pas parler HTTP et HTTPS à la fois (TLS n'est pas
    # multiplexable comme ça) : le port 5001 sert du HTTPS (certificat local
    # mkcert, le même que celui utilisé par le serveur de dev Vite) pour le
    # navigateur PC et l'appli Electron - qui font tous les deux confiance à
    # ce certificat, approuvé au niveau du système sur cette machine. Le
    # port 5000, en HTTP simple, sert uniquement l'app Android (voir
    # src/config.ts) : son WebView n'approuve pas ce certificat auto-signé.
    cert_dir = os.path.expanduser("~/Documents/Realornot")
    ssl_context = (
        os.path.join(cert_dir, "192.168.1.44+2.pem"),
        os.path.join(cert_dir, "192.168.1.44+2-key.pem"),
    )
    threading.Thread(
        target=lambda: app.run(host="0.0.0.0", port=5000, threaded=True),
        daemon=True,
    ).start()
    app.run(host="0.0.0.0", port=5001, threaded=True, ssl_context=ssl_context)
