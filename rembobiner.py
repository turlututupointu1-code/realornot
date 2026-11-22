#!/usr/bin/env python3
# Rembobiner (flèche circulaire sous tes bulles) : sans popup ; 1er appui = la flèche devient une coche, 2e appui dans les 3 s = confirme.
# Confirmé : efface les messages en dessous ET l'IA répond de nouveau. Le crayon (écrire) n'existe que si le dernier message de la conversation est celui de l'IA.
# Remplace la version précédente de ce script. Idempotent. À lancer depuis la racine du projet.
p = 'src/pages/PersonnagePage.tsx'
s = open(p, encoding='utf-8').read()
if 'handleRembobiner' in s:
    print('déjà fait')
    raise SystemExit

def couper(s, debut, fin, inclure_fin=False):
    """Retire de `debut` jusqu'à `fin` (fin non incluse sauf inclure_fin) ; ne fait rien si `debut` absent."""
    i = s.find(debut)
    if i == -1:
        return s
    j = s.index(fin, i) + (len(fin) if inclure_fin else 0)
    return s[:i] + s[j:]

# --- retire la version précédente (popup) si elle est là ---
s = couper(s, "    // Message à partir duquel on rembobine", "    const [rembobinerId, setRembobinerId] = useState<number | null>(null);\n", True)
s = couper(s, "\n    // Rembobine : garde la conversation", "    };\n", True)
s = couper(s, "            {rembobinerId !== null && (", "            {signalementOuvert && (")
a = s.find("                                                {/* Rembobiner : sous les messages de l'utilisateur")
if a != -1:
    b = s.index("</button>\n", a)
    b = s.index(")}\n", b) + len(")}\n")
    s = s[:a] + s[b:]

# --- état ---
a = "    const [editDraft, setEditDraft] = useState('');\n"
assert a in s
s = s.replace(a, a + "    // Message dont le bouton « rembobiner » est armé (attend le 2e appui) ; null si aucun.\n    const [rembobinerId, setRembobinerId] = useState<number | null>(null);\n", 1)

# --- icône coche ---
a = "const IconHautParleur: React.FC"
assert a in s
s = s.replace(a, '''const IconCoche: React.FC = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
    </svg>
);

''' + a, 1)

# --- action ---
a = "    const handleCopierMessage = (texte: string) => {\n        navigator.clipboard?.writeText(texte).catch((err) => console.log('Copie échouée', err));\n    };\n"
assert a in s
s = s.replace(a, a + '''
    // Rembobiner un message de l'utilisateur : 1er appui = armer (la flèche devient une coche, 3 s), 2e appui = confirmer.
    // Confirmé : on efface tout ce qui suit ce message, puis l'IA y répond de nouveau.
    const handleRembobiner = async (messageId: number) => {
        if (isWaitingReply || !creation) return;
        if (rembobinerId !== messageId) {
            setRembobinerId(messageId);
            window.setTimeout(() => setRembobinerId((courant) => (courant === messageId ? null : courant)), 3000);
            return;
        }
        setRembobinerId(null);
        const index = messages.findIndex((m) => m.id === messageId);
        if (index === -1) return;
        const gardes = messages.slice(0, index + 1);
        setMessages(gardes);
        setFailedMessageIds((prev) => new Set([...prev].filter((x) => x <= messageId)));

        setIsWaitingReply(true);
        try {
            const envoi = gardes.filter((m) => m.id === messageId || !failedMessageIds.has(m.id));
            const { reply, etatDelta } = await askCharacterReply({
                name: creation.title,
                bio: creation.bio,
                description: creation.description,
                histoire: creation.histoire,
                salutation: creation.salutation,
                history: envoi.map((m) => ({ sender: m.sender, text: m.text })),
                etat: plierEtatMessages(envoi),
                profilUtilisateur: construireProfilUtilisateur(),
                lang,
            });
            setMessages((prev) => [...prev, { id: prev.length, sender: 'character', text: reply, etatDelta }]);
        } catch (err) {
            console.log('Réponse après rembobinage échouée', err);
            // Le message reste marqué en échec : bulle « Réessayer ».
            setFailedMessageIds((prev) => new Set(prev).add(messageId));
        } finally {
            setIsWaitingReply(false);
        }
    };
''', 1)

# --- bouton sous les bulles de l'utilisateur ---
s = s.replace("{/* Relancer : seulement sous les messages du personnage (l'utilisateur n'a pas besoin de recharger ses propres messages) */}", "{/* Relancer : régénère le message de l'IA (sous les messages de l'utilisateur, c'est « Rembobiner », juste en dessous) */}")
i = s.index('onClick={() => handleRegenerate(message.id)}')
j = s.index('</button>\n', i) + len('</button>\n')
k = s.index(')}\n', j) + len(')}\n')
m0 = s.rfind("{message.sender === 'character' && (", 0, i)
ind = s[s.rfind('\n', 0, m0) + 1:m0]
bouton = (
    ind + "{/* Rembobiner : sous les messages de l'utilisateur (1er appui : coche ; 2e appui : efface les messages en dessous et l'IA répond de nouveau) */}\n"
    + ind + "{message.sender === 'user' && (\n"
    + ind + "    <button\n"
    + ind + "        type=\"button\"\n"
    + ind + "        className=\"personnage-bubble-action-btn\"\n"
    + ind + "        onClick={() => handleRembobiner(message.id)}\n"
    + ind + "        disabled={regeneratingId !== null || isWaitingReply}\n"
    + ind + "        aria-label={t.rembobinerMessage}\n"
    + ind + "    >\n"
    + ind + "        {rembobinerId === message.id ? <IconCoche /> : <IconReload />}\n"
    + ind + "    </button>\n"
    + ind + ")}\n"
)
s = s[:k] + bouton + s[k:]

# --- crayon : seulement si le dernier message de la conversation est celui de l'IA ---
s = s.replace("message.sender === 'character' && message.id === dernierIdIA &&", "message.sender === 'character' && message.id === messages.length - 1 &&")
s = couper(s, "    // Le crayon (écrire / modifier) n'apparaît que sous le dernier message de l'IA.\n", "?.id;\n\n", True)
open(p, 'w', encoding='utf-8').write(s)
print('ok')
