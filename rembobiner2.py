#!/usr/bin/env python3
# Rembobiner partout : la flèche circulaire sous un message de l'IA (autre que le dernier) efface aussi tout ce qui suit, puis l'IA répond de nouveau à la place de ce message.
# Sous le dernier message de l'IA : régénère seulement son texte (rien en dessous à effacer). Sous un message de l'utilisateur : comme avant.
# 1er appui = coche (3 s), 2e appui = confirme. À lancer après rembobiner.py. Idempotent.
import re
p = 'src/pages/PersonnagePage.tsx'
s = open(p, encoding='utf-8').read()
if 'const aEffacer' in s:
    print('déjà fait'); raise SystemExit
assert 'handleRembobiner' in s, "lance d'abord rembobiner.py"

# --- nouvelle action ---
d = s.index("    // Rembobiner un message de l'utilisateur")
f = s.index("\n    };\n", d) + len("\n    };\n")
s = s[:d] + '''    // Rembobiner : 1er appui = armer (la flèche devient une coche, 3 s), 2e appui = confirmer. On efface tout ce qui suit :
    // sous un message de l'utilisateur on garde ce message, sous un message de l'IA on retire aussi ce message ; puis l'IA répond de nouveau.
    // (Sous le dernier message de l'IA, rien à effacer : c'est une simple régénération, voir handleRegenerate.)
    const handleRembobiner = async (messageId: number) => {
        if (isWaitingReply || !creation) return;
        const index = messages.findIndex((m) => m.id === messageId);
        if (index === -1) return;
        const aEffacer = index < messages.length - 1;
        if (aEffacer && rembobinerId !== messageId) {
            setRembobinerId(messageId);
            window.setTimeout(() => setRembobinerId((courant) => (courant === messageId ? null : courant)), 3000);
            return;
        }
        setRembobinerId(null);
        const gardes = messages.slice(0, messages[index].sender === 'user' ? index + 1 : index);
        if (gardes.length === 0) return;
        const dernierGardeId = gardes[gardes.length - 1].id;
        setMessages(gardes);
        setFailedMessageIds((prev) => new Set([...prev].filter((x) => x <= dernierGardeId)));

        setIsWaitingReply(true);
        try {
            const envoi = gardes.filter((m) => m.id === dernierGardeId || !failedMessageIds.has(m.id));
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
            // Le dernier message gardé est celui de l'utilisateur : bulle « Réessayer ».
            setFailedMessageIds((prev) => new Set(prev).add(dernierGardeId));
        } finally {
            setIsWaitingReply(false);
        }
    };
''' + s[f:]

# --- bouton sous les messages de l'IA ---
motif = re.compile(r"onClick=\{\(\) => handleRegenerate\(message\.id\)\}\n(\s*)disabled=\{regeneratingId !== null \|\| isWaitingReply\}\n(\s*)aria-label=\{t\.regenerer\}\n(\s*)>\n(\s*)<IconReload />")
m = motif.search(s)
assert m, 'bouton relancer introuvable'
ind = m.group(1)
s = s[:m.start()] + (
    "onClick={() => (message.id === messages.length - 1 ? handleRegenerate(message.id) : handleRembobiner(message.id))}\n"
    + ind + "disabled={regeneratingId !== null || isWaitingReply || (message.id === 0 && message.id !== messages.length - 1)}\n"
    + m.group(2) + "aria-label={t.regenerer}\n"
    + m.group(3) + ">\n"
    + m.group(4) + "{rembobinerId === message.id ? <IconCoche /> : <IconReload />}"
) + s[m.end():]
s = s.replace("{/* Relancer : régénère le message de l'IA (sous les messages de l'utilisateur, c'est « Rembobiner », juste en dessous) */}", "{/* Relancer / rembobiner : dernier message de l'IA = régénère son texte ; message plus ancien = efface ce qui suit (2 appuis) et l'IA répond de nouveau */}")
open(p, 'w', encoding='utf-8').write(s)
print('ok')
