# RealOrNot

**English** | [Français](README.fr.md)

RealOrNot is free software, released under the GNU AGPL v3 license (see the `LICENSE` file).

Two ways to meet people, one single app.

- **AI mode**: chat with imaginary characters created by artificial intelligence. Each one has its own personality and a generated face.
- **Real mode**: meet real people through a compatibility system and messaging.

The app is free, with no intrusive popups and no hidden trackers.

## Themes

4 very different graphic themes: Lace (Dentelle), Gothic, Cyberpunk and Frosted.

## What is in this repository

| Folder | Purpose |
|---|---|
| `src/` | The app (React, Vite, TypeScript) |
| `android/` | Android version (Capacitor) |
| `electron/` | Windows and Linux version (Electron) |
| `stable-diffusion/` | The Python server: characters, accounts, messages, image creation |
| `public/`, `assets/` | Shared files and icons |

## Run the app for development

You need Node.js 22 or newer.

```
npm install
npm run dev
```

The site opens over https. You need your own local certificates (they are not in the repository).

## Run the server

The server is in `stable-diffusion/server.py` (Python). It runs on port 5001.

- Install the Python libraries imported at the top of `server.py`.
- Create a `stable-diffusion/.env` file for your keys (it is never published). The keys are optional, depending on the services you use.
- Start it with: `python stable-diffusion/server.py`

### Image creation

In `server.py`, the `GENERATEUR` setting chooses how images are created:

- `"pollinations"`: free service, no graphics card and no key needed.
- `"stable_diffusion"`: Stable Diffusion running locally. You must download the model yourself (it is not in the repository).

## Build the apps

- Android: `npm run build`, then `npx cap sync android`, then `./gradlew assembleDebug` in the `android/` folder.
- Linux (.deb), Windows: `npx electron-builder` in the `electron/` folder.

## Not in this repository

User data, keys, AI models and already-built apps are not published.

## Contributing

Ideas and fixes are welcome: open an *issue* or a *pull request*.

## License

GNU Affero General Public License v3 (AGPL v3). If you run a modified version of the server for other people, you must publish your code.
