// src/App.jsx
import { useState, useEffect, useRef } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const SHORT = { Lundi: "Lun", Mardi: "Mar", Mercredi: "Mer", Jeudi: "Jeu", Vendredi: "Ven", Samedi: "Sam", Dimanche: "Dim" };

const THEMES = {
  aurora: { label: "Aurora", bg: "#071b2b", surface: "#0d2f3b", surfaceAlt: "#123f48", text: "#e4fbf4", muted: "#a6d4cf", border: "#246878", accent: "#55d6be", button: "#147d78" },
  sunset: { label: "Sunset", bg: "#321525", surface: "#4b1f2e", surfaceAlt: "#672d35", text: "#fff0e5", muted: "#e9b9ae", border: "#9b4b50", accent: "#ff9a62", button: "#d85a4a" },
  foret: { label: "Forêt", bg: "#0c211b", surface: "#14382b", surfaceAlt: "#1c4a36", text: "#e9f7e9", muted: "#acd0b0", border: "#34734e", accent: "#79c267", button: "#28734b" },
  lavande: { label: "Lavande", bg: "#171229", surface: "#282044", surfaceAlt: "#382b5c", text: "#f2edff", muted: "#c9bee5", border: "#62508f", accent: "#b99cff", button: "#7654c8" },
  nuit: { label: "Nuit violette", bg: "#100d1c", surface: "#1d1730", surfaceAlt: "#2a2145", text: "#f0eaff", muted: "#bdb4d2", border: "#514377", accent: "#a889ff", button: "#6848b8" },
};

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, "0")}:00`);

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
  scheduleStart: "06:00",
  scheduleEnd: "22:00",
});

const defaultStyle = {
  title: "Mon planning",
  bgColor: "",
  bgImage: "",
  bgOpacity: 0.25,
  dayImages: {},
  dayImageOpacity: 0.3,
  accent: "#14532d",
  theme: "nuit",
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
  const saved = useRef(loadSaved()).current;

  const [couple, setCouple] = useState(saved?.couple ?? false);
  const [people, setPeople] = useState((saved?.people ?? [emptyPerson("Toi")]).map((p) => ({ ...emptyPerson(p.name || "Toi"), ...p, scheduleStart: p.scheduleStart || p.earliest || "06:00", scheduleEnd: p.scheduleEnd || p.latest || "22:00" })));
  const [active, setActive] = useState(0);
  const [step, setStep] = useState(saved?.step ?? 0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(saved?.result ?? null);
  const [style, setStyle] = useState({ ...defaultStyle, ...(saved?.style ?? {}) });
  const [exporting, setExporting] = useState(false);

  const theme = THEMES[style.theme] || THEMES.nuit;
  const themeVars = { "--theme-bg": theme.bg, "--theme-surface": theme.surface, "--theme-surface-alt": theme.surfaceAlt, "--theme-text": theme.text, "--theme-muted": theme.muted, "--theme-border": theme.border, "--theme-accent": theme.accent, "--theme-button": theme.button };
  useEffect(() => { document.body.style.background = theme.bg; return () => { document.body.style.background = ""; }; }, [theme.bg]);

  const [draft, setDraft] = useState({ title: "", days: [], start: "18:00", end: "19:00" });
  const [wantDraft, setWantDraft] = useState("");

  // édition d'un événement du résultat : { plan, index } ou null
  const [editing, setEditing] = useState(null);

  const exportRef = useRef(null);

  const person = people[active] || people[0];
  const progress = Math.round((Math.min(step, 4) / 4) * 100);

  // ----- Sauvegarde automatique -----
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ couple, people, step, result, style })
      );
    } catch (e) {
      // quota dépassé (images trop lourdes) : on ignore sans casser l'app
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
      backgroundColor: style.bgColor || theme.bg,
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

  const selectedScheduleStart = (people[0]?.scheduleStart || people[0]?.earliest || "06:00");
  const selectedScheduleEnd = (people[0]?.scheduleEnd || people[0]?.latest || "22:00");
  const printStartHour = Math.min(23, Math.max(0, Number(selectedScheduleStart.slice(0, 2)) || 6));
  const printEndHour = Math.max(printStartHour + 1, Math.min(24, Number(selectedScheduleEnd.slice(0, 2)) || 22));
  const printHours = Array.from({ length: printEndHour - printStartHour }, (_, i) => printStartHour + i);

  const renderPrintWeek = () => {
    const restDays = new Set(result.plans.map((p) => p.restDay).filter(Boolean));
    return (
      <div className="print-planning">
        <div className="print-title">{style.title || (couple ? "Votre planning" : `Planning de ${result.plans[0].name}`)}</div>
        <div className="print-grid" style={{ gridTemplateRows: `30px repeat(${printHours.length}, 1fr)`, "--print-hours": printHours.length }}>
          <div className="print-time-head" />
          {DAYS.map((d) => <div key={d} className={`print-day-head ${restDays.has(d) ? "print-rest" : ""}`}>{d}</div>)}
          {printHours.map((h) => <div key={`t-${h}`} className="print-time">{String(h).padStart(2, "0")}:00</div>)}
          {DAYS.map((d, dayIndex) => {
            const events = buildDay(d).filter((e) => toMin(e.end) > toMin(e.start));
            const lanes = [];
            const placed = events.map((e) => {
              let lane = 0;
              while (lanes[lane]?.some((x) => overlaps(x, e))) lane++;
              (lanes[lane] ||= []).push(e);
              return { ...e, lane };
            });
            const laneCount = Math.max(1, lanes.length);
            return (
              <div key={d} className={`print-day-column ${restDays.has(d) ? "print-rest" : ""}`} style={{ gridColumn: dayIndex + 2 }}>
                {restDays.has(d) && <div className="print-rest-label">Repos</div>}
                {placed.map((e, i) => {
                  const top = ((toMin(e.start) - printStartHour * 60) / 60) * 100;
                  const height = ((toMin(e.end) - toMin(e.start)) / 60) * 100;
                  const c = e.together ? { bg: "#f5f0ff", border: "#7c3aed" } : (COLORS[e.owner] || COLORS[0]);
                  return <div key={i} className="print-event" style={{ top: `${top}%`, height: `${height}%`, left: `calc(${e.lane} * ${100 / laneCount}%)`, width: `${100 / laneCount}%`, background: c.bg, borderColor: c.border }}>{e.title}</div>;
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderWeek = (interactive) => (
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
                  opacity: style.dayImageOpacity,
                  pointerEvents: "none",
                }}
              />
            )}
            <div style={{ position: "relative" }}>
              <h3>{d}</h3>
              {merged.length === 0 && <div className="rest">Libre</div>}
              {merged.map((e, i) => {
                const c = e.together
                  ? { bg: "#f5f0ff", border: "#7c3aed" }
                  : COLORS[e.owner] || COLORS[0];
                const warns = interactive && !e.together ? warningsFor(e.owner, e.evIndex) : [];
                const canEdit = interactive && !e.fixed && !e.together;
                return (
                  <div
                    key={i}
                    className={canEdit ? "event editable" : "event"}
                    onClick={canEdit ? () => startEdit(e.owner, e.evIndex) : undefined}
                    style={{
                      background: c.bg,
                      borderLeft: `3px solid ${warns.length ? "#dc2626" : c.border}`,
                      opacity: e.fixed ? 0.85 : 1,
                    }}
                  >
                    <strong>{e.title}</strong>
                    <span>{e.start} – {e.end}</span>
                    {couple && (
                      <span className="owner">{e.together ? "Ensemble" : e.ownerName}</span>
                    )}
                    {warns.length > 0 && <span className="warn-dot">⚠ à vérifier</span>}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
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
    <div className="app" style={themeVars}>
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

          <h2>Plage horaire du planning</h2>
          <p className="hint">Ces horaires servent aussi à l'impression. Ils restent indicatifs et ne bloquent jamais la génération.</p>
          <div className="row">
            <label className="field">Première séance à (heure)
              <select className="input" value={person.scheduleStart || "06:00"} onChange={(e) => update({ scheduleStart: e.target.value })}>
                {HOUR_OPTIONS.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </label>
            <label className="field">Dernière séance finit à (heure)
              <select className="input" value={person.scheduleEnd || "22:00"} onChange={(e) => update({ scheduleEnd: e.target.value })}>
                {HOUR_OPTIONS.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </label>
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

            <label className="label">Thème</label>
            <select className="input full" value={style.theme || "nuit"} onChange={(e) => setStyleKey({ theme: e.target.value })}>
              {Object.entries(THEMES).map(([id, t]) => <option key={id} value={id}>{t.label}</option>)}
            </select>

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
                  value={style.bgColor || theme.bg}
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
              style={{ background: style.bgColor || theme.bg, position: "relative", overflow: "hidden" }}
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
                  <p key={i} className="hint no-print">
                    {p.name} : {p.sessionsAdded} séance(s) ajoutée(s) sur {p.sessionsTarget} prévue(s).
                    {p.restDay ? ` Repos : ${p.restDay}.` : ""}
                  </p>
                ))}

                <div className="screen-week">{renderWeek(!exporting)}</div>
                {renderPrintWeek()}

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
.want-card { border: 1px solid #ececE8; border-radius: 14px; padding: 18px; display: flex

/* Thèmes globaux, sans modifier la vue de planning existante */
body { background: var(--theme-bg, #f7f7f5); color: var(--theme-text, #151515); }
.app { color: var(--theme-text, #151515); }
.app .top p, .app .hint, .app .field, .app .list small, .app .choice span, .app .event span { color: var(--theme-muted, #6b6b6b); }
.app .card, .app .tab, .app .choice, .app .input, .app .btn.ghost, .app .chip, .app .list li { background: var(--theme-surface, #fff); color: var(--theme-text, #151515); border-color: var(--theme-border, #e0e0dc); }
.app .card h2, .app .top h1, .app .day h3, .app .choice, .app .chip, .app .tab { color: var(--theme-text, #151515); }
.app .form-block { background: var(--theme-surface-alt, #fafaf8); border-color: var(--theme-border, #efefeb); }
.app .btn:not(.ghost), .app .chip.on { background: var(--theme-button, #14532d); border-color: var(--theme-button, #14532d); }
.app .btn:not(.ghost):hover:not(:disabled) { filter: brightness(.9); }
.app .choice.on { background: color-mix(in srgb, var(--theme-accent) 18%, var(--theme-surface)); border-color: var(--theme-accent); }
.app .fill { background: var(--theme-accent); }
.app .progress-labels .on, .app .link-btn { color: var(--theme-accent); }
.app .bar { background: var(--theme-border); }
.app .day, .app .want-card, .app .editor { border-color: var(--theme-border); background: color-mix(in srgb, var(--theme-surface) 82%, transparent); }
.app .tag { background: var(--theme-surface-alt); color: var(--theme-muted); }
.app .export-zone { color: var(--theme-text); }
.print-planning { display: none; }
@media print {
  @page { size: landscape; margin: 6mm; }
  html, body { background: var(--theme-bg) !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .no-print, .screen-week, .common { display: none !important; }
  .app { max-width: none; padding: 0; background: var(--theme-bg) !important; }
  .card.plan-card { display: block !important; border: 0; padding: 0; margin: 0; background: transparent !important; box-shadow: none; }
  .export-zone { min-height: 0; background: var(--theme-bg) !important; overflow: visible !important; }
  .export-zone > div[style*="padding"] { padding: 0 !important; }
  .export-zone > div[style*="padding"] > h2, .export-zone > div[style*="padding"] > .badge-ia, .export-zone > div[style*="padding"] > .legend { display: none !important; }
  .print-planning { display: block; color: var(--theme-text); break-inside: avoid; }
  .print-title { font-size: 20px; font-weight: 700; margin: 0 0 4mm; color: var(--theme-accent); }
  .print-grid { display: grid; grid-template-columns: 12mm repeat(7, 1fr); grid-auto-flow: column; border: 1px solid var(--theme-border); height: 185mm; position: relative; }
  .print-day-head { grid-row: 1; padding: 5px 2px; text-align: center; font-weight: 700; font-size: 10px; border-left: 1px solid var(--theme-border); background: var(--theme-surface-alt); }
  .print-time-head { grid-column: 1; grid-row: 1; background: var(--theme-surface-alt); }
  .print-time { grid-column: 1; padding: 2px; text-align: right; font-size: 8px; color: var(--theme-muted); border-top: 1px solid color-mix(in srgb, var(--theme-border) 60%, transparent); }
  .print-day-column { position: relative; grid-row: 2 / span var(--print-hours, 16); min-width: 0; border-left: 1px solid var(--theme-border); background: repeating-linear-gradient(to bottom, transparent 0, transparent calc(100% / 16 - 1px), color-mix(in srgb, var(--theme-border) 55%, transparent) calc(100% / 16 - 1px), color-mix(in srgb, var(--theme-border) 55%, transparent) calc(100% / 16)); }
  .print-rest { background: color-mix(in srgb, var(--theme-border) 34%, var(--theme-surface)) !important; }
  .print-rest-label { position: absolute; inset: 45% 0 auto; text-align: center; font-weight: 700; font-size: 11px; color: var(--theme-muted); }
  .print-event { position: absolute; box-sizing: border-box; padding: 3px; overflow: hidden; border-left: 3px solid; border-radius: 3px; font-size: 9px; line-height: 1.15; color: #151515; z-index: 2; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`;
