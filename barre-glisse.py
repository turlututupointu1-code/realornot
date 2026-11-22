#!/usr/bin/env python3
# 1) Supprime ce qui servait à la fenêtre « les messages en dessous seront effacés » (texte traduit + styles).
# 2) Discussion : la barre (flèche + titre + drapeau) se cache quand on descend dans une longue conversation
#    et réapparaît dès qu'on remonte un peu. Idempotent. À lancer depuis la racine du projet.
import re

# ---- 1) nettoyage ----
t = 'src/translations.ts'
s = open(t, encoding='utf-8').read()
s = s.replace('    confirmerRembobiner: string;\n', '')
s = re.sub(r"    confirmerRembobiner: \{\n(?:.*\n)*?    \},\n", '', s, count=1)
open(t, 'w', encoding='utf-8').write(s)

q = 'src/styles/base/_16-popups.scss'
c = open(q, encoding='utf-8').read()
c = re.sub(r'\n/\* Confirmation "Rembobiner"[^\n]*\n(?:[^\n]*\n)*?\.personnage-rembobiner-confirmation-actions \{\n(?:[^\n]*\n)*?\}\n', '\n', c)
open(q, 'w', encoding='utf-8').write(c)
print('nettoyage ok')

# ---- 2) barre qui se cache / réapparaît ----
p = 'src/pages/PersonnagePage.tsx'
s = open(p, encoding='utf-8').read()
if 'barreVisible' in s:
    print('barre déjà modifiée')
else:
    a = "    // Genre/caractère à envoyer au personnage"
    assert a in s, 'ancre introuvable'
    s = s.replace(a, '''    // Barre (flèche + titre) : se cache quand on descend dans la conversation, réapparaît dès qu'on remonte légèrement.
    const [barreVisible, setBarreVisible] = useState(true);
    const dernierDefilementRef = useRef(0);
    useEffect(() => {
        // Écoute en capture : fonctionne que la page défile elle-même ou un conteneur interne.
        const surDefilement = (e: Event) => {
            const cible = e.target;
            const el = cible instanceof Document ? document.scrollingElement : cible;
            if (!(el instanceof HTMLElement) || el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) return;
            const y = el.scrollTop;
            const dernier = dernierDefilementRef.current;
            if (y < 10) setBarreVisible(true);
            else if (y > dernier + 4 && y > 60) setBarreVisible(false);
            else if (y < dernier - 4) setBarreVisible(true);
            dernierDefilementRef.current = y;
        };
        window.addEventListener('scroll', surDefilement, true);
        return () => window.removeEventListener('scroll', surDefilement, true);
    }, []);

''' + a, 1)
    b = '<div className="titre-ligne">'
    assert b in s, 'barre introuvable'
    s = s.replace(b, '<div className={`titre-ligne titre-ligne-collante${barreVisible ? \'\' : \' titre-ligne-cachee\'}`}>', 1)
    open(p, 'w', encoding='utf-8').write(s)
    print('TSX ok')

f = 'src/styles/base/_08-entete-fixe.scss'
c = open(f, encoding='utf-8').read()
c = re.sub(r'\n// Discussion : la barre reste collée en haut.*', '\n', c, flags=re.S)
c = c.rstrip('\n') + '''

// Discussion : la barre reste collée en haut de l'écran, se cache quand on descend et revient dès qu'on remonte un peu.
.titre-ligne-collante {
    position: sticky;
    top: calc(var(--safe-top, 0px) + 5px);
    z-index: 20;
    transition: transform 0.25s ease;
}
.titre-ligne-cachee {
    transform: translateY(calc(-100% - var(--safe-top, 0px) - 40px));
    pointer-events: none;
}
'''
open(f, 'w', encoding='utf-8').write(c)
print('SCSS ok')
