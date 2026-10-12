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
  { bg: "#dbeafe", border: "#2563eb", text: "#1d4ed8" },
  { bg: "#ead8c8", border: "#7c3f20", text: "#7c3f20" },
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
  preferredDays: [],
  preferredSlots: ["soir"],
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
  accent: "#14532d",
};

function loadSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
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
  const [saved] = useState(() => loadSaved());

  const [couple, setCouple] = useState(saved?.couple ?? false);
  const [people, setPeople] = useState(saved?.people ?? [emptyPerson("Toi")]);
  const [active, setActive] = useState(saved?.active ?? 0);
  const [step, setStep] = useState(saved?.step ?? 0);
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
  const skipNextSave = useRef(false);

  const person = people[active] || people[0];
  const progress = Math.round((Math.min(step, 4) / 4) * 100);

  // ----- Sauvegarde automatique -----
  useEffect(() => {
    if (skipNextSave.current) { skipNextSave.current = false; return; }
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ couple, people, active, step, result, style, draft, wantDraft, editing })
      );
    } catch (e) {
      // quota dépassé (images trop lourdes) : on ignore sans casser l'app
    }
  }, [couple, people, active, step, result, style, draft, wantDraft, editing]);

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
      setStep(4); // arrive directement sur la personnalisation
      setActive(0);
      setEditing(null);
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
    skipNextSave.current = true;
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* stockage indisponible */ }
    setResult(null);
    setStep(0);
    setActive(0);
    setEditing(null);
    setPeople(couple ? [emptyPerson("Toi"), emptyPerson("Partenaire")] : [emptyPerson("Toi")]);
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
    const url = await fileToDataUrl(file);
    setStyleKey({ bgImage: url });
    e.target.value = "";
  };

  const onDayImage = async (day, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await fileToDataUrl(file);
    setStyleKey({ dayImages: { ...style.dayImages, [day]: url } });
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
  const buildDay = (d) => {
    const items = [];
    result.plans.forEach((p, pi) => {
      p.events.forEach((e, ei) => {
        if (e.day === d) items.push({ ...e, owner: pi, ownerName: p.name, evIndex: ei });
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

  const renderWeek = (interactive) => {
    const allEvents = [];
    DAYS.forEach((day) => {
      const dayItems = result.plans.flatMap((p, pi) =>
        p.events.filter((e) => e.day === day).map((e, ei) => ({ ...e, owner: pi, ownerName: p.name, evIndex: ei }))
      );
      const used = new Set();
      dayItems.forEach((a, ai) => {
        if (used.has(ai)) return;
        const bi = couple ? dayItems.findIndex((b, j) => j > ai && !used.has(j) && b.owner !== a.owner && b.title.toLowerCase() === a.title.toLowerCase() && b.start === a.start && b.end === a.end) : -1;
        if (bi >= 0) { used.add(bi); allEvents.push({ ...a, together: true }); }
        else allEvents.push(a);
        used.add(ai);
      });
    });
    const minActivity = allEvents.reduce((min, e) => Math.min(min, toMin(e.start)), Infinity);
    const maxActivity = allEvents.reduce((max, e) => Math.max(max, toMin(e.end)), -Infinity);
    const rangeStart = Number.isFinite(minActivity) ? Math.floor(minActivity / 60) * 60 : 7 * 60;
    const rangeEnd = Number.isFinite(maxActivity) ? Math.ceil(maxActivity / 60) * 60 : 18 * 60;
    const hourHeight = 72;
    const rangeMinutes = Math.max(60, rangeEnd - rangeStart);
    const gridHeight = (rangeMinutes / 60) * hourHeight;
    const formatHour = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:00`;
    const layoutDay = (day) => {
      const items = allEvents.filter((e) => e.day === day).sort((a, b) => toMin(a.start) - toMin(b.start));
      const columns = [];
      items.forEach((item) => {
        let col = columns.findIndex((last) => !overlaps(last, item));
        if (col < 0) { col = columns.length; columns.push(item); }
        else columns[col] = item;
        item._col = col;
      });
      const count = Math.max(columns.length, 1);
      return items.map((e) => ({ ...e, width: 100 / count, left: (e._col * 100) / count }));
    };
    const hours = [];
    for (let m = rangeStart; m <= rangeEnd; m += 60) hours.push(m);

    return (
      <div className="schedule-scroll">
        <div className="schedule-grid" style={{ minWidth: 920 }}>
          <div className="schedule-corner" />
          {DAYS.map((d) => <div key={d} className="schedule-day-head">{SHORT[d]}</div>)}
          <div className="schedule-hours" style={{ height: gridHeight }}>
            {hours.map((m) => <span key={m} style={{ top: ((m - rangeStart) / 60) * hourHeight }}>{formatHour(m)}</span>)}
          </div>
          {DAYS.map((d) => {
            const dayImg = style.dayImages[d];
            const events = layoutDay(d);
            return (
              <div key={d} className="schedule-day" style={{ height: gridHeight }}>
                {dayImg && <div className="schedule-day-image" style={{ backgroundImage: `url(${dayImg})`, opacity: style.dayImageOpacity }} />}
                {hours.slice(0, -1).map((m) => <div key={m} className="schedule-line" style={{ top: ((m - rangeStart) / 60) * hourHeight }} />)}
                {events.map((e, i) => {
                  const c = e.together
                    ? { bg: "#eee4ff", border: "#7c3aed" }
                    : COLORS[e.owner] || COLORS[0];
                  const warns = interactive && !e.together ? warningsFor(e.owner, e.evIndex) : [];
                  const canEdit = interactive && !e.fixed && !e.together;
                  const top = ((toMin(e.start) - rangeStart) / 60) * hourHeight;
                  const height = Math.max(28, ((toMin(e.end) - toMin(e.start)) / 60) * hourHeight);
                  return (
                    <div key={i} className={canEdit ? "schedule-event editable" : "schedule-event"}
                      onClick={canEdit ? () => startEdit(e.owner, e.evIndex) : undefined}
                      style={{ top, height, left: `calc(${e.left}% + 3px)`, width: `calc(${e.width}% - 6px)`, background: c.bg, borderLeft: `3px solid ${warns.length ? "#dc2626" : c.border}`, opacity: e.fixed ? 0.85 : 1 }}>
                      <strong>{e.title}</strong><span>{e.start} – {e.end}</span>
                      {couple && <span className="owner">{e.together ? "Ensemble" : e.ownerName}</span>}
                      {warns.length > 0 && <span className="warn-dot">⚠ à vérifier</span>}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

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

      {/* ---------- ÉTAPE 5 : PERSONNALISATION + RÉSULTAT ---------- */}
      {step === 4 && result && (
        <>
          {/* Panneau de personnalisation (une seule page pour les deux) */}
          <section className="card no-print">
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
          <section className="card plan-card">
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
                        <span className="dot" style={{ background: COLORS[i].border }} />
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
              <button className="btn ghost" onClick={() => setStep(3)}>Modifier mes choix</button>
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
.card { background: #fff; border: 1px solid #ebebe8; border-radius: 20px; padding: 36px; box-shadow: 0 1px 2px rgba(0,0,0,.03); margin-bottom: 20px; }
.card h2 { font-size: 18px; margin: 32px 0 6px; color: #151515; font-weight: 600; letter-spacing: -0.01em; }
.card h2:first-child { margin-top: 0; }
.hint { color: #6b6b6b; font-size: 14px; margin: 0 0 14px; line-height: 1.5; }
.hint.small { font-size: 12px; margin-top: 10px; }
.choices { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-top: 12px; }
.choice { text-align: left; padding: 18px; border: 1px solid #e3e3df; background: #fff; border-radius: 14px; cursor: pointer; display: flex; flex-direction: column; gap: 4px; color: #151515; font-family: inherit; font-size: 15px; transition: border-color .15s; }
.choice span { font-size: 13px; color: #6b6b6b; }
.choice:hover { border-color: #b9b9b3; }
.choice.on { border-color: #14532d; background: #f2f8f4; }
.form-block { display: flex; flex-direction: column; gap: 10px; background: #fafaf8; border: 1px solid #efefeb; border-radius: 16px; padding: 22px; margin-top: 8px; }
.label { font-size: 14px; font-weight: 600; margin-top: 10px; display: block; }
.label:first-child { margin-top: 0; }
.label em { font-weight: 400; color: #8a8a8a; font-style: normal; }
.full { width: 100%; }
.shortcuts { display: flex; flex-wrap: wrap; gap: 14px; }
.link-btn { background: none; border: none; padding: 0; color: #14532d; font-size: 13px; font-weight: 500; cursor: pointer; font-family: inherit; text-decoration: underline; text-underline-offset: 3px; }
.row { display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-end; }
.row.spaced { margin-top: 16px; margin-bottom: 6px; }
.row.end { justify-content: flex-end; margin-top: 32px; }
.grow { flex: 1; min-width: 160px; }
.input { padding: 11px 14px; border: 1px solid #e0e0dc; border-radius: 12px; font-size: 15px; background: #fff; color: #151515; font-family: inherit; }
.input:focus { outline: none; border-color: #14532d; box-shadow: 0 0 0 3px rgba(20,83,45,.1); }
.field { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: #6b6b6b; }
.field.slider { margin-top: 10px; max-width: 360px; }
.color { width: 64px; height: 38px; padding: 2px; border: 1px solid #e0e0dc; border-radius: 10px; background: #fff; cursor: pointer; }
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
.schedule-scroll { overflow-x: auto; margin-top: 18px; }
.schedule-grid { display: grid; grid-template-columns: 58px repeat(7, minmax(116px, 1fr)); position: relative; border: 1px solid #ececE8; border-radius: 12px; overflow: hidden; }
.schedule-corner { background: rgba(255,255,255,.7); border-bottom: 1px solid #ececE8; }
.schedule-day-head { padding: 12px 6px; text-align: center; font-size: 13px; font-weight: 700; color: #151515; background: rgba(255,255,255,.7); border-left: 1px solid #ececE8; border-bottom: 1px solid #ececE8; }
.schedule-hours { position: relative; background: rgba(255,255,255,.5); }
.schedule-hours span { position: absolute; right: 7px; transform: translateY(-50%); color: #777; font-size: 11px; }
.schedule-day { position: relative; overflow: hidden; border-left: 1px solid #ececE8; background: rgba(255,255,255,.34); }
.schedule-day-image { position: absolute; inset: 0; background-size: cover; background-position: center; pointer-events: none; }
.schedule-line { position: absolute; left: 0; right: 0; border-top: 1px solid rgba(160,160,160,.18); pointer-events: none; }
.schedule-event { position: absolute; padding: 6px 7px; border-radius: 7px; display: flex; flex-direction: column; gap: 2px; font-size: 11px; overflow: hidden; z-index: 1; box-shadow: 0 1px 2px rgba(0,0,0,.06); }
.schedule-event.editable { cursor: pointer; }
.schedule-event.editable:hover { box-shadow: 0 0 0 2px rgba(20,83,45,.25); }
.event span { color: #6b6b6b; }
.warn-dot { color: #dc2626 !important; font-weight: 600; font-size: 11px; }
.legend { display: flex; flex-wrap: wrap; gap: 16px; margin: 0 0 14px; }
.legend-item { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: #444; }
.dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
.owner { font-size: 11px; font-weight: 600; }
.badge-ia { display: inline-block; margin: 0 0 14px; padding: 5px 14px; border-radius: 999px; background: #f3eefe; color: #5b3fd1; font-size: 13px; font-weight: 600; }
.common { margin-top: 32px; }
.wants { display: flex; flex-direction: column; gap: 14px; margin-top: 20px; }
.want-card { border: 1px solid #ececE8; border-radius: 14px; padding: 18px; display: flex; flex-direction: column; gap: 12px; }
.editor-hidden { display: none !important; }
.cinematic { position: fixed; z-index: 50; inset: 0; display: grid; place-items: center; align-content: center; gap: 24px; background: radial-gradient(circle at 50% 42%, #39206f 0, #171329 28%, #090812 72%); color: white; overflow: hidden; }
.cinematic::before { content: ""; position: absolute; inset: 0; opacity: .22; background-image: linear-gradient(rgba(167,139,250,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(167,139,250,.12) 1px, transparent 1px); background-size: 48px 48px; transform: perspective(500px) rotateX(55deg) scale(1.6); transform-origin: bottom; }
.cinematic-orbit { position: relative; z-index: 1; width: 132px; height: 132px; border-radius: 50%; border: 1px solid rgba(216,180,254,.35); box-shadow: 0 0 30px #8b5cf6, inset 0 0 30px rgba(139,92,246,.5); animation: orbitPulse 1.5s ease-in-out infinite; display: grid; place-items: center; }
.cinematic-orbit::after { content: ""; position: absolute; inset: -12px; border: 2px solid transparent; border-top-color: #f0abfc; border-right-color: #818cf8; border-radius: 50%; animation: spin 1.1s linear infinite; }
.cinematic-core { font-size: 42px; color: #e9d5ff; text-shadow: 0 0 24px #c084fc; animation: coreGlow 1s ease-in-out infinite alternate; }
.cinematic-track { z-index: 1; width: min(360px, 70vw); height: 4px; border-radius: 9px; background: rgba(255,255,255,.14); overflow: hidden; }
.cinematic-track span { display: block; height: 100%; width: 0; background: linear-gradient(90deg,#f0abfc,#8b5cf6,#67e8f9); animation: fillCine 6s linear forwards; }
.cinematic-copy { z-index: 1; position: relative; min-height: 30px; text-align: center; }
.cine-line { position: absolute; width: 100%; margin: 0; opacity: 0; font-size: clamp(16px, 2.5vw, 22px); font-weight: 600; letter-spacing: .01em; white-space: nowrap; }
.line-1 { animation: cineText 6s 0s both; color: #c4b5fd; }.line-2 { animation: cineText 6s 1.5s both; color: #93c5fd; }.line-3 { animation: cineText 6s 3s both; color: #f0abfc; }.line-4 { animation: cineText 6s 4.5s both; color: #86efac; }
.editor-layout { display: grid; grid-template-columns: 190px 1fr; gap: 20px; margin-bottom: 22px; padding: 18px; border-radius: 24px; background: linear-gradient(135deg,#141126,#1d1534); color: #f5f3ff; box-shadow: 0 24px 70px rgba(53,27,105,.22); }
.editor-sidebar { display: flex; flex-direction: column; }.editor-brand { display:flex; gap:10px; align-items:center; margin-bottom: 28px; }.editor-brand > span { display:grid; place-items:center; width:34px; height:34px; border-radius:11px; background:linear-gradient(135deg,#c084fc,#7c3aed); box-shadow:0 0 20px #7c3aed; }.editor-brand strong,.editor-brand small { display:block; }.editor-brand small { color:#aaa3c9; font-size:10px; margin-top:3px; }.editor-tabs { display:flex; flex-direction:column; gap:6px; }.editor-tab { border:0; background:transparent; color:#aaa3c9; text-align:left; padding:12px 10px; border-radius:12px; font:inherit; cursor:pointer; display:flex; gap:10px; align-items:center; }.editor-tab.active { color:#fff; background:rgba(167,139,250,.18); box-shadow:inset 3px 0 #c084fc; }.editor-panel { min-width:0; background:rgba(255,255,255,.055); border:1px solid rgba(255,255,255,.1); border-radius:18px; padding:22px; }.editor-panel-head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:20px; }.editor-panel h2 { color:#fff; margin:5px 0 0; }.eyebrow { color:#c084fc; font-size:10px; font-weight:700; letter-spacing:.16em; }.editor-status { color:#86efac; font-size:11px; }.control-grid { display:grid; gap:16px; }.editor-panel .label { color:#dcd6f2; }.editor-panel .input,.editor-panel .color { background:rgba(8,6,20,.45); border-color:#493c6b; color:#fff; }.editor-panel .hint { color:#b9b1d0; }.color-grid { display:flex; gap:24px; }.theme-row { display:flex; gap:8px; flex-wrap:wrap; }.theme { border:1px solid #5b4a83; color:#fff; border-radius:10px; padding:10px 14px; cursor:pointer; background:#26203d; }.theme-aurora { background:linear-gradient(135deg,#16122e,#6d28d9); }.theme-sunset { background:linear-gradient(135deg,#7c2d12,#fb923c); }.theme-forest { background:linear-gradient(135deg,#14532d,#65a30d); }.sticker-palette { display:flex; flex-wrap:wrap; gap:8px; }.sticker-btn { border:1px solid #58477c; background:#211a3a; border-radius:12px; font-size:24px; width:46px; height:46px; cursor:pointer; transition:transform .15s; }.sticker-btn:hover { transform:translateY(-3px) rotate(-4deg); }.sticker-list { display:flex; gap:8px; flex-wrap:wrap; }.sticker-chip { border:1px solid #66538d; background:#2a2147; color:#fff; border-radius:99px; padding:6px 10px; cursor:pointer; }.sticker-chip small { color:#b8add4; }.editor-warning { color:#ff7b87 !important; border-left:2px solid #ef4444; padding-left:10px; }.floating-sticker { position:absolute; z-index:2; font-size:28px; filter:drop-shadow(0 4px 8px rgba(0,0,0,.18)); transform:rotate(-8deg); }.event-reveal { animation: eventReveal .55s cubic-bezier(.2,.8,.2,1) both; }
@keyframes spin { to { transform:rotate(360deg); } } @keyframes orbitPulse { 50% { transform:scale(1.05); box-shadow:0 0 55px #a78bfa, inset 0 0 36px rgba(139,92,246,.7); } } @keyframes coreGlow { to { transform:scale(1.14) rotate(8deg); } } @keyframes fillCine { to { width:100%; } } @keyframes cineText { 0%,18% { opacity:0; transform:translateY(10px); } 24%,44% { opacity:1; transform:translateY(0); } 52%,100% { opacity:0; transform:translateY(-10px); } } @keyframes eventReveal { from { opacity:0; transform:scale(.84) translateY(8px); } to { opacity:1; transform:scale(1) translateY(0); } }
@media (max-width: 680px) { .editor-layout { display:block; padding:12px; }.editor-sidebar { display:block; }.editor-brand { margin:4px 4px 12px; }.editor-tabs { flex-direction:row; gap:4px; }.editor-tab { flex:1; justify-content:center; padding:10px 4px; font-size:12px; }.editor-tab span { display:none; }.editor-panel { margin-top:10px; padding:16px; }.editor-panel-head { margin-bottom:14px; }.color-grid { gap:14px; }.app { padding:26px 12px 54px; } }
/* Mode éditeur : atelier + aperçu côte à côte, sans surface blanche. */
html.editor-active, html.editor-active body { background:#0b0816; color:#f5f3ff; }
.editor-workspace { display:grid; grid-template-columns:190px minmax(280px,1fr) minmax(390px,1.35fr); gap:20px; align-items:start; }
.editor-workspace .editor-layout { display:contents; }
.editor-workspace .editor-sidebar { grid-column:1; position:sticky; top:20px; padding:18px 0; }
.editor-workspace .editor-panel { grid-column:2; position:sticky; top:20px; }
.editor-workspace .plan-card { grid-column:3; position:sticky; top:20px; margin:0; background:#141026; border-color:#30234d; color:#eee9ff; }
.editor-workspace .plan-card .export-zone { background:#18132c !important; }
.editor-workspace .plan-card .day { background:#211a38; border-color:#40335f; }
.editor-workspace .plan-card .day h3, .editor-workspace .plan-card .legend-item { color:#eee9ff; }
.editor-workspace .plan-card .event { background:#2a2148 !important; color:#f5f3ff; }
.editor-workspace .plan-card .event span, .editor-workspace .plan-card .hint, .editor-workspace .plan-card .rest { color:#c8bfdf; }
.editor-workspace .plan-card .badge-ia { background:#2d2250; color:#d8b4fe; }
.editor-workspace .plan-card .list li { background:#211a38; border-color:#40335f; color:#f5f3ff; }
.editor-workspace .plan-card .list small { color:#c8bfdf; }
.editor-workspace .row.end .btn, .editor-workspace .plan-card .btn.ghost { background:#211a38; border-color:#6d4db0; color:#eee9ff; }
.editor-workspace input[type=file] { color:#d8cef0; background:#17112c; border:1px solid #493c6b; border-radius:10px; padding:5px; }
.editor-workspace input[type=file]::file-selector-button { border:0; border-radius:8px; padding:8px 12px; margin-right:8px; background:#7c3aed; color:#fff; cursor:pointer; font:inherit; }
@media (max-width: 1050px) { .editor-workspace { grid-template-columns:180px minmax(260px,1fr) minmax(320px,1fr); gap:12px; } }
@media (max-width: 760px) { .editor-workspace { display:block; } .editor-workspace .editor-sidebar, .editor-workspace .editor-panel, .editor-workspace .plan-card { position:static; } .editor-workspace .editor-layout { display:block; } .editor-workspace .plan-card { margin-top:14px; } }

@media print { .editor-layout, .no-print { display:none !important; } .plan-card { border:0; box-shadow:none; } }

`;