// convertir-translations.cjs
// Convertit src/i18n/translations.ts : au lieu d'un bloc par langue (fr: {...}, en: {...}), une entrée par texte
// avec toutes les langues côte à côte (langue: { fr: 'Langue', en: 'Language', ... }).
// Le dictionnaire exporté `translations` garde exactement la même forme : aucun autre fichier n'est à modifier.
// Écrit le résultat dans un NOUVEAU fichier (translations.nouveau.ts) : l'original n'est jamais modifié.
// Utilisation (depuis la racine du projet) :  node convertir-translations.cjs

const fs = require('fs');
const path = require('path');
const ts = require(path.join(process.cwd(), 'node_modules', 'typescript'));

const SRC = process.argv[2] || 'src/i18n/translations.ts';
const OUT = process.argv[3] || 'src/i18n/translations.nouveau.ts';

const texte = fs.readFileSync(SRC, 'utf8');
const sf = ts.createSourceFile(SRC, texte, ts.ScriptTarget.Latest, true);

// Repère « export const translations = { ... } ».
let instruction = null;
sf.forEachChild((n) => {
    if (ts.isVariableStatement(n)) {
        const d = n.declarationList.declarations[0];
        if (d && d.name.getText(sf) === 'translations') instruction = n;
    }
});
if (!instruction) throw new Error("Impossible de trouver 'export const translations'.");
const objet = instruction.declarationList.declarations[0].initializer;
if (!objet || !ts.isObjectLiteralExpression(objet)) throw new Error("'translations' n'est pas un objet.");

const langues = [];
// cle -> { commentaire, valeurs: { langue: texteDeLaValeur } }
const entrees = new Map();

for (const langProp of objet.properties) {
    if (!ts.isPropertyAssignment(langProp) || !ts.isObjectLiteralExpression(langProp.initializer)) {
        throw new Error('Entrée inattendue dans translations : ' + langProp.getText(sf).slice(0, 60));
    }
    const langue = langProp.name.getText(sf).replace(/['"]/g, '');
    langues.push(langue);
    for (const p of langProp.initializer.properties) {
        if (!ts.isPropertyAssignment(p)) {
            throw new Error(`Entrée inattendue (langue ${langue}) : ` + p.getText(sf).slice(0, 60));
        }
        const cle = p.name.getText(sf);
        if (!entrees.has(cle)) entrees.set(cle, { commentaire: '', valeurs: {} });
        const e = entrees.get(cle);
        e.valeurs[langue] = p.initializer.getText(sf);
        // Commentaire placé avant la clé : on garde celui de la première langue qui en a un.
        if (!e.commentaire) {
            const ranges = ts.getLeadingCommentRanges(texte, p.getFullStart()) || [];
            const lignes = ranges
                .map((r) => texte.slice(r.pos, r.end))
                .join('\n')
                .split('\n')
                .map((l) => '    ' + l.trim());
            e.commentaire = lignes.join('\n');
        }
    }
}

const entete = texte.slice(0, instruction.getStart(sf));
const suite = texte.slice(instruction.getEnd());

let corps = '';
for (const [cle, e] of entrees) {
    if (e.commentaire.trim()) corps += e.commentaire + '\n';
    corps += `    ${cle}: {\n`;
    for (const l of langues) {
        if (e.valeurs[l] !== undefined) corps += `        ${l}: ${e.valeurs[l]},\n`;
    }
    corps += '    },\n';
}

const code = `// ===========================================
// TEXTES : une entrée par texte, avec toutes les langues côte à côte.
// Pour ajouter un texte : ajouter son nom dans l'interface Translations (plus haut),
// puis une entrée ici avec une ligne par langue (TypeScript signale une langue oubliée).
// ===========================================
export const LANGUES = [${langues.map((l) => `'${l}'`).join(', ')}] as const;
type Langue = (typeof LANGUES)[number];

// Un texte facultatif (clé avec ?) peut ne pas exister dans toutes les langues.
type Textes = {
    [K in keyof Translations]: undefined extends Translations[K]
        ? Partial<Record<Langue, Translations[K]>>
        : Record<Langue, Translations[K]>;
};

const textes: Textes = {
${corps}};

// Dictionnaire par langue (translations[langue][texte]) reconstruit à partir des textes ci-dessus :
// même forme qu'avant, les autres fichiers de l'application n'ont rien à changer.
export const translations: Record<string, Translations> = Object.fromEntries(
    LANGUES.map((langue) => [
        langue,
        Object.fromEntries(
            Object.entries(textes).map(([cle, valeurs]) => [cle, (valeurs as Record<string, unknown>)[langue]]),
        ),
    ]),
) as unknown as Record<string, Translations>;
`;

fs.writeFileSync(OUT, entete + code + suite);
console.log(`OK : ${entrees.size} textes, ${langues.length} langues -> ${OUT}`);
