/* src/config.ts */
import { Capacitor } from '@capacitor/core';

// Adresse du serveur local (PC) qui génère les photos IA et stocke les
// personnages créés, accessible par tous les téléphones sur le même réseau.
// Le serveur Flask (voir stable-diffusion/server.py) écoute sur 2 ports en
// parallèle, un seul port ne pouvant pas parler HTTP et HTTPS à la fois :
// le 5001 en HTTPS (certificat local mkcert) pour le navigateur PC et
// l'appli Electron, qui tournent tous les deux sur cette même machine où ce
// certificat est déjà approuvé par le système ; le 5000 en HTTP simple pour
// l'app Android, dont le WebView ne fait pas confiance à ce certificat
// auto-signé.
export const SERVER_BASE_URL = Capacitor.getPlatform() === 'android'
    ? 'http://192.168.1.44:5000'
    : 'https://192.168.1.44:5001';

// Numéro de version de cette build, à incrémenter à chaque nouvelle version
// publiée sur le serveur (voir android/app/build.gradle -> versionCode, qui
// doit être incrémenté en même temps).
export const APP_VERSION_CODE = 82;
