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

const STEPS = ["Profil", "Ta semaine", "Objectifs", "Personnalisation"];

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

const STORAGE_KEY = "ruvy-planner-v2";
const MAX_SHIFT_MIN = 30;

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

function toMin(t) {
  const [h, m] = String(t || "00:00").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function overlaps(a, b) {
  return toMin(a.start) < toMin(b.end) && toMin(b.start) < toMin(a.end);
}

const emptyPerson = (name) => ({
  name,
  level: "debutant",
  fixed: [],
  wants: [],
  preferredDays: [...DAYS],
  preferredSlots: SLOTS.map((s) => s.id),
  maxSessions: 3,
  earliest: "06:00",
  latest: "22:00",
});

const defaultStyle = {
  title: "Mon planning",
  bgColor: "#ffffff",
  bgImage: "",
  bgOpacity: 0.25,
  dayImages: {},
  dayImageOpacity: 0.3,
  accent: "#a78bfa",
  personColors: ["#60a5fa", "#a8795d"],
  stickers: {},
  theme: "dark-violet",
};

function loadSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed) return null;
    const maxStep = STEPS.length - 1;
    const restoredStep = parsed.step;
    return {
      ...parsed,
      step: Number.isInteger(restoredStep) && restoredStep >= 0 && restoredStep <= maxStep ? restoredStep : 0,
      people: Array.isArray(parsed.people)
        ? parsed.people.map((p) => ({ ...p, preferredDays: [...DAYS], preferredSlots: SLOTS.map((s) => s.id) }))
        : parsed.people,
    };
  } catch {
    return null;
  }
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export default function App() {
  const saved = useRef(loadSaved()).current;

  const [couple, setCouple] = useState(saved?.couple ?? false);
  const [people, setPeople] = useState(saved?.people ?? [emptyPerson("Toi")]);
  const [active, setActive] = useState(saved?.active ?? 0);
  const [step, setStep] = useState(saved?.step ?? 0);
  const [phase, setPhase] = useState(saved?.phase ?? (saved?.result ? "editor" : "questionnaire"));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(saved?.result ?? null);
  const [style, setStyle] = useState({ ...defaultStyle, ...(saved?.style ?? {}) });
  const [exporting, setExporting] = useState(false);

  const [draft, setDraft] = useState(saved?.draft ?? { title: "", days: [], start: "18:00", end: "19:00" });
  const [wantDraft, setWantDraft] = useState(saved?.wantDraft ?? "");

  // édition d'un événement du résultat : { plan, index } ou null
  const [editing, setEditing] = useState(saved?.editing ?? null);

  const exportRef = useRef(null);

  const person = people[active] || people[0];
  const progress = Math.round((Math.min(step, STEPS.length - 1) / (STEPS.length - 1)) * 100);

  // ----- Sauvegarde automatique -----
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ couple, people, active, step, phase, result, style, draft, wantDraft, editing })
      );
    } catch (e) {
      // quota dépassé (images trop lourdes) : on ignore sans casser l'app
    }
  }, [couple, people, active, step, phase, result, style, draft, wantDraft, editing]);

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
      setStep(3); // arrive directement sur la personnalisation
      setActive(0);
      setEditing(null);
    } catch (e) {
      setError("Impossible de générer le planning. Réessaie dans un instant.");
    } finally {
      setLoading(false);
    }
  };

  const next = () => {
    if (step === 2) generate();
    else setStep(step + 1);
  };

  const restart = () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    setResult(null); setPhase("questionnaire"); setStep(0); setActive(0); setEditing(null);
    setStyle({ ...defaultStyle });
    setDraft({ title: "", days: [], start: "18:00", end: "19:00" }); setWantDraft("");
    setPeople([emptyPerson("Toi")]); setCouple(false);
  };

  // ----- Édition d'un événement du résultat -----
  const updateEvent = (planIdx, evIdx, patch) => {
    setResult((prev) => {
      if (!prev) return prev;
      const plans = prev.plans.map((p, pi) =>
        pi !== planIdx
          ? p
          : { ...p, events: p.events.map((e, ei) => (ei === evIdx ? { ...e, ...patch } : e)) }
      );
      return { ...prev, plans };
    });
  };

  const deleteEvent = (planIdx, evIdx) => {
    setResult((prev) => {
      if (!prev) return prev;
      const plans = prev.plans.map((p, pi) =>
        pi !== planIdx ? p : { ...p, events: p.events.filter((_, ei) => ei !== evIdx) }
      );
      return { ...prev, plans };
    });
    setEditing(null);
  };

  // Avertissements (rouge, sans blocage) pour un événement donné
  const warningsFor = (planIdx, evIdx) => {
    if (!result) return [];
    const plan = result.plans[planIdx];
    const ev = plan?.events[evIdx];
    if (!ev) return [];
    const warns = [];

    if (toMin(ev.end) <= toMin(ev.start)) {
      warns.push("L'heure de fin doit être après l'heure de début.");
    }

    const clash = plan.events.some(
      (o, oi) => oi !== evIdx && o.day === ev.day && overlaps(o, ev)
    );
    if (clash) warns.push("Cette séance chevauche une autre activité.");

    if (ev.origStart && Math.abs(toMin(ev.start) - toMin(ev.origStart)) > MAX_SHIFT_MIN) {
      warns.push(`Décalage de plus de ${MAX_SHIFT_MIN} minutes par rapport au créneau proposé.`);
    }
    if (ev.origDay && ev.origDay !== ev.day) {
      warns.push("Séance déplacée sur un autre jour que celui proposé.");
    }
    return warns;
  };

  const startEdit = (planIdx, evIdx) => {
    const ev = result.plans[planIdx].events[evIdx];
    // on mémorise le créneau d'origine une seule fois
    if (!ev.origStart) {
      updateEvent(planIdx, evIdx, { origStart: ev.start, origEnd: ev.end, origDay: ev.day });
    }
    setEditing({ plan: planIdx, index: evIdx });
  };

  // ----- Personnalisation -----
  const setStyleKey = (patch) => setStyle((prev) => ({ ...prev, ...patch }));

  const onBgImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try { const url = await fileToDataUrl(file); setStyleKey({ bgImage: url }); }
    catch { setError("Image trop volumineuse ou quota de stockage dépassé."); }
    e.target.value = "";
  };

  const onDayImage = async (day, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try { const url = await fileToDataUrl(file); setStyleKey({ dayImages: { ...style.dayImages, [day]: url } }); }
    catch { setError("Image trop volumineuse ou quota de stockage dépassé."); }
    e.target.value = "";
  };

  const removeDayImage = (day) => {
    const copy = { ...style.dayImages };
    delete copy[day];
    setStyleKey({ dayImages: copy });
  };

  // ----- Export -----
  const exportCanvas = async () => {
    if (!exportRef.current) return null;
    return html2canvas(exportRef.current, {
      scale: 2,
      backgroundColor: style.bgColor,
      useCORS: true,
    });
  };

  const exportPNG = async () => {
    setExporting(true);
    try {
      const canvas = await exportCanvas();
      if (!canvas) return;
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = "planning.png";
      a.click();
    } finally {
      setExporting(false);
    }
  };

  const exportPDF = async () => {
    setExporting(true);
    try {
      const canvas = await exportCanvas();
      if (!canvas) return;
      const img = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      const pw = pdf.internal.pageSize.getWidth();
      const ph = pdf.internal.pageSize.getHeight();
      const ratio = Math.min(pw / canvas.width, ph / canvas.height);
      const w = canvas.width * ratio;
      const h = canvas.height * ratio;
      pdf.addImage(img, "PNG", (pw - w) / 2, (ph - h) / 2, w, h);
      pdf.save("planning.png".replace(".png", ".pdf"));
    } finally {
      setExporting(false);
    }
  };

  const groups = groupFixed(person.fixed);

  // ----- Construction de la semaine (réutilisée pour l'affichage) -----
  // ----- Grille horaire Google Agenda : un seul planning partagé -----
  const allEvents = result?.plans?.flatMap((p, pi) => (p.events || []).map((e, ei) => ({ ...e, owner: pi, ownerName: p.name, evIndex: ei }))) || [];
  const gridStart = allEvents.length ? Math.floor(Math.min(...allEvents.map(e => toMin(e.start))) / 60) * 60 : 8 * 60;
  const gridEnd = allEvents.length ? Math.ceil(Math.max(...allEvents.map(e => toMin(e.end))) / 60) * 60 : 22 * 60;
  const gridHeight = Math.max(480, ((gridEnd - gridStart) / 60) * 64);

  const layoutDay = (day) => {
    const events = allEvents.filter(e => e.day === day).sort((a,b) => toMin(a.start)-toMin(b.start) || toMin(a.end)-toMin(b.end));
    const columns = [];
    return events.map((event) => {
      let col = 0;
      while (columns[col]?.some(other => overlaps(other, event))) col++;
      if (!columns[col]) columns[col] = [];
      columns[col].push(event);
      const group = events.filter(other => overlaps(other, event));
      const maxCols = Math.max(1, columns.length, ...group.map(other => {
        let c = 0; while (events.slice(0, events.indexOf(other)).filter(x => overlaps(x, other) && x._col === c).length) c++; return c + 1;
      }));
      event._col = col;
      return { ...event, col, cols: Math.max(maxCols, columns.filter(Boolean).length) };
    });
  };

  const renderWeek = (interactive) => (
    <div className="agenda-scroll">
      <div className="agenda" style={{ "--agenda-height": `${gridHeight}px` }}>
        <div className="time-axis" aria-hidden="true">
          <div className="axis-spacer" />
          {Array.from({ length: Math.floor((gridEnd-gridStart)/60)+1 }, (_, i) => <div className="time-label" key={i}>{String(Math.floor((gridStart+i*60)/60)).padStart(2,"0")}:00</div>)}
        </div>
        <div className="agenda-days">
          {DAYS.map((d) => {
            const dayImg = style.dayImages?.[d]; const laid = layoutDay(d);
            return <div className="agenda-day" key={d}>
              <div className="day-head">{SHORT[d]}</div>
              <div className="day-canvas" style={{ backgroundImage: dayImg ? `linear-gradient(rgba(12,9,28,.62),rgba(12,9,28,.62)),url(${dayImg})` : undefined }}>
                <div className="hour-lines">{Array.from({ length: Math.floor((gridEnd-gridStart)/60)+1 }, (_, i) => <div key={i} />)}</div>
                {laid.map((e) => {
                  const top = ((toMin(e.start)-gridStart)/(gridEnd-gridStart))*gridHeight;
                  const height = Math.max(28, ((toMin(e.end)-toMin(e.start))/(gridEnd-gridStart))*gridHeight);
                  const c = style.personColors?.[e.owner] || (e.owner === 1 ? "#a8795d" : "#60a5fa");
                  const warns = interactive ? warningsFor(e.owner, e.evIndex) : [];
                  const canEdit = interactive && !e.fixed;
                  return <div key={`${e.owner}-${e.evIndex}`} className={`agenda-event ${canEdit ? "editable" : ""}`} onClick={canEdit ? () => startEdit(e.owner,e.evIndex) : undefined} style={{ top, height, left: `calc(${(e.col/e.cols)*100}% + 2px)`, width: `calc(${(100/e.cols)}% - 4px)`, background: `${c}dd`, borderColor: warns.length ? "#f87171" : c }}>
                    <strong>{e.title}</strong><span>{e.start} – {e.end}</span>{couple && <small>{e.ownerName}</small>}{warns.length > 0 && <b className="warn-dot">⚠</b>}
                  </div>;
                })}
              </div>
            </div>;
          })}
        </div>
      </div>
    </div>
  );

  // ----- Panneau d'édition d'un événement -----
  const renderEditor = () => {
    if (!editing || !result) return null;
    const ev = result.plans[editing.plan]?.events[editing.index];
    if (!ev) return null;
    const warns = warningsFor(editing.plan, editing.index);

    return (
      <div className="editor no-print">
        <div className="editor-head">
          <strong>Modifier : {ev.title}</strong>
          <button className="link" onClick={() => setEditing(null)}>Fermer</button>
        </div>

        <div className="row">
          <label className="field">Jour
            <select
              className="input"
              value={ev.day}
              onChange={(e) => updateEvent(editing.plan, editing.index, { day: e.target.value })}
            >
              {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
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
          <p key={i} className="warn-text">{w}</p>
        ))}
        <p className="hint small">
          Les avertissements ne bloquent rien : tu peux garder ta modification.
        </p>
      </div>
    );
  };

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

      {couple && step < 3 && (
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
          {error && <p className="error">{error}</p>}
        </section>
      )}

      {/* ---------- ÉTAPE 4 : PERSONNALISATION + RÉSULTAT ---------- */}
      {step === 3 && result && (
        <>
          {/* Panneau de personnalisation (une seule page pour les deux) */}
          <section className="card no-print customization-card">
            <h2>Personnalisation</h2>
            <p className="hint">
              {couple
                ? "Un seul réglage pour le planning commun du couple."
                : "Règle l'apparence de ton planning."}
            </p>

            <label className="label">Titre du planning</label>
            <input
              className="input full"
              value={style.title}
              onChange={(e) => setStyleKey({ title: e.target.value })}
            />

            <div className="row spaced">
              <label className="field">Couleur de fond
                <input
                  type="color"
                  className="color"
                  value={style.bgColor}
                  onChange={(e) => setStyleKey({ bgColor: e.target.value })}
                />
              </label>
              <label className="field">Couleur d'accent
                <input
                  type="color"
                  className="color"
                  value={style.accent}
                  onChange={(e) => setStyleKey({ accent: e.target.value })}
                />
              </label>
            </div>

            {couple && <>
              <h2 className="workshop-title">Donne-lui ta couleur</h2>
              <div className="person-colors">{people.map((p, i) => <label className="field" key={i}>{p.name || `Personne ${i+1}`}<input type="color" className="color" value={style.personColors?.[i] || (i ? "#a8795d" : "#60a5fa")} onChange={e => setStyleKey({ personColors: people.map((_, j) => style.personColors?.[j] || (j ? "#a8795d" : "#60a5fa")).map((c,j) => j === i ? e.target.value : c) })} /></label>)}</div>
            </>}

            <label className="label">Image de fond</label>
            <div className="row">
              <input type="file" accept="image/*" onChange={onBgImage} />
              {style.bgImage && (
                <button className="link" onClick={() => setStyleKey({ bgImage: "" })}>
                  Retirer l'image
                </button>
              )}
            </div>
            {style.bgImage && (
              <label className="field slider">
                Transparence de l'image : {Math.round(style.bgOpacity * 100)} %
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={style.bgOpacity}
                  onChange={(e) => setStyleKey({ bgOpacity: Number(e.target.value) })}
                />
              </label>
            )}

            <label className="label">Images par jour <em>(optionnel)</em></label>
            <div className="day-images">
              {DAYS.map((d) => (
                <div key={d} className="day-image-row">
                  <span>{SHORT[d]}</span>
                  <input type="file" accept="image/*" onChange={(e) => onDayImage(d, e)} />
                  {style.dayImages[d] && (
                    <button className="link" onClick={() => removeDayImage(d)}>Retirer</button>
                  )}
                </div>
              ))}
            </div>
            {Object.keys(style.dayImages).length > 0 && (
              <label className="field slider">
                Transparence des images de jour : {Math.round(style.dayImageOpacity * 100)} %
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={style.dayImageOpacity}
                  onChange={(e) => setStyleKey({ dayImageOpacity: Number(e.target.value) })}
                />
              </label>
            )}
          </section>

          {/* Planning (zone exportée) */}
          <section className="card plan-card planning-card">
            <div
              ref={exportRef}
              className="export-zone"
              style={{ background: style.bgColor, position: "relative", overflow: "hidden" }}
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

              <div style={{ position: "relative", padding: 20 }}>
                <h2 style={{ color: style.accent, marginTop: 0 }}>
                  {style.title || (couple ? "Votre planning" : `Planning de ${result.plans[0].name}`)}
                </h2>

                <p className="badge-ia no-print">
                  {result.ai
                    ? "✨ Planning optimisé par l'IA"
                    : "Planning calculé par l'algorithme"}
                </p>

                {couple && (
                  <div className="legend">
                    {result.plans.map((p, i) => (
                      <span key={i} className="legend-item">
                        <span className="dot" style={{ background: style.personColors?.[i] || (i ? "#a8795d" : "#60a5fa") }} />
                        {p.name}
                      </span>
                    ))}
                    <span className="legend-item">
                      <span className="dot" style={{ background: style.accent }} />
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

                {renderWeek(!exporting)}

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
              </div>
            </div>

            {renderEditor()}

            <p className="hint small no-print">
              Clique sur une séance ajoutée pour la modifier. Les séances que tu as déjà fixées ne se déplacent pas.
            </p>

            <div className="row no-print end">
              <button className="btn ghost" onClick={restart}>Recommencer</button>
              <button className="btn ghost" onClick={() => setStep(2)}>Modifier mes choix</button>
              <button className="btn ghost" onClick={() => window.print()}>Imprimer</button>
              <button className="btn ghost" disabled={exporting} onClick={exportPNG}>
                {exporting ? "Export..." : "Export PNG"}
              </button>
              <button className="btn" disabled={exporting} onClick={exportPDF}>
                {exporting ? "Export..." : "Export PDF"}
              </button>
            </div>
          </section>
        </>
      )}

      {step < 3 && (
        <footer className="nav no-print">
          <button className="btn ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>
            Retour
          </button>
          <button className="btn" disabled={loading} onClick={next}>
            {step === 2 ? (loading ? "Génération..." : "Générer mon planning") : "Suivant"}
          </button>
        </footer>
      )}
    </div>
  );
}

