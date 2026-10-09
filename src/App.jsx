// src/App.jsx
import { useState, useEffect, useRef } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

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

const STEPS = ["Profil", "Ta semaine", "Objectifs"];
const EDIT_STEPS = ["Séances", "Style", "Décoration", "Export"];

const OWNER_COLORS = ["#14532d", "#1d4ed8"];
const TOGETHER_COLOR = "#7c3aed";

const THEMES = [
  { id: "epure", label: "Épuré", bg: "#ffffff", text: "#151515", border: "#e5e5e1", font: "Inter, system-ui, sans-serif" },
  { id: "nuit", label: "Nuit", bg: "#16181d", text: "#f2f2f2", border: "#2c2f36", font: "Inter, system-ui, sans-serif" },
  { id: "sable", label: "Sable", bg: "#f6f0e6", text: "#3a2e1f", border: "#e1d5bf", font: "Georgia, serif" },
  { id: "sauge", label: "Sauge", bg: "#eef3ee", text: "#1f3a28", border: "#cfdccf", font: "Inter, system-ui, sans-serif" },
];

const FONTS = [
  { id: "Inter, system-ui, sans-serif", label: "Moderne" },
  { id: "Georgia, serif", label: "Classique" },
  { id: "'Courier New', monospace", label: "Mono" },
  { id: "'Trebuchet MS', sans-serif", label: "Rond" },
];

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
  earliest: "06:00",
  latest: "22:00",
});

// ----- Utilitaires horaires -----
const toMin = (t) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const toTime = (m) => {
  const c = Math.max(0, Math.min(24 * 60 - 1, m));
  return `${String(Math.floor(c / 60)).padStart(2, "0")}:${String(c % 60).padStart(2, "0")}`;
};
const snap = (m) => Math.round(m / 30) * 30;

const GRID_START = 6 * 60;
const GRID_END = 22 * 60;
const PX_PER_MIN = 0.9;

const STORAGE_KEY = "planning-app-v1";

function loadStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function buildEvents(result, couple) {
  const events = [];
  let id = 1;
  result.plans.forEach((p, pi) => {
    p.events.forEach((e) => {
      events.push({
        id: id++,
        owner: pi,
        ownerName: p.name,
        day: e.day,
        start: e.start,
        end: e.end,
        title: e.title,
        fixed: !!e.fixed,
        note: "",
        color: OWNER_COLORS[pi] || OWNER_COLORS[0],
        groupId: null,
      });
    });
  });

  if (couple) {
    let gid = 1;
    events.forEach((a) => {
      if (a.groupId) return;
      const b = events.find(
        (x) =>
          x.id !== a.id &&
          !x.groupId &&
          x.owner !== a.owner &&
          x.fixed === a.fixed &&
          x.day === a.day &&
          x.start === a.start &&
          x.end === a.end &&
          x.title.toLowerCase() === a.title.toLowerCase()
      );
      if (b) {
        a.groupId = gid;
        b.groupId = gid;
        a.color = TOGETHER_COLOR;
        b.color = TOGETHER_COLOR;
        gid++;
      }
    });
  }
  return events;
}

function hasConflict(ev, events) {
  const s = toMin(ev.start);
  const e = toMin(ev.end);
  return events.some((o) => {
    if (o.id === ev.id) return false;
    if (ev.groupId && o.groupId === ev.groupId) return false;
    const sameScope = o.owner === ev.owner || o.groupId || ev.groupId;
    if (!sameScope) return false;
    if (o.day !== ev.day) return false;
    return toMin(o.start) < e && toMin(o.end) > s;
  });
}

