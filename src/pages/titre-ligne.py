#!/usr/bin/env python3
# titre-ligne.py - remplace <HeaderRetour/> + <BanniereTitre/> par une seule ligne « flèche + barre titre » (classe titre-ligne).
# Usage : cd ~/Documents/Realornot/src/pages && python3 titre-ligne.py
# Sauvegarde chaque fichier modifié en .bak. Relance possible (un fichier déjà fait est ignoré).
import re, glob, shutil

SAUTE = {'MoiPage.tsx', 'PersonnagePage.tsx'}  # Moi déjà fait ; PersonnagePage = discussion avec l'IA (inchangée)
HEADER = r'<HeaderRetour(?P<attrs>(?:\s+onClick=\{(?:[^{}]|\{[^{}]*\})*\})?)\s*/>'
BAN_OUVRE = r'<BanniereTitre\s+texte=(?:\{[^{}]*\}|"[^"]*")\s*>'
BAN_SEUL = r'<BanniereTitre\s+texte=(?:\{[^{}]*\}|"[^"]*")\s*/>'
motif = re.compile(HEADER + r'(?P<gap>\s*)(?P<ban>' + BAN_SEUL + r'|' + BAN_OUVRE + r'.*?</BanniereTitre>)', re.S)

def indente(bloc, n):
    return '\n'.join((' ' * n + l if l.strip() else l) for l in bloc.split('\n'))

def remplace(m):
    attrs = m.group('attrs').strip()
    ligne_debut = m.string.rfind('\n', 0, m.start()) + 1
    ind = len(m.string[ligne_debut:m.start()])
    pad = ' ' * ind
    ban = indente(m.group('ban'), 4)
    nav = '<NavArrow direction="back"' + (' ' + attrs if attrs else '') + ' />'
    return ('<div className="titre-ligne">\n' + pad + '    ' + nav + '\n' + pad + '    ' + ban.lstrip() + '\n' + pad + '</div>')

for f in sorted(glob.glob('*.tsx')):
    if f in SAUTE:
        continue
    s = open(f, encoding='utf-8').read()
    if 'className="titre-ligne"' in s:
        print('⏭️  ' + f + ' : déjà fait'); continue
    if '<HeaderRetour' not in s or '<BanniereTitre' not in s:
        continue
    n = len(motif.findall(s))
    nouveau = motif.sub(remplace, s)
    if n == 0:
        print('⚠️  ' + f + ' : motif non reconnu, rien changé (à faire à la main)'); continue
    if "import NavArrow" not in nouveau:
        nouveau = re.sub(r"(import \{[^}]*\} from '\.\./communs';\n)", r"\1import NavArrow from '../components/NavArrow';\n", nouveau, count=1)
    if '<HeaderRetour' not in nouveau:
        nouveau = re.sub(r"HeaderRetour, ", "", nouveau, count=1) if 'HeaderRetour, ' in nouveau else re.sub(r", HeaderRetour", "", nouveau, count=1)
        reste = ''
    else:
        reste = ' ⚠️ il reste un <HeaderRetour> (cas particulier, à vérifier)'
    shutil.copy(f, f + '.bak')
    open(f, 'w', encoding='utf-8').write(nouveau)
    print('✅ ' + f + ' : ' + str(n) + ' titre(s) remplacé(s)' + reste)
