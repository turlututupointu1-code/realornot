#!/usr/bin/env node
// simplifier-imports.cjs - à lancer depuis le dossier du projet (celui qui contient package.json) :
//   node simplifier-imports.cjs --essai     -> montre ce qui serait changé, sans rien modifier
//   node simplifier-imports.cjs             -> fait les changements
//
// Il fait deux choses :
//  1. REGROUPER : les imports qui reviennent dans presque tous les fichiers (useUiLang, useThemeAssets, HeaderRetour,
//     BanniereTitre, ChevronArrow, ProgressBar, PageDuBas) passent par un seul fichier src/communs.ts.
//     Dans chaque fichier, 2 imports ou plus de cette liste deviennent 1 seule ligne.
//  2. NETTOYER : retire les imports qui ne servent plus (même moteur que « Organiser les imports » de VS Code,
//     sans changer l'ordre des lignes).
// Chaque fichier modifié est d'abord copié dans le dossier sauvegarde-imports/ (même arborescence).
// Les fichiers des dossiers rab/ sont ignorés (ils sont exclus par tsconfig.app.json).

const fs = require('fs');
const path = require('path');

const racine = process.cwd();
const essai = process.argv.includes('--essai');
const src = path.join(racine, 'src');
const dossierSauvegarde = path.join(racine, 'sauvegarde-imports');

let ts;
try {
    ts = require(path.join(racine, 'node_modules', 'typescript'));
} catch {
    console.error('TypeScript introuvable : lance ce script depuis le dossier du projet (celui qui contient node_modules).');
    process.exit(1);
}

// Ce qu'on regroupe dans src/communs.ts. Clé = fichier sans extension, relatif à src/.
//   nommes : noms importés avec { } ; defaut : nom de l'import par défaut.
const REGROUPES = {
    'context/theme': { nommes: ['useUiLang'] },
    'assets/themeAssets': { nommes: ['useThemeAssets'] },
    'components/HeaderRetour': { defaut: 'HeaderRetour' },
    'components/BanniereTitre': { defaut: 'BanniereTitre' },
    'components/ChevronArrow': { defaut: 'ChevronArrow' },
    'components/ProgressBar': { defaut: 'ProgressBar' },
    'components/PageDuBas': { defaut: 'PageDuBas' },
};

const existe = (cheminSansExtension) =>
    ['.ts', '.tsx'].some((ext) => fs.existsSync(cheminSansExtension + ext));

// On ne garde que les fichiers qui existent vraiment dans ce projet.
const valides = Object.fromEntries(
    Object.entries(REGROUPES).filter(([cle]) => existe(path.join(src, cle)))
);

// --- Liste des fichiers du projet, d'après tsconfig.app.json (rab/ déjà exclu) ---
const cheminConfig = ['tsconfig.app.json', 'tsconfig.json'].map((f) => path.join(racine, f)).find((f) => fs.existsSync(f));
if (!cheminConfig) {
    console.error('tsconfig.app.json introuvable.');
    process.exit(1);
}
const lu = ts.readConfigFile(cheminConfig, ts.sys.readFile);
const config = ts.parseJsonConfigFileContent(lu.config, ts.sys, path.dirname(cheminConfig));
const fichiers = config.fileNames.filter(
    (f) => f.startsWith(src + path.sep) && !/[\\/](node_modules|rab)[\\/]/.test(f) && /\.(ts|tsx)$/.test(f)
);

const sauvegardes = new Set();
const sauvegarder = (fichier) => {
    if (essai || sauvegardes.has(fichier)) return;
    const cible = path.join(dossierSauvegarde, path.relative(racine, fichier));
    fs.mkdirSync(path.dirname(cible), { recursive: true });
    fs.copyFileSync(fichier, cible);
    sauvegardes.add(fichier);
};

const versPosix = (p) => p.split(path.sep).join('/');
const sansExtension = (p) => p.replace(/\.(ts|tsx)$/, '');

// --- Étape 1 : créer src/communs.ts et regrouper les imports ---
const cheminCommuns = path.join(src, 'communs.ts');
if (Object.keys(valides).length > 0) {
    const lignes = [
        '// src/communs.ts',
        '// Tout ce qui sert dans presque tous les fichiers, au même endroit : une seule ligne d\'import par fichier.',
        '// Fichier créé par simplifier-imports.cjs. Pour ajouter un élément : une ligne « export » ici.',
    ];
    for (const [cle, def] of Object.entries(valides)) {
        if (def.defaut) lignes.push(`export { default as ${def.defaut} } from './${cle}';`);
        else lignes.push(`export { ${def.nommes.join(', ')} } from './${cle}';`);
    }
    const contenu = lignes.join('\n') + '\n';
    if (!fs.existsSync(cheminCommuns) || fs.readFileSync(cheminCommuns, 'utf8') !== contenu) {
        console.log(`${essai ? '[essai] ' : ''}Création de src/communs.ts (${Object.keys(valides).length} éléments).`);
        if (!essai) fs.writeFileSync(cheminCommuns, contenu);
    }
}

const reImport = /^import\s+(?:(\w+)|\{([^}]*)\})\s+from\s+'([^']+)';?\s*$/;
let nbFichiersRegroupes = 0;
let nbLignesEnMoins = 0;

