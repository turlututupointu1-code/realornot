#!/usr/bin/env python3
# Page de discussion : même barre que « Moi » (titre.webp, mêmes dimensions) ; le drapeau est à droite DANS la barre
# et « Personnage non réel » est sous le nom, dans la barre. Idempotent, remplace aussi la version précédente du script.
import re, textwrap

p = 'src/pages/PersonnagePage.tsx'
s = open(p, encoding='utf-8').read()
if 'personnage-sous-titre' in s:
    print('TSX déjà modifié')
else:
    debut = min(i for i in (s.find('                {/* Flèche retour + titre + drapeau'),
                            s.find('                <div className="personnage-header-fixed">')) if i != -1)
    fin = s.index('                <div className="create-buttons">')
    zone = s[debut:fin]
    a = zone.index('<BanniereTitre texte={traduit.title}>') + len('<BanniereTitre texte={traduit.title}>\n')
    b = zone.index('</BanniereTitre>')
    avatar = textwrap.indent(textwrap.dedent(zone[a:b].rstrip() + '\n'), ' ' * 24)
    nouveau = '''                {/* Flèche retour + barre titre sur une seule ligne (comme « Moi », mêmes dimensions). Dans la barre : avatar à gauche, drapeau « Signaler » à droite, « Personnage non réel » sous le nom. */}
                <div className="titre-ligne">
                    <NavArrow direction="back" />
                    <BanniereTitre texte={traduit.title}>
''' + avatar + '''                        {!estCreateur && (
                            <button
                                type="button"
                                className="signaler-btn"
                                onClick={() => setSignalementOuvert(true)}
                                aria-label={t.signalerBouton}
                            >
                                <img src={assets.drapeau} alt="" className="signaler-btn-img" />
                            </button>
                        )}
                        {creation?.creatorPseudo && (
                            <span className="personnage-sous-titre">{t.personnageCreeParIA}</span>
                        )}
                    </BanniereTitre>
                </div>

'''
    s = s[:debut] + nouveau + s[fin:]
    open(p, 'w', encoding='utf-8').write(s)
    print('TSX ok')

q = 'src/styles/base/_08-entete-fixe.scss'
c = open(q, encoding='utf-8').read()
c = c.replace('.personnage-header-fixed,\n.profil-conversation-header-fixed {', '.profil-conversation-header-fixed {')
c = c.replace('.personnage-header-fixed .nav-arrow-btn,\n.personnage-header-fixed .signaler-btn,\n', '')
c = re.sub(r'\.personnage-header-fixed \.personnage-creator-banner \{[^}]*\}\n', '', c)
c = re.sub(r'\.personnage-creator-banner \{[^}]*\}\n', '', c)
c = re.sub(r'\n// Drapeau « Signaler » à droite de la barre.*', '\n', c, flags=re.S)
c = c.rstrip('\n') + '''

// Discussion avec l'IA : le drapeau « Signaler » est à droite dans la barre (symétrique de l'avatar à gauche)
// et « Personnage non réel » est sous le nom. Réglages par thème, facultatifs :
//   --sous-titre-haut  : position verticale du sous-titre dans la barre (défaut 66%)
//   --sous-titre-taille: taille du sous-titre (défaut 11px)
//   --sous-titre-decal : décalage du nom vers le haut quand il y a un sous-titre (défaut -6px)
.titre-ligne .signaler-btn {
    position: absolute;
    left: 89.7%;
    top: 42.2%;
    transform: translate(-50%, -50%);
    z-index: 2;
}
.personnage-sous-titre {
    position: absolute;
    left: 0;
    right: 0;
    top: var(--sous-titre-haut, 66%);
    text-align: center;
    font-size: var(--sous-titre-taille, 11px);
    font-weight: 600;
    line-height: 1;
    pointer-events: none;
    color: var(--titre-couleur, inherit);
    text-shadow: var(--titre-ombre, 0 1px 2px rgba(0, 0, 0, 0.6));
}
.titre-ligne:has(.personnage-sous-titre) .create-banner-text {
    transform: translateY(var(--sous-titre-decal, -6px));
}
'''
open(q, 'w', encoding='utf-8').write(c)
print('SCSS ok')
