#!/usr/bin/env python3
# reduire-images.py : réduit les images de Realornot et les passe en WebP.
# 1) Copie les originaux dans "images-originaux" (à côté de src, jamais écrasés).
# 2) Réduit chaque image à la largeur proposée (même ratio, jamais agrandie).
# 3) Enregistre en .webp (transparence gardée) et enlève le .png de src/images.
# Les .jpg ne sont pas touchés.
# Test sans rien changer :  python3 reduire-images.py --test
import sys
from pathlib import Path
from PIL import Image

RACINE = Path(__file__).resolve().parent          # dossier Realornot
IMAGES = RACINE / "src" / "images"
SAUVEGARDE = RACINE / "images-originaux"
TEST = "--test" in sys.argv
QUALITE = 90

# Dossiers à traiter (images sauvegarde = ignoré)
THEMES = ["cyberpunk", "dentelle", "frosted", "gelee", "glassmorphism",
          "gothique", "laiton", "neumorph", "vaporwave", "vert-encapsule", "vinyle"]

# Largeur voulue par nom d'image (une image absente de la liste garde sa taille)
LARGEURS = {
    "appareilphoto": 256, "burger": 256, "creer": 256, "messages": 256,
    "palette": 256, "drapeau": 256, "cadenas": 256, "compatibilite": 256,
    "profil-femme": 256, "profil-homme": 256, "supprimer": 256,
    "fleche": 256, "recherche": 860, "titre": 860, "silhouette": 720,
    "smartphone": 240, "repertoire": 240, "flechebas": 64, "flechehaut": 64,
}

def traiter(dossier: Path, largeurs: dict):
    """Traite tous les .png d'un dossier : sauvegarde, réduction, WebP."""
    avant = apres = 0
    for png in sorted(dossier.glob("*.png")):
        copie = SAUVEGARDE / dossier.name / png.name
        with Image.open(png) as im:
            im.load()
            w, h = im.size
            cible = largeurs.get(png.stem)
            if isinstance(largeurs, dict) and "*" in largeurs:
                cible = largeurs["*"]
            if cible and cible < w:                # on ne fait que réduire
                im = im.resize((cible, round(h * cible / w)), Image.LANCZOS)
            sortie = png.with_suffix(".webp")
            if not TEST:
                copie.parent.mkdir(parents=True, exist_ok=True)
                if not copie.exists():
                    copie.write_bytes(png.read_bytes())
                im.save(sortie, "WEBP", quality=QUALITE, method=6)
                taille_apres = sortie.stat().st_size
                png.unlink()
            else:
                taille_apres = 0
            avant += copie.stat().st_size if copie.exists() else png.stat().st_size
            apres += taille_apres
            print(f"{dossier.name}/{png.name}: {w}x{h} -> {im.size[0]}x{im.size[1]}")
    return avant, apres

total_avant = total_apres = 0
for nom in THEMES:
    d = IMAGES / nom
    if d.is_dir():
        a, b = traiter(d, LARGEURS)
        total_avant += a; total_apres += b
    else:
        print(f"(dossier absent : {nom})")
for nom, reglage in (("styles", {"*": 480}), ("avatars", {})):
    d = IMAGES / nom
    if d.is_dir():
        a, b = traiter(d, reglage)
        total_avant += a; total_apres += b

if TEST:
    print("\nTEST : rien n'a été modifié.")
else:
    print(f"\nAvant : {total_avant/1e6:.1f} Mo   Après : {total_apres/1e6:.1f} Mo")
    print("Originaux gardés dans :", SAUVEGARDE)
