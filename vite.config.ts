/* vite.config.ts */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';

// Vrai quand le site est fabriqué pour GitHub Pages (variable posée par GitHub).
const pourGithubPages = process.env.GITHUB_PAGES === 'true';
// Les certificats locaux n'existent que sur ton PC, pas sur GitHub.
const certificatsLocaux =
fs.existsSync('./192.168.1.44+2-key.pem') && fs.existsSync('./192.168.1.44+2.pem');

export default defineConfig({
  plugins: [react()],
// Sur GitHub Pages, le site est dans le dossier /realornot/. Ailleurs (PC, Android, Electron), rien ne change.
  base: pourGithubPages ? '/realornot/' : '/',
  server: {
    host: '0.0.0.0',
    // HTTPS (certificat local mkcert) : le serveur Flask
    // (stable-diffusion/server.py) sert aussi en HTTPS maintenant, pour
    // éviter le blocage "contenu mixte" d'une page HTTPS appelant un
    // serveur HTTP, et pour que des navigateurs comme Brave (qui tentent de
    // passer les adresses en HTTPS par défaut) puissent ouvrir la page.
    // https seulement si les certificats existent (sinon la fabrication planterait sur GitHub).
    https: certificatsLocaux
    ? {
      key: fs.readFileSync('./192.168.1.44+2-key.pem'),
                            cert: fs.readFileSync('./192.168.1.44+2.pem'),
    }
    : undefined,
    watch: {
      ignored: ['**/stable-diffusion/**', '**/android/**'],
    },
  },
});
