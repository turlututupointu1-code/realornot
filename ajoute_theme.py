#!/usr/bin/env python3
"""
add_theme.py - Termine l'installation d'un nouveau thème.

Pré-requis AVANT de lancer ce script :
  1. src/images/<nom>/ existe déjà et contient les images du thème
  2. src/styles/<nom>.scss existe déjà (copie d'un thème existant, avec son
     sélecteur .theme-<nom> et $dossier déjà renommés)

Ce script fait le reste automatiquement :
  - ajoute l'import du .scss dans src/App.tsx
  - ajoute l'entrée dans le registre THEMES de src/context/theme.ts
    (couleur de statut copiée du thème source, à ajuster ensuite)
  - ajoute une entrée provisoire (à traduire) dans les 10 langues de
    src/i18n/translations.ts

Usage :
    python3 add_theme.py <nom-nouveau-theme> [nom-theme-source]

Exemple :
    python3 add_theme.py gelee gothique
    (gothique est utilisé par défaut si non précisé)

À lancer depuis la racine du projet (là où se trouve le dossier src/).
"""
import re
import sys
from pathlib import Path

def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    nouveau = sys.argv[1]
    source = sys.argv[2] if len(sys.argv) > 2 else 'gothique'
    nom_affiche = nouveau[0].upper() + nouveau[1:]

    racine = Path('.')
    scss_file = racine / 'src' / 'styles' / f'{nouveau}.scss'
    images_dir = racine / 'src' / 'images' / nouveau
    app_file = racine / 'src' / 'App.tsx'
    theme_file = racine / 'src' / 'context' / 'theme.ts'
    trad_file = racine / 'src' / 'i18n' / 'translations.ts'

    # --- Vérifications préalables ---
    if not scss_file.exists():
        print(f"❌ {scss_file} introuvable - créez-le d'abord (copie d'un thème existant).")
        sys.exit(1)
    if not images_dir.exists():
        print(f"⚠️  {images_dir} introuvable - les images ne se chargeront pas tant qu'il n'existe pas.")

    # --- 1. Import dans App.tsx ---
    if app_file.exists():
        contenu = app_file.read_text(encoding='utf-8')
        ligne_import = f"import './styles/{nouveau}.scss';"
        ligne_source = f"import './styles/{source}.scss';"
        if ligne_import in contenu:
            print(f"✓ Import déjà présent dans {app_file}")
        elif ligne_source in contenu:
            contenu = contenu.replace(ligne_source, f"{ligne_source}\n{ligne_import}", 1)
            app_file.write_text(contenu, encoding='utf-8')
            print(f"✓ Import ajouté dans {app_file} (après celui de {source})")
        else:
            print(f"⚠️  Import de {source} introuvable dans {app_file} - ajoutez à la main : {ligne_import}")
    else:
        print(f"⚠️  {app_file} introuvable - ajoutez à la main : import './styles/{nouveau}.scss';")

    # --- 2. Entrée dans THEMES (context/theme.ts) ---
    if theme_file.exists():
        contenu = theme_file.read_text(encoding='utf-8')
        if re.search(rf'^\s*{re.escape(nouveau)}:', contenu, re.MULTILINE):
            print(f"✓ Entrée déjà présente dans {theme_file}")
        else:
            m = re.search(rf'^(\s*){re.escape(source)}:\s*(\{{[^}}]*\}}),?', contenu, re.MULTILINE)
            if m:
                indentation, valeurs = m.group(1), m.group(2)
                nouvelle_ligne = f"{indentation}{nouveau}: {valeurs}, // TODO: ajuster couleur (copié de {source})"
                contenu = contenu[:m.end()] + '\n' + nouvelle_ligne + contenu[m.end():]
                theme_file.write_text(contenu, encoding='utf-8')
                print(f"✓ Entrée ajoutée dans THEMES ({theme_file}) - couleur copiée de {source}, à ajuster")
            else:
                print(f"⚠️  Thème source '{source}' introuvable dans THEMES ({theme_file}) - ajoutez l'entrée à la main.")
    else:
        print(f"⚠️  {theme_file} introuvable - ajoutez l'entrée à la main dans THEMES.")

    # --- 3. Entrée provisoire dans translations.ts (10 langues) ---
    if trad_file.exists():
        contenu = trad_file.read_text(encoding='utf-8')
        compteur = 0
        def remplacer_ligne(m):
            nonlocal compteur
            ligne = m.group(0)
            if f"'{nom_affiche}'" in ligne or f'"{nom_affiche}"' in ligne:
                return ligne  # déjà présent dans cette langue
            compteur += 1
            # Insère juste avant le crochet fermant du tableau
            return re.sub(r'\]\s*,?\s*$', f", '{nom_affiche}' /* TODO: traduire */]", ligne.rstrip()) + '\n'
        contenu_modifie = re.sub(r'^\s*themes:\s*\[.*\],?\s*$', remplacer_ligne, contenu, flags=re.MULTILINE)
        if compteur > 0:
            trad_file.write_text(contenu_modifie, encoding='utf-8')
            print(f"✓ {compteur} langue(s) mises à jour dans {trad_file} (à traduire : '{nom_affiche}')")
        else:
            print(f"✓ '{nom_affiche}' déjà présent dans toutes les langues de {trad_file}")
    else:
        print(f"⚠️  {trad_file} introuvable - ajoutez '{nom_affiche}' à la main dans les 10 langues.")

    print()
    print("Terminé. Reste à faire à la main :")
    print(f"  - Ajuster la couleur de statut du thème '{nouveau}' dans {theme_file}")
    print(f"  - Traduire '{nom_affiche}' dans les 10 langues de {trad_file}")
    print(f"  - Adapter les couleurs/textes de {scss_file}")

if __name__ == '__main__':
    main()
