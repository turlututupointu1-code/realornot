#!/usr/bin/env python3
"""
theme_editor.py - Éditeur de thèmes graphiques, application de bureau.

Lancer avec :
    python3 theme_editor.py

Puis choisir le dossier racine du projet (celui qui contient src/).

Fonctions :
- Un menu déroulant liste les dossiers d'images (src/images/*) et retrouve
  automatiquement le fichier .scss du thème correspondant (via $dossier: '...';).
- Affiche TOUTES les variables --xxx déclarées dans ce fichier, éditables :
  sélecteur de couleur pour les valeurs qui sont une couleur pure (ex.
  --box-bg: #6d0000;), simple champ texte pour les valeurs composées (ex.
  --histoire-box-border: 3px solid var(--box-border);) - éditables à la main
  dans ce cas, pas de sélecteur de couleur automatique.
- Bouton "Ajouter un thème" : copie un thème existant sous un nouveau nom
  (fichier .scss + sélecteur .theme-X + $dossier renommés), ajoute l'import
  dans App.tsx, l'entrée dans le registre THEMES de theme.ts (couleur
  copiée du thème source, à ajuster), et une entrée provisoire à traduire
  dans les 10 langues de translations.ts.

Dépendance : Python 3 avec tkinter, inclus dans la plupart des installations
Python. Si absent (Debian/Ubuntu) : sudo apt install python3-tk
"""
from __future__ import annotations

import re
import tkinter as tk
from tkinter import ttk, filedialog, messagebox, colorchooser, simpledialog
from pathlib import Path

HEX_RE = re.compile(r'^#[0-9a-fA-F]{3,8}$')
VAR_DECL_RE = re.compile(r'^(\s*--[\w-]+):\s*([^;]+);\s*$')


