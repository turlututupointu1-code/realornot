#!/bin/bash
cd "$(dirname "$0")"

# Charge nvm explicitement (nécessaire car ce script tourne hors shell interactif)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 22 2>/dev/null || nvm use --lts

echo "Node utilisé : $(node --version)"

# SANS_BUILD=1 : le build a déjà été fait par realornot.sh (choix d), on ne le refait pas.
if [ -z "$SANS_BUILD" ]; then
  echo "=== Build du projet ==="
  npm run build
  if [ $? -ne 0 ]; then
    echo "❌ Le build a échoué, arrêt."
    read -p "Appuie sur Entrée pour fermer..."
    exit 1
  fi
else
  echo "=== Build déjà fait (SANS_BUILD) ==="
fi

echo "=== Sync Android ==="
npx cap sync android
if [ $? -ne 0 ]; then
  echo "❌ Le sync Capacitor a échoué, arrêt."
  read -p "Appuie sur Entrée pour fermer..."
  exit 1
fi

echo "=== Build APK debug ==="
cd android
./gradlew assembleDebug
if [ $? -ne 0 ]; then
  echo "❌ Le build APK a échoué."
  read -p "Appuie sur Entrée pour fermer..."
  exit 1
fi

echo "=== Détection des appareils ==="
DEVICES=$(adb devices | tail -n +2 | grep -w "device" | awk '{print $1}')
if [ -z "$DEVICES" ]; then
  echo "❌ Aucun appareil Android détecté (adb devices ne renvoie rien de prêt)."
  echo "   Branche le téléphone en USB ou reconnecte le débogage sans fil, puis relance."
  read -p "Appuie sur Entrée pour fermer..."
  exit 1
fi
echo "Appareil(s) détecté(s) :"
echo "$DEVICES"

echo "=== Installation sur le(s) téléphone(s) ==="
ECHEC=0
while IFS= read -r DEVICE; do
  echo "--- $DEVICE ---"
  adb -s "$DEVICE" install -r app/build/outputs/apk/debug/app-debug.apk
  if [ $? -ne 0 ]; then
    echo "❌ L'installation a échoué sur $DEVICE."
    ECHEC=1
  fi
done <<< "$DEVICES"

if [ "$ECHEC" -ne 0 ]; then
  read -p "Appuie sur Entrée pour fermer..."
  exit 1
fi

echo "✅ Terminé ! L'app est installée sur tous les téléphones détectés."
read -p "Appuie sur Entrée pour fermer..."
