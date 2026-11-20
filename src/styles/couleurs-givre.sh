#!/bin/bash
# couleurs-givre.sh - règle givre.scss : couleurs du menu burger et des vignettes de l'accueil (bleu glace, comme la capsule de pagination).
# À lancer dans src/styles :  cd ~/Documents/Realornot/src/styles && bash couleurs-givre.sh
# Ne change que la valeur des lignes existantes (les commentaires restent). Relance possible.
F="givre.scss"
[ -f "$F" ] || { echo "⚠️  $F introuvable (lance le script dans src/styles)"; exit 1; }
regler() { # variable valeur
    if grep -q -E "^ *$1:" "$F"; then
        sed -i -E "s|^( *$1:) *[^;]*;|\1 $2;|" "$F"
    else
        echo "⚠️  $1 introuvable"
    fi
}
# Menu burger
regler --burger-bg        '#1B3550'
regler --burger-border    '#BFE6FF'
regler --burger-hover     '#274A6B'
regler --burger-text      '#EAF6FF'
# Vignettes de l'accueil
regler --creation-card-border      '#BFE6FF'
regler --creation-card-gradient    'linear-gradient(to bottom, #1B355000, #1B3550F2)'
regler --creation-card-title-color '#EAF6FF'
regler --creation-card-bio-color   '#C5DCEE'
regler --creation-card-shadow      '0 2px 8px #00000066'
echo "✅ $F"
