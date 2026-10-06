// src/App.jsx
import { useState } from "react";

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const SHORT = { Lundi: "Lun", Mardi: "Mar", Mercredi: "Mer", Jeudi: "Jeu", Vendredi: "Ven", Samedi: "Sam", Dimanche: "Dim" };

const LEVELS = [
  { id: "debutant", label: "Débutant", desc: "Moins de 6 mois de pratique" },
  { id: "intermediaire", label: "Intermédiaire", desc: "Entre 6 mois et 2 ans" },
  { id: "avance", label: "Avancé", desc: "Plus de 2 ans, pratique régulière" },
];

const SLOTS = [
  { id: "matin", label: "Matin" },
  { id: "midi", label: "Midi" },
  { id: "soir", label: "Soir" },
];

const STEPS = ["Profil", "Ta semaine", "Objectifs", "Préférences", "Résultat"];

const CATEGORIES = [
  { name: "Combat", words: ["mma", "boxe", "jjb", "jiu", "judo", "karaté", "karate", "lutte", "muay", "kick", "grappling"] },
  { name: "Musculation", words: ["muscu", "salle", "crossfit", "force", "gym", "fitness"] },
  { name: "Cardio", words: ["course", "running", "vélo", "velo", "natation", "nage", "corde", "rameur"] },
  { name: "Souplesse", words: ["yoga", "pilates", "stretching", "étirement", "etirement"] },
  { name: "Travail", words: ["travail", "boulot", "bureau", "cours", "école", "ecole", "fac"] },
];

function classify(title) {
  const t = String(title).toLowerCase();
  for (const c of CATEGORIES) {
    if (c.words.some((w) => t.includes(w))) return c.name;
  }
  return "Autre";
}

// Regroupe les activités identiques (même titre + mêmes horaires) sur une seule ligne
function groupFixed(list) {
  const map = new Map();
  list.forEach((a, index) => {
    const key = `${a.title.toLowerCase()}|${a.start}|${a.end}`;
    if (!map.has(key)) {
      map.set(key, { title: a.title, start: a.start, end: a.end, days: [], indexes: [] });
    }
    const g = map.get(key);
    g.days.push(a.day);
    g.indexes.push(index);
  });
  return [...map.values()].map((g) => ({
    ...g,
    days: [...g.days].sort((a, b) => DAYS.indexOf(a) - DAYS.indexOf(b)),
  }));
}

const emptyPerson = (name) => ({
  name,
  level: "debutant",
  fixed: [],
  wants: [],
  preferredDays: [],
  preferredSlots: ["soir"],
  maxSessions: 3,
  earliest: "06:00",
  latest: "22:00",
});