export default function App() {
  const stored = useRef(loadStored()).current;

  const [couple, setCouple] = useState(stored?.couple ?? false);
  const [people, setPeople] = useState(stored?.people ?? [emptyPerson("Toi")]);
  const [active, setActive] = useState(0);
  const [step, setStep] = useState(stored?.events ? -1 : 0); // -1 = personnalisation
  const [editStep, setEditStep] = useState(stored?.editStep ?? 0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [events, setEvents] = useState(stored?.events ?? []);
  const [commonSlots, setCommonSlots] = useState(stored?.commonSlots ?? []);
  const [meta, setMeta] = useState(stored?.meta ?? { ai: false, summaries: [] });
  const [style, setStyle] = useState(
    stored?.style ?? {
      theme: "epure",
      bg: "#ffffff",
      text: "#151515",
      border: "#e5e5e1",
      font: THEMES[0].font,
      title: "Mon planning",
    }
  );
  const [decor, setDecor] = useState(
    stored?.decor ?? { backImage: null, backOpacity: 0.25, frontImage: null, frontOpacity: 0.15, stickers: [] }
  );

  const [selected, setSelected] = useState(null);
  const [warning, setWarning] = useState("");
  const [selectedSticker, setSelectedSticker] = useState(null);
  const [exporting, setExporting] = useState(false);

  const [draft, setDraft] = useState({ title: "", days: [], start: "18:00", end: "19:00" });
  const [wantDraft, setWantDraft] = useState("");

  const planRef = useRef(null);
  const dragRef = useRef(null);
  const stickerDrag = useRef(null);

  const person = people[active];
  const editing = step === -1;
  const progress = editing
    ? Math.round((editStep / (EDIT_STEPS.length - 1)) * 100)
    : Math.round((step / STEPS.length) * 100);

  // Sauvegarde automatique
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          couple,
          people,
          editStep,
          events: events.length ? events : null,
          commonSlots,
          meta,
          style,
          decor,
        })
      );
    } catch {
      // quota dépassé (images lourdes) : on ignore
    }
  }, [couple, people, editStep, events, commonSlots, meta, style, decor]);

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
      wants: [...person.wants, { title: wantDraft.trim(), sessions: 1, slots: ["soir"], days: [] }],
    });
    setWantDraft("");
  };
  const removeWant = (index) => update({ wants: person.wants.filter((_, i) => i !== index) });
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
      setEvents(buildEvents(data, couple));
      setCommonSlots(data.commonSlots || []);
      setMeta({
        ai: !!data.ai,
        summaries: data.plans.map((p) => ({
          name: p.name,
          added: p.sessionsAdded,
          target: p.sessionsTarget,
          restDay: p.restDay,
        })),
      });
      setSelected(null);
      setWarning("");
      setEditStep(0);
      setStep(-1);
    } catch (e) {
      setError("Impossible de générer le planning. Réessaie dans un instant.");
    } finally {
      setLoading(false);
    }
  };

  const next = () => {
    if (step === STEPS.length - 1) generate();
    else setStep(step + 1);
  };

  const restart = () => {
    if (!window.confirm("Recommencer efface ton planning actuel. Continuer ?")) return;
    localStorage.removeItem(STORAGE_KEY);
    setEvents([]);
    setCommonSlots([]);
    setSelected(null);
    setWarning("");
    setStep(0);
    setActive(0);
    setPeople(couple ? [emptyPerson("Toi"), emptyPerson("Partenaire")] : [emptyPerson("Toi")]);
    setDecor({ backImage: null, backOpacity: 0.25, frontImage: null, frontOpacity: 0.15, stickers: [] });
  };

  // ----- Édition des événements -----
  const applyToEvent = (id, patch) => {
    setEvents((prev) => {
      const target = prev.find((e) => e.id === id);
      if (!target || target.fixed) return prev;
      return prev.map((e) => {
        const linked = target.groupId && e.groupId === target.groupId;
        if (e.id === id || linked) return { ...e, ...patch };
        return e;
      });
    });
  };

  const moveEvent = (id, day, startMin) => {
    const ev = events.find((e) => e.id === id);
    if (!ev || ev.fixed) return;
    const dur = toMin(ev.end) - toMin(ev.start);
    const ns = Math.max(GRID_START, Math.min(GRID_END - dur, startMin));
    const patch = { day, start: toTime(ns), end: toTime(ns + dur) };
    const test = { ...ev, ...patch };
    const others = events.filter((e) => !(ev.groupId && e.groupId === ev.groupId));
    const conflict = hasConflict(test, others);
    applyToEvent(id, patch);
    setWarning(
      conflict ? `Attention : « ${ev.title} » chevauche une autre activité le ${day.toLowerCase()}.` : ""
    );
  };

  const changeDuration = (id, deltaMin) => {
    const ev = events.find((e) => e.id === id);
    if (!ev || ev.fixed) return;
    const newDur = Math.max(30, toMin(ev.end) - toMin(ev.start) + deltaMin);
    const end = Math.min(GRID_END, toMin(ev.start) + newDur);
    const patch = { end: toTime(end) };
    const test = { ...ev, ...patch };
    const others = events.filter((e) => !(ev.groupId && e.groupId === ev.groupId));
    applyToEvent(id, patch);
    setWarning(
      hasConflict(test, others) ? `Attention : « ${ev.title} » chevauche une autre activité.` : ""
    );
  };

  // Glisser-déposer des séances
  const onDragStart = (e, ev) => {
    if (ev.fixed) return;
    const rect = e.currentTarget.getBoundingClientRect();
    dragRef.current = { id: ev.id, offset: e.clientY - rect.top };
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(ev.id));
  };

  const onDropColumn = (e, day) => {
    e.preventDefault();
    if (!dragRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top - dragRef.current.offset;
    const minutes = snap(GRID_START + y / PX_PER_MIN);
    moveEvent(dragRef.current.id, day, minutes);
    dragRef.current = null;
  };

  // ----- Images -----
  const readImage = (file, cb) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => cb(reader.result);
    reader.readAsDataURL(file);
  };

  const addSticker = (file) =>
    readImage(file, (src) =>
      setDecor((d) => ({
        ...d,
        stickers: [...d.stickers, { id: Date.now(), src, x: 40, y: 40, size: 80, opacity: 1 }],
      }))
    );

  const updateSticker = (id, patch) =>
    setDecor((d) => ({ ...d, stickers: d.stickers.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));

  const removeSticker = (id) => {
    setDecor((d) => ({ ...d, stickers: d.stickers.filter((s) => s.id !== id) }));
    setSelectedSticker(null);
  };

  const onStickerDown = (e, s) => {
    e.preventDefault();
    setSelectedSticker(s.id);
    const container = planRef.current.getBoundingClientRect();
    stickerDrag.current = { id: s.id, dx: e.clientX - container.left - s.x, dy: e.clientY - container.top - s.y };
    const move = (ev) => {
      const nx = ev.clientX - container.left - stickerDrag.current.dx;
      const ny = ev.clientY - container.top - stickerDrag.current.dy;
      updateSticker(s.id, { x: Math.max(0, nx), y: Math.max(0, ny) });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  // ----- Thème -----
  const applyTheme = (t) =>
    setStyle((s) => ({ ...s, theme: t.id, bg: t.bg, text: t.text, border: t.border, font: t.font }));

  // ----- Export -----
  const capture = async () => {
    setSelected(null);
    setSelectedSticker(null);
    await new Promise((r) => setTimeout(r, 80));
    return html2canvas(planRef.current, { scale: 2, backgroundColor: style.bg, useCORS: true });
  };

  const exportImage = async () => {
    setExporting(true);
    try {
      const canvas = await capture();
      const a = document.createElement("a");
      a.download = "planning.png";
      a.href = canvas.toDataURL("image/png");
      a.click();
    } finally {
      setExporting(false);
    }
  };

  const exportPdf = async () => {
    setExporting(true);
    try {
      const canvas = await capture();
      const img = canvas.toDataURL("image/png");
      const landscape = canvas.width > canvas.height;
      const pdf = new jsPDF({ orientation: landscape ? "landscape" : "portrait", unit: "mm", format: "a4" });
      const pw = pdf.internal.pageSize.getWidth();
      const ph = pdf.internal.pageSize.getHeight();
      const ratio = Math.min(pw / canvas.width, ph / canvas.height);
      const w = canvas.width * ratio;
      const h = canvas.height * ratio;
      pdf.addImage(img, "PNG", (pw - w) / 2, (ph - h) / 2, w, h);
      pdf.save("planning.pdf");
    } finally {
      setExporting(false);
    }
  };

  const selectedEvent = events.find((e) => e.id === selected);
  const groups = groupFixed(person.fixed);
  const gridHeight = (GRID_END - GRID_START) * PX_PER_MIN;
  const hours = [];
  for (let h = GRID_START / 60; h <= GRID_END / 60; h++) hours.push(h);

  // ------------------------------------------------------------
  // Rendu du planning (grille horaire)
  // ------------------------------------------------------------
  const renderPlanning = () => (
    <div
      ref={planRef}
      className="plan-sheet"
      style={{ background: style.bg, color: style.text, fontFamily: style.font, borderColor: style.border }}
    >
      {decor.backImage && (
        <img src={decor.backImage} alt="" className="layer" style={{ opacity: decor.backOpacity }} />
      )}

      <div className="plan-head" style={{ borderColor: style.border }}>
        <h2 style={{ color: style.text }}>{style.title}</h2>
        {couple && (
          <div className="legend">
            {people.map((p, i) => (
              <span key={i} className="legend-item">
                <span className="dot" style={{ background: OWNER_COLORS[i] }} />
                {p.name}
              </span>
            ))}
            <span className="legend-item">
              <span className="dot" style={{ background: TOGETHER_COLOR }} />
              Ensemble
            </span>
          </div>
        )}
      </div>

      <div className="agenda">
        <div className="hours-col">
          <div className="day-name">&nbsp;</div>
          <div className="hours-body" style={{ height: gridHeight }}>
            {hours.map((h) => (
              <div key={h} className="hour-label" style={{ top: (h * 60 - GRID_START) * PX_PER_MIN }}>
                {String(h).padStart(2, "0")}h
              </div>
            ))}
          </div>
        </div>

        {DAYS.map((d) => (
          <div key={d} className="day-col">
            <div className="day-name" style={{ borderColor: style.border }}>
              {SHORT[d]}
            </div>
            <div
              className="day-body"
              style={{ height: gridHeight, borderColor: style.border }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => onDropColumn(e, d)}
            >
              {hours.map((h) => (
                <div
                  key={h}
                  className="hour-line"
                  style={{ top: (h * 60 - GRID_START) * PX_PER_MIN, borderColor: style.border }}
                />
              ))}
              {events
                .filter((e) => e.day === d)
                .map((e) => {
                  if (e.groupId) {
                    const first = events.find((x) => x.groupId === e.groupId);
                    if (first.id !== e.id) return null;
                  }
                  const top = (toMin(e.start) - GRID_START) * PX_PER_MIN;
                  const height = Math.max(22, (toMin(e.end) - toMin(e.start)) * PX_PER_MIN);
                  const conflict = !e.fixed && hasConflict(e, events);
                  return (
                    <div
                      key={e.id}
                      className={`event${selected === e.id ? " sel" : ""}${e.fixed ? " is-fixed" : ""}${conflict ? " conflict" : ""}`}
                      draggable={!e.fixed && editing && editStep === 0}
                      onDragStart={(ev) => onDragStart(ev, e)}
                      onClick={() => {
                        if (editing && editStep === 0) setSelected(e.id);
                      }}
                      style={{
                        top,
                        height,
                        background: e.fixed ? hexToRgba(e.color, 0.14) : hexToRgba(e.color, 0.22),
                        borderLeft: `3px solid ${e.color}`,
                        color: style.text,
                      }}
                    >
                      <strong>{e.title}</strong>
                      <span>
                        {e.start} – {e.end}
                      </span>
                      {e.note && <em>{e.note}</em>}
                    </div>
                  );
                })}
            </div>
          </div>
        ))}
      </div>

      {couple && commonSlots.length > 0 && (
        <div className="common" style={{ borderColor: style.border }}>
          <strong>Créneaux libres en commun :</strong>{" "}
          {commonSlots.map((s) => `${SHORT[s.day] || s.day} ${s.start}–${s.end}`).join(" · ")}
        </div>
      )}

      {decor.frontImage && (
        <img
          src={decor.frontImage}
          alt=""
          className="layer front"
          style={{ opacity: decor.frontOpacity }}
        />
      )}

      {decor.stickers.map((s) => (
        <img
          key={s.id}
          src={s.src}
          alt=""
          className={`sticker${selectedSticker === s.id ? " sel" : ""}`}
          style={{ left: s.x, top: s.y, width: s.size, opacity: s.opacity, pointerEvents: editing && editStep === 2 ? "auto" : "none" }}
          onPointerDown={(e) => onStickerDown(e, s)}
          draggable={false}
        />
      ))}
    </div>
  );

  // ------------------------------------------------------------
  // Rendu principal
  // ------------------------------------------------------------
  return (
    <div className="app">
      <style>{css}</style>

      <header className="top no-print">
        <h1>Mon planning</h1>
        <p>
          {editing
            ? "Personnalise ton planning à ta façon."
            : "Construis une semaine d'entraînement adaptée à ton niveau."}
        </p>
      </header>

      <div className="progress no-print">
        <div className="progress-labels">
          {(editing ? EDIT_STEPS : STEPS).map((s, i) => (
            <button
              key={s}
              className={`plabel${i <= (editing ? editStep : step) ? " on" : ""}`}
              onClick={() => editing && setEditStep(i)}
              disabled={!editing}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="bar">
          <div className="fill" style={{ width: progress + "%" }} />
        </div>
      </div>

      {couple && !editing && (
        <div className="tabs no-print">
          {people.map((p, i) => (
            <button key={i} className={i === active ? "tab on" : "tab"} onClick={() => setActive(i)}>
              {p.name}
            </button>
          ))}
        </div>
      )}

      {/* ---------- QUESTIONNAIRE ---------- */}
      {step === 0 && (
        <section className="card narrow">
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
              <input className="input" value={person.name} onChange={(e) => update({ name: e.target.value })} />
            </>
          )}
        </section>
      )}

      {step === 1 && (
        <section className="card narrow">
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

            <label className="label">
              2. Quels jours ? <em>(tu peux en cocher plusieurs)</em>
            </label>
            <div className="chips">
              {DAYS.map((d) => (
                <button key={d} className={draft.days.includes(d) ? "chip on" : "chip"} onClick={() => toggleDraftDay(d)}>
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
              <label className="field">
                De
                <input type="time" className="input" value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} />
              </label>
              <label className="field">
                À
                <input type="time" className="input" value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })} />
              </label>
              <button className="btn" onClick={addFixed} disabled={!draft.title.trim() || draft.days.length === 0}>
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
                  <small>
                    {g.days.map((d) => SHORT[d]).join(", ")} · {g.start} – {g.end}
                  </small>
                </div>
                <button className="link" onClick={() => removeGroup(g.indexes)}>Retirer</button>
              </li>
            ))}
            {groups.length === 0 && <li className="empty">Aucune activité ajoutée pour l'instant.</li>}
          </ul>
        </section>
      )}

      {step === 2 && (
        <section className="card narrow">
          <h2>Ce que tu veux ajouter</h2>
          <p className="hint">
            Chaque activité a ses propres réglages : nombre de séances, moments et jours possibles.
          </p>

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
                    <button key={n} className={w.sessions === n ? "chip on" : "chip"} onClick={() => updateWant(i, { sessions: n })}>
                      {n}
                    </button>
                  ))}
                </div>

                <label className="label">Moment de la journée</label>
                <div className="chips">
                  {SLOTS.map((s) => (
                    <button key={s.id} className={w.slots.includes(s.id) ? "chip on" : "chip"} onClick={() => toggleWantIn(i, "slots", s.id)}>
                      {s.label}
                    </button>
                  ))}
                </div>

                <label className="label">
                  Jours possibles <em>(aucun = tous)</em>
                </label>
                <div className="chips">
                  {DAYS.map((d) => (
                    <button key={d} className={w.days.includes(d) ? "chip on" : "chip"} onClick={() => toggleWantIn(i, "days", d)}>
                      {SHORT[d]}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {person.wants.length === 0 && (
              <div className="want-empty">Rien d'ajouté. Tu peux générer ton planning directement.</div>
            )}
          </div>

          <h2>Entre quelles heures peut-on te proposer des séances ?</h2>
          <p className="hint">Aucune séance ne sera placée en dehors de cette plage.</p>
          <div className="row">
            <label className="field">
              De
              <input type="time" className="input" value={person.earliest} onChange={(e) => update({ earliest: e.target.value })} />
            </label>
            <label className="field">
              À
              <input type="time" className="input" value={person.latest} onChange={(e) => update({ latest: e.target.value })} />
            </label>
          </div>
          {error && <p className="error">{error}</p>}
        </section>
      )}

      {/* ---------- PERSONNALISATION ---------- */}
      {editing && (
        <div className="editor">
          <div className="editor-plan">
            <p className="badge-ia no-print">
              {meta.ai ? "✨ Planning optimisé par l'IA" : "Planning calculé par l'algorithme"}
            </p>
            {meta.summaries.map((s, i) => (
              <p key={i} className="hint no-print" style={{ margin: "0 0 4px" }}>
                {s.name} : {s.added} séance(s) ajoutée(s) sur {s.target} prévue(s).
                {s.restDay ? ` Repos : ${s.restDay}.` : ""}
              </p>
            ))}
            {warning && editStep === 0 && <div className="warn no-print">{warning}</div>}
            {renderPlanning()}
          </div>

          <aside className="panel no-print">
            {/* ÉTAPE 1 : SÉANCES */}
            {editStep === 0 && (
              <>
                <h3>Séances</h3>
                <p className="hint">
                  Glisse une séance pour la déplacer (pas de 30 min). Clique dessus pour la modifier. Les activités
                  prioritaires sont verrouillées.
                </p>

                {!selectedEvent && <div className="want-empty">Sélectionne une séance sur le planning.</div>}

                {selectedEvent && selectedEvent.fixed && (
                  <div className="want-empty">« {selectedEvent.title} » est une activité prioritaire : elle ne se modifie pas ici.</div>
                )}

                {selectedEvent && !selectedEvent.fixed && (
                  <div className="form-block">
                    <label className="label">Titre</label>
                    <input
                      className="input full"
                      value={selectedEvent.title}
                      onChange={(e) => applyToEvent(selectedEvent.id, { title: e.target.value })}
                    />

                    <label className="label">Jour</label>
                    <select
                      className="input full"
                      value={selectedEvent.day}
                      onChange={(e) => moveEvent(selectedEvent.id, e.target.value, toMin(selectedEvent.start))}
                    >
                      {DAYS.map((d) => (
                        <option key={d}>{d}</option>
                      ))}
                    </select>

                    <label className="label">Heure de début</label>
                    <input
                      type="time"
                      step="1800"
                      className="input full"
                      value={selectedEvent.start}
                      onChange={(e) =>
                        e.target.value && moveEvent(selectedEvent.id, selectedEvent.day, snap(toMin(e.target.value)))
                      }
                    />

                    <label className="label">
                      Durée : {toMin(selectedEvent.end) - toMin(selectedEvent.start)} min
                    </label>
                    <div className="row">
                      <button className="btn ghost" onClick={() => changeDuration(selectedEvent.id, -30)}>− 30 min</button>
                      <button className="btn ghost" onClick={() => changeDuration(selectedEvent.id, 30)}>+ 30 min</button>
                    </div>

                    <label className="label">Couleur</label>
                    <input
                      type="color"
                      className="color-input"
                      value={selectedEvent.color}
                      onChange={(e) => applyToEvent(selectedEvent.id, { color: e.target.value })}
                    />

                    <label className="label">Note</label>
                    <textarea
                      className="input full"
                      rows={3}
                      placeholder="Ex : apporter les gants"
                      value={selectedEvent.note}
                      onChange={(e) => applyToEvent(selectedEvent.id, { note: e.target.value })}
                    />
                  </div>
                )}
              </>
            )}

            {/* ÉTAPE 2 : STYLE */}
            {editStep === 1 && (
              <>
                <h3>Style</h3>

                <label className="label">Titre du planning</label>
                <input className="input full" value={style.title} onChange={(e) => setStyle({ ...style, title: e.target.value })} />

                <label className="label">Thème</label>
                <div className="themes">
                  {THEMES.map((t) => (
                    <button
                      key={t.id}
                      className={`theme${style.theme === t.id ? " on" : ""}`}
                      style={{ background: t.bg, color: t.text, borderColor: t.border }}
                      onClick={() => applyTheme(t)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                <label className="label">Police</label>
                <select className="input full" value={style.font} onChange={(e) => setStyle({ ...style, font: e.target.value })}>
                  {FONTS.map((f) => (
                    <option key={f.id} value={f.id}>{f.label}</option>
                  ))}
                </select>

                <div className="color-row">
                  <label>
                    Fond
                    <input type="color" className="color-input" value={style.bg} onChange={(e) => setStyle({ ...style, bg: e.target.value })} />
                  </label>
                  <label>
                    Texte
                    <input type="color" className="color-input" value={style.text} onChange={(e) => setStyle({ ...style, text: e.target.value })} />
                  </label>
                  <label>
                    Bordures
                    <input type="color" className="color-input" value={style.border} onChange={(e) => setStyle({ ...style, border: e.target.value })} />
                  </label>
                </div>

                <p className="hint">La couleur de chaque séance se règle à l'étape « Séances ».</p>
              </>
            )}

            {/* ÉTAPE 3 : DÉCORATION */}
            {editStep === 2 && (
              <>
                <h3>Décoration</h3>

                <label className="label">Arrière-plan (image)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => readImage(e.target.files[0], (src) => setDecor({ ...decor, backImage: src }))}
                />
                {decor.backImage && (
                  <>
                    <label className="label">Transparence : {Math.round(decor.backOpacity * 100)} %</label>
                    <input
                      type="range"
                      min="0.05"
                      max="1"
                      step="0.05"
                      value={decor.backOpacity}
                      onChange={(e) => setDecor({ ...decor, backOpacity: +e.target.value })}
                    />
                    <button className="link" onClick={() => setDecor({ ...decor, backImage: null })}>Retirer</button>
                  </>
                )}

                <label className="label">Premier plan (image)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => readImage(e.target.files[0], (src) => setDecor({ ...decor, frontImage: src }))}
                />
                {decor.frontImage && (
                  <>
                    <label className="label">Transparence : {Math.round(decor.frontOpacity * 100)} %</label>
                    <input
                      type="range"
                      min="0.05"
                      max="1"
                      step="0.05"
                      value={decor.frontOpacity}
                      onChange={(e) => setDecor({ ...decor, frontOpacity: +e.target.value })}
                    />
                    <button className="link" onClick={() => setDecor({ ...decor, frontImage: null })}>Retirer</button>
                  </>
                )}

                <label className="label">Stickers (images ou logos)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    addSticker(e.target.files[0]);
                    e.target.value = "";
                  }}
                />
                <p className="hint">Glisse un sticker directement sur le planning pour le placer.</p>

                {decor.stickers.map((s) => (
                  <div
                    key={s.id}
                    className={`sticker-ctrl${selectedSticker === s.id ? " on" : ""}`}
                    onClick={() => setSelectedSticker(s.id)}
                  >
                    <img src={s.src} alt="" />
                    <div className="sticker-sliders">
                      <label>
                        Taille
                        <input type="range" min="30" max="300" value={s.size} onChange={(e) => updateSticker(s.id, { size: +e.target.value })} />
                      </label>
                      <label>
                        Transparence
                        <input
                          type="range"
                          min="0.1"
                          max="1"
                          step="0.05"
                          value={s.opacity}
                          onChange={(e) => updateSticker(s.id, { opacity: +e.target.value })}
                        />
                      </label>
                    </div>
                    <button className="link" onClick={() => removeSticker(s.id)}>Retirer</button>
                  </div>
                ))}
              </>
            )}

            {/* ÉTAPE 4 : EXPORT */}
            {editStep === 3 && (
              <>
                <h3>Export</h3>
                <p className="hint">Vérifie l'aperçu à gauche, puis choisis ton format.</p>
                <div className="export-btns">
                  <button className="btn" onClick={() => window.print()}>Imprimer</button>
                  <button className="btn ghost" disabled={exporting} onClick={exportImage}>
                    {exporting ? "Export..." : "Image (PNG)"}
                  </button>
                  <button className="btn ghost" disabled={exporting} onClick={exportPdf}>
                    {exporting ? "Export..." : "PDF"}
                  </button>
                </div>
                <p className="hint">Tes modifications sont sauvegardées automatiquement dans ce navigateur.</p>
              </>
            )}
          </aside>
        </div>
      )}

      {/* ---------- NAVIGATION ---------- */}
      {!editing && (
        <footer className="nav no-print narrow">
          <button className="btn ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>
            Retour
          </button>
          <button className="btn" disabled={loading} onClick={next}>
            {step === STEPS.length - 1 ? (loading ? "Génération..." : "Générer mon planning") : "Suivant"}
          </button>
        </footer>
      )}

      {editing && (
        <footer className="nav no-print">
          <div className="row">
            <button className="btn ghost" onClick={restart}>Recommencer</button>
            <button className="btn ghost" onClick={() => setStep(2)}>Modifier mes réponses</button>
          </div>
          <div className="row">
            <button className="btn ghost" disabled={editStep === 0} onClick={() => setEditStep(editStep - 1)}>
              Retour
            </button>
            <button
              className="btn"
              disabled={editStep === EDIT_STEPS.length - 1}
              onClick={() => setEditStep(editStep + 1)}
            >
              Suivant
            </button>
          </div>
        </footer>
      )}
    </div>
  );
}

function hexToRgba(hex, alpha) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

const css = `
* { box-sizing: border-box; }
body { margin: 0; background: #f7f7f5; -webkit-font-smoothing: antialiased; }
.