const css = `
:root { color-scheme: dark; }
* { box-sizing: border-box; }
html, body, #root { min-height: 100%; width: 100%; margin: 0; background: #090713; }
body { color: #eeeaff; -webkit-font-smoothing: antialiased; }
.app { width: 100%; min-height: 100vh; margin: 0; padding: 32px clamp(18px,3vw,48px) 72px; font-family: ui-sans-serif, system-ui, sans-serif; color: #eeeaff; background: radial-gradient(circle at 85% -10%, #33205e 0, transparent 34%), #090713; }
.top, .progress, .tabs { max-width: 1500px; margin-left: auto; margin-right: auto; }
.top h1 { font-size: clamp(28px,4vw,42px); margin: 0 0 6px; letter-spacing: -.04em; }
.top p, .hint { color: #aba4c1; }
.progress { margin-top: 28px; margin-bottom: 22px; }.progress-labels { display:flex;justify-content:space-between;font-size:12px;color:#766d91;margin-bottom:8px }.progress-labels .on{color:#e9ddff;font-weight:700}.bar{height:3px;background:#29213d;border-radius:4px;overflow:hidden}.fill{height:100%;background:#9b7bea;transition:width .35s ease}
.tabs { display:flex; gap:8px; margin-bottom:16px }.tab { padding:9px 18px; border:1px solid #3b3152; background:#171126; color:#dcd1f5; border-radius:999px; cursor:pointer }.tab.on{background:#8b5cf6;color:white;border-color:#a78bfa}
.card { background: rgba(22,16,39,.92); border:1px solid #332747; border-radius:18px; padding:clamp(20px,3vw,34px); box-shadow:0 18px 50px rgba(0,0,0,.22); margin:0 auto 18px; max-width:1500px }.card h2{font-size:18px;margin:26px 0 6px;color:#f4efff}.card h2:first-child{margin-top:0}.hint{font-size:14px;margin:0 0 14px;line-height:1.5}.hint.small{font-size:12px;margin-top:10px}.choices{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-top:12px}.choice{padding:18px;border:1px solid #3b3152;background:#18122a;border-radius:14px;color:#eeeaff;text-align:left;cursor:pointer}.choice span{font-size:13px;color:#a49bb9}.choice.on{border-color:#a78bfa;background:#271747}.form-block,.want-card{background:#130e23;border:1px solid #302443;border-radius:14px;padding:18px}.label{font-size:13px;font-weight:700;margin-top:10px;display:block}.label em{font-weight:400;color:#817795;font-style:normal}.input,.color,input[type=file],select{box-sizing:border-box;max-width:100%;padding:10px 12px;border:1px solid #44355c;border-radius:10px;font-size:14px;background:#0f0b1b;color:#f2ecff;font-family:inherit}.full{width:100%}.row{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end}.field{display:flex;flex-direction:column;gap:6px;font-size:12px;color:#aaa0bc;min-width:0}.color{width:56px;height:36px;padding:2px}.btn{padding:10px 18px;border-radius:10px;border:1px solid #8b5cf6;background:#7c3aed;color:white;cursor:pointer;font-weight:700}.btn.ghost{background:#171126;color:#ddd2f2;border-color:#493964}.btn:disabled{opacity:.45}.link,.link-btn{background:none;border:0;color:#b9a5e9;cursor:pointer}.chips{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:8px}.chip{padding:8px 15px;border:1px solid #44355c;background:#171126;color:#ddd2f2;border-radius:999px;cursor:pointer}.chip.on{background:#7c3aed;border-color:#a78bfa;color:#fff}.list{list-style:none;padding:0;margin:20px 0 0;display:flex;flex-direction:column;gap:8px}.list li{display:flex;justify-content:space-between;align-items:center;padding:12px 14px;border:1px solid #36294c;border-radius:10px;background:#130e23}.tag{display:inline-block;margin-left:7px;padding:2px 8px;font-size:11px;background:#302047;border-radius:99px;color:#c7b8e9}.nav{display:flex;justify-content:space-between;max-width:1500px;margin:20px auto}.error,.warn-text{color:#fb7185}.customization-card{position:sticky;top:18px;max-width:none}.workshop-title{padding:10px 0 0;line-height:1.25}.person-colors{display:flex;flex-wrap:wrap;gap:18px}.day-images{display:flex;flex-direction:column;gap:8px;margin-top:8px}.day-image-row{display:flex;align-items:center;gap:8px;font-size:12px;min-width:0}.day-image-row input{flex:1}.plan-card{max-width:none}.export-zone{border-radius:14px;background:#110c20!important}.legend{display:flex;flex-wrap:wrap;gap:16px;margin:0 0 14px}.legend-item{display:inline-flex;align-items:center;gap:6px;font-size:13px;color:#cfc5df}.dot{width:10px;height:10px;border-radius:50%;display:inline-block}.badge-ia{display:inline-block;margin:0 0 14px;padding:5px 12px;border-radius:999px;background:#2d1e53;color:#d9c5ff;font-size:12px}.agenda-scroll{overflow-x:auto;padding-bottom:4px}.agenda{display:grid;grid-template-columns:58px minmax(770px,1fr);min-width:830px}.time-axis{padding-top:34px;background:#110c20}.axis-spacer{height:0}.time-label{height:64px;padding:5px 7px 0 0;text-align:right;color:#847996;font-size:10px}.agenda-days{display:grid;grid-template-columns:repeat(7,minmax(110px,1fr));gap:1px;background:#3a2c51}.agenda-day{min-width:110px;background:#120d20}.day-head{height:34px;padding:9px 8px;color:#dcd0ef;font-weight:700;font-size:12px;text-align:center;background:#1a1230;border-bottom:1px solid #45345d}.day-canvas{height:var(--agenda-height);position:relative;background-size:cover;background-position:center}.hour-lines{position:absolute;inset:0;pointer-events:none}.hour-lines div{height:64px;border-bottom:1px solid rgba(153,130,190,.16)}.agenda-event{position:absolute;z-index:2;overflow:hidden;padding:6px 7px;border:1px solid;border-left-width:3px;border-radius:7px;color:#fff;box-shadow:0 4px 10px rgba(0,0,0,.2);font-size:11px;line-height:1.25}.agenda-event strong,.agenda-event span,.agenda-event small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.agenda-event span,.agenda-event small{color:#f1eaff;font-size:10px}.agenda-event.editable{cursor:pointer}.agenda-event.editable:hover{filter:brightness(1.15);z-index:5}.warn-dot{color:#fecaca!important;position:absolute;right:4px;top:3px}.editor{margin-top:18px;padding:16px;border:1px solid #3c2c53;border-radius:12px;background:#130e23;display:flex;flex-direction:column;gap:10px}.editor-head{display:flex;justify-content:space-between;align-items:center}
@media (min-width:900px){.app:has(.planning-card){display:grid;grid-template-columns:minmax(230px,280px) minmax(0,1fr);gap:18px;align-items:start}.app:has(.planning-card)>.top,.app:has(.planning-card)>.progress,.app:has(.planning-card)>.tabs{grid-column:1/-1}.app:has(.planning-card)>.customization-card{grid-column:1;grid-row:4}.app:has(.planning-card)>.planning-card{grid-column:2;grid-row:4}.app:has(.planning-card)>.nav{grid-column:1/-1}}
@media (max-width:899px){.customization-card{position:static}.app:has(.planning-card){padding-bottom:88px}.app:has(.planning-card)>.customization-card{order:1}.app:has(.planning-card)>.planning-card{order:2}.app:has(.planning-card)>.tabs{position:fixed;bottom:12px;left:12px;right:12px;z-index:20;justify-content:center;margin:0;padding:8px;background:#171126dd;border:1px solid #493964;border-radius:14px}.agenda{min-width:830px}}
@media print{.no-print{display:none!important}body{background:#fff}.app{padding:0;background:#fff}.card{border:0;box-shadow:none;padding:0}.agenda-scroll{overflow:visible}.agenda{min-width:0}.agenda-days{grid-template-columns:repeat(7,1fr)}
}
`;

