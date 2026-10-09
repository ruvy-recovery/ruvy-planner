// src/App.jsx
import { useState, useEffect, useRef } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

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

const STEPS = ["Profil", "Ta semaine", "Objectifs", "Préférences", "Personnalisation"];

const COLORS = [
  { bg: "#f2f8f4", border: "#14532d", text: "#14532d" },
  { bg: "#eff6ff", border: "#1d4ed8", text: "#1d4ed8" },
];

const CATEGORIES = [
  { name: "Combat", words: ["mma", "boxe", "jjb", "jiu", "judo", "karaté", "karate", "lutte", "muay", "kick", "grappling"] },
  { name: "Musculation", words: ["muscu", "salle", "crossfit", "force", "gym", "fitness"] },
  { name: "Cardio", words: ["course", "running", "vélo", "velo", "natation", "nage", "corde", "rameur"] },
  { name: "Souplesse", words: ["yoga", "pilates", "stretching", "étirement", "etirement"] },
  { name: "Travail", words: ["travail", "boulot", "bureau", "cours", "école", "ecole", "fac"] },
];

const STORAGE_KEY = "mon-planning-v1";

function classify(title) {
  const t = String(title).toLowerCase();
  for (const c of CATEGORIES) {
    if (c.words.some((w) => t.includes(w))) return c.name;
  }
  return "Autre";
}

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

const defaultStyle = {
  bgImage: "",
  bgOpacity: 0.15,
  dayImages: {},
  dayOpacity: 0.2,
};

