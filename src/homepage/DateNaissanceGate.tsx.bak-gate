/* src/homepage/DateNaissanceGate.tsx */
import { useState, useMemo, useRef } from 'react';
import '../homepage/AgeGate.css';
import '../homepage/PrenomGate.css';
import { useUiLang } from '../context/theme';
import { definirPrenomRencontre } from '../utils/rencontre';

interface DateNaissanceGateProps {
  onConfirme: () => void;
  onRejete: () => void;
}

const MIN_AGE = 18;

function getDaysInMonth(month: number, year: number) {
  return new Date(year, month, 0).getDate();
}

function calculateAge(day: number, month: number, year: number) {
  const today = new Date();
  const birthDate = new Date(year, month - 1, day);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

/* Molette générique réutilisable pour jour / mois / année. */
function WheelColumn({
  values,
  selected,
  onChange,
}: {
  values: number[];
  selected: number;
  onChange: (val: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const ITEM_HEIGHT = 40;

  const handleScroll = () => {
    if (!containerRef.current) return;
    const index = Math.round(containerRef.current.scrollTop / ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(values.length - 1, index));
    if (values[clamped] !== selected) {
      onChange(values[clamped]);
    }
  };

  return (
    <div className="age-gate__wheel-outer">
      <div className="age-gate__wheel" ref={containerRef} onScroll={handleScroll}>
        <div className="age-gate__wheel-spacer" style={{ height: ITEM_HEIGHT * 2 }} />
        {values.map((val) => (
          <div
            key={val}
            className={`age-gate__wheel-item ${val === selected ? 'is-selected' : ''}`}
            style={{ height: ITEM_HEIGHT }}
          >
            {val}
          </div>
        ))}
        <div className="age-gate__wheel-spacer" style={{ height: ITEM_HEIGHT * 2 }} />
      </div>
      <div className="age-gate__wheel-highlight" style={{ height: ITEM_HEIGHT }} />
    </div>
  );
}

// Seule et unique étape (avec le compte pseudo/mot de passe - voir
// ModeReelGuard) de l'entrée dans le site de rencontre : prénom affiché
// publiquement et date de naissance, sur le même écran - regroupés ici
// plutôt que sur deux écrans séparés (l'ancien PrenomGate) pour éviter tout
// problème de logique "faut-il sauter cet écran ou pas" selon qu'un prénom
// a déjà été donné ailleurs. Le prénom est enregistré séparément du pseudo
// de connexion (voir definirPrenomRencontre) : contrairement au pseudo, qui
// doit rester unique pour se connecter au bon compte, le prénom n'a aucune
// contrainte d'unicité - deux personnes peuvent tout à fait s'appeler
// pareil, sans qu'un numéro y soit ajouté.
export default function DateNaissanceGate({ onConfirme, onRejete }: DateNaissanceGateProps) {
  const t = useUiLang();
  const currentYear = new Date().getFullYear();

  const [prenom, setPrenom] = useState('');
  const [day, setDay] = useState(1);
  const [month, setMonth] = useState(1);
  const [year, setYear] = useState(currentYear - MIN_AGE);
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(false);

  const days = useMemo(
    () => Array.from({ length: getDaysInMonth(month, year) }, (_, i) => i + 1),
    [month, year]
  );
  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);
  const years = useMemo(
    () => Array.from({ length: 100 }, (_, i) => currentYear - i),
    [currentYear]
  );

  const handleConfirmer = async () => {
    const valeurPrenom = prenom.trim();
    if (!valeurPrenom || chargement) return;

    const age = calculateAge(day, month, year);
    if (age < MIN_AGE) {
      setErreur(t.ageGateErreurMineur ?? 'Accès réservé aux personnes majeures.');
      onRejete();
      return;
    }

    setChargement(true);
    setErreur('');
    try {
      await definirPrenomRencontre(valeurPrenom);
      localStorage.setItem('realornot-age', String(age));
      onConfirme();
    } catch (err) {
      setErreur(err instanceof Error ? err.message : (t.compteErreurGenerique ?? 'Erreur, réessaie.'));
    } finally {
      setChargement(false);
    }
  };

  return (
    <div className="age-gate">
      <div className="age-gate__card">
        <h2>{t.prenomGateTitre ?? 'Bienvenue !'}</h2>
        <p>{t.prenomGateTexte ?? 'Indique ton prénom pour continuer.'}</p>

        <div className="prenom-gate__halo-masque">
          <input
            type="text"
            className="prenom-gate__input"
            placeholder={t.prenomGatePlaceholder ?? 'Ton prénom'}
            value={prenom}
            onChange={(e) => setPrenom(e.target.value)}
            maxLength={30}
            autoFocus
            autoCorrect="off"
            spellCheck={false}
          />
        </div>

        <h2>{t.dateNaissanceGateTitre ?? 'Ta date de naissance'}</h2>
        <p>{t.dateNaissanceGateTexte ?? 'Indique ta date de naissance pour continuer.'}</p>

        <div className="age-gate__wheel-labels">
          <span>{t.dateJourLabel ?? 'Jour'}</span>
          <span>{t.dateMoisLabel ?? 'Mois'}</span>
          <span>{t.dateAnneeLabel ?? 'Année'}</span>
        </div>

        <div className="age-gate__wheels">
          <WheelColumn values={days} selected={day} onChange={setDay} />
          <WheelColumn values={months} selected={month} onChange={setMonth} />
          <WheelColumn values={years} selected={year} onChange={setYear} />
        </div>

        {erreur && <p className="age-gate__error">{erreur}</p>}

        <div className="age-gate__actions">
          <button
            className="age-gate__confirm"
            onClick={handleConfirmer}
            disabled={chargement || !prenom.trim()}
          >
            {t.valider ?? 'Confirmer'}
          </button>
        </div>
      </div>
    </div>
  );
}
