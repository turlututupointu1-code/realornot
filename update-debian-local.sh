#!/bin/bash
# update-debian-local.sh
# Reconstruit RealOrNot (web + Electron) et installe le .deb résultant
# directement sur ce PC, pour tester "en utilisateur lambda" sans passer
# par le site de téléchargement.

set -e  # arrête le script à la première erreur, plutôt que de continuer
        # et d'installer un .deb obsolète/incomplet si une étape échoue.

PROJECT_ROOT="/home/philippe/Documents/Realornot"
ELECTRON_DIR="$PROJECT_ROOT/electron"

cd "$PROJECT_ROOT"
# Charge Node 22 (nvm) : Capacitor demande Node 22 ou plus, et un terminal normal peut avoir un Node plus ancien.
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 22 >/dev/null 2>&1 || nvm use --lts >/dev/null 2>&1 || true
echo "Node utilisé : $(node --version)"
# SANS_BUILD=1 : le build du site a déjà été fait par realornot.sh (choix d), on ne le refait pas.
if [ -z "$SANS_BUILD" ]; then
    echo "=== 1/4 : build du site (Vite) ==="
    npm run build
else
    echo "=== 1/4 : build du site déjà fait (SANS_BUILD) ==="
fi

echo "=== 2/4 : synchronisation vers Electron ==="
npx cap sync electron

echo "=== 3/4 : build du paquet .deb (Electron) ==="
cd "$ELECTRON_DIR"
# Compile le code Electron (src/*.ts) : sans ça, les changements de setup.ts ne sont pas pris en compte.
npx tsc
npx electron-builder build --linux deb -c ./electron-builder.config.json

# Ferme l'application si elle tourne : sinon l'ancienne fenêtre reste ouverte avec l'ancien code.
pkill -f /opt/RealOrNot/realornot || true
echo "=== 4/4 : installation du paquet ==="
DEB_FILE=$(find "$ELECTRON_DIR/dist" -maxdepth 1 -name "*.deb" -print -quit)
if [ -z "$DEB_FILE" ]; then
    echo "Aucun fichier .deb trouvé dans $ELECTRON_DIR/dist - build probablement échoué."
    exit 1
fi
echo "Installation de : $DEB_FILE"
# --reinstall : remplace l'application même si la version du paquet n'a pas changé (1.0.0), sinon apt répond "déjà à jour" et ne fait rien.
sudo apt install --reinstall -y "$DEB_FILE"

echo "Terminé. Lance RealOrNot depuis le menu applications comme un utilisateur normal."