for (const fichier of fichiers) {
    const rel = sansExtension(versPosix(path.relative(src, fichier)));
    // On ne touche pas aux fichiers regroupés eux-mêmes ni à communs.ts, ni aux contextes et assets (évite les boucles d'import).
    if (rel === 'communs' || valides[rel] || rel.startsWith('context/') || rel.startsWith('assets/')) continue;

    const texte = fs.readFileSync(fichier, 'utf8');
    if (/from\s+'(\.{1,2}\/)+communs'/.test(texte)) continue; // déjà fait
    const fin = texte.includes('\r\n') ? '\r\n' : '\n';
    const lignes = texte.split(/\r?\n/);

    const noms = [];
    let positionInsertion = -1;
    const nouvelles = [];
    for (const ligne of lignes) {
        const m = ligne.match(reImport);
        if (!m || !m[3].startsWith('.')) { nouvelles.push(ligne); continue; }
        const module = versPosix(path.relative(src, path.resolve(path.dirname(fichier), m[3])));
        const def = valides[module];
        if (!def) { nouvelles.push(ligne); continue; }

        if (m[1] && def.defaut && m[1] === def.defaut) {
            // import par défaut, même nom : on le déplace
            noms.push(def.defaut);
            if (positionInsertion < 0) { positionInsertion = nouvelles.length; nouvelles.push(null); }
        } else if (m[2] !== undefined && def.nommes) {
            const liste = m[2].split(',').map((s) => s.trim()).filter(Boolean);
            const deplaces = liste.filter((n) => def.nommes.includes(n));
            const gardes = liste.filter((n) => !def.nommes.includes(n));
            if (deplaces.length === 0) { nouvelles.push(ligne); continue; }
            noms.push(...deplaces);
            if (gardes.length > 0) {
                nouvelles.push(`import { ${gardes.join(', ')} } from '${m[3]}';`);
            } else if (positionInsertion < 0) {
                positionInsertion = nouvelles.length; nouvelles.push(null);
            }
        } else {
            nouvelles.push(ligne);
        }
    }

    // Il faut au moins 2 éléments à regrouper, sinon on ne gagne rien.
    if (noms.length < 2 || positionInsertion < 0) continue;

    let relCommuns = versPosix(path.relative(path.dirname(fichier), cheminCommuns.replace(/\.ts$/, '')));
    if (!relCommuns.startsWith('.')) relCommuns = './' + relCommuns;
    const uniques = [...new Set(noms)];
    nouvelles[positionInsertion] = `import { ${uniques.join(', ')} } from '${relCommuns}';`;

    // Les lignes null restantes (autres imports déplacés) sont simplement retirées.
    const final = nouvelles.filter((l) => l !== null);
    nbFichiersRegroupes++;
    nbLignesEnMoins += lignes.length - final.length;
    console.log(`${essai ? '[essai] ' : ''}Regroupé : ${versPosix(path.relative(racine, fichier))} (${uniques.join(', ')})`);
    if (!essai) {
        sauvegarder(fichier);
        fs.writeFileSync(fichier, final.join(fin));
    }
}

// --- Étape 2 : retirer les imports inutiles ---
const service = ts.createLanguageService({
    getScriptFileNames: () => config.fileNames,
    getScriptVersion: () => '0',
    getScriptSnapshot: (f) => (fs.existsSync(f) ? ts.ScriptSnapshot.fromString(fs.readFileSync(f, 'utf8')) : undefined),
    getCurrentDirectory: () => racine,
    getCompilationSettings: () => config.options,
    getDefaultLibFileName: (o) => ts.getDefaultLibFilePath(o),
    fileExists: ts.sys.fileExists,
    readFile: ts.sys.readFile,
    readDirectory: ts.sys.readDirectory,
    directoryExists: ts.sys.directoryExists,
    getDirectories: ts.sys.getDirectories,
});

const modeRetirerSeulement = ts.OrganizeImportsMode ? ts.OrganizeImportsMode.RemoveUnused : undefined;
if (!modeRetirerSeulement) {
    console.log('Ta version de TypeScript est ancienne : le nettoyage des imports inutiles est ignoré (le regroupement est fait).');
}

// Même présentation que dans le projet : espaces autour des accolades et après les virgules, guillemets simples.
const formatage = {
    ...ts.getDefaultFormatCodeSettings('\n'),
    insertSpaceAfterOpeningAndBeforeClosingNonemptyBraces: true,
    insertSpaceAfterCommaDelimiter: true,
    semicolons: ts.SemicolonPreference ? ts.SemicolonPreference.Insert : undefined,
};

let nbFichiersNettoyes = 0;
if (modeRetirerSeulement) {
    for (const fichier of fichiers) {
        let changements;
        try {
            changements = service.organizeImports(
                { type: 'file', fileName: fichier, mode: modeRetirerSeulement },
                formatage,
                { quotePreference: 'single' }
            );
        } catch (e) {
            console.log(`Ignoré (erreur) : ${versPosix(path.relative(racine, fichier))}`);
            continue;
        }
        let texte = fs.readFileSync(fichier, 'utf8');
        const original = texte;
        const toutes = changements.flatMap((c) => c.textChanges).sort((a, b) => b.span.start - a.span.start);
        for (const c of toutes) {
            texte = texte.slice(0, c.span.start) + c.newText + texte.slice(c.span.start + c.span.length);
        }
        if (texte !== original) {
            nbFichiersNettoyes++;
            console.log(`${essai ? '[essai] ' : ''}Imports inutiles retirés : ${versPosix(path.relative(racine, fichier))}`);
            if (!essai) {
                sauvegarder(fichier);
                fs.writeFileSync(fichier, texte);
            }
        }
    }
}

console.log('');
console.log(`${essai ? '[essai] ' : ''}Terminé : ${nbFichiersRegroupes} fichier(s) regroupé(s) (${nbLignesEnMoins} ligne(s) en moins), ${nbFichiersNettoyes} fichier(s) nettoyé(s).`);
if (!essai && sauvegardes.size > 0) {
    console.log(`Les originaux sont dans ${path.relative(racine, dossierSauvegarde)}/ . Lance ensuite le build pour vérifier.`);
}
