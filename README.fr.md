# RealOrNot

[English](README.md) | **Français**

RealOrNot est un logiciel libre, sous licence GNU AGPL v3 (voir le fichier `LICENSE`).

Deux façons de vivre des rencontres, une seule application.

- **Mode IA** : discute avec des personnages imaginaires créés par intelligence artificielle. Chacun a sa personnalité et son visage généré.
- **Mode réel** : rencontre de vraies personnes grâce à un système de compatibilité et de messagerie.

L'application est gratuite, sans popup intrusif et sans traqueur caché.

## Thèmes

4 thèmes graphiques très différents : Dentelle, Gothique, Cyberpunk et Frosted (givre).

## Ce que contient le dépôt

| Dossier | Rôle |
|---|---|
| `src/` | L'application (React, Vite, TypeScript) |
| `android/` | Version Android (Capacitor) |
| `electron/` | Version Windows et Linux (Electron) |
| `stable-diffusion/` | Le serveur Python : personnages, comptes, messages, création des images |
| `public/`, `assets/` | Fichiers communs et icônes |

## Lancer l'application pour développer

Il faut Node.js 22 ou plus.

```
npm install
npm run dev
```

Le site s'ouvre en https. Il faut tes propres certificats locaux (ils ne sont pas dans le dépôt).

## Lancer le serveur

Le serveur est dans `stable-diffusion/server.py` (Python). Il tourne sur le port 5001.

- Installe les bibliothèques Python importées en haut de `server.py`.
- Crée un fichier `stable-diffusion/.env` pour tes clés (il n'est jamais publié). Les clés sont facultatives, selon les services que tu utilises.
- Lance : `python stable-diffusion/server.py`

### Création des images

Dans `server.py`, le réglage `GENERATEUR` choisit comment les images sont créées :

- `"pollinations"` : service gratuit, sans carte graphique ni clé.
- `"stable_diffusion"` : Stable Diffusion en local. Il faut télécharger le modèle toi-même (il n'est pas dans le dépôt).

## Fabriquer les applications

- Android : `npm run build`, puis `npx cap sync android`, puis `./gradlew assembleDebug` dans le dossier `android/`.
- Linux (.deb), Windows : `npx electron-builder` dans le dossier `electron/`.

## Ce qui n'est pas dans le dépôt

Les données des utilisateurs, les clés, les modèles d'IA et les applications déjà fabriquées ne sont pas publiés.

## Contribuer

Les idées et les corrections sont les bienvenues : ouvre une *issue* ou une *pull request*.

## Licence

GNU Affero General Public License v3 (AGPL v3). Si tu fais tourner une version modifiée du serveur pour d'autres personnes, tu dois publier ton code.
