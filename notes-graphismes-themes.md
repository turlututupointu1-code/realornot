# Notes de travail graphisme — thème givre (référence pour les autres thèmes)

**État des thèmes : givre fini, beige fini, gothique fini, cyberpunk fini. Les 4 thèmes sont passés en revue.**

Ce fichier résume les modifications et les pièges rencontrés en travaillant sur le thème **givre**. Il sert de check-list quand on refait le même travail sur un autre thème (gothique, cyberpunk, beige...).

## Pièges CSS de `base.css` à connaître (valables pour tous les thèmes)

- **`.create-page .create-banner-title { margin-top: 0; }`** remet le titre tout en haut sur toute page ayant la classe `create-page`, en écrasant la marge par défaut de 56px. Si le titre semble mal placé sur une nouvelle page, vérifier si elle a cette classe.
- **`.personnage-page`** a son propre `padding-top` (`calc(40px + env(safe-area-inset-top))`) — toujours inclure `env(safe-area-inset-top)` dans les marges hautes, sinon l'écart avec la flèche de retour (qui, elle, l'inclut toujours) varie d'un téléphone à l'autre.
- **`.create-box`** a une règle de fond dans `base.css` avec une chaîne de `:not(...)` très spécifique (6 "classes" au total) :
  ```css
  .create-box:not(.personnage-bubble):not(.personnage-histoire-box):not(.create-preview-box):not(.vous-info-box):not(.create-upload-box) {
      background-color: #8B6F47;
  }
  ```
  Une règle de thème simple (`.theme-X .create-box { background-color: ... }`, 2 classes) **perd** face à celle-ci. Il faut reprendre exactement la même chaîne de `:not()` pour gagner en spécificité :
  ```css
  .theme-X .create-box:not(.personnage-bubble):not(.personnage-histoire-box):not(.create-preview-box):not(.vous-info-box):not(.create-upload-box) {
      background-color: ...;
  }
  ```
- **`.vous-info-box`** est volontairement exclu de la règle ci-dessus (chaque thème est censé le gérer à part, comme le font déjà `noir.css`/`cyberpunk.css`). Sans règle dédiée `.theme-X .vous-info-box { background-color: ... }`, il reste transparent.
- **`.generer-badge-plaque`** (`margin-top: -44px` par défaut) et **`.generer-badge-ornament`** (`margin-top: -15px` par défaut) sont calées sur les proportions de `titre.png`. Chaque thème a un `titre.png` de ratio différent, donc chaque thème a besoin de son propre réglage (sauf s'il tombe par chance sur le même ratio que celui d'origine) :
  - beige : 2239×448 (ratio 5.00) → `-30px` / `-1px`
  - gothique/noir : 2361×448 (ratio 5.27) → `-30px` / `-1px`
  - cyberpunk : 960×508 (ratio 1.89) → garde les valeurs par défaut (`-44px`)
  - **givre : 1271×455 (ratio 2.79) → `-52px` / `-8px`** (valeur trouvée par essais successifs, pas par un calcul simple — l'interpolation linéaire entre les autres thèmes ne suffit pas, vérifier toujours à l'œil sur le téléphone)
- **Focus natif orange/doré** : un `<textarea>`/`<input>` sans `outline: none` explicite (au repos ET dans `:focus`) affiche le contour de focus par défaut du système (souvent doré), quelle que soit la couleur de bordure définie en CSS. `.create-textarea` l'a déjà par défaut dans `base.css`, mais les champs des autres classes (`.vous-caractere-textarea`, `.personnage-chat-input`, `.signaler-commentaire`, `.pseudo-popup-input`) ne l'ont pas et doivent le recevoir explicitement par thème.
- Certains champs texte n'ont **pas de bordure propre** (`.create-textarea { border: none; }` dans `base.css`) — la bordure visible vient de la boîte englobante `.create-box`. Pour un effet "bordure qui change au focus", cibler la boîte avec `:focus-within` plutôt que le champ lui-même.

## Bug caméra natif (corrigé pour tous les thèmes)

Deux problèmes distincts trouvés sur la page appareil photo (flash/capture/basculer) :

