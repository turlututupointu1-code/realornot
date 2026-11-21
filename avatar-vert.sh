#!/bin/bash
# 1) Avatar de la discussion : mêmes classes (donc mêmes réglages de position) que sur « Moi ».
# 2) vert-encapsule : « Personnage non réel » en blanc.
# Idempotent. À lancer depuis la racine du projet.
f=src/pages/PersonnagePage.tsx
sed -i 's/personnage-user-avatar-banner-btn"/profil-conversation-avatar-btn"/; s/personnage-user-avatar-banner-img"/profil-conversation-avatar-img"/' "$f"
t=src/styles/vert-encapsule.scss
sed -i '/--titre-couleur:/d' "$t"
sed -i '/--titre-ombre:/a\    --titre-couleur: #ffffff;' "$t"
grep -q -- '--titre-couleur' "$t" || echo "⚠️ vert-encapsule : ancre --titre-ombre introuvable"
grep -c 'profil-conversation-avatar-btn' "$f"