export default function App() {
  const [couple, setCouple] = useState(false);
  const [people, setPeople] = useState([emptyPerson("Toi")]);
  const [active, setActive] = useState(0);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const [draft, setDraft] = useState({ title: "", days: [], start: "18:00", end: "19:00" });
  const [wantDraft, setWantDraft] = useState("");

  const person = people[active];
  const progress = Math.round((step / (STEPS.length - 1)) * 100);

  const update = (patch) =>
    setPeople((prev) => prev.map((p, i) => (i === active ? { ...p, ...patch } : p)));

  const toggleCouple = (value) => {
    setCouple(value);
    setActive(0);
    setPeople(value ? [emptyPerson("Toi"), emptyPerson("Partenaire")] : [emptyPerson("Toi")]);
  };

  // ----- Jours multiples -----
  const toggleDraftDay = (d) =>
    setDraft((prev) => ({
      ...prev,
      days: prev.days.includes(d) ? prev.days.filter((x) => x !== d) : [...prev.days, d],
    }));

  const setDraftDays = (days) => setDraft((prev) => ({ ...prev, days }));

  const addFixed = () => {
    if (!draft.title.trim() || draft.days.length === 0) return;
    const title = draft.title.trim();
    const newItems = draft.days.map((day) => ({ title, day, start: draft.start, end: draft.end }));
    update({ fixed: [...person.fixed, ...newItems] });
    setDraft({ ...draft, title: "", days: [] });
  };

  const removeGroup = (indexes) =>
    update({ fixed: person.fixed.filter((_, i) => !indexes.includes(i)) });

  const addWant = () => {
    if (!wantDraft.trim()) return;
    update({ wants: [...person.wants, { title: wantDraft.trim() }] });
    setWantDraft("");
  };

  const removeWant = (index) =>
    update({ wants: person.wants.filter((_, i) => i !== index) });

  const toggleIn = (key, value) => {
    const list = person[key];
    update({ [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value] });
  };

  const generate = async () => {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ couple, people }),
      });
      if (!r.ok) throw new Error("Erreur serveur");
      const data = await r.json();
      setResult(data);
      setStep(4);
      setActive(0);
    } catch (e) {
      setError("Impossible de générer le planning. Réessaie dans un instant.");
    } finally {
      setLoading(false);
    }
  };

  const next = () => {
    if (step === 3) generate();
    else setStep(step + 1);
  };

  const restart = () => {
    setResult(null);
    setStep(0);
    setActive(0);
    setPeople(couple ? [emptyPerson("Toi"), emptyPerson("Partenaire")] : [emptyPerson("Toi")]);
  };

  const planOf = (i) => result?.plans?.[i];
  const groups = groupFixed(person.fixed);

  return (
    <div className="app">
      <style>{css}</style>

      <header className="top no-print">
        <h1>Mon planning</h1>
        <p>Construis une semaine d'entraînement adaptée à ton niveau.</p>
      </header>

      <div className="progress no-print">
        <div className="progress-labels">
          {STEPS.map((s, i) => (
            <span key={s} className={i <= step ? "on" : ""}>{s}</span>
          ))}
        </div>
        <div className="bar"><div className="fill" style={{ width: progress + "%" }} /></div>
      </div>

      {couple && step < 4 && (
        <div className="tabs no-print">
          {people.map((p, i) => (
            <button key={i} className={i === active ? "tab on" : "tab"} onClick={() => setActive(i)}>
              {p.name}
            </button>
          ))}
        </div>
      )}

      {/* ---------- ÉTAPE 1 : PROFIL ---------- */}
      {step === 0 && (
        <section className="card">
          <h2>Pour qui est ce planning ?</h2>
          <div className="choices">
            <button className={!couple ? "choice on" : "choice"} onClick={() => toggleCouple(false)}>
              <strong>Moi seul</strong>
              <span>Un planning personnel</span>
            </button>
            <button className={couple ? "choice on" : "choice"} onClick={() => toggleCouple(true)}>
              <strong>En couple</strong>
              <span>Deux plannings et créneaux communs</span>
            </button>
          </div>

          <h2>Ton niveau</h2>
          <div className="choices">
            {LEVELS.map((l) => (
              <button
                key={l.id}
                className={person.level === l.id ? "choice on" : "choice"}
                onClick={() => update({ level: l.id })}
              >
                <strong>{l.label}</strong>
                <span>{l.desc}</span>
              </button>
            ))}
          </div>

          {couple && (
            <>
              <h2>Prénom</h2>
              <input
                className="input"
                value={person.name}
                onChange={(e) => update({ name: e.target.value })}
              />
            </>
          )}
        </section>
      )}

      {/* ---------- ÉTAPE 2 : TA SEMAINE ---------- */}
      {step === 1 && (
        <section className="card">
          <h2>Ce que tu fais déjà dans ta semaine</h2>
          <p className="hint">Sport, travail, cours... Ces activités restent prioritaires et ne bougent pas.</p>

          <div className="form-block">
            <label className="label">1. Nom de l'activité</label>
            <input
              className="input full"
              placeholder="Ex : MMA, Travail, Cours..."
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />

            <label className="label">2. Quels jours ? <em>(tu peux en cocher plusieurs)</em></label>
            <div className="chips">
              {DAYS.map((d) => (
                <button
                  key={d}
                  className={draft.days.includes(d) ? "chip on" : "chip"}
                  onClick={() => toggleDraftDay(d)}
                >
                  {SHORT[d]}
                </button>
              ))}
            </div>
            <div className="shortcuts">
              <button className="link-btn" onClick={() => setDraftDays(DAYS.slice(0, 5))}>Lun – Ven</button>
              <button className="link-btn" onClick={() => setDraftDays(DAYS.slice(5))}>Week-end</button>
              <button className="link-btn" onClick={() => setDraftDays([...DAYS])}>Tous les jours</button>
              <button className="link-btn" onClick={() => setDraftDays([])}>Effacer</button>
            </div>

            <label className="label">3. De quelle heure à quelle heure ?</label>
            <div className="row">
              <label className="field">De
                <input type="time" className="input" value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} />
              </label>
              <label className="field">À
                <input type="time" className="input" value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })} />
              </label>
              <button
                className="btn"
                onClick={addFixed}
                disabled={!draft.title.trim() || draft.days.length === 0}
              >
                Ajouter
              </button>
            </div>
          </div>

          <ul className="list">
            {groups.map((g, i) => (
              <li key={i}>
                <div>
                  <strong>{g.title}</strong>
                  <span className="tag">{classify(g.title)}</span>
                  <small>{g.days.map((d) => SHORT[d]).join(", ")} · {g.start} – {g.end}</small>
                </div>
                <button className="link" onClick={() => removeGroup(g.indexes)}>Retirer</button>
              </li>
            ))}
            {groups.length === 0 && <li className="empty">Aucune activité ajoutée pour l'instant.</li>}
          </ul>
        </section>
      )}

      {/* ---------- ÉTAPE 3 : OBJECTIFS ---------- */}
      {step === 2 && (
        <section className="card">
          <h2>Ce que tu veux ajouter</h2>
          <p className="hint">Les activités que tu aimerais intégrer. L'IA les classe et les place pour toi.</p>

          <div className="row">
            <input
              className="input grow"
              placeholder="Ex : Boxe, Yoga, Course..."
              value={wantDraft}
              onChange={(e) => setWantDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addWant()}
            />
            <button className="btn" onClick={addWant}>Ajouter</button>
          </div>

          <ul className="list">
            {person.wants.map((w, i) => (
              <li key={i}>
                <div>
                  <strong>{w.title}</strong>
                  <span className="tag">{classify(w.title)}</span>
                </div>
                <button className="link" onClick={() => removeWant(i)}>Retirer</button>
              </li>
            ))}
            {person.wants.length === 0 && <li className="empty">Rien d'ajouté. Tu peux passer à l'étape suivante.</li>}
          </ul>
        </section>
      )}

      {/* ---------- ÉTAPE 4 : PRÉFÉRENCES ---------- */}
      {step === 3 && (
        <section className="card">
          <h2>Quels jours peut-on te proposer des séances ?</h2>
          <p className="hint">Ne sélectionne rien si tous les jours te conviennent.</p>
          <div className="chips">
            {DAYS.map((d) => (
              <button
                key={d}
                className={person.preferredDays.includes(d) ? "chip on" : "chip"}
                onClick={() => toggleIn("preferredDays", d)}
              >
                {SHORT[d]}
              </button>
            ))}
          </div>

          <h2>À quel moment de la journée ?</h2>
          <p className="hint">Tu peux en choisir plusieurs.</p>
          <div className="chips">
            {SLOTS.map((s) => (
              <button
                key={s.id}
                className={person.preferredSlots.includes(s.id) ? "chip on" : "chip"}
                onClick={() => toggleIn("preferredSlots", s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>

          <h2>Combien de séances veux-tu ajouter par semaine ?</h2>
          <p className="hint">En plus des activités que tu fais déjà.</p>
          <div className="chips">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                className={person.maxSessions === n ? "chip on" : "chip"}
                onClick={() => update({ maxSessions: n })}
              >
                {n}
              </button>
            ))}
          </div>

          <h2>Entre quelles heures peut-on te proposer des séances ?</h2>
          <p className="hint">Aucune séance ne sera placée en dehors de cette plage.</p>
          <div className="row">
            <label className="field">De
              <input type="time" className="input" value={person.earliest} onChange={(e) => update({ earliest: e.target.value })} />
            </label>
            <label className="field">À
              <input type="time" className="input" value={person.latest} onChange={(e) => update({ latest: e.target.value })} />
            </label>
          </div>
          {error && <p className="error">{error}</p>}
        </section>
      )}

      {/* ---------- ÉTAPE 5 : RÉSULTAT ---------- */}
      {step === 4 && result && (
        <section className="card">
          {couple && (
            <div className="tabs no-print">
              {result.plans.map((p, i) => (
                <button key={i} className={i === active ? "tab on" : "tab"} onClick={() => setActive(i)}>
                  {p.name}
                </button>
              ))}
            </div>
          )}

          {planOf(active) && (
            <>
              <h2>Planning de {planOf(active).name}</h2>
              <p className="hint">
                {planOf(active).sessionsAdded} séance(s) ajoutée(s) sur {planOf(active).sessionsTarget} prévue(s).
                {planOf(active).restDay ? ` Jour de repos : ${planOf(active).restDay}.` : ""}
              </p>

              <div className="week">
                {DAYS.map((d) => {
                  const evs = planOf(active).events.filter((e) => e.day === d);
                  return (
                    <div key={d} className="day">
                      <h3>{d}</h3>
                      {evs.length === 0 && (
                        <div className="rest">{planOf(active).restDay === d ? "Repos" : "Libre"}</div>
                      )}
                      {evs.map((e, i) => (
                        <div key={i} className={e.fixed ? "event fixed" : "event added"}>
                          <strong>{e.title}</strong>
                          <span>{e.start} – {e.end}</span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {couple && result.commonSlots?.length > 0 && (
            <div className="common">
              <h2>Créneaux libres en commun</h2>
              <ul className="list">
                {result.commonSlots.map((s, i) => (
                  <li key={i}>
                    <div><strong>{s.day}</strong><small>{s.start} – {s.end}</small></div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="row no-print end">
            <button className="btn ghost" onClick={restart}>Recommencer</button>
            <button className="btn" onClick={() => window.print()}>Imprimer</button>
          </div>
        </section>
      )}

      {step < 4 && (
        <footer className="nav no-print">
          <button className="btn ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>
            Retour
          </button>
          <button className="btn" disabled={loading} onClick={next}>
            {step === 3 ? (loading ? "Génération..." : "Générer mon planning") : "Suivant"}
          </button>
        </footer>
      )}
    </div>
  );
}

const css = `
* { box-sizing: border-box; }
body { margin: 0; background: #f7f7f5; -webkit-font-smoothing: antialiased; }
.app { max-width: 820px; margin: 0 auto; padding: 48px 20px 80px; font-family: Inter, system-ui, -apple-system, sans-serif; color: #151515; }
.top h1 { font-size: 32px; margin: 0 0 8px; letter-spacing: -0.03em; font-weight: 700; }
.top p { margin: 0; color: #6b6b6b; font-size: 16px; }
.progress { margin: 36px 0 24px; }
.progress-labels { display: flex; justify-content: space-between; font-size: 13px; color: #a3a3a3; margin-bottom: 10px; }
.progress-labels .on { color: #151515; font-weight: 600; }
.bar { height: 3px; background: #e7e7e4; border-radius: 4px; overflow: hidden; }
.fill { height: 100%; background: #14532d; transition: width .35s ease; }
.tabs { display: flex; gap: 8px; margin-bottom: 16px; }
.tab { padding: 9px 18px; border: 1px solid #e3e3df; background: #fff; border-radius: 999px; cursor: pointer; font-size: 14px; color: #151515; font-family: inherit; }
.tab.on { background: #151515; color: #fff; border-color: #151515; }
.card { background: #fff; border: 1px solid #ebebe8; border-radius: 20px; padding: 36px; box-shadow: 0 1px 2px rgba(0,0,0,.03); }
.card h2 { font-size: 18px; margin: 32px 0 6px; color: #151515; font-weight: 600; letter-spacing: -0.01em; }
.card h2:first-child { margin-top: 0; }
.hint { color: #6b6b6b; font-size: 14px; margin: 0 0 14px; line-height: 1.5; }
.choices { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-top: 12px; }
.choice { text-align: left; padding: 18px; border: 1px solid #e3e3df; background: #fff; border-radius: 14px; cursor: pointer; display: flex; flex-direction: column; gap: 4px; color: #151515; font-family: inherit; font-size: 15px; transition: border-color .15s; }
.choice span { font-size: 13px; color: #6b6b6b; }
.choice:hover { border-color: #b9b9b3; }
.choice.on { border-color: #14532d; background: #f2f8f4; }
.form-block { display: flex; flex-direction: column; gap: 10px; background: #fafaf8; border: 1px solid #efefeb; border-radius: 16px; padding: 22px; margin-top: 8px; }
.label { font-size: 14px; font-weight: 600; margin-top: 10px; }
.label:first-child { margin-top: 0; }
.label em { font-weight: 400; color: #8a8a8a; font-style: normal; }
.full { width: 100%; }
.shortcuts { display: flex; flex-wrap: wrap; gap: 14px; }
.link-btn { background: none; border: none; padding: 0; color: #14532d; font-size: 13px; font-weight: 500; cursor: pointer; font-family: inherit; text-decoration: underline; text-underline-offset: 3px; }
.row { display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-end; }
.row.end { justify-content: flex-end; margin-top: 32px; }
.grow { flex: 1; min-width: 160px; }
.input { padding: 11px 14px; border: 1px solid #e0e0dc; border-radius: 12px; font-size: 15px; background: #fff; color: #151515; font-family: inherit; }
.input:focus { outline: none; border-color: #14532d; box-shadow: 0 0 0 3px rgba(20,83,45,.1); }
.field { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: #6b6b6b; }
.btn { padding: 11px 22px; border-radius: 12px; border: 1px solid #14532d; background: #14532d; color: #fff; font-size: 15px; font-weight: 500; cursor: pointer; font-family: inherit; }
.btn:hover:not(:disabled) { background: #0f4023; }
.btn:disabled { opacity: .4; cursor: not-allowed; }
.btn.ghost { background: #fff; color: #151515; border-color: #e0e0dc; }
.btn.ghost:hover:not(:disabled) { background: #f5f5f3; }
.link { background: none; border: none; color: #9a9a9a; cursor: pointer; font-size: 13px; font-family: inherit; }
.link:hover { color: #b91c1c; }
.list { list-style: none; padding: 0; margin: 20px 0 0; display: flex; flex-direction: column; gap: 8px; }
.list li { display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; border: 1px solid #ececE8; border-radius: 12px; background: #fff; }
.list li div { display: flex; flex-direction: column; gap: 3px; }
.list small { color: #6b6b6b; font-size: 13px; }
.list .empty { color: #a3a3a3; font-size: 14px; justify-content: center; border-style: dashed; background: transparent; }
.tag { display: inline-block; margin-left: 8px; padding: 2px 9px; font-size: 11px; background: #f0f0ed; border-radius: 999px; color: #555; font-weight: 500; }
.chips { display: flex; flex-wrap: wrap; gap: 8px; }
.chip { padding: 9px 18px; border: 1px solid #e0e0dc; background: #fff; border-radius: 999px; cursor: pointer; font-size: 14px; color: #151515; font-family: inherit; transition: all .15s; }
.chip:hover { border-color: #b9b9b3; }
.chip.on { background: #14532d; color: #fff; border-color: #14532d; }
.nav { display: flex; justify-content: space-between; margin-top: 24px; }
.error { color: #b91c1c; font-size: 14px; margin-top: 18px; }
.week { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 8px; margin-top: 8px; }
.day { border: 1px solid #ececE8; border-radius: 12px; padding: 12px; min-height: 120px; }
.day h3 { font-size: 13px; margin: 0 0 8px; color: #151515; font-weight: 600; }
.rest { font-size: 12px; color: #b0b0b0; }
.event { padding: 8px; border-radius: 8px; margin-bottom: 6px; display: flex; flex-direction: column; gap: 2px; font-size: 12px; }
.event.fixed { background: #f3f3f1; color: #151515; }
.event.added { background: #f2f8f4; border: 1px solid #14532d; color: #151515; }
.event span { color: #6b6b6b; }
.common { margin-top: 32px; }
@media (max-width: 560px) { .card { padding: 22px; } .progress-labels { font-size: 11px; } }
@media print {
  .no-print { display: none !important; }
  body { background: #fff; }
  .app { padding: 0; max-width: none; }
  .card { border: none; padding: 0; box-shadow: none; }
  .week { grid-template-columns: repeat(7, 1fr); }
}
`;