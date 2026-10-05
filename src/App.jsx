import { useState, useEffect } from "react";
import "./App.css";

const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

const CATS_DEFAUT = [
  { id: "sport", label: "Sport", couleur: "#10b981" },
  { id: "travail", label: "Travail", couleur: "#3b82f6" },
  { id: "etudes", label: "Études", couleur: "#f59e0b" },
  { id: "perso", label: "Perso", couleur: "#8b5cf6" },
];

const jourActuel = JOURS[(new Date().getDay() + 6) % 7];

function charger(cle, defaut) {
  try {
    return JSON.parse(localStorage.getItem(cle)) ?? defaut;
  } catch {
    return defaut;
  }
}

function App() {
  const [activites, setActivites] = useState(() => charger("ruvy-activites", []));
  const [categories, setCategories] = useState(() => charger("ruvy-categories", CATS_DEFAUT));

  const [nom, setNom] = useState("");
  const [jours, setJours] = useState([]);
  const [debut, setDebut] = useState("18:00");
  const [fin, setFin] = useState("19:30");
  const [categorie, setCategorie] = useState("sport");
  const [frequence, setFrequence] = useState("toutes");
  const [erreur, setErreur] = useState("");

  const [nouvelleCat, setNouvelleCat] = useState("");
  const [couleurCat, setCouleurCat] = useState("#ec4899");

  useEffect(() => {
    localStorage.setItem("ruvy-activites", JSON.stringify(activites));
  }, [activites]);

  useEffect(() => {
    localStorage.setItem("ruvy-categories", JSON.stringify(categories));
  }, [categories]);

  const toggleJour = (j) => {
    setJours(jours.includes(j) ? jours.filter((x) => x !== j) : [...jours, j]);
  };

  const ajouter = (e) => {
    e.preventDefault();
    if (!nom.trim()) return setErreur("Donne un nom à l'activité.");
    if (jours.length === 0) return setErreur("Choisis au moins un jour.");
    if (fin <= debut) return setErreur("L'heure de fin doit être après l'heure de début.");

    const nouvelles = jours.map((jour) => ({
      id: crypto.randomUUID(),
      nom: nom.trim(),
      jour,
      debut,
      fin,
      categorie,
      frequence,
    }));
    setActivites([...activites, ...nouvelles]);
    setNom("");
    setJours([]);
    setErreur("");
  };

  const ajouterCategorie = () => {
    if (!nouvelleCat.trim()) return;
    const id = Date.now().toString();
    setCategories([...categories, { id, label: nouvelleCat.trim(), couleur: couleurCat }]);
    setCategorie(id);
    setNouvelleCat("");
  };

  const supprimer = (id) => setActivites(activites.filter((a) => a.id !== id));

  const infosCat = (id) =>
    categories.find((c) => c.id === id) || { label: "?", couleur: "#9ca3af" };

  // Regroupe les activités d'un jour par créneau horaire (pour couper A / B)
  const creneauxDuJour = (jour) => {
    const liste = activites
      .filter((a) => a.jour === jour)
      .sort((a, b) => a.debut.localeCompare(b.debut));
    const groupes = {};
    liste.forEach((a) => {
      const cle = a.debut + "-" + a.fin;
      if (!groupes[cle]) groupes[cle] = [];
      groupes[cle].push(a);
    });
    return Object.values(groupes);
  };

  const renderCarte = (a) => {
    const c = infosCat(a.categorie);
    return (
      <div key={a.id} className="carte" style={{ background: c.couleur }}>
        {a.frequence !== "toutes" && <span className="badge-ab">{a.frequence}</span>}
        <span className="carte-nom">{a.nom}</span>
        <button className="suppr" onClick={() => supprimer(a.id)} title="Supprimer">
          ×
        </button>
      </div>
    );
  };

  return (
    <div className="app">
      <header className="no-print">
        <h1>Planificateur Ruvy</h1>
        <p className="sous-titre">Organise ta semaine, un créneau à la fois</p>
      </header>

      {/* ---------- FORMULAIRE ---------- */}
      <form className="carte-blanche formulaire no-print" onSubmit={ajouter}>
        <h2>Ajouter une activité</h2>

        <label className="champ">
          <span>Activité</span>
          <input
            type="text"
            placeholder="Ex : MMA, Salsa, Travail…"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
          />
        </label>

        <div className="champ">
          <span>Jours</span>
          <div className="puces">
            {JOURS.map((j) => (
              <button
                type="button"
                key={j}
                className={"puce" + (jours.includes(j) ? " active" : "")}
                onClick={() => toggleJour(j)}
              >
                {j.slice(0, 3)}
              </button>
            ))}
          </div>
        </div>

        <div className="ligne">
          <label className="champ">
            <span>Début</span>
            <input type="time" value={debut} onChange={(e) => setDebut(e.target.value)} />
          </label>
          <label className="champ">
            <span>Fin</span>
            <input type="time" value={fin} onChange={(e) => setFin(e.target.value)} />
          </label>
        </div>

        <div className="champ">
          <span>Fréquence</span>
          <div className="puces">
            {[
              { id: "toutes", label: "Chaque semaine" },
              { id: "A", label: "Semaine A" },
              { id: "B", label: "Semaine B" },
            ].map((f) => (
              <button
                type="button"
                key={f.id}
                className={"puce" + (frequence === f.id ? " active" : "")}
                onClick={() => setFrequence(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="champ">
          <span>Catégorie</span>
          <div className="puces">
            {categories.map((c) => (
              <button
                type="button"
                key={c.id}
                className={"puce" + (categorie === c.id ? " active" : "")}
                style={categorie === c.id ? { background: c.couleur, borderColor: c.couleur } : {}}
                onClick={() => setCategorie(c.id)}
              >
                <span className="pastille" style={{ background: c.couleur }} />
                {c.label}
              </button>
            ))}
          </div>
          <div className="nouvelle-cat">
            <input
              type="text"
              placeholder="Nouvelle catégorie…"
              value={nouvelleCat}
              onChange={(e) => setNouvelleCat(e.target.value)}
            />
            <input
              type="color"
              value={couleurCat}
              onChange={(e) => setCouleurCat(e.target.value)}
            />
            <button type="button" className="btn-secondaire" onClick={ajouterCategorie}>
              + Créer
            </button>
          </div>
        </div>

        {erreur && <p className="erreur">{erreur}</p>}

        <button type="submit" className="btn-principal">
          Ajouter au planning
        </button>
      </form>

      {/* ---------- PLANNING SEMAINE ---------- */}
      <section className="carte-blanche planning">
        <div className="planning-entete">
          <h2>Mon planning</h2>
          <button className="btn-secondaire no-print" onClick={() => window.print()}>
            🖨️ Imprimer
          </button>
        </div>

        <div className="semaine">
          {JOURS.map((jour) => {
            const creneaux = creneauxDuJour(jour);
            return (
              <div key={jour} className={"colonne" + (jour === jourActuel ? " aujourdhui" : "")}>
                <h3>{jour}</h3>
                {creneaux.length === 0 && <p className="vide">—</p>}
                {creneaux.map((groupe) => (
                  <div key={groupe[0].debut + groupe[0].fin} className="creneau">
                    <div className="heure">
                      {groupe[0].debut} – {groupe[0].fin}
                    </div>
                    <div className="cartes">{groupe.map(renderCarte)}</div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        {categories.length > 0 && (
          <div className="legende">
            {categories.map((c) => (
              <span key={c.id}>
                <span className="pastille" style={{ background: c.couleur }} /> {c.label}
              </span>
            ))}
          </div>
        )}
      </section>

      <footer className="no-print">© 2026 Ruvy Planner</footer>
    </div>
  );
}

export default App;