import { useState } from "react";
import "./App.css";

const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const ETAPES = ["Ta semaine", "Ton profil", "Ton planning"];

const COULEURS = {
  Travail: "#3b82f6",
  École: "#f59e0b",
  Sport: "#10b981",
  Santé: "#ef4444",
  Perso: "#8b5cf6",
};

const nouvelId = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

export default function App() {
  const [etape, setEtape] = useState(0);

  // Étape 1 : activités déjà dans la semaine
  const [existantes, setExistantes] = useState([]);
  const [nom, setNom] = useState("");
  const [jours, setJours] = useState([]);
  const [debut, setDebut] = useState("18:00");
  const [fin, setFin] = useState("19:30");
  const [semaine, setSemaine] = useState("AB");
  const [erreur, setErreur] = useState("");

  // Étape 2 : profil + ce qu'il veut ajouter
  const [ajouts, setAjouts] = useState([]);
  const [nomAjout, setNomAjout] = useState("");
  const [anciennete, setAnciennete] = useState("");
  const [niveau, setNiveau] = useState("debutant");
  const [objectif, setObjectif] = useState("");
  const [heureDebut, setHeureDebut] = useState("07:00");

  // Résultat
  const [resultat, setResultat] = useState(null);
  const [chargement, setChargement] = useState(false);
  const [erreurApi, setErreurApi] = useState("");

  const toggleJour = (j) =>
    setJours(jours.includes(j) ? jours.filter((x) => x !== j) : [...jours, j]);

  const ajouterExistante = (e) => {
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
      semaine,
    }));
    setExistantes([...existantes, ...nouvelles]);
    setNom("");
    setJours([]);
    setErreur("");
  };

  const ajouterAjout = () => {
    if (!nomAjout.trim()) return;
    setAjouts([...ajouts, { id: nouvelId(), nom: nomAjout.trim() }]);
    setNomAjout("");
  };

  const generer = async () => {
    setChargement(true);
    setErreurApi("");
    try {
      const rep = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          existantes,
          ajouts,
          limites: { debut: heureDebut },
          profil: { anciennete, niveau, objectif },
        }),
      });
      if (!rep.ok) throw new Error("Erreur serveur");
      const data = await rep.json();
      setResultat(data);
      setEtape(2);
    } catch {
      setErreurApi("Impossible de générer le planning. Réessaie dans un instant.");
    } finally {
      setChargement(false);
    }
  };

  const recommencer = () => {
    setResultat(null);
    setEtape(0);
  };

  const activitesDuJour = (jour) =>
    (resultat?.activites || [])
      .filter((a) => a.jour === jour)
      .sort((a, b) => a.debut.localeCompare(b.debut));

  return (
    <div className="app">
      <header className="no-print">
        <h1>RUVY Planner</h1>
        <p className="sous-titre">Ton planning de la semaine, organisé pour toi</p>

        <div className="progression">
          <div className="barre">
            <div className="barre-remplie" style={{ width: `${((etape + 1) / ETAPES.length) * 100}%` }} />
          </div>
          <div className="etapes-noms">
            {ETAPES.map((e, i) => (
              <span key={e} className={i <= etape ? "actif" : ""}>
                {i + 1}. {e}
              </span>
            ))}
          </div>
        </div>
      </header>

      {/* ---------- ÉTAPE 1 ---------- */}
      {etape === 0 && (
        <div className="carte-blanche no-print">
          <h2>Qu'y a-t-il déjà dans ta semaine ?</h2>
          <p className="aide">Travail, études, sport, rendez-vous… Ajoute tout ce qui est fixe.</p>

          <form onSubmit={ajouterExistante} className="formulaire">
            <label>
              Activité
              <input
                type="text"
                placeholder="Ex : Travail, Cours, JJB…"
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
                Semaines
                <select value={semaine} onChange={(e) => setSemaine(e.target.value)}>
                  <option value="AB">Toutes</option>
                  <option value="A">Semaine A</option>
                  <option value="B">Semaine B</option>
                </select>
              </label>
            </div>

            {erreur && <p className="erreur">{erreur}</p>}

            <button type="submit" className="btn-secondaire">
              + Ajouter
            </button>
          </form>

          {existantes.length > 0 && (
            <ul className="liste">
              {existantes.map((a) => (
                <li key={a.id}>
                  <span>
                    <strong>{a.nom}</strong> · {a.jour} · {a.debut}–{a.fin}
                    {a.semaine !== "AB" && ` · Sem. ${a.semaine}`}
                  </span>
                  <button
                    className="suppr"
                    onClick={() => setExistantes(existantes.filter((x) => x.id !== a.id))}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="navigation">
            <span />
            <button className="btn-principal" onClick={() => setEtape(1)}>
              Suivant →
            </button>
          </div>
        </div>
      )}

      {/* ---------- ÉTAPE 2 ---------- */}
      {etape === 1 && (
        <div className="carte-blanche no-print">
          <h2>Parle-nous de toi</h2>

          <div className="formulaire">
            <label>
              Depuis combien de temps fais-tu du sport ?
              <input
                type="text"
                placeholder="Ex : 2 ans, quelques mois…"
                value={anciennete}
                onChange={(e) => setAnciennete(e.target.value)}
              />
            </label>

            <label>
              Ton niveau
              <select value={niveau} onChange={(e) => setNiveau(e.target.value)}>
                <option value="debutant">Débutant</option>
                <option value="intermediaire">Intermédiaire</option>
                <option value="avance">Avancé</option>
              </select>
            </label>

            <label>
              Ton objectif
              <input
                type="text"
                placeholder="Ex : perdre du poids, progresser en JJB…"
                value={objectif}
                onChange={(e) => setObjectif(e.target.value)}
              />
            </label>

            <label>
              Heure à partir de laquelle tu peux t'entraîner
              <input type="time" value={heureDebut} onChange={(e) => setHeureDebut(e.target.value)} />
            </label>

            <div>
              <span className="label">Qu'est-ce que tu veux ajouter à ta semaine ?</span>
              <div className="ligne">
                <input
                  type="text"
                  placeholder="Ex : Musculation, Running, Yoga…"
                  value={nomAjout}
                  onChange={(e) => setNomAjout(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), ajouterAjout())}
                />
                <button type="button" className="btn-secondaire" onClick={ajouterAjout}>
                  + Ajouter
                </button>
              </div>
            </div>

            {ajouts.length > 0 && (
              <ul className="liste">
                {ajouts.map((a) => (
                  <li key={a.id}>
                    <strong>{a.nom}</strong>
                    <button className="suppr" onClick={() => setAjouts(ajouts.filter((x) => x.id !== a.id))}>
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {erreurApi && <p className="erreur">{erreurApi}</p>}

          <div className="navigation">
            <button className="btn-secondaire" onClick={() => setEtape(0)}>
              ← Retour
            </button>
            <button className="btn-principal" onClick={generer} disabled={chargement}>
              {chargement ? "Génération…" : "Générer mon planning"}
            </button>
          </div>
        </div>
      )}

      {/* ---------- ÉTAPE 3 : RÉSULTAT ---------- */}
      {etape === 2 && resultat && (
        <div className="carte-blanche">
          <div className="entete-planning">
            <h2>Ton planning</h2>
            <div className="no-print actions">
              <button className="btn-secondaire" onClick={() => setEtape(1)}>
                Modifier
              </button>
              <button className="btn-secondaire" onClick={recommencer}>
                Recommencer
              </button>
              <button className="btn-principal" onClick={() => window.print()}>
                Imprimer
              </button>
            </div>
          </div>

          {resultat.conseil && <p className="conseil">{resultat.conseil}</p>}

          <div className="semaine">
            {JOURS.map((jour) => {
              const liste = activitesDuJour(jour);
              return (
                <div key={jour} className="colonne">
                  <h3>{jour}</h3>
                  {liste.length === 0 && <p className="vide">Repos</p>}
                  {liste.map((a, i) => (
                    <div
                      key={i}
                      className={a.nouvelle ? "carte nouvelle" : "carte"}
                      style={{ background: COULEURS[a.categorie] || "#6b7280" }}
                    >
                      <div className="heure">
                        {a.debut} – {a.fin}
                      </div>
                      {a.nom}
                      {a.semaine !== "AB" && <span className="badge-ab">{a.semaine}</span>}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          <div className="legende">
            {Object.entries(COULEURS).map(([nomCat, couleur]) => (
              <span key={nomCat}>
                <span className="pastille" style={{ background: couleur }} />
                {nomCat}
              </span>
            ))}
          </div>
        </div>
      )}

      <footer className="no-print">RUVY Recovery</footer>
    </div>
  );
}