1. **Thème Android jamais activé** : `MainActivity.java` ne basculait jamais de `AppTheme.NoActionBarLaunch` (thème de lancement, fond = `splash.png`) vers `AppTheme.NoActionBar` (le thème avec la vraie couleur de fond `windowBackground`). Résultat : l'image de démarrage restait en fond de fenêtre en permanence, visible dans tout espace non couvert par autre chose. Corrigé en ajoutant `setTheme(R.style.AppTheme_NoActionBar);` tout en haut de `onCreate()`, avant `super.onCreate()`.
2. **Espace blanc sous l'aperçu caméra** : le plugin `@capgo/camera-preview` (`toBack: true`) ne rend le WebView transparent que dans les limites qu'il gère lui-même. En dehors de cette zone (entre le bas de l'aperçu et le bandeau de contrôles), le WebView redevient blanc opaque par défaut — aucun CSS `background: transparent` sur `html`/`body` ne peut l'empêcher. Corrigé en donnant au bandeau de contrôles (`.camera-controls-panel`) une **hauteur minimale généreuse** (`min-height: 42vh`) avec `justify-content: flex-end` pour garder les boutons ancrés en bas, et son propre fond d'écran en image plutôt que la couleur noire unie par défaut. Appliqué à givre, gothique, cyberpunk et beige.

## Principe de conception : regrouper ce qui doit bouger ensemble

Quand deux éléments doivent partager le même décalage (`transform: translateY(...)`), les regrouper dans une boîte commune (`<div>` englobant en JSX) et appliquer le décalage **une seule fois** sur cette boîte, plutôt que de dupliquer la même valeur sur chaque élément séparément. Une valeur dupliquée finit toujours par diverger au fil des ajustements.

Exemples déjà en place : `.personnage-header-fixed` (flèche + texte "créé par..."), `.profil-conversation-header-fixed` (flèche + drapeau signaler), `.generer-title-group` (titre + compteur + ornement sur "Générer ma photo").

## Palette de couleurs givre (pour référence, à adapter par thème)

- Boîtes de texte génériques (Mon profil, Détails du personnage, panneau caractère "Toi", etc.) : fond `#FFFFFFCC`, bordure `#CFE8F3`, texte `#1A3A47`, bordure au focus `#6FA8C4`.
- Boîte de scène/description (page conversation) : fond `#DCEEF5`, bordure `#A8CEDF`.
- Bulles IA : fond `#A8D4E8`, bordure `#6FA8C4`.
- Bulles utilisateur : fond `#EEF8FC`, bordure `#CFE8F3`.
- Texte des bulles : `#1A3A47`.
- Champ de saisie du chat : fond `#B8C8D0`, bordure `#8FA3AD` (focus `#7A94A0`), texte `#1A2E36`, placeholder `#5A6B73`. Bandeau englobant : `#9FB3BD`.
- Fenêtre de signalement : fond `#B8C8D0`, bouton principal `#6FA8C4` (actif au tap : `#5A93AF`).

**Préférence de l'utilisateur : toujours écrire les couleurs en hexadécimal (y compris `#RRGGBBAA` pour la transparence), jamais en `rgba()`.**

## Boutons barre3 (icône + texte)

Le composant `.create-btn-caption` (base.css) est décalé par défaut (`left: 18.5%; right: 7%`) pour laisser la place à l'icône à gauche. Sur tous les boutons qui utilisent `barre3` comme fond (`CreatePhoto.tsx`, `GenererPhoto.tsx`), on veut au contraire un texte **blanc**, centré sur toute la largeur du bouton, sans tenir compte de la place prise par l'icône :

```css
.theme-frosted .btn-bouton-png .create-btn-caption {
    left: 0;
    right: 0;
}
.theme-frosted .btn-bouton-png .create-btn-title {
    color: #ffffff;
}
```

Cette règle est générique (pas limitée à une page) puisque tous les boutons `.btn-bouton-png` doivent avoir le même traitement. Le centrage vertical de l'icône/texte (nécessaire car `barre3` est une pilule fine, contrairement à `bouton.png`) reste réglé page par page (`.create-photo-page`/`.generer-photo-page`/`.details-personnage-page`), voir plus haut.

## Cibler un popup partagé sans toucher aux autres (`:has()`)

Certaines classes (`.update-prompt-box`, `.update-prompt-btn-primary`, `.update-prompt-btn-secondary`) sont réutilisées par plusieurs popups différents (mise à jour de l'app, pseudo, signalement). Pour styliser un seul de ces popups sans affecter les autres, repérer un élément UNIQUE à ce popup à l'intérieur et cibler avec `:has()` :

```css
.theme-frosted .update-prompt-box:has(.signaler-motifs) {
    background-image: url('../images/givre/fondecran.jpeg');
    ...
}
```

`.signaler-motifs` n'existe que dans la fenêtre "Signaler ce personnage", donc cette règle ne touche jamais le popup de mise à jour ni celui du pseudo. Attention à la spécificité : une règle `:has()` ajoute des "classes" au calcul, donc bien exclure les états actifs qui doivent continuer à gagner (ex. `:not(.signaler-motif-btn-actif)` pour ne pas écraser la couleur du motif sélectionné).

## Thème beige : point de départ différent de givre

Contrairement à givre (parti de zéro), `beige.css` était déjà largement stylé avant qu'on s'y attaque (page d'accueil, menu burger, cartes de création, pagination déjà faits). Avant d'ajouter quoi que ce soit sur une page, vérifier d'abord ce qui existe déjà dans le fichier plutôt que de repartir de zéro.

Piège trouvé : `.theme-beige .camera-controls-panel` était défini **deux fois** dans le fichier — une fois avec le bon correctif (fond d'écran + `min-height: 42vh`), une fois plus loin avec juste une couleur unie qui écrasait le correctif (la règle la plus bas dans le fichier gagne à spécificité égale). Toujours vérifier avec `grep -n "nom-de-la-classe" fichier.css` qu'une règle n'est pas redéfinie ailleurs avant de conclure qu'un correctif ne marche pas.

Le piège de spécificité `.create-box` (voir plus haut) existait **déjà** dans `beige.css` avant même cette session — `.theme-beige .create-box { background-color: #ffffff; }` perdait silencieusement face à la règle brune de `base.css` depuis le début. Bonne raison de vérifier systématiquement ce point sur chaque thème, même ceux qui semblent déjà fonctionner.

Effet de bord de ce correctif : la version renforcée en spécificité (`.theme-beige .create-box:not(...):not(...)...`, 7 "classes") est devenue plus forte que les règles de personnalisation par page déjà en place, comme `.theme-beige .details-personnage-page .create-box { background-color: #4a3419; }` (3 "classes") — cette dernière s'est retrouvée silencieusement écrasée. Après avoir renforcé la spécificité d'une règle générique, toujours vérifier (`grep`) qu'aucune règle plus spécifique par page n'existe déjà pour la même classe, sinon elle devient du code mort sans avertissement.

## Page de recadrage : bannière titre compressée par le flexbox

Signalé comme "une ligne grise entre le titre et le cadre de la photo" sur cyberpunk. Deux fausses pistes explorées d'abord (bordure du titre.png anti-crénelée, bordure du cadre `.crop-viewport` — corrigée en passant, elle était bien en gris/or par défaut, mais ce n'était pas la cause principale). Vraie cause trouvée en inspectant le DOM en direct (voir méthode plus haut) : `.crop-overlay` est un conteneur flex (`display:flex; flex-direction:column;`) et `.create-banner-title` (la bannière, qui contient une grande image `titre.png`) n'a pas de `flex-shrink:0` — le layout flex la compressait à ~20px de haut quand l'espace vertical manquait, et comme la bannière a `overflow:hidden`, il ne restait visible qu'une fine bande de l'image (d'où la "ligne"), le reste étant coupé silencieusement. Corrigé dans `base.css` (`flex-shrink: 0`), affecte tous les thèmes, pas seulement cyberpunk. Bonne illustration qu'un bug visuel qui ressemble à un problème de couleur/bordure peut en fait être un problème de dimensionnement — vérifier `getBoundingClientRect()` de l'élément ET de son contenu avant de conclure.

## Caméra : l'aperçu ne remplissait que 60% de l'écran (plugin, pas CSS)

Repéré en comparant à une vraie appli photo : l'aperçu caméra laissait un grand vide en haut de l'écran. Diagnostiqué via `adb logcat` (logs natifs du plugin `@capgo/camera-preview`, tag `CameraPreview CameraXView`) : `CameraPreview.start()` n'avait jamais reçu d'option `aspectRatio`, qui vaut `'4:3'` par défaut dans le plugin — celui-ci centre alors un cadre 4:3 (1080×1440 sur un écran 1080×2400) au lieu de remplir l'écran, peu importe le CSS autour. Le plugin accepte aussi `'fill'` (voir `node_modules/@capgo/camera-preview/dist/esm/definitions.d.ts`). Ajouté `aspectRatio: 'fill'` à l'appel dans `TelechargerPhoto.tsx` (`ouvrirCamera`). Préexistant à cette session, pas causé par le verrou d'orientation portrait.

Une fois l'aperçu plein écran, le bandeau de contrôles (`min-height: 42vh`, ajouté plus tôt dans le projet pour couvrir un vide sous un aperçu qui ne remplissait pas l'écran) est devenu disproportionné — réduit à `22vh` sur les 4 thèmes.

## Barre de statut blanche sur la page appareil photo (MIUI)

Repéré sur un téléphone (MIUI/Xiaomi) : la barre de statut redevenait blanche uniquement sur la page appareil photo, alors qu'elle suit correctement la couleur du thème partout ailleurs (`StatusBar.setBackgroundColor()`, appelé dans `ThemeContext.tsx`). Cause trouvée en lisant le code Java du plugin `@capgo/camera-preview` (`CameraPreview.java`) : `CameraPreview.start()` sauvegarde lui-même la couleur de la barre de statut *au moment de l'appel* puis la force à l'opaque (et la restaure telle quelle à `stop()`) — écrasant silencieusement notre couleur si elle n'était pas déjà correctement posée à cet instant précis (ce qui arrive sur certains appareils qui ignorent la transparence par défaut). Corrigé en réappliquant `StatusBar.setBackgroundColor()` juste après `CameraPreview.start()` et juste après `CameraPreview.stop()` dans `TelechargerPhoto.tsx`, plutôt que de compter sur le seul appel fait une fois au changement de thème (`STATUT_PAR_THEME` exporté depuis `ThemeContext.tsx` pour être réutilisable ailleurs).

## Flash blanc/beige au lancement de l'app (avant le premier rendu React)

Repéré au premier lancement : la barre de statut ET le popup de bienvenue apparaissaient brièvement en couleurs claires ("beige") même en thème cyberpunk. Cause : `index.html` n'a aucune couleur de fond définie, donc le navigateur affiche son blanc par défaut le temps que React démarre, lise le thème et applique la classe `.theme-X` — un flash classique de contenu non stylé (FOUC). Corrigé en ajoutant un petit `<script>` dans le `<head>` qui lit `realornot-theme` dans `localStorage` et colore `document.documentElement` **avant** le premier rendu, donc avant même que React ait pu s'exécuter.

## Popups génériques cyberpunk manquants (mise à jour, bienvenue, pseudo)

Même trou que la barre de statut ci-dessus, mais CSS cette fois, pas natif : `cyberpunk.css` n'avait **aucune** règle générique pour `.update-prompt-box`/`.update-prompt-text`/`.update-prompt-btn-primary`/`.update-prompt-btn-secondary`/`.update-prompt-progress*` (seulement la version scopée `:has(.signaler-motifs)` pour le popup de signalement, et `.pseudo-popup-input` pour le champ). Résultat : le popup de bienvenue ("Willkommen zurück...") et le popup de mise à jour retombaient sur le fond clair/beige par défaut de `base.css`. Ajouté les règles génériques avec `var(--box-bg)`/`var(--box-border)`/`var(--box-text)`, comme `noir.css`/`frosted.css` les ont déjà (pour noir, ces règles vivent dans `base.css`, pas `noir.css` — incohérence pré-existante notée ailleurs).

**Statut de la barre de statut (page appareil photo)** : abandonné après plusieurs tentatives infructueuses. Symptôme final observé : en beige la barre est noire, en gothique/cyberpunk elle est beige (couleurs comme inversées/figées). Vérifié via `adb logcat` que le code JS envoie bien la bonne couleur en boucle sans erreur (`StatusBar.setBackgroundColor`) — le problème n'est donc pas dans notre code mais dans une interaction plus profonde entre le mode transparent de la caméra (`toBack`) et le rendu système, hors de portée sans outils de debug natifs (Android Studio). Essayé sans succès : réapplication ponctuelle après `start()`/`stop()`, plusieurs tentatives échelonnées (100ms-2.5s), boucle continue (toutes les 400ms tant que la caméra est active). Laissé un seul appel simple (inoffensif) dans `TelechargerPhoto.tsx`, sans complexité supplémentaire puisqu'aucune des tentatives plus élaborées n'a résolu le problème. Ne pas retenter sans un moyen de déboguer le rendu natif directement.

## Bannière de la page recadrage : une hauteur fixe + `object-fit: cover` recadre différemment selon la largeur d'écran

`.crop-overlay .create-banner-title` avait été réduite avec `height: 64px` + `object-fit: cover` sur l'image (voir plus haut, "boutons pas visibles"). Piège découvert en comparant deux téléphones différents (même thème, même build) : le rapport largeur/hauteur du cadre dépend de la largeur d'écran (la hauteur est fixe en px, la largeur suit `width:100%` du conteneur flex) — sur un écran plus étroit, le cadre devient plus "carré" par rapport à l'image large, donc `object-fit: cover` recadre davantage en hauteur et peut couper le cadre décoratif (le doré) en laissant dépasser le fond (le vert) hors de son "logement". Corrigé en réduisant plutôt la **largeur** de la bannière (`width: 55%`, centrée) et en laissant `height: auto` : l'image garde son ratio d'origine sans jamais être recadrée, donc un rendu identique quel que soit l'écran.

## Bandeau caméra resserré + coins carrés + fond d'écran sur le recadrage : appliqué à beige/gothique/cyberpunk

`.camera-controls-panel { min-height: 22vh → 9vh; border-radius: 0; }` et `.crop-overlay` avec `var(--wallpaper)` en plus de la couleur unie. Fait pour les 4 thèmes (cyberpunk, gothique, beige, givre). Le popup générique (`.update-prompt-box`, bienvenue/mise à jour/pseudo) n'a besoin d'aucune couleur particulière sur beige : le fond par défaut de `base.css` (`#F0E6D6`) est déjà la couleur beige elle-même, donc déjà correct par coïncidence (contrairement à gothique/cyberpunk qui en avaient besoin).

## Passe de simplification CSS (couleurs répétées, `rgba()` → hex)

En plus des variables du menu burger : converti tous les `rgba(...)` restants des 4 fichiers de thème en hexadécimal (préférence du projet), et remplacé par `var(--box-bg)`/`var(--box-border)`/`var(--box-accent)` les quelques endroits qui recopiaient en dur une valeur identique à une variable déjà déclarée (ex. `.theme-noir .creation-card`/`.creation-card-image`/`.style-card-image-wrap` utilisaient `#6d0000` en dur au lieu de `var(--box-bg)` ; `.theme-frosted .personnage-salutation-box` utilisait `#6FA8C4` en dur au lieu de `var(--box-accent)`).

**Arrêté volontairement avant d'aller plus loin** : les couleurs encore répétées après cette passe (ex. `#00E5FF`/`#00FF90` en cyberpunk, `#FFFFFF` un peu partout) sont utilisées sur des éléments non reliés entre eux (icône recherche, bordures de cartes cycliques, badges...) — les regrouper dans une seule variable donnerait l'impression fausse qu'ils doivent toujours changer ensemble, alors que rien ne le garantit. Seuls les cas où plusieurs règles représentent clairement le **même concept** (couleurs de boîte, menu burger) ont été simplifiés.

## Variables pour le menu burger

Même principe que `--box-*`, appliqué au menu burger (12 règles quasi identiques répétées dans chaque thème : `burger-panel`, `burger-item`, `burger-close-btn`, `burger-separator`, `burger-chevron`, `burger-submenu`, `burger-subitem*`). Ajouté `--burger-bg`/`--burger-text`/`--burger-hover`/`--burger-border` par thème (seulement les variables dont la valeur est vraiment dupliquée ≥ 2-3 fois dans ce thème précis — cyberpunk par exemple a des couleurs de bordure différentes entre `burger-panel` et `burger-submenu`, donc pas de `--burger-border` créé pour lui, pour ne pas prétendre à une valeur commune qui n'existe pas). Au passage, converti les `rgba(...)` restants de ces règles en hexadécimal (préférence de couleur du projet).

## Cyberpunk : nouvelle palette de boîtes (fond translucide + bordure/glow néon)

Palette demandée pour le champ pseudonyme, puis étendue à `--box-bg`/`--box-border`/`--box-text` (donc à toutes les boîtes du thème, grâce au système de variables) : fond `#0D0D1A80` (bleu-noir à 50% de transparence), bordure `#00FFB3` (turquoise néon), texte `#E0FFF5` (blanc menthe pâle). Ajouté aussi un glow au focus sur les boîtes de saisie génériques (`.create-box:focus-within { box-shadow: 0 0 8px var(--box-border); }`), pas seulement le champ pseudonyme.

## Variables CSS pour les couleurs de boîtes répétées

Sur beige, les mêmes couleurs de boîte revenaient dans plusieurs règles (`.create-box`, `.create-textarea`, la boîte commentaire du signalement...). Pour éviter de les dupliquer (et de devoir les changer partout à la main à chaque ajustement), elles sont maintenant définies une fois en variables CSS sur `.theme-beige` :

```css
.theme-beige {
    --box-bg: #A48860CC;
    --box-border: #C4A876;
    --box-text: #D5C5AD;
}
```

... puis réutilisées avec `var(--box-bg)`, `var(--box-border)`, `var(--box-text)` dans chaque règle concernée, au lieu de répéter le code hexadécimal. Repris depuis sur `frosted.css` (+ `--box-text-muted`, `--box-radius`, `--box-accent`), `noir.css` et `cyberpunk.css` (`--box-bg`, `--box-text`, `--box-radius`, et `--box-border` pour cyberpunk), toujours en gardant les couleurs propres à chaque thème — seule la structure (variables) est commune, pas les valeurs.

Piège découvert en creusant ce sujet : `background-color` et `border-color` d'une même règle sont deux propriétés indépendantes vis-à-vis de la cascade. Une règle plus spécifique par page (ex. `.details-personnage-page .create-box { background-color: X; border-color: Y; }`, 3 classes) peut avoir sa `background-color` silencieusement écrasée par une règle générique plus spécifique (`.create-box:not(...)...`, 6+ classes) tout en gardant sa `border-color` bien active (rien d'aussi spécifique ne la conteste). Ne pas supposer qu'une règle entière est "morte" sans vérifier propriété par propriété.

## Variable CSS pour l'image de fond d'écran (`--wallpaper`)

Même logique que pour les couleurs de boîtes : le fond d'écran (`fondecran.png`/`.jpeg`) était répété tel quel dans plusieurs règles du même fichier (fond général du thème, bandeau caméra `.camera-controls-panel`, popup "Signaler ce personnage" sur givre/beige). Une variable CSS peut aussi contenir un `url(...)`, donc elle est maintenant définie une fois par thème :

```css
.theme-X {
    --wallpaper: url('../images/X/fondecran.png');
    background-image: var(--wallpaper);
}
.theme-X .camera-controls-panel {
    background-image: var(--wallpaper);
}
```

Appliqué aux 4 thèmes. Change une seule ligne si jamais le fichier ou le chemin de l'image de fond change.

## `.vous-info-box` manquant sur beige (page Moi)

Confirmation du piège déjà noté plus haut (`.vous-info-box` exclu de la règle générique `.create-box`, doit avoir sa propre règle par thème) : `noir.css` et `cyberpunk.css` avaient bien `.theme-X .vous-info-box { background-color: var(--box-bg); }`, mais cette règle manquait dans `beige.css` — la boîte d'info en haut de la page Moi restait donc sans fond (transparente, juste le fond d'écran derrière). Ajoutée, avec en plus `.vous-info-box .personnage-field-text { color: var(--box-text); }` pour le texte.

## `.create-textarea` de beige oublié lors du passage aux variables

En comparant les 4 fichiers avec un script `postcss` (recherche de sélecteurs dupliqués + de règles qui se marchent dessus sur la même propriété), trouvé que `.theme-beige .create-textarea` gardait `color: #5a4a5c` en dur au lieu de `var(--box-text)`, alors que `noir.css`/`cyberpunk.css` avaient bien été mis à jour. Comme `#5a4a5c` (gris-brun, pensé pour le texte de page sur fond clair) est peu lisible sur `var(--box-bg)` (brun translucide), une règle spécifique à `.profil-conversation-page .create-textarea` avait été ajoutée en rustine pour corriger juste cette page. Corrigé à la racine : `.create-textarea` généraliste utilise maintenant `var(--box-text)` comme les autres thèmes, et la rustine `.profil-conversation-page` (devenue redondante) a été supprimée.

Leçon : après avoir ajouté des variables CSS partagées, vérifier avec un outil (`postcss`, ou `grep -n "color:\s*#"` sur le fichier) qu'aucune règle générique n'a été oubliée et laissée en couleur codée en dur — sinon on empile des rustines page par page au lieu de corriger la règle de base.

## Double bordure sur `.vous-caractere-panel` : bug de fond dans `base.css`, pas juste un problème de couleur beige

Sur la page Moi, le panneau "Caractère" affichait deux bordures dorées imbriquées. Cause réelle (pas juste une histoire de couleurs qui se ressemblent) : `.vous-caractere-panel` — le conteneur `<div>` réutilisé aussi bien pour le champ Pseudonyme que pour le champ Caractère — avait **lui-même** un fond et une bordure définis par défaut dans `base.css`, en plus de l'élément qu'il contient (`.pseudo-popup-input` ou `.vous-caractere-textarea`) qui a déjà les siens. Deux éléments imbriqués stylés comme des "boîtes" = boîte dans la boîte, quel que soit le thème.

Première tentative de correctif (mettre `border: none` puis `background-color: transparent` uniquement dans `beige.css`) ne faisait que masquer le symptôme dans un seul thème sans traiter la cause. Corrigé à la racine dans `base.css` : `.vous-caractere-panel` est redevenu un pur conteneur de mise en page (marge, largeur, padding, animation), sans fond ni bordure — l'élément à l'intérieur reste seul responsable de l'aspect "boîte". La règle `.theme-noir .vous-caractere-panel` (qui redonnait fond+bordure au panneau, dans `base.css`) a été supprimée pour la même raison. `beige.css` n'a plus besoin d'aucune règle sur `.vous-caractere-panel`.

**Reste à vérifier** : `frosted.css` a sa propre règle `.theme-frosted .vous-caractere-panel { background-color: var(--box-bg); border: 1px solid var(--box-border); }` qui n'a pas été touchée (hors périmètre, givre déjà fini) — elle recrée probablement le même effet de double boîte et mériterait d'être retirée un jour.

## Page "Choisir le style artistique" : vérifier si givre a déjà la solution avant de restructurer

Demande : que le texte sous les vignettes de style (`.style-card-label`) ait le même traitement (fond dégradé + bordure) que les cartes de la page d'accueil (`.creation-card-info`/`.creation-card-title`). Première tentative : fusionner `.style-card` avec `.creation-card-info`/`.creation-card-title` (réutiliser directement les mêmes classes, JSX + base.css partagés entre thèmes) — **repoussé** car `frosted.css` avait déjà une solution différente et déjà validée pour exactement la même demande (commentaire `/* Page "Choisir le style artistique" : même bordure de vignette que sur la page d'accueil. */`), qui aurait cassé avec la restructuration (elle stylait encore `.style-card-label`, classe supprimée par le changement).

Bonne approche (reprise de givre, adaptée aux couleurs beige) : garder les classes `.style-card-image-wrap`/`.style-card-label` telles quelles (pas de changement JSX ni `base.css`), et par thème :
```css
.theme-X .style-card { gap: 0; }
.theme-X .style-card-image-wrap { border-radius: 16px 16px 0 0; }
.theme-X .style-card-label {
    background: linear-gradient(to bottom, transparent, <couleur de fond du thème>);
    border: 2px solid <couleur de bordure>;
    border-top: none;
    border-radius: 0 0 16px 16px;
    padding: 8px 10px;
    width: 100%;
    box-sizing: border-box;
}
```
`gap: 0` fait que le libellé touche directement le bas de la vignette ; la bordure de l'image (haut/gauche/droite arrondis) se prolonge visuellement avec celle du libellé (gauche/droite/bas, sans haut) pour donner l'impression d'une seule boîte continue, sans dupliquer de bordure. **Leçon : avant de restructurer un composant partagé entre thèmes pour une demande qui "ressemble" à une demande déjà traitée ailleurs, vérifier d'abord si un autre thème (surtout givre, souvent traité en premier) n'a pas déjà la même règle en place — copier son approche plutôt que d'inventer une structure différente qui risque de la casser.**

Appliqué depuis aux 4 thèmes (givre déjà fait, beige/gothique/cyberpunk ajoutés à la suite), en reprenant à chaque fois les couleurs déjà utilisées par `.creation-card`/`.creation-card-info`/`.creation-card-title` du même thème sur la page d'accueil (dégradé de fond, couleur de bordure, couleur du texte) plutôt que d'inventer de nouvelles valeurs. Pour cyberpunk, la bordure du libellé reprend la couleur cyclique par carte déjà en place sur `.style-card-image-wrap` (`:nth-child(3n+1/2/3)`).

## Page "Détails du personnage" : effet "onglet" sur les étiquettes de champ (Nom, Description...)

Givre a un effet "boîte + titre en onglet attaché" sur cette page (`.details-personnage-page .create-box` avec coin gauche carré + `.details-field-label` en onglet par-dessus, fond = couleur de bordure + `CC` d'alpha) — voir plus haut. Repris pour les 3 autres thèmes, en gardant la couleur de bordure déjà utilisée par chaque thème pour les boîtes de cette page (`.details-personnage-page .create-box`) au lieu de `var(--box-border)` générique :
- beige : bordure `var(--box-border)` (#C4A876), onglet `#C4A876CC`
- gothique : bordure `#8a6f4f` (déjà utilisée par `.details-personnage-page .create-box`), onglet `#8a6f4fCC`
- cyberpunk : bordure `#7a4fb5` (déjà utilisée par `.details-personnage-page .create-box`), onglet `#7a4fb5CC`

**Piège rencontré (à ne pas oublier une seconde fois)** : givre a aussi une règle `.details-personnage-page .voix-choisie-row { margin-bottom: 14px; }` qui pousse le champ "Nom" plus bas (espace sous la rangée "voix"). Facile à manquer si on ne relit pas tout le bloc givre — toujours copier l'intégralité des règles `.details-personnage-page` de givre, pas seulement celles qui semblent liées à la demande initiale.

## Cyberpunk : `barre2` a un médaillon décoratif à gauche, `barre3` non

`barre2.png` de cyberpunk (860×314, très différent du ratio ~8:1 plat des autres thèmes) a un gros médaillon circulaire lumineux occupant tout le tiers gauche de l'image — contrairement à `barre3.png` qui est un panneau plat sans élément décoratif superposable. Tout texte centré sur toute la largeur d'un bouton/rangée en `barre2` chevauche donc ce médaillon. Corrigé en décalant la zone de texte vers la droite (`padding-left: ~34%`) et en centrant le texte dans l'espace restant :
- `.details-voix-content`/`.details-voix-label` (rangées Avatar/Pseudonyme/Caractère/Vos créations/Vos discussions/Choisir la voix, génériques à toutes les pages qui les utilisent) : `padding-left: 34%` sur le conteneur + `.details-voix-label { flex: 1; text-align: center; }`.
- `.update-prompt-btn-primary` dans le popup "Signaler ce personnage" (bouton Envoyer, en `barre2`) : `padding-left: 34%; text-align: center;` directement sur le bouton.

**À vérifier ailleurs** : tout autre bouton/rangée cyberpunk utilisant `barre2` comme fond (ex. `.voix-item-label` sur la page Choisir la voix, pas encore vérifié) a probablement le même problème.

**Historique (page par page, confusion de noms en cours de route)** : "remplace barre2 par barre3, page Mon profil" visait d'abord la page **Conversation → Profil créateur** (`ProfilConversationPage.tsx`, bouton "Recommencer la conversation"). `MoiPage.tsx` avait été changé par erreur puis remis dans son état d'origine. Ensuite trouvé que la vue **Conversation → Profil utilisateur** (`ProfilConversationUtilisateurPage.tsx`) a son **propre** bouton "Recommencer" séparé, encore en `barre2` — corrigé aussi. Enfin, `MoiPage.tsx` ("Moi" dans le menu) a bien été redemandé et changé pour de vrai : ses 5 rangées (Avatar/Pseudonyme/Caractère/Vos créations/Vos discussions) sont passées en `barre3` (rangée genre déjà en `barre3`). Plus aucune page cyberpunk n'utilise `barre2` avec `.details-voix-content`/`.details-voix-label`, donc la règle de décalage médaillon a été retirée pour de bon (à remettre si une page future réutilise cette combinaison).

**Piège CSS découvert en corrigeant ce cas** : un `padding-left` en `%` sur un élément qui est lui-même un enfant flex (`flex: 1`, ex. `.update-prompt-btn-primary`) ne se résout **pas** contre sa largeur affichée finale — confirmé en inspectant le DOM en direct (voir plus bas) : `padding-left: 34%` sur un bouton large de 169.7px donnait un padding réel de 93.2px (54%), pas 57.7px (34%). Toujours utiliser une valeur fixe en pixels pour ce genre de décalage sur un élément flex, jamais un pourcentage (même famille de piège que les `%` sur `padding-top`/`padding-bottom`, déjà documenté dans la mémoire du projet).

## Motif sélectionné (popup signalement) : image `barre1`/`barre2` au clic plutôt que couleur unie

Par défaut, `.signaler-motif-btn-actif` (motif sélectionné) était exclu du traitement `barre3`/`barre2` et retombait sur une couleur unie générique. Ajouté une règle scopée dédiée pour l'état actif, dans les 4 thèmes : cyberpunk → `barre1.png`, gothique → `barre2.png`, beige → `barre1.png`, givre → `barre2.png` (à chaque fois la même image que le bouton "Envoyer" de ce thème).

## Libellé "ZOOM" sur le rail de zoom (page appareil photo)

Ajouté un `<span className="zoom-label">ZOOM</span>` dans `TelechargerPhoto.tsx` (composant partagé par les 4 thèmes). Masqué par défaut (`.zoom-label { display: none; }` dans `base.css`), affiché et centré uniquement par thème avec sa propre couleur d'accent : cyberpunk `#00E5FF` (+ glow), beige `#5a4a5c`, gothique `#C4A876`, givre `var(--box-accent)`.

**Attention** : `CreatePhoto.tsx` et `TelechargerPhoto.tsx` sont des composants **partagés** entre les 4 thèmes (pas de fichier par thème) — le remplacement `barre2` → `barre3` demandé pendant la session cyberpunk a changé l'image utilisée pour **tous les thèmes**, pas seulement cyberpunk (contrairement aux styles CSS qui restent scopés par `.theme-X`). Si beige/gothique/givre étaient "finis" avec `barre2` sur ces boutons intentionnellement, ça a changé leur rendu aussi. À vérifier si ça pose problème.

**Outil de vérification** : pour ce genre de réglage au pixel près, se fier à un screenshot (photo compressée, tons de la photo qui trompent l'œil) est risqué. Possible d'inspecter le DOM **en direct** sur le téléphone via le protocole Chrome DevTools : `adb shell "cat /proc/net/unix | grep webview_devtools"` donne le socket (`webview_devtools_remote_<pid>`), puis `adb forward tcp:PORT localabstract:webview_devtools_remote_<pid>` et une requête sur `http://localhost:PORT/json` donne l'URL du WebSocket de débogage ; un script Node (WebSocket natif) qui appelle `Runtime.evaluate` peut alors lire `getBoundingClientRect()`, `getComputedStyle()`, etc. directement sur la page réellement affichée. Beaucoup plus fiable qu'un screenshot pour un problème de centrage/couleur exacte. Le socket change de nom (PID différent) à chaque relance de l'app, donc refaire `cat /proc/net/unix` avant chaque nouvelle session d'inspection.

**Bug de spécificité dans les 4 thèmes (y compris givre "fini")** : `.details-personnage-page .create-box { border-top-left-radius: 0; border-bottom-left-radius: 0; }` (3 "classes") perdait silencieusement face à la règle générique `.create-box:not(...)x5 { border-radius: var(--box-radius); }` (7 "classes", raccourci qui fixe les 4 coins) — le coin carré de l'effet "onglet" ne s'est donc **jamais** réellement affiché, y compris sur givre depuis sa création. Corrigé sur les 4 thèmes en reprenant la même chaîne `:not()` pour égaler la spécificité (même piège que le fond marron, déjà documenté plus haut — mais cette fois-ci sur `border-radius`, pas `background-color`). Repéré uniquement parce que l'utilisateur l'a vu sur gothique ; toujours vérifier si un bug similaire existe ailleurs (y compris sur un thème "fini") avant de le corriger seulement là où il a été signalé.

## Taille de texte des petits boutons "pilule" : unifiée en pixels fixes dans `base.css`

Le texte des boutons Envoyer/Annuler (fenêtre de signalement) paraissait plus gros que celui des boutons à côté (motifs), malgré des valeurs `em` "proches" (0.9em vs 0.85em) — piège classique de l'empilement des `em` : la même valeur relative rend différemment selon la taille de police du contexte parent, donc des `em` "proches" ne donnent pas forcément un rendu visuellement identique. Sur demande de l'utilisateur ("fait un css pour tous les texte des boutons"), toutes les tailles/graisses de police de cette famille de boutons (`update-prompt-btn`, `signaler-motif-btn`, `details-voix-label`, `voix-item-label`, `pagination-label`, `crop-btn`) ont été retirées de leurs règles individuelles et regroupées dans une seule règle commune à la fin de `base.css`, en pixels fixes plutôt qu'en `em` — un seul endroit à changer, et plus de dépendance au contexte parent. `.create-btn-title` et `.style-card-label` (catégorie différente : gros boutons CTA avec icône, pas des pilules de texte) n'ont pas été touchés.

Valeur finale : `15px` / `font-weight: normal`, choisie pour correspondre au titre de la fenêtre de signalement (`.update-prompt-text`, `0.95em` ≈ 15px, poids normal) — corrections successives : d'abord réduit au niveau des plus petits (`13px`) par erreur (l'utilisateur voulait l'inverse : monter les petits au niveau des plus gros), puis mis en gras (`600`) par erreur alors que le titre `.update-prompt-text` n'est pas en gras.

## Fenêtre "Signaler ce personnage" : appliquée aux 4 thèmes

Bâtie d'abord pour givre et beige (fond d'écran + boutons en barre2/barre3 + boîte commentaire colorée), refaite/corrigée pour gothique (bordure `2px solid #C4A876` manquante — en fait présente mais quasi invisible car `.signaler-commentaire` hérite du bord de `.pseudo-popup-input`, et le bord par défaut de gothique pour cette classe est un blanc à 15% d'opacité, donc très pâle ; bordure explicite plus visible ajoutée) puis étendue à cyberpunk (n'avait aucune règle du tout pour ce popup, tombait sur le style clair par défaut de `base.css` — construite en reprenant `var(--box-bg)`/`var(--box-border)`/`var(--box-text)`/`--wallpaper` déjà définis pour ce thème). Numérotation des boutons harmonisée entre givre/gothique/cyberpunk : motifs+annuler en `barre3`, envoyer en `barre2` (beige reste sur son ancienne convention `barre2`/`barre1`, pas retouchée). Bordure de la boîte commentaire uniformisée à `2px solid var(--box-border)` pour beige/gothique/cyberpunk ; givre gardée telle quelle (1px, déjà suffisamment visible, thème marqué fini).

## `.vous-caractere-panel`/`.vous-caractere-textarea` : classes à part, pas `.create-box`

Le panneau "Caractère" de la page Moi (`vous-caractere-panel`/`vous-caractere-textarea`) n'utilise **pas** les classes `.create-box`/`.create-textarea` habituelles — ce sont des classes dédiées définies dans `base.css` avec leurs propres couleurs par défaut, dont un fond **brun foncé codé en dur** (`#8B6F47`) sur le textarea. Comme elles ne font pas partie de la chaîne `.create-box:not(...)`, elles ne reçoivent **aucune** des couleurs de thème par défaut et doivent être stylées explicitement par thème, sinon elles gardent ce brun foncé même sur les thèmes clairs comme beige. Seul `frosted.css` avait déjà les règles ; `noir.css` n'avait que le panneau (dans `base.css` en plus, pas dans le fichier du thème — incohérent avec le reste) ; `beige.css` et `cyberpunk.css` n'avaient rien. Ajouté pour beige (`var(--box-bg)`/`var(--box-border)`/`var(--box-text)`, même schéma que frosted). Ajouté aussi pour cyberpunk (mêmes variables + glow au focus) : le fond/la bordure sont uniquement sur `.vous-caractere-textarea`, pas sur `.vous-caractere-panel` (voir le piège de double-boîte documenté plus bas — le panneau doit rester un pur conteneur de mise en page).

## Piège `assets.barre2`/`barre3` en beige : la clé JS ne correspondait pas au fichier

Dans `themeAssets.ts`, le thème **beige** avait un mapping décalé par rapport aux 3 autres thèmes : la clé `barre2` pointait en réalité vers `barreprogression.png` (pas vers `beige/barre2.png`), et la clé `barre3` pointait vers `beige/barre2.png` (le vrai fichier "barre2" était donc caché sous le nom `barre3`). Pour noir/cyberpunk/frosted, le mapping était direct (`barre1`→`barre1.png`, etc.). Conséquence concrète : demander "utilise `assets.barre2`" dans du JSX affichait la barre de progression sur beige au lieu du vrai `barre2.png`, un bug reproduit deux fois de suite avant d'être compris.

**Corrigé** : ajout d'une clé dédiée `barreProgression` dans `ThemeAssets` (beige → `beigeBarreProgression`, noir/cyberpunk/frosted → leur propre `barre2` respectif, pour préserver le rendu existant de `CropPhoto.tsx`/`GenererPhoto.tsx`, seuls consommateurs de l'ancienne barre de progression). `barre2`/`barre3` de beige pointent maintenant honnêtement vers les vrais fichiers (`barre2: beigeBarre2`, `barre3: beigeBarre2` aussi car il n'existe plus de 3ᵉ fichier distinct pour beige, son ancien `barre3.png` ayant été supprimé — `barre3` y est un simple alias de `barre2`).

**Leçon** : avant d'utiliser `assets.barreN` dans du JSX/CSS pour une clé qu'on n'a pas encore vérifiée sur le thème actif, comparer visuellement (ou via `identify`/`convert ... -resize 1x1 txt:-` pour une couleur dominante rapide) plutôt que de faire confiance au nom de la clé.

## Gothique : `barre1.png` (gris) mis en réserve, `barre3.png` (vert) promu `barre1.png`

Sur demande explicite (l'app affichait 3 couleurs de barre distinctes sur "Mon profil" - rouge `barre2`, vert `barre3`, gris `barre1` inutilisé sur cette page - et seules 2 étaient voulues) : `gothique/barre1.png` déplacé en réserve (`rab/1barre1.png`, même convention que les fichiers numérotés des autres thèmes) et `gothique/barre3.png` renommé en `barre1.png`. Toutes les références code à `gothique/barre3.png` (import `noirBarre3` dans `themeAssets.ts`, `url('../images/gothique/barre3.png')` dans `noir.css` pour le bouton "Envoyer" du popup de signalement) mises à jour vers `barre1.png` en conséquence. Effet de bord assumé et voulu : `.crop-btn` et le zoom (déjà en `barre1`/anciennement `barre3`) affichent désormais le vert partout où ils apparaissent.
