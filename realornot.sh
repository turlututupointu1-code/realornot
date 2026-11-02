#!/bin/bash
# realornot.sh - un seul point d'entrée pour tout lancer.
# Sans argument : affiche un menu. Avec un argument (1 à 7, x, a, b, c ou d) : lance directement l'action.
#   1 serveur Stable Diffusion        a tout pour le navigateur (serveur + Vite, 2 onglets)
#   2 Vite (navigateur)               b tout pour le téléphone  (serveur + adb Wi-Fi + mise à jour, 2 onglets)
#   3 téléphone : connexion Wi-Fi adb c tout pour l'application du PC (serveur + mise à jour + lancement, 2 onglets)
#   4 téléphone : mettre à jour       x arrêter le serveur Stable Diffusion
#   5 PC : mettre à jour l'application installée
#   6 PC : lancer l'application installée
#   7 page de téléchargement : ouvrir dans le navigateur (démarre le serveur si besoin)
#   d effectuer de 1 à 7 en parallèle : un seul build, puis le téléphone et le PC en même temps (nécessite SANS_BUILD dans les deux scripts)

ROOT="/home/philippe/Documents/Realornot"
SELF="$(readlink -f "$0")"
ADB_WIFI="/home/philippe/scripts/adb-wifi-connect.sh"
APP_PC="/opt/RealOrNot/realornot"
URL_SERVEUR="https://localhost:5001/creations"
URL_VITE="https://localhost:5173"
# Fichiers qui signalent la fin du build commun (choix d).
MARQUEUR_OK="/tmp/realornot-build.ok"
MARQUEUR_KO="/tmp/realornot-build.ko"

# Option 7 : page de téléchargement (stable-diffusion/static_pages/telecharger.html), servie par le serveur Stable Diffusion
# et qui lit elle-même la liste des versions (/app/releases) : elle n'a donc rien à "mettre à jour", il suffit de l'ouvrir.
#   PAGE_MAJ_CMD : commande à lancer avant l'ouverture (vide : aucune).
#   PAGE_URL     : adresse ouverte dans le navigateur.
PAGE_MAJ_CMD=""
PAGE_URL="https://localhost:5001/telecharger"

# --- Outils ---------------------------------------------------------------

# Ouvre UNE fenêtre Konsole avec plusieurs onglets. Arguments : "Titre|commande" (un par onglet).
# Konsole lit la liste des onglets dans un fichier temporaire (option --tabs-from-file) : aucun texte n'est envoyé
# dans un terminal existant, donc pas d'avertissement de sécurité.
ouvrir_onglets() {
    local f; f=$(mktemp /tmp/realornot-onglets.XXXXXX)
    local t
    for t in "$@"; do
        printf 'title: %s;; command: %s\n' "${t%%|*}" "${t#*|}" >> "$f"
    done
    konsole --tabs-from-file "$f" >/dev/null 2>&1 &
    ( sleep 10; rm -f "$f" ) >/dev/null 2>&1 &
}

# curl renvoie 0 dès que le serveur répond (même par une erreur HTTP), et une erreur s'il ne répond pas du tout.
repond() { curl -ks --max-time 3 -o /dev/null "$1"; }

etat() { if repond "$1"; then echo "✅ en marche"; else echo "❌ arrêté"; fi; }

attendre_serveur() {
    echo -n "Attente du serveur (jusqu'à 3 minutes)"
    local i
    for i in $(seq 1 90); do
        if repond "$URL_SERVEUR"; then echo; echo "✅ Serveur prêt."; return 0; fi
        echo -n "."; sleep 2
    done
    echo; echo "⚠️  Le serveur ne répond toujours pas : regarde l'onglet « Serveur SD »."
    return 1
}

# Charge Node (nvm), comme sync-android.sh : un onglet lancé par Konsole n'est pas un shell interactif.
charger_node() {
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
    nvm use 22 >/dev/null 2>&1 || nvm use --lts >/dev/null 2>&1
}

