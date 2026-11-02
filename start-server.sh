#!/bin/bash
# start-server.sh
# Lance le serveur Stable Diffusion (génération de photos IA + stockage des
# personnages) - écoute sur le port 5000 (HTTP, pour l'app Android) et 5001
# (HTTPS, pour le navigateur/Electron sur ce PC). Voir src/config.ts pour le
# détail des deux ports.

cd "$(dirname "$0")/stable-diffusion" || exit 1
#source venv/bin/activate
#python3 server.py
source venv/bin/activate

# Quand on ferme l'onglet ou qu'on fait Ctrl+C, arrête aussi le serveur Python et tout ce qu'il a lancé.
trap 'kill 0' EXIT HUP INT TERM

python3 server.py &
wait
echo
echo "Le serveur s'est arrêté (voir le message au-dessus)."
read -p "Appuie sur Entrée pour fermer..."
