#!/bin/bash
# couleurs-vignettes.sh - règle les couleurs des vignettes de l'accueil (bordure, dégradé sous la photo, nom, description, ombre)
# pour les 6 thèmes pas encore faits : gelee, laiton, relief-doux, onde-vapeur, verre-translucide, vert-encapsule.
# À lancer dans src/styles :  cd ~/Documents/Realornot/src/styles && bash couleurs-vignettes.sh
# Il ne change que la valeur des lignes existantes (les commentaires restent). Relance possible. Ajuste ensuite à la main.
regler() { # fichier variable valeur
    if grep -q -E "^ *$2:" "$1"; then
        sed -i -E "s|^( *$2:) *[^;]*;|\1 $3;|" "$1"
    else
        echo "⚠️  $1 : $2 introuvable"
    fi
}
theme() { # nom bordure fond(sans alpha) titre bio ombre
    local f="$1.scss"
    [ -f "$f" ] || { echo "⚠️  $f introuvable"; return; }
    regler "$f" --creation-card-border "$2"
    regler "$f" --creation-card-gradient "linear-gradient(to bottom, #${3}00, #${3}F2)"
    regler "$f" --creation-card-title-color "$4"
    regler "$f" --creation-card-bio-color "$5"
    regler "$f" --creation-card-shadow "$6"
    echo "✅ $f"
}
#     thème               bordure    fond-dégradé  nom        description  ombre
theme gelee               '#B9A7FF'  2B2358        '#FFFFFF'  '#E6DFFF'    '0 2px 8px #B9A7FF55'
theme laiton              '#D6B46A'  3A2A16        '#F3E3BE'  '#D9C79D'    '0 2px 8px #00000066'
theme relief-doux         '#E6EAF2'  5F6B80        '#F6F8FC'  '#DDE3EE'    '0 2px 8px #00000040'
theme onde-vapeur         '#8FD8FF'  0B2A5A        '#EAF7FF'  '#BFE3FF'    '0 2px 8px #00000066'
theme verre-translucide   '#9FC3FF'  101A33        '#EAF2FF'  '#BCD0F2'    '0 2px 8px #00000066'
theme vert-encapsule      '#A2D7C5'  0C3B2A        '#E6F6EF'  '#BFE3D4'    '0 2px 8px #00000066'
