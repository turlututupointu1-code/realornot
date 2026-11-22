#!/bin/bash
# Cadre image autour des bulles (bulle.webp, étiré selon la taille du texte). Opt-in par thème.
# Usage : bash bulles-cadre.sh dentelle      (nom du fichier thème, sans .scss ; défaut : dentelle)
# Avant : copier bulle.webp dans src/images/<dossier du thème>/ . Idempotent.
t=${1:-dentelle}
f=src/styles/base/_17-chat-bulles.scss
sed -i '/Bulles : cadre image/,$d' "$f"
cat >> "$f" <<'SCSS'
// Bulles : cadre image. Un thème l'active en définissant --img-bulle (+ --bulle-cadre, --bulle-padding, --bulle-rayon, --bulle-volutes: none) ;
// sans ces variables, les bulles restent comme avant (trait + volutes). Découpe de l'image : coins 20 % / 11,5 %, le milieu s'étire.
.create-box.personnage-bubble.personnage-salutation-box,
.create-box.personnage-bubble.personnage-user-box {
    border-width: var(--bulle-cadre, var(--border-width));
    border-radius: var(--bulle-rayon, var(--radius-small));
    border-image-source: var(--img-bulle, none);
    border-image-slice: 20% 11.5%;
    border-image-width: var(--bulle-cadre, 1);
    border-image-repeat: stretch;
    padding: var(--bulle-padding, 16px 18px);
}
.create-box.personnage-bubble.personnage-salutation-box::before,
.create-box.personnage-bubble.personnage-salutation-box::after,
.create-box.personnage-bubble.personnage-user-box::before,
.create-box.personnage-bubble.personnage-user-box::after {
    content: var(--bulle-volutes, '');
}
SCSS
s=src/styles/$t.scss
sed -i '/--img-bulle:/d; /--bulle-cadre:/d; /--bulle-padding:/d; /--bulle-rayon:/d; /--bulle-volutes:/d' "$s"
sed -i "/--img-btn-continuer:/a\\    --img-bulle: url('../images/#{\$dossier}/bulle.webp');\n    --bulle-cadre: 24px;\n    --bulle-padding: 6px 8px;\n    --bulle-rayon: 22px;\n    --bulle-volutes: none;" "$s"
grep -q -- '--img-bulle' "$s" || echo "⚠️ $s : ancre --img-btn-continuer introuvable"
echo "ok ($t) — pense à mettre bulle.webp dans src/images/<dossier>/"
