#!/bin/bash
# couleurs-capsule.sh - ajoute dans chaque thème les 3 couleurs de la capsule de pagination (fond, bordure, texte).
# À lancer dans src/styles :  cd ~/Documents/Realornot/src/styles && bash couleurs-capsule.sh
# Ne fait rien pour un thème qui a déjà --pagination-capsule-bg (relance sans risque). Ensuite, ajuste chaque couleur à la main si besoin.
ajouter() {
    local f="$1.scss" bg="$2" bord="$3" txt="$4"
    [ -f "$f" ] || { echo "⚠️  $f introuvable"; return; }
    if grep -q -- "--pagination-capsule-bg" "$f"; then echo "⏭️  $f : déjà fait"; return; fi
    if ! grep -q -- "--pagination-arrow-width" "$f"; then echo "⚠️  $f : ligne --pagination-arrow-width introuvable, rien changé"; return; fi
    sed -i -E "0,/^( *)--pagination-arrow-width:.*\$/ s||&\n\1--pagination-capsule-bg: $bg; // fond de la capsule de pagination (flèches + « Page x / y »)\n\1--pagination-capsule-border-color: $bord; // bordure de la capsule\n\1--pagination-capsule-text: $txt; // texte « Page x / y »|" "$f"
    echo "✅ $f"
}
#        thème               fond        bordure     texte
ajouter dentelle          '#5B4631E0' '#C4A876'  '#F3E9D6'
ajouter cyberpunk         '#0A0E1AEB' '#1F8FFF'  '#9FD8FF'
ajouter gelee             '#2B2358DB' '#B9A7FF'  '#F1ECFF'
ajouter givre             '#1B3550DB' '#BFE6FF'  '#EAF6FF'
ajouter gothique          '#120C0CF2' '#8E2A22'  '#E7C9B8'
ajouter laiton            '#3A2A16E0' '#D6B46A'  '#F3E3BE'
ajouter onde-vapeur       '#0B2A5ADB' '#8FD8FF'  '#EAF7FF'
ajouter relief-doux       '#5F6B80DB' '#E6EAF2'  '#F6F8FC'
ajouter verre-translucide '#101A33DB' '#9FC3FF'  '#EAF2FF'
ajouter vert-encapsule    '#0C3B2ADD' '#A2D7C5'  '#E6F6EF'