# Build du site, une seule fois, pour le téléphone ET le PC (choix d). Crée un fichier-signal à la fin.
construire_une_fois() {
    charger_node
    cd "$ROOT" || return 1
    echo "Node utilisé : $(node --version)"
    echo "=== Build du projet (une seule fois pour le téléphone et le PC) ==="
    if npm run build; then
        touch "$MARQUEUR_OK"; echo "✅ Build terminé."; return 0
    else
        touch "$MARQUEUR_KO"; echo "❌ Le build a échoué : le téléphone et le PC ne seront pas mis à jour."; return 1
    fi
}

attendre_build() {
    echo -n "Attente de la fin du build"
    while [ ! -e "$MARQUEUR_OK" ] && [ ! -e "$MARQUEUR_KO" ]; do echo -n "."; sleep 2; done
    echo
    [ -e "$MARQUEUR_OK" ] || { echo "❌ Le build a échoué : étape annulée."; return 1; }
}

# Le mode rapide n'est possible que si les deux scripts savent sauter leur build (variable SANS_BUILD).
scripts_sans_build() {
    grep -q SANS_BUILD "$ROOT/sync-android.sh" && grep -q SANS_BUILD "$ROOT/update-debian-local.sh"
}

# --- Actions --------------------------------------------------------------

lancer_serveur() {
    if repond "$URL_SERVEUR"; then
        echo "Serveur Stable Diffusion : déjà en marche."
        return 0
    fi
    echo "Lancement du serveur Stable Diffusion..."
    ouvrir_onglets "Serveur SD|$ROOT/start-server.sh"
    attendre_serveur
}

lancer_vite() {
    if repond "$URL_VITE"; then
        echo "Vite : déjà en marche ($URL_VITE)."
        return 0
    fi
    echo "Lancement de Vite..."
    ouvrir_onglets "Vite|$ROOT/start-vite.sh"
    echo "Ouvre $URL_VITE dans le navigateur (quelques secondes de démarrage)."
}

arreter_serveur() {
    local pids
    pids=$(ss -ltnp 2>/dev/null | grep -E ':(5000|5001)\b' | grep -o 'pid=[0-9]*' | cut -d= -f2 | sort -u)
    if [ -z "$pids" ]; then echo "Le serveur n'est pas en marche."; return 0; fi
    echo "Arrêt du serveur (processus : $pids)..."
    kill $pids
    sleep 3
    if ss -ltn | grep -qE ':(5000|5001)\b'; then
        echo "Il tourne encore : arrêt forcé."
        kill -9 $pids
    fi
    echo "Serveur arrêté."
}

adb_wifi()        { "$ADB_WIFI"; }
maj_telephone()   { "$ROOT/sync-android.sh"; }
maj_pc()          { charger_node; "$ROOT/update-debian-local.sh"; }
# Ferme l'ancienne instance avant de relancer, sinon on retrouve la version déjà ouverte.

