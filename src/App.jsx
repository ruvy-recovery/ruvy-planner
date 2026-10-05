import { useState, useEffect } from "react";
import "./App.css";

const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

const CATEGORIES = [
  { id: "perso", label: "Perso", couleur: "#8b5cf6" },
  { id: "travail", label: "Travail", couleur: "#3b82f6" },
  { id: "sport", label: "Sport", couleur: "#10b981" },
  { id: "sante", label: "Santé", couleur: "#f59e0b" },
];

const jourActuel = JOURS[(new Date().getDay() + 6) % 7];

function App() {
  const [taches, setTaches] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("ruvy-planning")) || [];
    } catch {
      return [];
    }
  });
  const [texte, setTexte] = useState("");
  const [jour, setJour] = useState(jourActuel);
  const [categorie, setCategorie] = useState("perso");
  const [jourAffiche, setJourAffiche] = useState(jourActuel);

  useEffect(() => {
    localStorage.setItem("ruvy-planning", JSON.stringify(taches));
  }, [taches]);

  const ajouter = (e) => {
    e.preventDefault();
    if (!texte.trim()) return;
    setTaches([
      ...taches,
      { id: Date.now(), texte: texte.trim(), jour, categorie, fait: false },
    ]);
    setTexte("");
    setJourAffiche(jour);
  };

  const basculer = (id) =>
    setTaches(taches.map((t) => (t.id === id ? { ...t, fait: !t.fait } : t)));

  const supprimer = (id) => setTaches(taches.filter((t) => t.id !== id));

  const tachesDuJour = taches.filter((t) => t.jour === jourAffiche);
  const faites = tachesDuJour.filter((t) => t.fait).length;
  const progression = tachesDuJour.length
    ? Math.round((faites / tachesDuJour.length) * 100)
    : 0;

  const infoCat = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[0];

  return (
    <div className="app">
      <header>
        <h1>Planificateur Ruvy</h1>
        <p className="sous-titre">Organise ta vie, un jour à la fois</p>
      </header>

      <main className="carte">
        <h2>Ajouter une tâche</h2>
        <form onSubmit={ajouter} className="formulaire">
          <input
            type="text"
            placeholder="Écris une tâche..."
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
          />
          <select value={jour} onChange={(e) => setJour(e.target.value)}>
            {JOURS.map((j) => (
              <option key={j}>{j}</option>
            ))}
          </select>
          <select value={categorie} onChange={(e) => setCategorie(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
          <button type="submit">Ajouter</button>
        </form>

        <div className="jours">
          {JOURS.map((j) => {
            const nb = taches.filter((t) => t.jour === j && !t.fait).length;
            return (
              <button
                key={j}
                className={`jour ${j === jourAffiche ? "actif" : ""} ${j === jourActuel ? "aujourdhui" : ""}`}
                onClick={() => setJourAffiche(j)}
              >
                {j.slice(0, 3)}
                {nb > 0 && <span className="badge">{nb}</span>}
              </button>
            );
          })}
        </div>

        <h2>
          {jourAffiche} {jourAffiche === jourActuel && "· Aujourd'hui"}
        </h2>

        {tachesDuJour.length > 0 && (
          <div className="progression">
            <div className="barre" style={{ width: `${progression}%` }} />
            <span>{faites}/{tachesDuJour.length} terminées · {progression}%</span>
          </div>
        )}

        {tachesDuJour.length === 0 ? (
          <p className="vide">Aucune tâche pour ce jour.</p>
        ) : (
          <ul>
            {tachesDuJour.map((t) => (
              <li key={t.id} className={t.fait ? "fait" : ""}>
                <input
                  type="checkbox"
                  checked={t.fait}
                  onChange={() => basculer(t.id)}
                />
                <span className="texte">{t.texte}</span>
                <span
                  className="tag"
                  style={{ background: infoCat(t.categorie).couleur }}
                >
                  {infoCat(t.categorie).label}
                </span>
                <button onClick={() => supprimer(t.id)} aria-label="Supprimer">✕</button>
              </li>
            ))}
          </ul>
        )}
      </main>

      <footer>© 2026 Ruvy Planner</footer>
    </div>
  );
}

export default App;