const toMin = (t) => {
  const [h, m] = String(t || "0:0").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

function loadSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function App() {
  const saved = useRef(loadSaved()).current;

  const [couple, setCouple] = useState(saved?.couple ?? false);
  const [people, setPeople] = useState(saved?.people ?? [emptyPerson("Toi")]);
  const [active, setActive] = useState(0);
  const [step, setStep] = useState(saved?.step ?? 0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(saved?.result ?? null);
  const [style, setStyle] = useState(saved?.style ?? defaultStyle);
  const [editing, setEditing] = useState(null);

  const [draft, setDraft] = useState({ title: "", days: [], start: "18:00", end: "19:00" });
  const [wantDraft, setWantDraft] = useState("");

  const exportRef = useRef(null);

  const person = people[active] || people[0];
  const progress = Math.round((step / (STEPS.length - 1)) * 100);

  // ----- Sauvegarde automatique -----
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ couple, people, step, result, style })
      );
    } catch {
      /* stockage plein : on ignore */
    }
  }, [couple, people, step, result, style]);

  const update = (patch) =>
    setPeople((prev) => prev.map((p, i) => (i === active ? { ...p, ...patch } : p)));

  const toggleCouple = (value) => {
    setCouple(value);
    setActive(0);
    setPeople(value ? [emptyPerson("Toi"), emptyPerson("Partenaire")] : [emptyPerson("Toi")]);
  };

  // ----- Activités fixes -----
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

  // ----- Activités à ajouter -----
  const addWant = () => {
    if (!wantDraft.trim()) return;
    update({
      wants: [
        ...person.wants,
        { title: wantDraft.trim(), sessions: 1, slots: ["soir"], days: [] },
      ],
    });
    setWantDraft("");
  };

  const removeWant = (index) =>
    update({ wants: person.wants.filter((_, i) => i !== index) });

  const updateWant = (index, patch) =>
    update({ wants: person.wants.map((w, i) => (i === index ? { ...w, ...patch } : w)) });

  const toggleWantIn = (index, key, value) => {
    const list = person.wants[index][key];
    updateWant(index, {
      [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value],
    });
  };

  // ----- Préférences globales -----
  const toggleIn = (key, value) => {
    const list = person[key];
    update({ [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value] });
  };

  // ----- Génération -----
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
      setEditing(null);
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
    setEditing(null);
    setStep(0);
    setActive(0);
    setStyle(defaultStyle);
    setPeople(couple ? [emptyPerson("Toi"), emptyPerson("Partenaire")] : [emptyPerson("Toi")]);
  };

  // ----- Édition des séances du résultat -----
  const updateEvent = (planIndex, eventIndex, patch) => {
    setResult((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        plans: prev.plans.map((p, pi) =>
          pi !== planIndex
            ? p
            : { ...p, events: p.events.map((e, ei) => (ei === eventIndex ? { ...e, ...patch } : e)) }
        ),
      };
    });
  };

  const deleteEvent = (planIndex, eventIndex) => {
    setResult((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        plans: prev.plans.map((p, pi) =>
          pi !== planIndex ? p : { ...p, events: p.events.filter((_, ei) => ei !== eventIndex) }
        ),
      };
    });
    setEditing(null);
  };

  // Renvoie la liste des avertissements pour une séance (jamais bloquant)
  const warningsFor = (planIndex, eventIndex) => {
    if (!result) return [];
    const plan = result.plans[planIndex];
    const ev = plan?.events[eventIndex];
    if (!ev) return [];
    const warnings = [];
    const s = toMin(ev.start);
    const e = toMin(ev.end);

    if (e <= s) warnings.push("L'heure de fin est avant l'heure de début.");

    plan.events.forEach((other, oi) => {
      if (oi === eventIndex || other.day !== ev.day) return;
      const os = toMin(other.start);
      const oe = toMin(other.end);
      if (s < oe && os < e) {
        warnings.push(`Chevauche « ${other.title} » (${other.start} – ${other.end}).`);
      } else {
        const gap = s >= oe ? s - oe : os - e;
        if (gap >= 0 && gap < 30) {
          warnings.push(`Moins de 30 min avec « ${other.title} ».`);
        }
      }
    });
    return warnings;
  };

  // ----- Images -----
  const onBgFile = async (file) => {
    if (!file) return;
    const url = await readFileAsDataUrl(file);
    setStyle((prev) => ({ ...prev, bgImage: url }));
  };

  const onDayFile = async (day, file) => {
    if (!file) return;
    const url = await readFileAsDataUrl(file);
    setStyle((prev) => ({ ...prev, dayImages: { ...prev.dayImages, [day]: url } }));
  };

  const clearDayImage = (day) =>
    setStyle((prev) => {
      const next = { ...prev.dayImages };
      delete next[day];
      return { ...prev, dayImages: next };
    });

  // ----- Export -----
  const captureCanvas = async () => {
    if (!exportRef.current) return null;
    return html2canvas(exportRef.current, { backgroundColor: "#ffffff", scale: 2, useCORS: true });
  };

  const exportPng = async () => {
    const canvas = await captureCanvas();
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "planning.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const exportPdf = async () => {
    const canvas = await captureCanvas();
    if (!canvas) return;
    const img = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const ratio = Math.min(pageW / canvas.width, pageH / canvas.height);
    const w = canvas.width * ratio;
    const h = canvas.height * ratio;
    pdf.addImage(img, "PNG", (pageW - w) / 2, (pageH - h) / 2, w, h);
    pdf.save("planning.pdf");
  };

  // ----- Construction d'une journée (fusion "Ensemble") -----
  const buildDay = (d) => {
    const items = [];
    result.plans.forEach((p, pi) => {
      p.events.forEach((e, ei) => {
        if (e.day === d) items.push({ ...e, owner: pi, ownerName: p.name, eventIndex: ei });
      });
    });

    const merged = [];
    const used = new Set();
    items.forEach((a, ai) => {
      if (used.has(ai)) return;
      const bi = couple
        ? items.findIndex(
            (b, j) =>
              j > ai &&
              !used.has(j) &&
              b.owner !== a.owner &&
              b.title.toLowerCase() === a.title.toLowerCase() &&
              b.start === a.start &&
              b.end === a.end
          )
        : -1;
      if (bi >= 0) {
        used.add(bi);
        merged.push({ ...a, together: true });
      } else {
        merged.push(a);
      }
      used.add(ai);
    });
    merged.sort((x, y) => x.start.localeCompare(y.start));
    return merged;
  };

  const renderWeek = (editable) => (
    <div className="week">
      {DAYS.map((d) => {
        const merged = buildDay(d);
        const dayImg = style.dayImages[d];
        return (
          <div key={d} className="day" style={{ position: "relative", overflow: "hidden" }}>
            {dayImg && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  backgroundImage: `url(${dayImg})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  opacity: style.dayOpacity,
                  pointerEvents: "none",
                }}
              />
            )}
            <div style={{ position: "relative" }}>
              <h3>{d}</h3>
              {merged.length === 0 && <div className="rest">Libre</div>}
              {merged.map((e, i) => {
                const c = e.together ? { bg: "#f5f0ff", border: "#7c3aed" } : COLORS[e.owner % COLORS.length];
                const warns = editable && !e.fixed ? warningsFor(e.owner, e.eventIndex) : [];
                const canEdit = editable && !e.fixed && !e.together;
                return (
                  <div
                    key={i}
                    className={canEdit ? "event editable" : "event"}
                    style={{
                      background: c.bg,
                      borderLeft: `3px solid ${c.border}`,
                      opacity: e.fixed ? 0.85 : 1,
                    }}
                    onClick={() => canEdit && setEditing({ plan: e.owner, index: e.eventIndex })}
                  >
                    <strong>{e.title}</strong>
                    <span>{e.start} – {e.end}</span>
                    {couple && <span className="owner">{e.together ? "Ensemble" : e.ownerName}</span>}
                    {warns.length > 0 && <span className="warn-dot">⚠ À vérifier</span>}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderEditor = () => {
    if (!editing || !result) return null;
    const plan = result.plans[editing.plan];
    const ev = plan?.events[editing.index];
    if (!ev) return null;
    const warns = warningsFor(editing.plan, editing.index);

    return (
      <div className="editor no-print">
        <div className="editor-head">
          <strong>Modifier : {ev.title}</strong>
          <button className="link" onClick={() => setEditing(null)}>Fermer</button>
        </div>

        <label className="label">Jour</label>
        <div className="chips">
          {DAYS.map((d) => (
            <button
              key={d}
              className={ev.day === d ? "chip on" : "chip"}
              onClick={() => updateEvent(editing.plan, editing.index, { day: d })}
            >
              {SHORT[d]}
            </button>
          ))}
        </div>

        <div className="row">
          <label className="field">De
            <input
              type="time"
              className="input"
              value={ev.start}
              onChange={(e) => updateEvent(editing.plan, editing.index, { start: e.target.value })}
            />
          </label>
          <label className="field">À
            <input
              type="time"
              className="input"
              value={ev.end}
              onChange={(e) => updateEvent(editing.plan, editing.index, { end: e.target.value })}
            />
          </label>
          <button className="btn ghost" onClick={() => deleteEvent(editing.plan, editing.index)}>
            Supprimer
          </button>
        </div>

        {warns.map((w, i) => (
          <p key={i} className="warn-text">⚠ {w}</p>
        ))}
        {warns.length > 0 && (
          <p className="hint">Ce n'est qu'un avertissement : tu peux garder cette séance telle quelle.</p>
        )}
      </div>
    );
  };

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
              <span>Un planning commun avec créneaux partagés</span>
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
          <p className="hint">Chaque activité peut avoir ses propres réglages : nombre de séances, moments et jours préférés.</p>

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

          <div className="wants">
            {person.wants.map((w, i) => (
              <div key={i} className="want-card">
                <div className="want-head">
                  <div>
                    <strong>{w.title}</strong>
                    <span className="tag">{classify(w.title)}</span>
                  </div>
                  <button className="link" onClick={() => removeWant(i)}>Retirer</button>
                </div>

                <label className="label">Séances par semaine</label>
                <div className="chips">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      className={w.sessions === n ? "chip on" : "chip"}
                      onClick={() => updateWant(i, { sessions: n })}
                    >
                      {n}
                    </button>
                  ))}
                </div>

                <label className="label">Moment de la journée</label>
                <div className="chips">
                  {SLOTS.map((s) => (
                    <button
                      key={s.id}
                      className={w.slots.includes(s.id) ? "chip on" : "chip"}
                      onClick={() => toggleWantIn(i, "slots", s.id)}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                <label className="label">Jours possibles <em>(aucun = tous)</em></label>
                <div className="chips">
                  {DAYS.map((d) => (
                    <button
                      key={d}
                      className={w.days.includes(d) ? "chip on" : "chip"}
                      onClick={() => toggleWantIn(i, "days", d)}
                    >
                      {SHORT[d]}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {person.wants.length === 0 && (
              <div className="want-empty">Rien d'ajouté. Tu peux passer à l'étape suivante.</div>
            )}
          </div>
        </section>
      )}

      {/* ---------- ÉTAPE 4 : PRÉFÉRENCES ---------- */}
      {step === 3 && (
        <section className="card">
          <h2>Quels jours peut-on te proposer des séances ?</h2>
          <p className="hint">Ces réglages s'appliquent à toutes tes activités (sauf si tu en as défini d'autres).</p>
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

      {/* ---------- ÉTAPE 5 : RÉSULTAT + PERSONNALISATION ---------- */}
      {step === 4 && !result && (
        <section className="card">
          <h2>Aucun planning pour l'instant</h2>
          <p className="hint">Reviens en arrière et clique sur « Générer mon planning ».</p>
          <div className="row end">
            <button className="btn ghost" onClick={() => setStep(3)}>Retour</button>
          </div>
        </section>
      )}

      {step === 4 && result && (
        <section className="card">
          <h2>{couple ? "Votre planning" : `Planning de ${result.plans[0].name}`}</h2>

          <p className="badge-ia no-print">
            {result.ai ? "✨ Planning optimisé par l'IA" : "Planning calculé par l'algorithme"}
          </p>

          {couple && (
            <div className="legend">
              {result.plans.map((p, i) => (
                <span key={i} className="legend-item">
                  <span className="dot" style={{ background: COLORS[i % COLORS.length].border }} />
                  {p.name}
                </span>
              ))}
              <span className="legend-item">
                <span className="dot" style={{ background: "#7c3aed" }} />
                Ensemble
              </span>
            </div>
          )}

          {result.plans.map((p, i) => (
            <p key={i} className="hint">
              {p.name} : {p.sessionsAdded} séance(s) ajoutée(s) sur {p.sessionsTarget} prévue(s).
              {p.restDay ? ` Repos : ${p.restDay}.` : ""}
            </p>
          ))}

          <p className="hint no-print">Clique sur une séance ajoutée pour la déplacer, changer son horaire ou la supprimer.</p>

          {/* Zone exportée (PNG / PDF / impression) */}
          <div
            ref={exportRef}
            className="export-zone"
            style={{ position: "relative", overflow: "hidden", padding: 12, background: "#fff" }}
          >
            {style.bgImage && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  backgroundImage: `url(${style.bgImage})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  opacity: style.bgOpacity,
                  pointerEvents: "none",
                }}
              />
            )}
            <div style={{ position: "relative" }}>{renderWeek(true)}</div>
          </div>

          {renderEditor()}

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

          {/* Personnalisation */}
          <div className="no-print">
            <h2>Personnalisation</h2>
            <p className="hint">Ajoute une image de fond et règle sa transparence. Tout est facultatif.</p>

            <label className="label">Image de fond du planning</label>
            <div className="row">
              <input type="file" accept="image/*" onChange={(e) => onBgFile(e.target.files?.[0])} />
              {style.bgImage && (
                <button className="link" onClick={() => setStyle({ ...style, bgImage: "" })}>Retirer</button>
              )}
            </div>
            <label className="field spaced">
              Opacité du fond : {Math.round(style.bgOpacity * 100)} %
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={style.bgOpacity}
                onChange={(e) => setStyle({ ...style, bgOpacity: Number(e.target.value) })}
              />
            </label>

            <label className="label spaced">Images par jour</label>
            <div className="day-images">
              {DAYS.map((d) => (
                <div key={d} className="day-image-row">
                  <span>{SHORT[d]}</span>
                  <input type="file" accept="image/*" onChange={(e) => onDayFile(d, e.target.files?.[0])} />
                  {style.dayImages[d] && (
                    <button className="link" onClick={() => clearDayImage(d)}>Retirer</button>
                  )}
                </div>
              ))}
            </div>
            <label className="field spaced">
              Opacité des images de jour : {Math.round(style.dayOpacity * 100)} %
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={style.dayOpacity}
                onChange={(e) => setStyle({ ...style, dayOpacity: Number(e.target.value) })}
              />
            </label>
          </div>

          <div className="row no-print end">
            <button className="btn ghost" onClick={restart}>Recommencer</button>
            <button className="btn ghost" onClick={exportPng}>Export PNG</button>
            <button className="btn ghost" onClick={exportPdf}>Export PDF</button>
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
.label.spaced { display: block; margin-top: 20px; }
.full { width: 100%; }
.shortcuts { display: flex; flex-wrap: wrap; gap: 14px; }
.link-btn { background: none; border: none; padding: 0; color: #14532d; font-size: 13px; font-weight: 500; cursor: pointer; font-family: inherit; text-decoration: underline; text-underline-offset: 3px; }
.row { display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-end; }
.row.end { justify-content: flex-end; margin-top: 32px; }
.grow { flex: 1; min-width: 160px; }
.input { padding: 11px 14px; border: 1px solid #e0e0dc; border-radius: 12px; font-size: 15px; background: #fff; color: #151515; font-family: inherit; }
.input:focus { outline: none; border-color: #14532d; box-shadow: 0 0 0 3px rgba(20,83,45,.1); }
.field { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: #6b6b6b; }
.field.spaced { margin-top: 14px; max-width: 320px; }
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
.chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 8px; }
.chip { padding: 9px 18px; border: 1px solid #e0e0dc; background: #fff; border-radius: 999px; cursor: pointer; font-size: 14px; color: #151515; font-family: inherit; transition: all .15s; }
.chip:hover { border-color: #b9b9b3; }
.chip.on { background: #14532d; color: #fff; border-color: #14532d; }
.nav { display: flex; justify-content: space-between; margin-top: 24px; }
.error { color: #b91c1c; font-size: 14px; margin-top: 18px; }
.week { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 8px; margin-top: 8px; }
.day { border: 1px solid #ececE8; border-radius: 12px; padding: 12px; min-height: 120px; background: rgba(255,255,255,.6); }
.day h3 { font-size: 13px; margin: 0 0 8px; color: #151515; font-weight: 600; }
.rest { font-size: 12px; color: #b0b0b0; }
.event { padding: 8px; border-radius: 8px; margin-bottom: 6px; display: flex; flex-direction: column; gap: 2px; font-size: 12px; }
.event.editable { cursor: pointer; }
.event.editable:hover { box-shadow: 0 0 0 2px rgba(20,83,45,.25); }
.event span { color: #6b6b6b; }
.warn-dot { color: #dc2626 !important; font-weight: 600; font-size: 11px; }
.legend { display: flex; flex-wrap: wrap; gap: 16px; margin: 0 0 14px; }
.legend-item { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: #444; }
.dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
.owner { font-size: 11px; font-weight: 600; }
.badge-ia { display: inline-block; margin: 0 0 14px; padding: 5px 14px; border-radius: 999px; background: #f3eefe; color: #5b3fd1; font-size: 13px; font-weight: 600; }
.common { margin-top: 32px; }
.wants { display: flex; flex-direction: column; gap: 14px; margin-top: 20px; }
.want-card { border: 1px solid #ececE8; border-radius: 14px; padding: 18px; display: flex; flex-direction: column; gap: 10px; background: #fafaf8; }
.want-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 4px; }
.want-head div { display: flex; align-items: center; gap: 8px; }
.want-empty { color: #a3a3a3; font-size: 14px; text-align: center; border: 1px dashed #e0e0dc; border-radius: 12px; padding: 14px; }
.editor { margin-top: 20px; padding: 18px; border: 1px solid #e0e0dc; border-radius: 14px; background: #fafaf8; display: flex; flex-direction: column; gap: 12px; }
.editor-head { display: flex; justify-content: space-between; align-items: center; }
.warn-text { color: #dc2626; font-size: 13px; margin: 0; font-weight: 500; }
.day-images { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
.day-image-row { display: flex; align-items: center; gap: 12px; font-size: 13px; }
.day-image-row span { width: 36px; font-weight: 600; }
.export-zone { border-radius: 14px; }
@media (max-width: 560px) { .card { padding: 22px; } .progress-labels { font-size: 11px; } }
@media print {
  .no-print { display: none !important; }
  body { background: #fff; }
  .app { padding: 0; max-width: none; }
  .card { border: none; padding: 0; box-shadow: none; }
  .week { grid-template-columns: repeat(7, 1fr); }
}
`;