#!/bin/bash
# Supprime l'ancien menu contextuel (code mort) : son bloc dans _16-popups.scss et l'ancien fichier orphelin.
# À lancer depuis la racine du projet (le dossier qui contient src). Idempotent.
f=src/styles/base/_16-popups.scss
sed -i '/^\/\/ Menu contextuel et confirmation/,$d' "$f"
[ "$(tail -n1 "$f" | cut -c1-6)" = "// ===" ] && sed -i '$d' "$f"
rm -f src/styles/1personnage-menu-contextuel.css
grep -rn "menu-contextuel" src || echo "ok : plus aucune trace"
