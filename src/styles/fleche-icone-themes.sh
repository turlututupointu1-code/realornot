#!/bin/bash
# fleche-icone-themes.sh - ajoute --fleche-icone-height / --fleche-icone-width dans les 10 thèmes (src/styles). Relance possible.
# À lancer dans src/styles :  cd ~/Documents/Realornot/src/styles && bash fleche-icone-themes.sh
for t in dentelle cyberpunk gothique givre gelee verre-translucide laiton relief-doux onde-vapeur vert-encapsule; do
    f="$t.scss"
    [ -f "$f" ] || { echo "⚠️  $f introuvable"; continue; }
    grep -q -- "--fleche-icone-height" "$f" && { echo "⏭️  $f : déjà fait"; continue; }
    grep -q -- "--pagination-arrow-width" "$f" || { echo "⚠️  $f : ligne --pagination-arrow-width introuvable, rien changé"; continue; }
    sed -i -E "0,/^( *)--pagination-arrow-width:.*\$/ s||&\n\1--fleche-icone-height: 14px; // flèches des lignes « Vos créations », « Vos discussions »… : hauteur\n\1--fleche-icone-width: 56px; // longueur|" "$f"
    echo "✅ $f"
done
