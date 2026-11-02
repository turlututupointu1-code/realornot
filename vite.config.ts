/* vite.config.ts */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    // HTTPS (certificat local mkcert) : le serveur Flask
    // (stable-diffusion/server.py) sert aussi en HTTPS maintenant, pour
    // éviter le blocage "contenu mixte" d'une page HTTPS appelant un
    // serveur HTTP, et pour que des navigateurs comme Brave (qui tentent de
    // passer les adresses en HTTPS par défaut) puissent ouvrir la page.
    https: {
      key: fs.readFileSync('./192.168.1.44+2-key.pem'),
      cert: fs.readFileSync('./192.168.1.44+2.pem'),
    },
    watch: {
      ignored: ['**/stable-diffusion/**', '**/android/**'],
    },
  },
});