lancer_app_pc() {
    # Ferme l'ancienne instance seulement quand on relance l'application (option 6, ou après une mise à jour).
    pkill -f "$APP_PC" 2>/dev/null; sleep 1
    echo "Lancement de l'application du PC..."
    nohup "$APP_PC" >/dev/null 2>&1 &
}
maj_page() {
    if [ -z "$PAGE_MAJ_CMD" ] && [ -z "$PAGE_URL" ]; then
        echo "Option 7 non configurée : renseigne PAGE_URL en haut du script."
        return 1
    fi
    if [ -n "$PAGE_MAJ_CMD" ]; then
        echo "Mise à jour de la page HTML..."
        bash -c "$PAGE_MAJ_CMD" || { echo "❌ La mise à jour de la page a échoué."; return 1; }
    fi
    if [ -n "$PAGE_URL" ]; then
        # La page est servie par le serveur Stable Diffusion : on le démarre s'il ne tourne pas.
        case "$PAGE_URL" in
            *:5001/*|*:5000/*) repond "$URL_SERVEUR" || lancer_serveur || return 1 ;;
        esac
        echo "Ouverture de la page : $PAGE_URL"
        xdg-open "$PAGE_URL" >/dev/null 2>&1 &
    fi
}

# Navigateur : le serveur et Vite s'ouvrent ensemble, dans UNE fenêtre à deux onglets (ceux qui tournent déjà sont ignorés).
tout_navigateur() {
    local onglets=()
    repond "$URL_SERVEUR" || onglets+=("Serveur SD|$ROOT/start-server.sh")
    repond "$URL_VITE"    || onglets+=("Vite|$ROOT/start-vite.sh")
    if [ "${#onglets[@]}" -gt 0 ]; then
        echo "Ouverture de ${#onglets[@]} onglet(s)..."
        ouvrir_onglets "${onglets[@]}"
    else
        echo "Serveur et Vite sont déjà en marche."
    fi
    attendre_serveur && echo "Ouvre $URL_VITE dans le navigateur."
}

# Téléphone et PC : une fenêtre à deux onglets, « Serveur SD » et l'onglet qui enchaîne les étapes (les actions
# internes "etape-telephone" et "etape-pc" ci-dessous). Le menu reste libre.
tout_telephone() {
    local onglets=()
    repond "$URL_SERVEUR" || onglets+=("Serveur SD|$ROOT/start-server.sh")
    onglets+=("Téléphone|$SELF etape-telephone")
    echo "Ouverture de ${#onglets[@]} onglet(s)..."
    ouvrir_onglets "${onglets[@]}"
    attendre_serveur
}
tout_pc() {
    local onglets=()
    repond "$URL_SERVEUR" || onglets+=("Serveur SD|$ROOT/start-server.sh")
    onglets+=("PC|$SELF etape-pc")
    echo "Ouverture de ${#onglets[@]} onglet(s)..."
    ouvrir_onglets "${onglets[@]}"
    attendre_serveur
}

# Effectuer de 1 à 7 : une fenêtre à trois onglets (« Serveur SD », « Vite » et « Étapes » qui enchaîne 3 à 7).
# Chaque étape est tentée même si la précédente a échoué (par exemple sans téléphone branché, la mise à jour du PC se fait quand même) ; un bilan est affiché à la fin.
tout_effectuer_sequentiel() {
    local onglets=()
    repond "$URL_SERVEUR" || onglets+=("Serveur SD|$ROOT/start-server.sh")
    repond "$URL_VITE"    || onglets+=("Vite|$ROOT/start-vite.sh")
    onglets+=("Étapes|$SELF etape-tout")
    echo "Ouverture de ${#onglets[@]} onglet(s)..."
    ouvrir_onglets "${onglets[@]}"
    attendre_serveur
}
# Effectuer de 1 à 7 en parallèle : une fenêtre avec les onglets « Serveur SD », « Vite » (s'ils ne tournent pas déjà), « Build »,
# « Téléphone » et « PC ». Le build se fait une seule fois ; le téléphone et le PC attendent sa fin, puis travaillent en même temps.
# La page de téléchargement (7) s'ouvre depuis ce menu dès que le serveur répond.
tout_effectuer() {
    if ! scripts_sans_build; then
        echo "sync-android.sh et update-debian-local.sh ne contiennent pas encore SANS_BUILD : mode parallèle impossible."
        echo "Je fais l'enchaînement un par un (plus lent)."
        tout_effectuer_sequentiel
        return
    fi
    rm -f "$MARQUEUR_OK" "$MARQUEUR_KO"
    local onglets=()
    repond "$URL_SERVEUR" || onglets+=("Serveur SD|$ROOT/start-server.sh")
    repond "$URL_VITE"    || onglets+=("Vite|$ROOT/start-vite.sh")
    onglets+=("Build|$SELF etape-build" "Téléphone|$SELF etape-telephone-rapide" "PC|$SELF etape-pc-rapide")
    echo "Ouverture de ${#onglets[@]} onglet(s)..."
    ouvrir_onglets "${onglets[@]}"
    # La page de téléchargement n'est ouverte que si le serveur répond (sinon on ne relance pas un second serveur).
    attendre_serveur && maj_page
    echo
    echo "Les onglets Build, Téléphone et PC travaillent : regarde leur bilan à la fin (le mot de passe sudo est demandé dans l'onglet PC)."
}
etape_tout() {
    local bilan=()
    essayer() { local nom="$1"; shift; if "$@"; then bilan+=("✅ $nom"); else bilan+=("❌ $nom"); fi; }
    essayer "3 - Connexion Wi-Fi adb" adb_wifi
    essayer "4 - Mise à jour du téléphone" maj_telephone
    if maj_pc; then bilan+=("✅ 5 - Mise à jour de l'application du PC"); lancer_app_pc; bilan+=("✅ 6 - Lancement de l'application du PC"); else bilan+=("❌ 5 - Mise à jour de l'application du PC" "⏭️  6 - Lancement (non fait)"); fi
    essayer "7 - Page de téléchargement" maj_page
    echo; echo "=============== Bilan ==============="
    printf '%s\n' "${bilan[@]}"
}

lancer() {
    case "$1" in
        1) lancer_serveur ;;
        2) lancer_vite ;;
        3) adb_wifi ;;
        4) maj_telephone ;;
        5) maj_pc ;;
        6) lancer_app_pc ;;
        7) maj_page ;;
        x|X) arreter_serveur ;;
        a|A) tout_navigateur ;;
        b|B) tout_telephone ;;
        c|C) tout_pc ;;
        d|D) tout_effectuer ;;
        # Actions internes, lancées dans les onglets « Téléphone » et « PC » par b et c.
        etape-telephone) adb_wifi && maj_telephone; read -r -p "Terminé. Appuie sur Entrée pour fermer..." _ ;;
        etape-pc)        maj_pc && lancer_app_pc; read -r -p "Terminé. Appuie sur Entrée pour fermer..." _ ;;
        etape-tout)      etape_tout; read -r -p "Terminé. Appuie sur Entrée pour fermer..." _ ;;
        etape-build)     construire_une_fois; read -r -p "Terminé. Appuie sur Entrée pour fermer..." _ ;;
        etape-telephone-rapide) export SANS_BUILD=1; adb_wifi; attendre_build && maj_telephone; read -r -p "Terminé. Appuie sur Entrée pour fermer..." _ ;;
        etape-pc-rapide) export SANS_BUILD=1; attendre_build && charger_node && maj_pc && lancer_app_pc; read -r -p "Terminé. Appuie sur Entrée pour fermer..." _ ;;
        *) echo "Choix inconnu : $1"; return 1 ;;
    esac
}

# --- Menu -----------------------------------------------------------------

if [ -n "$1" ]; then
    lancer "$1"
    exit $?
fi

while true; do
    clear
    echo "=============== RealOrNot ==============="
    echo "  Serveur Stable Diffusion : $(etat "$URL_SERVEUR")"
    echo "  Vite                     : $(etat "$URL_VITE")"
    echo "-----------------------------------------"
    echo "  1) Serveur Stable Diffusion"
    echo "  2) Vite (navigateur)"
    echo "  3) Téléphone : connexion Wi-Fi adb"
    echo "  4) Téléphone : mettre à jour (build + installation)"
    echo "  5) PC : mettre à jour l'application installée"
    echo "  6) PC : lancer l'application installée"
    echo "  7) Page de téléchargement : ouvrir dans le navigateur"
    echo "  x) Arrêter le serveur Stable Diffusion"
    echo "-----------------------------------------"
    echo "  a) Tout pour le navigateur    (serveur + Vite)"
    echo "  b) Tout pour le téléphone     (serveur + adb + mise à jour)"
    echo "  c) Tout pour l'application PC (serveur + mise à jour + lancement)"
    echo "  d) Effectuer de 1 à 7         (rapide : un seul build, téléphone et PC en parallèle)"
    echo "  q) Quitter"
    echo
    read -r -p "Ton choix : " CHOIX
    case "$CHOIX" in
        q|Q) exit 0 ;;
        "") continue ;;
    esac
    echo
    lancer "$CHOIX"
    echo
    read -r -p "Appuie sur Entrée pour revenir au menu..." _
done
