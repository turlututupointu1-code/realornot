/* src/pages/HomePage.tsx */
import { useNavigate } from 'react-router-dom';
import './HomePage.css';
import homeImage from '../images/home-choice.png'; // <-- remplace par le chemin de ton image générée

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="home-page">
      <img src={homeImage} alt="" className="home-page__bg" />

      <div className="home-page__overlay" />

      <div className="home-page__buttons">
        <button
          className="home-page__btn home-page__btn--real"
          onClick={() => navigate('/mode-reel')}
        >
          Personne réelle
        </button>

        <button
          className="home-page__btn home-page__btn--ai"
          onClick={() => navigate('/mode-ia')}
        >
          Intelligence Artificielle
        </button>
      </div>
    </div>
  );
}
