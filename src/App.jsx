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
    const valeur = JSON.parse(localStorage.getItem(cle));
    return Array.isArray(valeur) ? valeur : defaut;
  } catch {
    return defaut;
  }
}

function nouvelId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
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
    if (!nom.trim()) return setErreur("Écris le nom de l'activité.");
    if (jours.length === 0) return setErreur("Choisis au moins un jour.");
    if (fin <= debut) return setErreur("L'heure de fin doit être après le début.");

    const nouvelles = jours.map((jour) => ({
      id: nouvelId(),
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

  const supprimer = (id) => {
    setActivites(activites.filter((a) => a.id !== id));
  };

  const ajouterCategorie = () => {
    if (!nouvelleCat.trim()) return;
    const id = nouvelId();
    setCategories([...categories, { id, label: nouvelleCat.trim(), couleur: couleurCat }]);
    setCategorie(id);
    setNouvelleCat("");
  };

  const couleurDe = (id) => categories.find((c) => c.id === id)?.couleur ?? "#6b7280";

  const creneauxDuJour = (jour) => {
    const liste = activites
      .filter((a) => a.jour === jour)
      .sort((a, b) => a.debut.localeCompare(b.debut));

    const groupes = {};
    liste.forEach((a) => {
      const cle = a.debut + "-" + a.fin;
      if (!groupes[cle]) groupes[cle] = { debut: a.debut, fin: a.fin, items: [] };
      groupes[cle].items.push(a);
    });
    return Object.values(groupes);
  };

  return (
    <div className="app">
      <header className="no-print">
        <h1>Ruvy Planner</h1>
        <p className="sous-titre">Ton planning de la semaine</p>
      </header>

      {/* ---------- Formulaire ---------- */}
      <div className="carte-blanche no-print">
        <h2>Ajouter une activité</h2>

        <form onSubmit={ajouter} className="formulaire">
          <label>
            Activité
            <input
              type="text"
              placeholder="Ex : MMA, Salsa, Travail..."
              value={nom}
              onChange={(e) => setNom(e.target.value)}
            />
          </label>

          <div>
            <span className="label">Jours</span>
            <div className="jours">
              {JOURS.map((j) => (
                <button
                  type="button"
                  key={j}
                  className={jours.includes(j) ? "jour-btn actif" : "jour-btn"}
                  onClick={() => toggleJour(j)}
                >
                  {j.slice(0, 3)}
                </button>
              ))}
            </div>
          </div>

          <div className="ligne">
            <label>
              Début
              <input type="time" value={debut} onChange={(e) => setDebut(e.target.value)} />
            </label>
            <label>
              Fin
              <input type="time" value={fin} onChange={(e) => setFin(e.target.value)} />
            </label>
            <label>
              Fréquence
              <select value={frequence} onChange={(e) => setFrequence(e.target.value)}>
                <option value="toutes">Toutes les semaines</option>
                <option value="A">Semaine A</option>
                <option value="B">Semaine B</option>
              </select>
            </label>
            <label>
              Catégorie
              <select value={categorie} onChange={(e) => setCategorie(e.target.value)}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {erreur && <p className="erreur">{erreur}</p>}

          <button type="submit" className="btn-principal">
            Ajouter au planning
          </button>
        </form>

        <div className="nouvelle-cat">
          <span className="label">Créer une catégorie</span>
          <div className="ligne">
            <input
              type="text"
              placeholder="Ex : Danse"
              value={nouvelleCat}
              onChange={(e) => setNouvelleCat(e.target.value)}
            />
            <input type="color" value={couleurCat} onChange={(e) => setCouleurCat(e.target.value)} />
            <button type="button" className="btn-secondaire" onClick={ajouterCategorie}>
              + Créer
            </button>
          </div>
        </div>
      </div>

      {/* ---------- Planning ---------- */}
      <div className="carte-blanche">
        <div className="entete-planning">
          <h2>Mon planning</h2>
          <button className="btn-principal no-print" onClick={() => window.print()}>
            🖨️ Imprimer
          </button>
        </div>

        <div className="semaine">
          {JOURS.map((jour) => {
            const creneaux = creneauxDuJour(jour);
            return (
              <div key={jour} className={jour === jourActuel ? "colonne aujourdhui" : "colonne"}>
                <h3>{jour}</h3>
                {creneaux.length === 0 && <p className="vide">—</p>}
                {creneaux.map((c) => (
                  <div key={c.debut + c.fin} className="creneau">
                    <div className="heure">
                      {c.debut} – {c.fin}
                    </div>
                    <div className="cartes">
                      {c.items.map((a) => (
                        <div key={a.id} className="carte" style={{ background: couleurDe(a.categorie) }}>
                          {a.frequence !== "toutes" && <span className="badge-ab">{a.frequence}</span>}
                          {a.nom}
                          <button className="suppr" onClick={() => supprimer(a.id)}>
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        <div className="legende">
          {categories.map((c) => (
            <span key={c.id}>
              <span className="pastille" style={{ background: c.couleur }}></span>
              {c.label}
            </span>
          ))}
        </div>
      </div>

      <footer className="no-print">Ruvy Recovery</footer>
    </div>
  );
}

export default App;