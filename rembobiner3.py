#!/usr/bin/env python3
# Rembobiner en un seul appui (plus de coche de confirmation) ; la coche sert maintenant au bouton Copier (1,5 s après la copie).
# À lancer après rembobiner2.py. Idempotent.
import re
p = 'src/pages/PersonnagePage.tsx'
s = open(p, encoding='utf-8').read()
if 'copieId' in s:
    print('déjà fait'); raise SystemExit
assert 'handleRembobiner' in s, "lance d'abord rembobiner.py puis rembobiner2.py"

def remplacer(a, b):
    global s
    assert a in s, 'introuvable : ' + a[:50]
    s = s.replace(a, b)

# 1) un seul appui : plus d'armement
d = s.index("        const aEffacer = index < messages.length - 1;\n")
f = s.index("        setRembobinerId(null);\n", d) + len("        setRembobinerId(null);\n")
s = s[:d] + s[f:]
remplacer("    // Rembobiner : 1er appui = armer (la flèche devient une coche, 3 s), 2e appui = confirmer. On efface tout ce qui suit :", "    // Rembobiner (un seul appui) : on efface tout ce qui suit :")
remplacer("{rembobinerId === message.id ? <IconCoche /> : <IconReload />}", "<IconReload />")
remplacer("message plus ancien = efface ce qui suit (2 appuis) et l'IA répond de nouveau", "message plus ancien = efface ce qui suit et l'IA répond de nouveau")
remplacer("(1er appui : coche ; 2e appui : efface les messages en dessous et l'IA répond de nouveau)", "(efface les messages en dessous et l'IA répond de nouveau)")
s = re.sub(r"    // Message dont le bouton « rembobiner » est armé[^\n]*\n    const \[rembobinerId, setRembobinerId\][^\n]*\n", "    // Message dont on vient de copier le texte (la coche remplace l'icône 1,5 s).\n    const [copieId, setCopieId] = useState<number | null>(null);\n", s)

# 2) coche sur Copier
remplacer("    const handleCopierMessage = (texte: string) => {\n        navigator.clipboard?.writeText(texte).catch((err) => console.log('Copie échouée', err));\n    };\n",
"""    const handleCopierMessage = (messageId: number, texte: string) => {
        navigator.clipboard?.writeText(texte).catch((err) => console.log('Copie échouée', err));
        setCopieId(messageId);
        window.setTimeout(() => setCopieId((courant) => (courant === messageId ? null : courant)), 1500);
    };
""")
remplacer("onClick={() => handleCopierMessage(message.text)}", "onClick={() => handleCopierMessage(message.id, message.text)}")
i = s.index("onClick={() => handleCopierMessage(message.id, message.text)}")
j = s.index("<IconCopier />", i)
s = s[:j] + "{copieId === message.id ? <IconCoche /> : <IconCopier />}" + s[j + len("<IconCopier />"):]
open(p, 'w', encoding='utf-8').write(s)
print('ok')
