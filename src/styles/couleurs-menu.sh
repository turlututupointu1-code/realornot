#!/bin/bash
# couleurs-menu.sh - règle les couleurs du menu burger (fond, bordure, survol, texte) pour les 6 thèmes pas encore faits :
# gelee, laiton, relief-doux, onde-vapeur, verre-translucide, vert-encapsule.
# À lancer dans src/styles :  cd ~/Documents/Realornot/src/styles && bash couleurs-menu.sh
# Il ne change que la valeur des lignes existantes (les commentaires restent). Relance possible. Ajuste ensuite à la main.
regler() { # fichier variable valeur
    if grep -q -E "^ *$2:" "$1"; then
        sed -i -E "s|^( *$2:) *[^;]*;|\1 $3;|" "$1"
    else
        echo "⚠️  $1 : $2 introuvable"
    fi
}
theme() { # nom fond bordure survol texte
    local f="$1.scss"
    [ -f "$f" ] || { echo "⚠️  $f introuvable"; return; }
    regler "$f" --burger-bg "$2"
    regler "$f" --burger-border "$3"
    regler "$f" --burger-hover "$4"
    regler "$f" --burger-text "$5"
    echo "✅ $f"
}
#     thème               fond       bordure    survol     texte
theme gelee               '#2B2358'  '#B9A7FF'  '#3A3175'  '#F1ECFF'
theme laiton              '#3A2A16'  '#D6B46A'  '#4E3A1F'  '#F3E3BE'
theme relief-doux         '#5F6B80'  '#E6EAF2'  '#74819A'  '#F6F8FC'
theme onde-vapeur         '#0B2A5A'  '#8FD8FF'  '#12408A'  '#EAF7FF'
theme verre-translucide   '#101A33'  '#9FC3FF'  '#1B2B52'  '#EAF2FF'
theme vert-encapsule      '#0C3B2A'  '#A2D7C5'  '#155239'  '#E6F6EF'