class ThemeEditor(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Éditeur de thèmes")
        self.geometry("720x600")
        self.racine: Path | None = None
        self.scss_actuel: Path | None = None
        self.champs: dict[str, tuple[tk.StringVar, int]] = {}

        self._construire_interface()
        self.after(100, self._choisir_racine)

    # ---------- Interface ----------
    def _construire_interface(self):
        barre = tk.Frame(self)
        barre.pack(fill='x', padx=8, pady=8)
        tk.Button(barre, text="Changer de dossier projet", command=self._choisir_racine).pack(side='left')
        tk.Button(barre, text="Ajouter un thème", command=self._ouvrir_ajout_theme).pack(side='left', padx=8)

        select_frame = tk.Frame(self)
        select_frame.pack(fill='x', padx=8, pady=(0, 8))
        tk.Label(select_frame, text="Dossier d'images :").pack(side='left')
        self.combo_dossier = ttk.Combobox(select_frame, state='readonly')
        self.combo_dossier.pack(side='left', padx=8, fill='x', expand=True)
        self.combo_dossier.bind('<<ComboboxSelected>>', self._on_dossier_choisi)

        conteneur = tk.Frame(self)
        conteneur.pack(fill='both', expand=True, padx=8, pady=8)
        self.canvas = tk.Canvas(conteneur, borderwidth=0)
        scrollbar = tk.Scrollbar(conteneur, orient='vertical', command=self.canvas.yview)
        self.frame_vars = tk.Frame(self.canvas)
        self.frame_vars.bind('<Configure>', lambda e: self.canvas.configure(scrollregion=self.canvas.bbox('all')))
        self.canvas.create_window((0, 0), window=self.frame_vars, anchor='nw')
        self.canvas.configure(yscrollcommand=scrollbar.set)
        self.canvas.pack(side='left', fill='both', expand=True)
        scrollbar.pack(side='right', fill='y')

        bas = tk.Frame(self)
        bas.pack(fill='x', padx=8, pady=8)
        self.label_fichier = tk.Label(bas, text="Aucun fichier chargé", anchor='w')
        self.label_fichier.pack(side='left', fill='x', expand=True)
        tk.Button(bas, text="Enregistrer", command=self._enregistrer, bg='#4caf50', fg='white').pack(side='right')

    # ---------- Choix du dossier projet ----------
    def _choisir_racine(self):
        dossier = filedialog.askdirectory(title="Dossier racine du projet (contenant src/)")
        if not dossier:
            if self.racine is None:
                messagebox.showwarning("Requis", "Un dossier de projet est nécessaire pour continuer.")
            return
        racine = Path(dossier)
        if not (racine / 'src').is_dir():
            messagebox.showerror("Dossier invalide", "Ce dossier ne contient pas de sous-dossier 'src/'.")
            return
        self.racine = racine
        self._rafraichir_liste_dossiers()

    def _rafraichir_liste_dossiers(self):
        images_dir = self.racine / 'src' / 'images'
        if not images_dir.is_dir():
            messagebox.showerror("Introuvable", f"{images_dir} introuvable.")
            return
        dossiers = sorted(p.name for p in images_dir.iterdir() if p.is_dir())
        self.combo_dossier['values'] = dossiers
        self.combo_dossier.set('')
        self._vider_variables()

    # ---------- Résolution dossier -> fichier .scss ----------
    def _trouver_scss_pour_dossier(self, dossier_image: str) -> Path | None:
        styles_dir = self.racine / 'src' / 'styles'
        for scss_file in styles_dir.glob('*.scss'):
            contenu = scss_file.read_text(encoding='utf-8')
            m = re.search(r"\$dossier:\s*'([^']+)';", contenu)
            if m and m.group(1) == dossier_image:
                return scss_file
        return None

    def _on_dossier_choisi(self, event=None):
        dossier_image = self.combo_dossier.get()
        scss_file = self._trouver_scss_pour_dossier(dossier_image)
        if scss_file is None:
            messagebox.showerror(
                "Introuvable",
                f"Aucun fichier .scss dans src/styles/ n'a \"$dossier: '{dossier_image}';\"."
            )
            return
        self._charger_scss(scss_file)

    # ---------- Chargement des variables ----------
    def _vider_variables(self):
        for widget in self.frame_vars.winfo_children():
            widget.destroy()
        self.champs = {}
        self.scss_actuel = None
        self.label_fichier.config(text="Aucun fichier chargé")

    def _charger_scss(self, scss_file: Path):
        self._vider_variables()
        self.scss_actuel = scss_file
        self.label_fichier.config(text=str(scss_file))

        lignes = scss_file.read_text(encoding='utf-8').splitlines()
        row = 0
        for i, ligne in enumerate(lignes):
            m = VAR_DECL_RE.match(ligne)
            if not m:
                continue
            nom_var = m.group(1).strip()
            valeur = m.group(2).strip()

            tk.Label(self.frame_vars, text=nom_var, anchor='w', width=30).grid(
                row=row, column=0, sticky='w', padx=4, pady=2
            )

            var_str = tk.StringVar(value=valeur)
            tk.Entry(self.frame_vars, textvariable=var_str, width=32).grid(
                row=row, column=1, sticky='we', padx=4, pady=2
            )

            if HEX_RE.match(valeur):
                swatch = tk.Label(self.frame_vars, text='  ', bg=valeur, relief='sunken', width=3)
                swatch.grid(row=row, column=2, padx=4)

                def choisir_couleur(var_str=var_str, swatch=swatch):
                    couleur = colorchooser.askcolor(color=var_str.get())[1]
                    if couleur:
                        var_str.set(couleur)
                        swatch.config(bg=couleur)

                tk.Button(self.frame_vars, text="...", command=choisir_couleur, width=3).grid(
                    row=row, column=3, padx=4
                )
            else:
                # Valeur composée (ex. "3px solid #8a6f4f" ou "var(--box-border)") :
                # pas de sélecteur de couleur automatique, modifiable à la main
                # dans le champ texte seulement.
                tk.Label(self.frame_vars, text="(texte libre)", fg='#888', width=12).grid(
                    row=row, column=2, columnspan=2, sticky='w', padx=4
                )

            self.champs[nom_var] = (var_str, i)
            row += 1

        if row == 0:
            tk.Label(self.frame_vars, text="Aucune variable --xxx trouvée dans ce fichier.").grid(row=0, column=0)

        self.frame_vars.columnconfigure(1, weight=1)

    # ---------- Enregistrement ----------
    def _enregistrer(self):
        if self.scss_actuel is None:
            messagebox.showwarning("Rien à enregistrer", "Choisissez d'abord un dossier d'images.")
            return
        lignes = self.scss_actuel.read_text(encoding='utf-8').splitlines(keepends=True)
        for nom_var, (var_str, idx) in self.champs.items():
            nouvelle_valeur = var_str.get().strip()
            ancienne_ligne = lignes[idx]
            m = VAR_DECL_RE.match(ancienne_ligne.rstrip('\n'))
            if not m:
                continue
            fin_de_ligne = '\n' if ancienne_ligne.endswith('\n') else ''
            lignes[idx] = f"{m.group(1)}: {nouvelle_valeur};{fin_de_ligne}"
        self.scss_actuel.write_text(''.join(lignes), encoding='utf-8')
        messagebox.showinfo("Enregistré", f"{self.scss_actuel.name} mis à jour.")

    # ---------- Ajout d'un thème ----------
    def _ouvrir_ajout_theme(self):
        if self.racine is None:
            messagebox.showwarning("Requis", "Choisissez d'abord le dossier du projet.")
            return
        nouveau = simpledialog.askstring("Ajouter un thème", "Nom du nouveau thème (identifiant, ex. gelee) :")
        if not nouveau:
            return
        source = simpledialog.askstring(
            "Ajouter un thème",
            "Thème source à copier (couleurs de départ, laisser vide = gothique) :"
        ) or 'gothique'

        rapport = ajouter_theme(self.racine, nouveau.strip(), source.strip())
        messagebox.showinfo("Ajouter un thème", '\n'.join(rapport))
        self._rafraichir_liste_dossiers()


def ajouter_theme(racine: Path, nouveau: str, source: str) -> list[str]:
    """Crée/complète un thème : copie le .scss si besoin, ajoute l'import
    dans App.tsx, l'entrée dans THEMES (theme.ts), et une entrée provisoire
    dans translations.ts. Peut être appelée indépendamment de l'interface
    (voir add_theme.py pour l'équivalent en ligne de commande)."""
    rapport = []
    nom_affiche = nouveau[0].upper() + nouveau[1:]

    scss_file = racine / 'src' / 'styles' / f'{nouveau}.scss'
    images_dir = racine / 'src' / 'images' / nouveau
    app_file = racine / 'src' / 'App.tsx'
    theme_file = racine / 'src' / 'context' / 'theme.ts'
    trad_file = racine / 'src' / 'i18n' / 'translations.ts'
    source_scss = racine / 'src' / 'styles' / f'{source}.scss'

    if not scss_file.exists():
        if source_scss.exists():
            contenu_source = source_scss.read_text(encoding='utf-8')
            contenu_nouveau = re.sub(rf'\.theme-{re.escape(source)}\b', f'.theme-{nouveau}', contenu_source)
            contenu_nouveau = re.sub(r"\$dossier:\s*'[^']+';", f"$dossier: '{nouveau}';", contenu_nouveau, count=1)
            contenu_nouveau = re.sub(
                rf'/\* src/styles/{re.escape(source)}\.scss \*/',
                f'/* src/styles/{nouveau}.scss */',
                contenu_nouveau, count=1
            )
            scss_file.write_text(contenu_nouveau, encoding='utf-8')
            rapport.append(f"✓ {scss_file.name} créé (copie de {source}.scss, couleurs à ajuster)")
        else:
            rapport.append(f"❌ Ni {scss_file} ni {source_scss} n'existent - rien créé.")
            return rapport
    else:
        rapport.append(f"✓ {scss_file} existe déjà")

    if not images_dir.exists():
        rapport.append(f"⚠️ {images_dir} introuvable - les images ne se chargeront pas tant qu'il n'existe pas.")

    if app_file.exists():
        contenu = app_file.read_text(encoding='utf-8')
        ligne_import = f"import './styles/{nouveau}.scss';"
        ligne_source = f"import './styles/{source}.scss';"
        if ligne_import in contenu:
            rapport.append("✓ Import déjà présent dans App.tsx")
        elif ligne_source in contenu:
            contenu = contenu.replace(ligne_source, f"{ligne_source}\n{ligne_import}", 1)
            app_file.write_text(contenu, encoding='utf-8')
            rapport.append("✓ Import ajouté dans App.tsx")
        else:
            rapport.append(f"⚠️ Import de {source} introuvable dans App.tsx - à ajouter à la main : {ligne_import}")
    else:
        rapport.append("⚠️ App.tsx introuvable")

    if theme_file.exists():
        contenu = theme_file.read_text(encoding='utf-8')
        if re.search(rf'^\s*{re.escape(nouveau)}:', contenu, re.MULTILINE):
            rapport.append("✓ Entrée déjà présente dans theme.ts")
        else:
            m = re.search(rf'^(\s*){re.escape(source)}:\s*(\{{[^}}]*\}}),?', contenu, re.MULTILINE)
            if m:
                indentation, valeurs = m.group(1), m.group(2)
                nouvelle_ligne = f"{indentation}{nouveau}: {valeurs}, // TODO: ajuster couleur (copié de {source})"
                contenu = contenu[:m.end()] + '\n' + nouvelle_ligne + contenu[m.end():]
                theme_file.write_text(contenu, encoding='utf-8')
                rapport.append("✓ Entrée ajoutée dans THEMES (theme.ts) - couleur copiée, à ajuster")
            else:
                rapport.append(f"⚠️ Thème source '{source}' introuvable dans THEMES - entrée à ajouter à la main")
    else:
        rapport.append("⚠️ theme.ts introuvable")

    if trad_file.exists():
        contenu = trad_file.read_text(encoding='utf-8')
        compteur = 0

        def remplacer_ligne(m):
            nonlocal compteur
            ligne = m.group(0)
            if f"'{nom_affiche}'" in ligne or f'"{nom_affiche}"' in ligne:
                return ligne
            compteur += 1
            return re.sub(r'\]\s*,?\s*$', f", '{nom_affiche}' /* TODO: traduire */]", ligne.rstrip()) + '\n'

        contenu_modifie = re.sub(r'^\s*themes:\s*\[.*\],?\s*$', remplacer_ligne, contenu, flags=re.MULTILINE)
        if compteur > 0:
            trad_file.write_text(contenu_modifie, encoding='utf-8')
            rapport.append(f"✓ {compteur} langue(s) mises à jour dans translations.ts (à traduire : '{nom_affiche}')")
        else:
            rapport.append(f"✓ '{nom_affiche}' déjà présent dans toutes les langues")
    else:
        rapport.append("⚠️ translations.ts introuvable")

    return rapport


if __name__ == '__main__':
    app = ThemeEditor()
    app.mainloop()
