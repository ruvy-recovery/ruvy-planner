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
  const saved = useRef(loadSaved()).current;

  const [couple, setCouple] = useState(saved?.couple ?? false);
  const [people, setPeople] = useState(saved?.people ?? [emptyPerson("Toi")]);
  const [active, setActive] = useState(0);
  const [step, setStep] = useState(saved?.step ?? 0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(saved?.result ?? null);
  const [style, setStyle] = useState({ ...defaultStyle, ...(saved?.style ?? {}) });
  const [exporting, setExporting] = useState(false);

  // Atelier : état de session uniquement (jamais écrit dans localStorage)
  const [atelierTab, setAtelierTab] = useState("Personnalisation");
  const [atelierTool, setAtelierTool] = useState(null);
  const [atelierColor, setAtelierColor] = useState("#8b5cf6");
  const [atelierTextColor, setAtelierTextColor] = useState("#f5f3ff");
  const [atelierBg, setAtelierBg] = useState("#171126");
  const [atelierDays, setAtelierDays] = useState({});
  const [atelierStickers, setAtelierStickers] = useState([]);
  const [selectedSticker, setSelectedSticker] = useState(null);
  const [atelierMarks, setAtelierMarks] = useState([]);
  const atelierRef = useRef(null);
  const drawRef = useRef(null);
  const dragRef = useRef(null);

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

  // ----- Atelier (session courante, sans persistance) -----
  const atelierThemes = {
    Aurora: { bg: "#101a1b", accent: "#55d6be", text: "#e9fff9" },
    Sunset: { bg: "#26131b", accent: "#ff8a65", text: "#fff1e8" },
    Forêt: { bg: "#102018", accent: "#8bc34a", text: "#efffe5" },
  };
  const selectAtelierTab = (tab) => { setAtelierTab(tab); setAtelierTool(null); setSelectedSticker(null); };
  const setTheme = (name) => { const t=atelierThemes[name]; setAtelierBg(t.bg); setAtelierColor(t.accent); setAtelierTextColor(t.text); };
  const atelierPoint = (e) => { const r=atelierRef.current?.getBoundingClientRect(); return r ? { x: Math.max(0, Math.min(r.width-4,e.clientX-r.left)), y: Math.max(0,Math.min(r.height-4,e.clientY-r.top)) } : {x:0,y:0}; };
  const startAtelierDrag = (kind, id, e) => {
    if (atelierTool !== null || e.button !== 0) return;
    e.preventDefault(); const p=atelierPoint(e); dragRef.current={kind,id,ox:p.x,oy:p.y};
    const move=(ev)=>{ const q=atelierPoint(ev), d=dragRef.current; if(!d)return; const dx=q.x-d.ox,dy=q.y-d.oy; d.ox=q.x;d.oy=q.y;
      if(d.kind==='sticker') setAtelierStickers(v=>v.map(x=>x.id===d.id?{...x,x:x.x+dx,y:x.y+dy}:x));
      else setAtelierDays(v=>({...v,[d.id]:{...(v[d.id]||{}),x:(v[d.id]?.x||0)+dx,y:(v[d.id]?.y||0)+dy}})); };
    const up=()=>{dragRef.current=null; window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up)};
    window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);
  };
  const addSticker = (glyph) => { const r=atelierRef.current?.getBoundingClientRect(); const st={id:Date.now()+Math.random(),glyph,x:(r?.width||720)/2-28,y:(r?.height||620)/2-28,size:56,rotate:0}; setAtelierStickers(v=>[...v,st]); setSelectedSticker(st.id); };
  const updateSticker=(id,patch)=>setAtelierStickers(v=>v.map(s=>s.id===id?{...s,...patch}:s));
  const atelierPaint=(target, e)=>{ if(atelierTool!=='pot' && atelierTool!=='pipette') return; e.stopPropagation(); const color=target.dataset?.color||atelierBg; if(atelierTool==='pipette') setAtelierColor(color); else if(target.dataset?.day) setAtelierDays(v=>({...v,[target.dataset.day]:{...(v[target.dataset.day]||{}),color:atelierColor}})); };
  const pickTool=(tool)=>setAtelierTool(tool);
  const drawPointer=(e)=>{ if(!['stylo','surligneur','gomme'].includes(atelierTool))return; const p=atelierPoint(e); setAtelierMarks(v=>[...v,{x:p.x,y:p.y,color:atelierTool==='gomme'?atelierBg:atelierColor,size:atelierTool==='surligneur'?18:4}]); };

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

      {/* ---------- ÉTAPE 5 : ATELIER ---------- */}
      {step === 4 && result && (
        <section className="atelier-shell">
          <div className="atelier-head"><div><span className="eyebrow">RUVY / ATELIER</span><h2>Compose ton planning</h2><p>Personnalise, dessine et déplace chaque élément librement.</p></div><input className="atelier-title" value={style.title} onChange={e=>setStyleKey({title:e.target.value})} aria-label="Titre du planning" /></div>
          <div className="atelier-layout">
            <aside className="atelier-cats">{["Personnalisation","Fond","Stickers","Modification"].map(x=><button key={x} className={atelierTab===x?'cat active':'cat'} onClick={()=>selectAtelierTab(x)}>{x}</button>)}</aside>
            <div className="atelier-tools">
              {atelierTab==='Personnalisation' && <><h3>Couleurs du planning</h3><label>Fond <input type="color" value={atelierBg} onChange={e=>setAtelierBg(e.target.value)}/></label><label>Accent <input type="color" value={atelierColor} onChange={e=>setAtelierColor(e.target.value)}/></label><label>Texte <input type="color" value={atelierTextColor} onChange={e=>setAtelierTextColor(e.target.value)}/></label><h3>Thèmes prêts</h3><div className="theme-list">{Object.keys(atelierThemes).map(x=><button key={x} onClick={()=>setTheme(x)}>{x}</button>)}</div><label>Image de fond<input className="file-input" type="file" accept="image/*" onChange={onBgImage}/></label>{style.bgImage&&<label>Transparence <input type="range" min="0" max="1" step=".05" value={style.bgOpacity} onChange={e=>setStyleKey({bgOpacity:+e.target.value})}/></label>}</>}
              {atelierTab==='Fond' && <><h3>Outils de dessin</h3><div className="tool-grid">{[[null,'Déplacer'],['stylo','Stylo'],['surligneur','Surligneur'],['gomme','Gomme'],['pot','Pot'],['pipette','Pipette']].map(([id,label])=><button key={label} className={atelierTool===id?'tool active':'tool'} onClick={()=>pickTool(id)}>{label}</button>)}</div><label>Couleur <input type="color" value={atelierColor} onChange={e=>setAtelierColor(e.target.value)}/></label><label>Épaisseur <input type="range" min="2" max="32" value={atelierMarks[0]?.size||4} onChange={()=>{}}/></label><div className="tool-actions"><button onClick={()=>setAtelierMarks(v=>v.slice(0,-1))}>Annuler</button><button onClick={()=>setAtelierMarks([])}>Effacer</button></div></>}
              {atelierTab==='Stickers' && <><h3>Ajouter un sticker</h3><p className="mini">Clique : il se place au centre du planning.</p><div className="sticker-palette">{['⭐','⚡','💪','🔥','☀️','🌙','✓','✦'].map(x=><button key={x} onClick={()=>addSticker(x)}>{x}</button>)}</div>{selectedSticker&&<div className="sticker-controls"><button onClick={()=>updateSticker(selectedSticker,{size:Math.max(20,(atelierStickers.find(s=>s.id===selectedSticker)?.size||56)-8)})}>−</button><button onClick={()=>updateSticker(selectedSticker,{size:(atelierStickers.find(s=>s.id===selectedSticker)?.size||56)+8})}>＋</button><button onClick={()=>updateSticker(selectedSticker,{rotate:(atelierStickers.find(s=>s.id===selectedSticker)?.rotate||0)-15})}>↶</button><button onClick={()=>setAtelierStickers(v=>v.filter(s=>s.id!==selectedSticker))}>✕ Supprimer</button></div>}</>}
              {atelierTab==='Modification' && <><h3>Modifier une séance</h3><p className="mini">Clique directement sur une séance ajoutée pour modifier son jour, son heure, sa durée ou la supprimer.</p><button className="tool" onClick={()=>setEditing(null)}>Clic normal</button></>}
            </div>
            <div className="atelier-planning"><div ref={atelierRef} className="atelier-canvas" style={{backgroundColor:atelierBg,color:atelierTextColor,backgroundImage:style.bgImage?`linear-gradient(rgba(0,0,0,${1-style.bgOpacity}),rgba(0,0,0,${1-style.bgOpacity})),url(${style.bgImage})`:undefined}} onPointerDown={drawPointer}>
              <div className="canvas-title" style={{color:atelierColor}}>{style.title || 'Mon planning'}</div>
              {DAYS.map((d,i)=>{const pos=atelierDays[d]||{};const events=buildDay(d);return <div key={d} data-day={d} data-color={pos.color||atelierBg} className="atelier-day" onPointerDown={e=>startAtelierDrag('day',d,e)} onClick={e=>atelierPaint(e.currentTarget,e)} style={{left:pos.x!==undefined?pos.x:i%3*32+'%',top:pos.y!==undefined?pos.y:Math.floor(i/3)*31+'%',background:pos.color||'rgba(255,255,255,.09)',borderColor:atelierColor}}><strong>{d}</strong>{events.map((ev,j)=><div key={j} data-color={pos.color||atelierBg} className="atelier-event" onClick={e=>{e.stopPropagation(); atelierPaint(e.currentTarget,e); if(ev.owner!==undefined&&!ev.together)startEdit(ev.owner,ev.evIndex)}} onPointerDown={e=>startAtelierDrag('day',d,e)}><b>{ev.title}</b><small>{ev.start} – {ev.end}</small></div>)}</div>})}
              {atelierStickers.map(s=><div key={s.id} className={'atelier-sticker '+(selectedSticker===s.id?'selected':'')} onPointerDown={e=>{e.stopPropagation();setSelectedSticker(s.id);startAtelierDrag('sticker',s.id,e)}} onClick={e=>atelierPaint(e.currentTarget,e)} style={{left:s.x,top:s.y,fontSize:s.size,transform:`rotate(${s.rotate}deg)`}}>{s.glyph}<button onClick={()=>setAtelierStickers(v=>v.filter(x=>x.id!==s.id))}>×</button></div>)}
              <svg className="marks" pointerEvents={atelierTool&&['stylo','surligneur','gomme'].includes(atelierTool)?'none':'none'}>{atelierMarks.map((m,i)=><circle key={i} cx={m.x} cy={m.y} r={m.size/2} fill={m.color} opacity={atelierTool==='surligneur'?.35:1}/>)}</svg>
            </div></div>
          </div>
          {renderEditor()}
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
*{box-sizing:border-box}body{margin:0;background:#f7f7f5;-webkit-font-smoothing:antialiased}.app{max-width:820px;margin:0 auto;padding:48px 20px 80px;font-family:Inter,system-ui,sans-serif;color:#151515}.top h1{font-size:32px;margin:0 0 8px}.top p{color:#6b6b6b}.progress{margin:36px 0 24px}.progress-labels{display:flex;justify-content:space-between;font-size:13px;color:#aaa;margin-bottom:10px}.progress-labels .on{color:#151515;font-weight:600}.bar{height:3px;background:#e7e7e4}.fill{height:100%;background:#14532d}.tabs,.row{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end}.card{background:#fff;border:1px solid #ebebe8;border-radius:20px;padding:36px;box-shadow:0 1px 2px #00000008;margin-bottom:20px}.card h2{font-size:18px;margin:32px 0 6px}.card h2:first-child{margin-top:0}.hint{color:#6b6b6b;font-size:14px;line-height:1.5}.label{font-size:14px;font-weight:600;margin-top:10px;display:block}.input{padding:11px 14px;border:1px solid #e0e0dc;border-radius:12px;font-size:15px;background:#fff;color:#151515}.full{width:100%}.field{display:flex;flex-direction:column;gap:6px;font-size:13px}.btn{padding:11px 22px;border-radius:12px;border:1px solid #14532d;background:#14532d;color:#fff;cursor:pointer}.btn.ghost{background:#fff;color:#151515;border-color:#e0e0dc}.link{background:none;border:0;color:#777;cursor:pointer}.nav{display:flex;justify-content:space-between;margin-top:24px}.choices{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}.choice{padding:18px;border:1px solid #e3e3df;background:#fff;border-radius:14px;text-align:left;cursor:pointer}.choice.on{border-color:#14532d;background:#f2f8f4}.chips{display:flex;flex-wrap:wrap;gap:8px}.chip{padding:9px 18px;border:1px solid #e0e0dc;background:#fff;border-radius:999px;cursor:pointer}.chip.on{background:#14532d;color:#fff}.week{display:grid;grid-template-columns:repeat(7,1fr);gap:8px}.day{border:1px solid #ececec;border-radius:12px;padding:12px;min-height:120px}.event{padding:8px;border-radius:8px;margin-bottom:6px;display:flex;flex-direction:column;font-size:12px;background:#f2f8f4}.event.editable{cursor:pointer}.editor{margin-top:20px;padding:18px;border:1px solid #e4e0ef;border-radius:14px;background:#faf8ff}.editor-head{display:flex;justify-content:space-between}.warn-text{color:#dc2626;font-size:13px}.atelier-shell{background:#110c1e;color:#eee;border:1px solid #382553;border-radius:24px;padding:24px;box-shadow:0 24px 80px #160d2b66}.atelier-head{display:flex;justify-content:space-between;gap:24px;align-items:end;margin-bottom:24px}.atelier-head h2{font-size:28px;margin:6px 0}.atelier-head p,.mini{color:#a79bbd;font-size:13px}.eyebrow{color:#a78bfa;font-size:11px;letter-spacing:.16em}.atelier-title{width:280px;background:#1d1430;border:1px solid #503575;color:#fff;padding:13px;border-radius:10px}.atelier-layout{display:grid;grid-template-columns:150px minmax(240px,290px) minmax(0,1fr);gap:14px;align-items:start}.atelier-cats,.atelier-tools{background:#191128;border:1px solid #302043;border-radius:16px;padding:12px}.cat,.tool,.theme-list button,.tool-actions button,.sticker-controls button{display:block;width:100%;text-align:left;background:transparent;color:#c9bedb;border:0;border-radius:9px;padding:11px 10px;cursor:pointer}.cat.active,.tool.active,.theme-list button:hover{background:#342052;color:#fff}.atelier-tools h3{font-size:14px;margin:6px 0 14px;color:#fff}.atelier-tools label{display:flex;justify-content:space-between;align-items:center;gap:8px;margin:12px 0;font-size:12px;color:#b9abc9}.atelier-tools input[type=color]{width:42px;height:28px;border:0;background:none}.file-input{max-width:135px;font-size:10px}.theme-list{display:grid;grid-template-columns:1fr;gap:4px}.tool-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px}.tool-grid .tool{font-size:12px}.sticker-palette{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}.sticker-palette button{font-size:22px;background:#25183b;border:1px solid #493064;border-radius:10px;padding:7px;cursor:pointer}.sticker-controls{margin-top:16px;display:flex;gap:5px;flex-wrap:wrap}.sticker-controls button{width:auto;background:#2a1b40}.atelier-planning{min-width:0}.atelier-canvas{position:relative;min-height:620px;height:calc(100vh - 220px);max-height:760px;overflow:hidden;border:1px solid #4b3470;border-radius:18px;padding:20px;isolation:isolate}.canvas-title{font-size:24px;font-weight:800;position:absolute;top:18px;left:20px;z-index:3}.atelier-day{position:absolute;width:30%;min-height:150px;padding:12px;border:1px solid;border-radius:13px;cursor:grab;overflow:hidden;transition:box-shadow .15s}.atelier-day:nth-of-type(2){left:34%}.atelier-day:nth-of-type(3){left:67%}.atelier-day strong{font-size:13px}.atelier-event{margin-top:9px;padding:8px;border-radius:8px;background:#ffffff20;cursor:pointer;font-size:11px}.atelier-event b,.atelier-event small{display:block}.atelier-event small{opacity:.7;margin-top:3px}.atelier-sticker{position:absolute;z-index:5;cursor:grab;user-select:none;line-height:1}.atelier-sticker button{display:none}.atelier-sticker.selected{outline:1px dashed #c4b5fd;outline-offset:5px}.atelier-sticker.selected button{display:block;position:absolute;right:-15px;top:-15px;border:0;border-radius:50%;background:#ef4444;color:#fff;cursor:pointer}.marks{position:absolute;inset:0;width:100%;height:100%;z-index:2;pointer-events:none}.end{justify-content:flex-end;margin-top:24px}@media(max-width:1000px){.app{max-width:1300px}.atelier-layout{grid-template-columns:130px 260px minmax(0,1fr)}}@media(max-width:760px){.atelier-head{display:block}.atelier-title{width:100%;margin-top:15px}.atelier-layout{grid-template-columns:1fr}.atelier-cats{display:flex;overflow:auto}.cat{white-space:nowrap}.atelier-canvas{height:620px}.week{grid-template-columns:1fr 1fr}}
`;
