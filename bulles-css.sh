#!/bin/bash
# Bulles de discussion : style graphique en CSS pur, un bloc par thème (10 thèmes). Remplace l'essai « cadre image » (bulles-cadre.sh).
# Idempotent. À lancer depuis la racine du projet.
f=src/styles/base/_17-chat-bulles.scss

# 1) retire l'ancien essai « cadre image » et ses variables dans les thèmes
sed -i '/Bulles : cadre image/,$d' "$f"
sed -i '/Bulles : style graphique en CSS pur/,$d' "$f"
for t in src/styles/*.scss; do
  sed -i '/--img-bulle:/d; /--img-bulle-ia:/d; /--img-bulle-user:/d; /--bulle-cadre:/d; /--bulle-padding:/d; /--bulle-rayon:/d; /--bulle-icone-decal:/d; /--bulle-volutes:/d' "$t"
done

# 2) les pastilles (haut-parleur, relancer, crayon, copier) ont leur propre fond plein, car le fond des bulles est translucide
sed -i 's/background: var(--bulle-ia-bg) !important;/background: var(--bulle-pastille-ia, var(--bulle-ia-bg)) !important;/; s/background: var(--bulle-user-bg) !important;/background: var(--bulle-pastille-user, var(--bulle-user-bg)) !important;/' "$f"

# 3) le crayon (écrire) seulement sous le dernier message de l'IA
python3 - <<'PY'
p = 'src/pages/PersonnagePage.tsx'
s = open(p, encoding='utf-8').read()
if 'dernierIdIA' in s:
    print('TSX déjà modifié')
else:
    a = "    return (\n        <div\n            className=\"page-content-container personnage-page\""
    assert a in s, 'return introuvable'
    s = s.replace(a, "    // Le crayon (écrire / modifier) n'apparaît que sous le dernier message de l'IA.\n    const dernierIdIA = [...messages].reverse().find((m) => m.sender === 'character')?.id;\n\n" + a, 1)
    i = s.index('onClick={() => handleStartEdit(message)}')
    d = s.rfind('<button', 0, i)
    d = s.rfind('\n', 0, d) + 1
    f_ = s.index('</button>\n', i) + len('</button>\n')
    ind = s[d:s.index('<button', d)]
    s = s[:d] + ind + "{message.sender === 'character' && message.id === dernierIdIA && (\n" + s[d:f_] + ind + ")}\n" + s[f_:]
    open(p, 'w', encoding='utf-8').write(s)
    print('TSX ok')
PY

# 4) blocs par thème
cat >> "$f" <<'SCSS'

// Bulles : style graphique en CSS pur, un bloc par thème (aperçu : bulles-css.html).
// Chaque bloc règle les couleurs (--bulle-*) et le décor des bulles IA / utilisateur. Classe doublée pour passer devant les fichiers de thème.
$ia: '.create-box.personnage-bubble.personnage-salutation-box';
$us: '.create-box.personnage-bubble.personnage-user-box';

// Pensée (*...*), icônes et trait des pastilles : réglés par bulle (IA / utilisateur) dans chaque thème.
#{$ia} .personnage-texte-action { color: var(--bulle-ia-action, var(--bulle-action-texte)); }
#{$us} .personnage-texte-action { color: var(--bulle-user-action, var(--bulle-action-texte)); }
#{$ia} .personnage-bubble-action-btn { color: var(--bulle-ia-icone, var(--bulle-action-icone)) !important; }
#{$us} .personnage-bubble-action-btn { color: var(--bulle-user-icone, var(--bulle-action-icone)) !important; }
.personnage-bubble-action-btn::after { border-width: var(--bulle-trait, 1.5px); }

// Pseudo-élément libre : annule les volutes (masque, fond) pour en faire un décor posé à la main.
@mixin deco-libre {
    content: '';
    position: absolute;
    inset: auto;
    -webkit-mask: none;
    mask: none;
    background: none;
    pointer-events: none;
}
// Coins en équerre (4 petits traits aux angles), couleur $c, longueur $s, épaisseur $w.
@mixin equerres($c, $s: 12px, $w: 2px) {
    @include deco-libre;
    inset: -4px;
    background-image: linear-gradient($c, $c), linear-gradient($c, $c), linear-gradient($c, $c), linear-gradient($c, $c),
        linear-gradient($c, $c), linear-gradient($c, $c), linear-gradient($c, $c), linear-gradient($c, $c);
    background-position: 0 0, 0 0, 100% 0, 100% 0, 0 100%, 0 100%, 100% 100%, 100% 100%;
    background-size: $s $w, $w $s, $s $w, $w $s, $s $w, $w $s, $s $w, $w $s;
    background-repeat: no-repeat;
}

.theme-cyberpunk.theme-cyberpunk {
    --bulle-ia-bg: rgba(8, 10, 30, 0.78); --bulle-ia-text: #e8fcff; --bulle-ia-border: #00e5ff; --bulle-pastille-ia: #0a1230; --bulle-ia-action: #ff8fe9; --bulle-ia-icone: #00e5ff; --bulle-trait: 1px;
    --bulle-user-bg: rgba(30, 8, 35, 0.78); --bulle-user-text: #ffe0f8; --bulle-user-border: #ff2bd6; --bulle-pastille-user: #240a2a; --bulle-user-action: #7fefff; --bulle-user-icone: #ff2bd6;
    #{$ia}, #{$us} { border-width: 1px; border-radius: 3px; }
    #{$ia} { box-shadow: inset 0 0 12px rgba(0, 229, 255, 0.4), 0 0 8px rgba(0, 229, 255, 0.45); }
    #{$us} { box-shadow: inset 0 0 12px rgba(255, 43, 214, 0.4), 0 0 8px rgba(255, 43, 214, 0.45); }
    #{$ia}::before { @include equerres(#00e5ff); filter: drop-shadow(0 0 3px #00e5ff); }
    #{$us}::before { @include equerres(#ff2bd6); filter: drop-shadow(0 0 3px #ff2bd6); }
    #{$ia}::after, #{$us}::after { content: none; }
}

// Dentelle : on garde les volutes d'origine, avec un second filet autour.
.theme-dentelle.theme-dentelle {
    --bulle-ia-bg: rgba(243, 230, 208, 0.85); --bulle-ia-text: #4a2f3d; --bulle-ia-border: #b99a7a; --bulle-pastille-ia: #f3e6d0; --bulle-ia-action: #8a3a5c; --bulle-ia-icone: #4a2f3d; --bulle-trait: 1px;
    --bulle-user-bg: rgba(122, 72, 92, 0.85); --bulle-user-text: #fbeee2; --bulle-user-border: #e0b8c4; --bulle-pastille-user: #7a485c; --bulle-user-action: #ffd27a; --bulle-user-icone: #fbeee2;
    #{$ia}, #{$us} { border-width: 1px; border-radius: 18px; outline: 1px solid; outline-offset: 4px; }
    #{$ia} { outline-color: #b99a7a; }
    #{$us} { outline-color: #e0b8c4; }
}

.theme-gothique.theme-gothique {
    --bulle-ia-bg: rgba(25, 18, 34, 0.84); --bulle-ia-text: #ece8f4; --bulle-ia-border: #b8b8c8; --bulle-pastille-ia: #191222; --bulle-ia-icone: #ece8f4; --bulle-trait: 1px;
    --bulle-user-bg: rgba(40, 14, 28, 0.84); --bulle-user-text: #f8e4ec; --bulle-user-border: #c04a74; --bulle-pastille-user: #280e1c; --bulle-user-icone: #f8e4ec;
    #{$ia}, #{$us} { border-width: 1px; border-radius: 2px; }
    #{$ia} { box-shadow: inset 0 0 0 3px rgba(25, 18, 34, 0.84), inset 0 0 0 4px #b8b8c8; }
    #{$us} { box-shadow: inset 0 0 0 3px rgba(40, 14, 28, 0.84), inset 0 0 0 4px #c04a74; }
    #{$ia}::before { @include equerres(#b8b8c8, 14px, 2px); }
    #{$us}::before { @include equerres(#c04a74, 14px, 2px); }
    #{$ia}::after, #{$us}::after { content: none; }
}

.theme-givre.theme-givre {
    --bulle-ia-text: #eaf6ff; --bulle-ia-border: #8fd3ff; --bulle-pastille-ia: #4e8fcf; --bulle-ia-action: #ffe9a8; --bulle-ia-icone: #eaf6ff; --bulle-trait: 1px;
    --bulle-user-text: #17324d; --bulle-user-border: #dfe9f2; --bulle-pastille-user: #cfdbe6; --bulle-user-action: #1f6fb8; --bulle-user-icone: #17324d;
    #{$ia}, #{$us} { border-width: 1px; border-radius: 16px; }
    #{$ia} {
        background: linear-gradient(160deg, rgba(143, 211, 255, 0.55), rgba(31, 95, 176, 0.65));
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8), inset 0 0 14px rgba(255, 255, 255, 0.35), 0 0 10px rgba(143, 211, 255, 0.5);
    }
    #{$us} {
        background: linear-gradient(160deg, rgba(255, 255, 255, 0.6), rgba(150, 175, 200, 0.6));
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9), inset 0 0 14px rgba(255, 255, 255, 0.35), 0 0 10px rgba(223, 233, 242, 0.5);
    }
    #{$ia}::before, #{$us}::before { content: none; }
    #{$ia}::after, #{$us}::after { @include deco-libre; content: '❄'; right: -6px; top: -10px; font-size: 18px; line-height: 1; color: #fff; text-shadow: 0 0 6px #8fd3ff; }
}

.theme-gelee.theme-gelee {
    --bulle-ia-text: #ffffff; --bulle-ia-border: #ff7eb6; --bulle-pastille-ia: #eb5096; --bulle-ia-icone: #ffffff; --bulle-trait: 2px;
    --bulle-user-text: #05423b; --bulle-user-border: #4fd8c4; --bulle-pastille-user: #28beaf; --bulle-user-icone: #05423b;
    #{$ia}, #{$us} { border-width: 0; border-radius: 26px; }
    #{$ia} { background: linear-gradient(180deg, rgba(255, 150, 200, 0.9), rgba(235, 80, 150, 0.85)); box-shadow: inset 0 6px 8px rgba(255, 255, 255, 0.55), inset 0 -6px 10px rgba(150, 0, 80, 0.35), 0 4px 10px rgba(0, 0, 0, 0.3); }
    #{$us} { background: linear-gradient(180deg, rgba(120, 240, 225, 0.9), rgba(40, 190, 175, 0.85)); box-shadow: inset 0 6px 8px rgba(255, 255, 255, 0.55), inset 0 -6px 10px rgba(0, 90, 80, 0.35), 0 4px 10px rgba(0, 0, 0, 0.3); }
    #{$ia}::before, #{$us}::before { @include deco-libre; left: 16px; right: 30px; top: 5px; height: 8px; border-radius: 8px; background: rgba(255, 255, 255, 0.55); }
    #{$ia}::after, #{$us}::after { content: none; }
}

.theme-verre-translucide.theme-verre-translucide {
    --bulle-ia-text: #ffffff; --bulle-ia-border: rgba(255, 255, 255, 0.65); --bulle-pastille-ia: #7d8c98; --bulle-ia-icone: #ffffff; --bulle-trait: 1px;
    --bulle-user-text: #ffffff; --bulle-user-border: rgba(150, 215, 255, 0.95); --bulle-pastille-user: #4a86b8; --bulle-user-icone: #ffffff;
    #{$ia}, #{$us} { border-width: 1px; border-radius: 20px; backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7), 0 6px 16px rgba(0, 0, 0, 0.25); }
    #{$ia} { background: rgba(255, 255, 255, 0.14); }
    #{$us} { background: rgba(80, 170, 255, 0.35); }
    #{$ia}::before, #{$us}::before, #{$ia}::after, #{$us}::after { content: none; }
}

.theme-laiton.theme-laiton {
    --bulle-ia-bg: rgba(61, 98, 168, 0.78); --bulle-ia-text: #f6ecd0; --bulle-ia-border: #c9a96a; --bulle-pastille-ia: #3d62a8; --bulle-ia-action: #bfe3ff; --bulle-ia-icone: #f6ecd0; --bulle-trait: 3px;
    --bulle-user-bg: rgba(120, 60, 30, 0.8); --bulle-user-text: #fbeede; --bulle-user-border: #b8683a; --bulle-pastille-user: #783c1e; --bulle-user-action: #a8f0d8; --bulle-user-icone: #fbeede;
    #{$ia}, #{$us} { border: 4px solid transparent; border-image: linear-gradient(135deg, #f6e3a1, #a67c2e 35%, #f2d98a 55%, #8a6420) 1; border-radius: 0; }
    #{$ia}::before, #{$us}::before, #{$ia}::after, #{$us}::after { @include deco-libre; width: 5px; height: 5px; border-radius: 50%; background: radial-gradient(circle at 30% 30%, #fff3c4, #8a6420); }
    #{$ia}::before, #{$us}::before { left: -2px; top: -2px; }
    #{$ia}::after, #{$us}::after { right: -2px; bottom: -2px; }
}

.theme-relief-doux.theme-relief-doux {
    --bulle-ia-bg: #d9d2c8; --bulle-ia-text: #4b443c; --bulle-ia-border: #d9d2c8; --bulle-pastille-ia: #d9d2c8; --bulle-ia-icone: #4b443c; --bulle-trait: 0px;
    --bulle-user-bg: #d8b58a; --bulle-user-text: #4b3a26; --bulle-user-border: #d8b58a; --bulle-pastille-user: #d8b58a; --bulle-user-icone: #4b3a26;
    #{$ia}, #{$us} { border-width: 0; border-radius: 22px; box-shadow: 6px 6px 12px rgba(0, 0, 0, 0.35), -5px -5px 10px rgba(255, 255, 255, 0.55), inset 1px 1px 2px rgba(255, 255, 255, 0.7); }
    #{$ia}::before, #{$us}::before, #{$ia}::after, #{$us}::after { content: none; }
}

.theme-onde-vapeur.theme-onde-vapeur {
    --bulle-ia-text: #f2e9ff; --bulle-ia-border: #ff6ad5; --bulle-pastille-ia: #230f46; --bulle-ia-icone: #ff9be6; --bulle-trait: 2px;
    --bulle-user-text: #e6fbff; --bulle-user-border: #3fe0f0; --bulle-pastille-user: #0f2346; --bulle-user-icone: #8ff1ff;
    #{$ia}, #{$us} { border: 2px solid transparent; border-radius: 14px; }
    #{$ia} { background: linear-gradient(#230f46, #230f46) padding-box, linear-gradient(90deg, #ff6ad5, #3fe0f0) border-box; }
    #{$us} { background: linear-gradient(#0f2346, #0f2346) padding-box, linear-gradient(90deg, #3fe0f0, #ff6ad5) border-box; }
    #{$ia}::before, #{$us}::before { content: none; }
    #{$ia}::after, #{$us}::after { @include deco-libre; inset: 0; border-radius: 12px; background: repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.05) 0 1px, transparent 1px 3px); }
}

.theme-vert-encapsule.theme-vert-encapsule {
    --bulle-ia-text: #ffffff; --bulle-ia-border: #d9ffe9; --bulle-pastille-ia: #2a9a68; --bulle-ia-icone: #ffffff; --bulle-trait: 2px;
    --bulle-user-text: #3a2600; --bulle-user-border: #fff3c4; --bulle-pastille-user: #b88a1f; --bulle-user-icone: #3a2600;
    #{$ia}, #{$us} { border-width: 2px; border-radius: 30px; }
    #{$ia} { background: linear-gradient(180deg, rgba(90, 220, 150, 0.9), rgba(20, 120, 80, 0.9)); box-shadow: inset 0 3px 4px rgba(255, 255, 255, 0.6), inset 0 -4px 6px rgba(0, 60, 30, 0.5), 0 0 0 3px rgba(62, 207, 142, 0.35); }
    #{$us} { background: linear-gradient(180deg, rgba(235, 205, 90, 0.95), rgba(150, 110, 20, 0.9)); box-shadow: inset 0 3px 4px rgba(255, 255, 255, 0.6), inset 0 -4px 6px rgba(80, 50, 0, 0.5), 0 0 0 3px rgba(212, 179, 74, 0.4); }
    #{$ia}::before, #{$us}::before, #{$ia}::after, #{$us}::after { content: none; }
}
SCSS
echo ok
