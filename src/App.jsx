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

const INTENSE_RE = /hiit|fractionn|sprint|crossfit|combat|boxe|mma|muscu|renforcement|force|course|running|vélo|velo|rameur/i;
const RECOVERY_RE = /yoga|mobil|étirement|etirement|stretch|marche douce|marche|pilates/i;

function timeForSlot(slot, level = "intermediaire") {
  const starts = { matin: "07:00", midi: "12:30", soir: "18:00" };
  const duration = level === "debutant" ? 40 : level === "avance" ? 70 : 55;
  const start = starts[slot] || "18:00";
  const endMin = toMin(start) + duration;
  return { start, end: `${String(Math.floor(endMin / 60)).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}` };
}

function isIntenseEvent(event) {
  return event?.intensity === "intense" || INTENSE_RE.test(String(event?.title || "")) && !RECOVERY_RE.test(String(event?.title || ""));
}

function isFixedEvent(event, fixed = []) {
  return Boolean(event?.fixed) || fixed.some((a) => a.day === event.day && String(a.title).toLowerCase() === String(event.title).toLowerCase() && a.start === event.start && a.end === event.end);
}

function overlapsAny(event, events) {
  return events.some((other) => other !== event && other.day === event.day && overlaps(event, other));
}

function assessLoad(plan) {
  const events = (plan?.events || []).filter((e) => !e.fixed);
  const intense = events.filter(isIntenseEvent);
  const intenseDays = new Set(intense.map((e) => e.day));
  const activeDays = new Set(events.map((e) => e.day));
  const dayIndexes = [...intenseDays].map((d) => DAYS.indexOf(d)).sort((a, b) => a - b);
  const consecutive = dayIndexes.some((d, i) => i > 0 && d === dayIndexes[i - 1] + 1);
  const noRest = activeDays.size >= DAYS.length;
  const warnings = [];
  if (intense.length > 3) warnings.push("⚠ Surcharge : plus de 3 séances intenses cette semaine. Prévois davantage de récupération.");
  if (consecutive) warnings.push("⚠ Récupération insuffisante : des séances intenses sont prévues sur des jours consécutifs.");
  if (noRest) warnings.push("⚠ Aucun jour de repos complet cette semaine : allège une journée.");
  return warnings;
}

function prepareGeneratedResult(data, inputPeople) {
  const warnings = [];
  const plans = (data?.plans || []).map((plan, pi) => {
    const person = inputPeople[pi] || {};
    const fixed = Array.isArray(person.fixed) ? person.fixed : [];
    const level = person.level || "intermediaire";
    const kept = [];
    const apiEvents = Array.isArray(plan.events) ? plan.events : [];
    // Les fixes viennent du questionnaire : on les réinjecte même si l'API les omet,
    // afin que le contrôle horaire reste exact et qu'aucune séance ne passe dessus.
    fixed.forEach((activity) => {
      if (!apiEvents.some((event) => isFixedEvent(event, [activity]))) {
        kept.push({ ...activity, fixed: true, intensity: "fixe" });
      }
    });
    const candidates = [...apiEvents].sort((a, b) => Number(Boolean(a.fixed)) - Number(Boolean(b.fixed)));
    candidates.forEach((event) => {
      const fixedEvent = isFixedEvent(event, fixed);
      let next = { ...event, fixed: fixedEvent || event.fixed === true, intensity: event.intensity || (isIntenseEvent(event) ? "intense" : "moderee") };
      if (fixedEvent) { kept.push(next); return; }
      const slotTimes = timeForSlot(next.slot, level);
      // La durée est pilotée par le niveau, plutôt que par un créneau générique renvoyé par l'API.
      const baseDuration = level === "debutant" ? 40 : level === "avance" ? 70 : 55;
      const boundedStart = Math.max(Number(person.firstSessionHour || 5) * 60, toMin(next.start || slotTimes.start));
      const boundedEnd = Math.min(Number(person.lastSessionHour || 23) * 60, boundedStart + baseDuration);
      next = { ...next, start: `${String(Math.floor(boundedStart / 60)).padStart(2, "0")}:${String(boundedStart % 60).padStart(2, "0")}`, end: `${String(Math.floor(boundedEnd / 60)).padStart(2, "0")}:${String(boundedEnd % 60).padStart(2, "0")}`, recovery: level === "debutant" || next.intensity !== "intense" ? "prioritaire" : "standard", progression: next.progression || (level === "debutant" ? "progressive" : level === "avance" ? "charge adaptée" : "progressive") };
      if (toMin(next.end) <= toMin(next.start) || overlapsAny(next, kept)) {
        let placed = false;
        for (let shift = 15; shift <= 12 * 60 && !placed; shift += 15) {
          for (const delta of [shift, -shift]) {
            const start = toMin(next.start) + delta;
            const end = start + baseDuration;
            const candidate = { ...next, start: `${String(Math.floor(start / 60)).padStart(2, "0")}:${String(start % 60).padStart(2, "0")}`, end: `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}` };
            if (start >= Number(person.firstSessionHour || 5) * 60 && end <= Number(person.lastSessionHour || 23) * 60 && !overlapsAny(candidate, kept)) { next = candidate; placed = true; break; }
          }
        }
        if (!placed) { warnings.push(`⚠ Séance non placée pour ${person.name || "ce profil"} : aucun créneau libre sans chevauchement.`); return; }
      }
      kept.push(next);
    });
    // Garantir au moins un jour sans séance générée lorsque c'est possible.
    const generatedDays = new Set(kept.filter((e) => !e.fixed).map((e) => e.day));
    if (generatedDays.size === DAYS.length) {
      const removable = kept
        .map((event, index) => ({ event, index }))
        .filter(({ event }) => !event.fixed)
        .sort((a, b) => Number(isIntenseEvent(b.event)) - Number(isIntenseEvent(a.event)) || toMin(b.event.start) - toMin(a.event.start));
      const dropped = removable.find(({ event }) => kept.filter((other) => !other.fixed && other.day === event.day).length === 1) || removable[0];
      if (dropped) {
        kept.splice(dropped.index, 1);
        warnings.push(`⚠ Séance non placée pour ${person.name || "ce profil"} : un jour de repos a été réservé.`);
      }
    }
    const loadWarnings = assessLoad({ ...plan, events: kept });
    warnings.push(...loadWarnings.map((w) => `${person.name || "Profil"} : ${w.replace(/^⚠\s*/, "")}`));
    return { ...plan, events: kept, warnings: loadWarnings };
  });
  return { ...data, plans, warnings: [...(data?.warnings || []), ...warnings] };
}

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
  maxSessions: 3,
  firstSessionHour: 6,
  lastSessionHour: 22,
});

const defaultStyle = {
  title: "Mon planning",
  bgColor: "#18132c",
  bgImage: "",
  bgOpacity: 0.25,
  dayImages: {},
  dayImageOpacity: 0.3,
  accent: "#a78bfa",
  textColor: "#f5f3ff",
  stickers: [],
};

function loadSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (Array.isArray(saved?.people)) {
      saved.people = saved.people.map((p) => {
        const clean = Object.fromEntries(Object.entries(p || {}).filter(([key]) => !key.startsWith("pref")));
        const hour = (value, fallback) => {
          const n = Number(String(value ?? "").split(":")[0]);
          return Number.isFinite(n) ? Math.max(5, Math.min(23, n)) : fallback;
        };
        return { ...emptyPerson(clean.name || "Toi"), ...clean, firstSessionHour: hour(clean.firstSessionHour, 6), lastSessionHour: hour(clean.lastSessionHour, 22) };
      });
    }
    return saved;
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
  const [step, setStep] = useState(saved?.result ? 4 : Math.min(saved?.step ?? 0, 2));
  const [loading, setLoading] = useState(false);
  const [cinematic, setCinematic] = useState(false);
  const [editorTab, setEditorTab] = useState("colors");
  const [error, setError] = useState("");
  const [result, setResult] = useState(saved?.result ?? null);
  const [style, setStyle] = useState({ ...defaultStyle });
  const [paintTool, setPaintTool] = useState("pen");
  const [paintColor, setPaintColor] = useState("#c084fc");
  const [paintSize, setPaintSize] = useState(5);
  const [paintBackground, setPaintBackground] = useState("#18132c");
  const [paintHistory, setPaintHistory] = useState([]);
  const [paintFuture, setPaintFuture] = useState([]);
  const [draggingEvent, setDraggingEvent] = useState(null);
  const [selectedSticker, setSelectedSticker] = useState(null);
  const stickerDragRef = useRef(null);
  const [atelierDayOrder, setAtelierDayOrder] = useState(DAYS);
  const atelierDayDragRef = useRef(null);
  const paintCanvasRef = useRef(null);
  const paintDrawingRef = useRef(false);
  const [exporting, setExporting] = useState(false);
  const [printPreview, setPrintPreview] = useState(false);

  const [draft, setDraft] = useState({ title: "", days: [], start: "18:00", end: "19:00" });
  const [wantDraft, setWantDraft] = useState("");

  // édition d'un événement du résultat : { plan, index } ou null
  const [editing, setEditing] = useState(null);

  const exportRef = useRef(null);

  const person = people[active] || people[0];
  const progress = Math.round((Math.min(step, 2) / 2) * 100);

  useEffect(() => {
    document.documentElement.classList.toggle("editor-active", step === 4);
    return () => document.documentElement.classList.remove("editor-active");
  }, [step]);

  // ----- Sauvegarde automatique -----
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ couple, people, step, result })
      );
    } catch (e) {
      // quota dépassé (images trop lourdes) : on ignore sans casser l'app
    }
  }, [couple, people, step, result]);

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

  // Réglages internes conservés pour la génération (sans étape affichée).
  const toggleIn = (key, value) => {
    const list = person[key];
    update({ [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value] });
  };

  // ----- Génération -----
  const generate = async () => {
    setLoading(true);
    setCinematic(true);
    setError("");
    try {
      const r = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ couple, people }),
      });
      if (!r.ok) throw new Error("Erreur serveur");
      const data = await r.json();
      const safeData = prepareGeneratedResult(data, people);
      setResult(safeData);
      setStep(4);
      setActive(0);
      setEditing(null);
      window.setTimeout(() => setCinematic(false), 6000);
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

  const applyTheme = (theme) => { setPaintBackground(theme.bgColor); setStyleKey(theme); };
  const selectEditorTab = (tab) => { setEditorTab(tab); setPaintTool("move"); setSelectedSticker(null); };
  const selectPaintTool = (tool) => { setPaintTool(tool); setSelectedSticker(null); };
  const addSticker = (sticker) => setStyleKey({ stickers: [...(style.stickers || []), { emoji: sticker, x: 18 + ((style.stickers || []).length * 17) % 70, y: 16 + ((style.stickers || []).length * 23) % 65, size: 28, rotation: -8 }] });
  const updateSticker = (index, patch) => setStyleKey({ stickers: (style.stickers || []).map((s, i) => i === index ? { ...s, ...patch } : s) });
  const startStickerDrag = (e, index, resize = false) => {
    e.stopPropagation(); e.preventDefault();
    const frame = e.currentTarget.closest(".export-zone"); if (!frame) return;
    const rect = frame.getBoundingClientRect(); const sticker = style.stickers[index];
    stickerDragRef.current = { index, resize, rect, startX: e.clientX, startY: e.clientY, startSize: sticker.size || 28, startXPos: sticker.x, startYPos: sticker.y };
    setSelectedSticker(index); e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const moveSticker = (e) => {
    const drag = stickerDragRef.current; if (!drag) return;
    const dx = e.clientX - drag.startX, dy = e.clientY - drag.startY;
    if (drag.resize) updateSticker(drag.index, { size: Math.max(16, Math.min(140, drag.startSize + (dx + dy) / 2)) });
    else updateSticker(drag.index, { x: Math.max(0, Math.min(96, drag.startXPos + dx / drag.rect.width * 100)), y: Math.max(0, Math.min(96, drag.startYPos + dy / drag.rect.height * 100)) });
  };
  const endStickerDrag = () => { stickerDragRef.current = null; };
  const removeSticker = (index) => setStyleKey({ stickers: (style.stickers || []).filter((_, i) => i !== index) });

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

  // ----- Atelier Paint : dessin libre, annuler/rétablir et remplissage visuel -----
  const snapshotCanvas = () => paintCanvasRef.current?.toDataURL() || "";
  const restoreCanvas = (data) => {
    const canvas = paintCanvasRef.current; if (!canvas || !data) return;
    const image = new Image(); image.onload = () => canvas.getContext("2d").drawImage(image, 0, 0); image.src = data;
  };
  const prepareCanvas = (canvas) => {
    if (!canvas || canvas.dataset.ready) return;
    const box = canvas.getBoundingClientRect(); const ratio = window.devicePixelRatio || 1;
    canvas.width = box.width * ratio; canvas.height = box.height * ratio;
    canvas.getContext("2d").scale(ratio, ratio); canvas.dataset.ready = "true";
  };
  const paintPoint = (event) => {
    const canvas = paintCanvasRef.current; if (!canvas) return;
    prepareCanvas(canvas); const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext("2d"); const x = event.clientX - rect.left, y = event.clientY - rect.top;
    if (paintTool === "bucket") return;
    ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.lineWidth = paintSize;
    ctx.strokeStyle = paintTool === "eraser" ? "rgba(0,0,0,1)" : paintColor;
    ctx.globalCompositeOperation = paintTool === "eraser" ? "destination-out" : paintTool === "marker" ? "multiply" : "source-over";
    if (!paintDrawingRef.current) { ctx.beginPath(); ctx.moveTo(x, y); paintDrawingRef.current = true; }
    ctx.lineTo(x, y); ctx.stroke();
  };
  const beginPaint = (e) => { if (paintTool === "bucket" || paintTool === "picker") return; setPaintHistory(h => [...h.slice(-14), snapshotCanvas()]); setPaintFuture([]); paintPoint(e); };
  const pickElementColor = (e) => {
    const canvas = paintCanvasRef.current; if (canvas) canvas.style.pointerEvents = "none";
    const hit = document.elementsFromPoint(e.clientX, e.clientY).find((node) => node !== canvas && node.closest?.(".export-zone"));
    if (canvas) canvas.style.pointerEvents = "auto";
    if (hit) {
      const color = getComputedStyle(hit).backgroundColor !== "rgba(0, 0, 0, 0)" ? getComputedStyle(hit).backgroundColor : getComputedStyle(hit).color;
      const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (match) setPaintColor(`#${match.slice(1).map(v => Number(v).toString(16).padStart(2, "0")).join("")}`);
    }
    setPaintTool("move");
  };
  const handlePaintPointer = async (e) => {
    e.preventDefault();
    if (paintTool === "picker") {
      if (window.EyeDropper) { try { const picked = await new window.EyeDropper().open(); setPaintColor(picked.sRGBHex); setPaintTool("move"); return; } catch (_) {} }
      pickElementColor(e); return;
    }
    if (paintTool === "bucket") {
      setPaintHistory(h => [...h.slice(-14), snapshotCanvas()]); setPaintFuture([]);
      const hit = document.elementsFromPoint(e.clientX, e.clientY).find((node) => !node.classList?.contains("paint-canvas") && node.matches?.(".day, .export-zone h2, .export-zone"));
      if (hit?.matches(".day")) hit.style.backgroundColor = paintColor;
      else if (hit?.matches("h2")) hit.style.color = paintColor;
      else setPaintBackground(paintColor);
      return;
    }
    beginPaint(e);
  };
  const endPaint = () => { paintDrawingRef.current = false; };
  const undoPaint = () => { const last = paintHistory.at(-1); if (!last) return; setPaintFuture(f => [...f, snapshotCanvas()]); setPaintHistory(h => h.slice(0,-1)); const c=paintCanvasRef.current; if(c){c.getContext("2d").clearRect(0,0,c.width,c.height); restoreCanvas(last);} };
  const redoPaint = () => { const next = paintFuture.at(-1); if (!next) return; setPaintHistory(h => [...h, snapshotCanvas()]); setPaintFuture(f => f.slice(0,-1)); const c=paintCanvasRef.current; if(c){c.getContext("2d").clearRect(0,0,c.width,c.height); restoreCanvas(next);} };
  const moveEvent = (e, day) => {
    if (paintTool !== "move") return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const planIndex = Number(e.currentTarget.dataset.plan), eventIndex = Number(e.currentTarget.dataset.event);
    const rect = e.currentTarget.parentElement.getBoundingClientRect();
    const dayIndex = DAYS.indexOf(day); const nextDay = DAYS[Math.max(0, Math.min(6, Math.round((e.clientX - rect.left) / (rect.width / 7) - .5)))];
    if (nextDay && nextDay !== day) updateEvent(planIndex, eventIndex, { day: nextDay });
    setDraggingEvent({ planIndex, eventIndex });
  };
  const finishMove = () => setDraggingEvent(null);

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

  const renderPrintGrid = () => {
    if (!result) return null;
    const start = Math.max(5, Math.min(23, Number(person?.firstSessionHour) || 6));
    const end = Math.max(start, Math.min(23, Number(person?.lastSessionHour) || 22));
    const hours = Array.from({ length: end - start + 1 }, (_, i) => start + i);
    const eventsAt = (day, hour) => result.plans.flatMap((p, owner) =>
      (p.events || []).filter((e) => e.day === day && Number(String(e.start || "").split(":")[0]) === hour)
        .map((e) => ({ ...e, owner, ownerName: p.name }))
    );
    return <div className="print-grid-wrap" aria-label="Grille imprimable du planning">
      <h2 className="print-title">{style.title || "Mon planning"}</h2>
      <table className="print-grid"><thead><tr><th>Heure</th>{DAYS.map((d) => <th key={d}>{d}</th>)}</tr></thead>
        <tbody>{hours.map((hour) => <tr key={hour}><th>{hour}h</th>{DAYS.map((day) => {
          const events = eventsAt(day, hour);
          return <td key={day}>{events.length ? events.map((e, i) => <div key={i} className="print-event"><strong>{e.title}</strong><span>{e.start} – {e.end}</span>{couple && <small>{e.ownerName}</small>}</div>) : <span className="print-rest">Repos</span>}</td>;
        })}</tr>)}</tbody></table>
    </div>;
  };

  const renderWeek = (interactive) => (
    <div className="week-frame" aria-label="Cadre du planning à sept jours">
    <div className="week">
      {atelierDayOrder.map((d) => {
        const merged = buildDay(d);
        const dayImg = style.dayImages[d];
        return (
          <div key={d} className="day" draggable={paintTool === "move"}
            onDragStart={(e) => { atelierDayDragRef.current = d; e.dataTransfer.effectAllowed = "move"; }}
            onDragOver={(e) => { if (paintTool === "move") e.preventDefault(); }}
            onDrop={(e) => {
              e.preventDefault();
              const from = atelierDayDragRef.current;
              if (paintTool === "move" && from && from !== d) setAtelierDayOrder(order => { const next=[...order]; const a=next.indexOf(from), b=next.indexOf(d); [next[a],next[b]]=[next[b],next[a]]; return next; });
              atelierDayDragRef.current = null;
            }}
            style={{ position: "relative", overflow: "hidden", backgroundColor: style.bgColor }}>
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
              <h3 style={{ color: style.textColor || "#151515" }}>{d}</h3>
              {merged.length === 0 && <div className="rest">Libre</div>}
              {merged.map((e, i) => {
                const c = e.together
                  ? { bg: style.blockColor || "#f5f0ff", border: "#7c3aed" }
                  : style.blockColor ? { bg: style.blockColor, border: style.accent } : (COLORS[e.owner] || COLORS[0]);
                const warns = interactive && !e.together ? warningsFor(e.owner, e.evIndex) : [];
                const canEdit = interactive && !e.fixed && !e.together;
                return (
                  <div
                    key={i}
                    className={(canEdit ? "event editable" : "event") + " event-reveal"}
                    data-plan={e.owner} data-event={e.evIndex}
                    onPointerDown={(ev) => moveEvent(ev, d)} onPointerUp={finishMove}
                    onClick={canEdit ? () => startEdit(e.owner, e.evIndex) : undefined}
                    onDoubleClick={() => paintTool === "bucket" && setStyleKey({ blockColor: paintColor })}
                    style={{
                      background: c.bg,
                      borderLeft: `3px solid ${warns.length ? "#dc2626" : c.border}`,
                      opacity: e.fixed ? 0.85 : 1,
                      animationDelay: `${i * 90}ms`,
                    }}
                  >
                    <strong style={{ color: style.textColor || "#151515" }}>{e.title}</strong>
                    <span style={{ color: style.textColor || "#151515" }}>{e.start} – {e.end}</span>
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

      {cinematic && (
        <div className="cinematic no-print" role="status" aria-live="polite">
          <div className="star-field">✦ · ✧ · ✦ · ⋆ · ✧ · ✦ · ⋆ · ✧ · ✦</div><div className="cinematic-orbit"><div className="cinematic-core">RUVY</div></div>
          <div className="cinematic-track"><span /></div>
          <div className="cinematic-copy">
            <p className="cine-line line-1">🔍 Analyse de ta semaine…</p>
            <p className="cine-line line-2">📅 Placement des séances…</p>
            <p className="cine-line line-3">✨ Ajout des touches finales…</p>
            <p className="cine-line line-4">✅ C'est prêt !</p>
          </div>
        </div>
      )}

      <header className={step === 4 ? "top no-print editor-hidden" : "top no-print"}>
        <h1>Mon planning</h1>
        <p>Construis une semaine d'entraînement adaptée à ton niveau.</p>
      </header>

      <div className={step === 4 ? "progress no-print editor-hidden" : "progress no-print"}>
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
          <p className="hint">Chaque activité peut avoir ses propres réglages : nombre de séances et moments.</p>

          <div className="row time-range-fields">
            <label className="field">Première séance à
              <select className="input" value={person.firstSessionHour} onChange={(e) => update({ firstSessionHour: Number(e.target.value) })}>
                {Array.from({ length: 19 }, (_, i) => i + 5).map((h) => <option key={h} value={h}>{h}h</option>)}
              </select>
            </label>
            <label className="field">Dernière séance finit à
              <select className="input" value={person.lastSessionHour} onChange={(e) => update({ lastSessionHour: Number(e.target.value) })}>
                {Array.from({ length: 19 }, (_, i) => i + 5).map((h) => <option key={h} value={h}>{h}h</option>)}
              </select>
            </label>
            {Number(person.lastSessionHour) <= Number(person.firstSessionHour) && <span className="range-warning">La dernière heure doit être après la première.</span>}
          </div>

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

      {/* ---------- ÉTAPE 5 : PERSONNALISATION + RÉSULTAT ---------- */}
      {step === 4 && result && (
        <>
          <div className="editor-workspace">
          <div className="editor-layout no-print">
            <aside className="editor-sidebar">
              <div className="editor-brand"><span>✦</span><div><strong>Atelier</strong><small>Ton planning, ta signature</small></div></div>
              <div className="editor-tabs">
                <button className={editorTab === "colors" ? "editor-tab active" : "editor-tab"} onClick={() => selectEditorTab("colors")}>🎨 <span>Personnalisation</span></button>
                <button className={editorTab === "paint" ? "editor-tab active" : "editor-tab"} onClick={() => selectEditorTab("paint")}>🖌️ <span>Fond</span></button>
                <button className={editorTab === "stickers" ? "editor-tab active" : "editor-tab"} onClick={() => selectEditorTab("stickers")}>✨ <span>Stickers</span></button>
                <button className={editorTab === "edit" ? "editor-tab active" : "editor-tab"} onClick={() => selectEditorTab("edit")}>✏️ <span>Modification</span></button>
              </div>
            </aside>
            <section className="editor-panel">
              <div className="editor-panel-head"><div><span className="eyebrow">PERSONNALISATION</span><h2>{editorTab === "colors" ? "Donne-lui ta couleur" : editorTab === "stickers" ? "Ajoute ton énergie" : "Ajuste tes séances"}</h2></div><span className="editor-status">● Sauvegardé</span></div>
              {editorTab === "colors" && <div className="control-grid">
                <label className="label">Titre du planning<input className="input full" value={style.title} onChange={(e) => setStyleKey({ title: e.target.value })} /></label>
                <div className="color-grid"><label className="field">Fond<input type="color" className="color" value={style.bgColor} onChange={(e) => setStyleKey({ bgColor: e.target.value })} /></label><label className="field">Accent<input type="color" className="color" value={style.accent} onChange={(e) => setStyleKey({ accent: e.target.value })} /></label><label className="field">Texte<input type="color" className="color" value={style.textColor || "#151515"} onChange={(e) => setStyleKey({ textColor: e.target.value })} /></label></div>
                <div><label className="label">Thèmes prêts à l'emploi</label><div className="theme-row"><button className="theme theme-aurora" onClick={() => applyTheme({ bgColor: "#101026", accent: "#a78bfa", textColor: "#f5f3ff" })}>Aurora</button><button className="theme theme-sunset" onClick={() => applyTheme({ bgColor: "#fff7ed", accent: "#ea580c", textColor: "#431407" })}>Sunset</button><button className="theme theme-forest" onClick={() => applyTheme({ bgColor: "#f2f8f4", accent: "#14532d", textColor: "#163324" })}>Forêt</button></div></div>
                <label className="label">Arrière-plan <input type="file" accept="image/*" onChange={onBgImage} /></label>{style.bgImage && <><button className="link" onClick={() => setStyleKey({ bgImage: "" })}>Retirer l'image</button><label className="field slider">Transparence : {Math.round(style.bgOpacity * 100)} %<input type="range" min="0" max="1" step="0.05" value={style.bgOpacity} onChange={(e) => setStyleKey({ bgOpacity: Number(e.target.value) })} /></label></>}
              </div>}
              {editorTab === "paint" && <div className="control-grid"><p className="hint">Dessine directement sur le planning. Le pot colore la zone ciblée, la pipette reprend une couleur, et les personnalisations restent en mémoire uniquement pendant cette session.</p><div className="paint-tools"><button className={paintTool === "move" ? "paint-tool active" : "paint-tool"} onClick={() => selectPaintTool("move")}>↖<small>Clic normal</small></button>{[["pen","✎","Stylo"],["bucket","▧","Pot"],["eraser","⌫","Gomme"],["picker","⌾","Pipette"],["marker","▰","Surligneur"]].map(([id,icon,label]) => <button key={id} className={paintTool===id ? "paint-tool active" : "paint-tool"} onClick={() => selectPaintTool(id)}>{icon}<small>{label}</small></button>)}</div><label className="label">Épaisseur : {paintSize}px<input type="range" min="2" max="32" value={paintSize} onChange={(e) => setPaintSize(Number(e.target.value))} /></label><label className="label">Couleur<input type="color" className="color" value={paintColor} onChange={(e) => setPaintColor(e.target.value)} /></label><div className="paint-actions"><button className="theme" onClick={undoPaint}>↶ Annuler</button><button className="theme" onClick={redoPaint}>↷ Rétablir</button></div><label className="label">Fond du planning<select className="input" value={paintBackground} onChange={(e) => { setPaintBackground(e.target.value); setStyleKey({ bgColor: e.target.value }); }}><option value="#18132c">Violet profond</option><option value="#25143d">Prune</option><option value="#172554">Bleu nuit</option><option value="#1f2937">Ardoise</option></select></label></div>}
              {editorTab === "stickers" && <div className="control-grid"><p className="hint">Choisis un signe distinctif, puis ajoute des images par jour comme arrière-plan ou logo.</p><div className="sticker-palette">{["🔥","⚡","🏋️","🥊","🏃","🧘","🚴","🏆","💪","🌙"].map((x) => <button key={x} className="sticker-btn" onClick={() => addSticker(x)}>{x}</button>)}</div><label className="label">Images / logos par jour</label><div className="day-images">{DAYS.map((d) => <div key={d} className="day-image-row"><span>{SHORT[d]}</span><input type="file" accept="image/*" onChange={(e) => onDayImage(d, e)} />{style.dayImages[d] && <img src={style.dayImages[d]} alt={`Miniature ${SHORT[d]}`} />}{style.dayImages[d] && <button className="link" onClick={() => removeDayImage(d)}>Retirer</button>}</div>)}</div>{Object.keys(style.dayImages).length > 0 && <label className="field slider">Transparence : {Math.round(style.dayImageOpacity * 100)} %<input type="range" min="0" max="1" step="0.05" value={style.dayImageOpacity} onChange={(e) => setStyleKey({ dayImageOpacity: Number(e.target.value) })} /></label>}<div className="sticker-list">{(style.stickers || []).map((s, i) => <button key={i} className="sticker-chip" onClick={() => removeSticker(i)}>{s.emoji} <small>retirer</small></button>)}</div></div>}
              {editorTab === "edit" && <div className="control-grid"><p className="hint">Clique sur une séance ajoutée dans le planning pour modifier son jour, ses horaires ou la supprimer.</p>{renderEditor()}<p className="warn-text editor-warning">⚠ Les séances ajoutées peuvent être décalées de 30 minutes maximum. Les avertissements restent sans blocage.</p></div>}
            </section>
          </div>

          {/* Planning (zone exportée) */}
          <section className="card plan-card">
            <div
              ref={exportRef}
              className="export-zone"
              style={{ "--atelier-event-bg": style.blockColor || "transparent", background: style.bgColor, color: style.textColor || "#151515", borderColor: style.accent, position: "relative", overflow: "hidden" }}
            >
              <canvas ref={paintCanvasRef} className="paint-canvas" style={{ pointerEvents: ["pen", "marker", "eraser", "bucket", "picker"].includes(paintTool) ? "auto" : "none" }} onPointerDown={(e) => { e.preventDefault(); handlePaintPointer(e); }} onMouseDown={(e) => e.preventDefault()} onPointerMove={(e) => { e.preventDefault(); paintDrawingRef.current && paintPoint(e); }} onPointerUp={endPaint} onPointerCancel={endPaint} aria-label="Dessin par-dessus le planning" />
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

              {(style.stickers || []).map((sticker, i) => <span key={i} className={`floating-sticker ${selectedSticker === i ? "selected" : ""}`} onPointerDown={(e) => startStickerDrag(e, i)} onPointerMove={moveSticker} onPointerUp={endStickerDrag} onPointerCancel={endStickerDrag} onClick={(e) => { e.stopPropagation(); setSelectedSticker(i); }} style={{ left: sticker.x + "%", top: sticker.y + "%", fontSize: (sticker.size || 28) + "px", transform: `rotate(${sticker.rotation || 0}deg)` }}>{sticker.emoji}{selectedSticker === i && <button className="sticker-delete" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); removeSticker(i); setSelectedSticker(null); }}>×</button>}<span className="sticker-resize" onPointerDown={(e) => startStickerDrag(e, i, true)} /></span>)}
              <div style={{ position: "relative", padding: 20, color: style.textColor || "#151515" }}>
                <h2 style={{ color: style.accent, marginTop: 0 }}>
                  {style.title || (couple ? "Votre planning" : `Planning de ${result.plans[0].name}`)}
                </h2>

                <p className="badge-ia no-print">
                  {result.ai
                    ? "✨ Planning optimisé par l'IA"
                    : "Planning calculé par l'algorithme"}
                </p>
                {result.warnings?.length > 0 && <div className="planning-warnings no-print" role="alert">{result.warnings.map((warning, i) => <p key={i}>{warning}</p>)}</div>}

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

                {renderWeek(!exporting)}
                {renderPrintGrid()}

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
              <button className="btn ghost" onClick={() => setStep(0)}>← Modifier mes infos</button>
              <button className="btn ghost" onClick={() => setPrintPreview(true)}>Aperçu</button>
              <button className="btn ghost" onClick={() => window.print()}>🖨️ Imprimer / Télécharger</button>
              <button className="btn ghost" disabled={exporting} onClick={exportPNG}>
                {exporting ? "Export..." : "Export PNG"}
              </button>
              <button className="btn" disabled={exporting} onClick={exportPDF}>
                {exporting ? "Export..." : "Export PDF"}
              </button>
            </div>
          </section>
          </div>
        </>
      )}

      {step < 4 && (
        <footer className="nav no-print">
          <button className="btn ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>
            Retour
          </button>
          <button className="btn" disabled={loading} onClick={next}>
            {step === 2 ? (loading ? "Génération..." : "Générer le planning") : "Suivant"}
          </button>
        </footer>
      )}

      {printPreview && (
        <div className="print-preview-overlay no-print" role="dialog" aria-modal="true" aria-label="Aperçu du planning">
          <div className="print-preview-modal"><button className="btn ghost print-preview-close" onClick={() => setPrintPreview(false)}>Fermer</button>{renderPrintGrid()}</div>
        </div>
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
.rest { font-size: 12px; color: rgba(255,255,255,.82); background: rgba(167,139,250,.16); border: 1px solid rgba(167,139,250,.32); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border-radius: 8px; padding: 8px; }
.day-images { display:flex; flex-direction:column; gap:8px; margin-top:4px; }.day-image-row { display:grid; grid-template-columns:72px minmax(0,1fr) auto; align-items:center; gap:10px; }.day-image-row > span { font-weight:600; color:#dcd6f2; }.day-image-row input[type=file] { min-width:0; width:100%; }.day-image-row::after { content:""; }.day-image-row img { width:34px; height:34px; object-fit:cover; border-radius:7px; border:1px solid #66538d; }
.time-range-fields { align-items: flex-end; margin: 12px 0 18px; }.range-warning { color: #dc2626; font-size: 12px; padding-bottom: 11px; }
.print-grid-wrap { display:none; }.print-title { color: var(--print-accent, #7c3aed); margin: 0 0 10px; }.print-grid { width:100%; border-collapse:collapse; table-layout:fixed; font-size:10px; }.print-grid th,.print-grid td { border:1px solid color-mix(in srgb, var(--print-accent, #7c3aed) 35%, transparent); padding:4px; vertical-align:top; }.print-grid thead th { background: color-mix(in srgb, var(--print-accent, #7c3aed) 18%, transparent); }.print-grid tbody th { width:42px; text-align:center; }.print-event { background: color-mix(in srgb, var(--print-accent, #7c3aed) 16%, transparent); border-left:2px solid var(--print-accent, #7c3aed); padding:3px; margin:1px 0; display:flex; flex-direction:column; }.print-event span,.print-event small { font-size:9px; }.print-rest { color:#777; font-style:italic; }.print-preview-overlay { position:fixed; inset:0; z-index:100; display:grid; place-items:center; padding:24px; background:rgba(9,8,18,.72); }.print-preview-modal { position:relative; width:min(1100px,96vw); max-height:92vh; overflow:auto; padding:28px; border-radius:18px; background:#fff; color:#151515; box-shadow:0 25px 80px rgba(0,0,0,.4); }.print-preview-modal .print-grid-wrap { display:block; }.print-preview-close { position:absolute; top:12px; right:12px; z-index:1; }
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
.editor-sidebar { display: flex; flex-direction: column; }.editor-brand { display:flex; gap:10px; align-items:center; margin-bottom: 28px; }.editor-brand > span { display:grid; place-items:center; width:34px; height:34px; border-radius:11px; background:linear-gradient(135deg,#c084fc,#7c3aed); box-shadow:0 0 20px #7c3aed; }.editor-brand strong,.editor-brand small { display:block; }.editor-brand small { color:#aaa3c9; font-size:10px; margin-top:3px; }.editor-tabs { display:flex; flex-direction:column; gap:6px; }.editor-tab { border:0; background:transparent; color:#aaa3c9; text-align:left; padding:12px 10px; border-radius:12px; font:inherit; cursor:pointer; display:flex; gap:10px; align-items:center; }.editor-tab.active { color:#fff; background:rgba(167,139,250,.18); box-shadow:inset 3px 0 #c084fc; }.editor-panel { min-width:0; background:rgba(255,255,255,.055); border:1px solid rgba(255,255,255,.1); border-radius:18px; padding:22px; }.editor-panel-head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:20px; }.editor-panel h2 { color:#fff; margin:5px 0 0; }.eyebrow { color:#c084fc; font-size:10px; font-weight:700; letter-spacing:.16em; }.editor-status { color:#86efac; font-size:11px; }.control-grid { display:grid; gap:16px; }.editor-panel .label { color:#dcd6f2; }.editor-panel .input,.editor-panel .color { background:rgba(8,6,20,.45); border-color:#493c6b; color:#fff; }.editor-panel .hint { color:#b9b1d0; }.color-grid { display:flex; gap:24px; }.theme-row { display:flex; gap:8px; flex-wrap:wrap; }.theme { border:1px solid #5b4a83; color:#fff; border-radius:10px; padding:10px 14px; cursor:pointer; background:#26203d; }.theme-aurora { background:linear-gradient(135deg,#16122e,#6d28d9); }.theme-sunset { background:linear-gradient(135deg,#7c2d12,#fb923c); }.theme-forest { background:linear-gradient(135deg,#14532d,#65a30d); }.sticker-palette { display:flex; flex-wrap:wrap; gap:8px; }.sticker-btn { border:1px solid #58477c; background:#211a3a; border-radius:12px; font-size:24px; width:46px; height:46px; cursor:pointer; transition:transform .15s; }.sticker-btn:hover { transform:translateY(-3px) rotate(-4deg); }.sticker-list { display:flex; gap:8px; flex-wrap:wrap; }.sticker-chip { border:1px solid #66538d; background:#2a2147; color:#fff; border-radius:99px; padding:6px 10px; cursor:pointer; }.sticker-chip small { color:#b8add4; }.planning-warnings { margin: 0 0 14px; padding: 8px 12px; border-left: 3px solid #dc2626; background: #fff1f2; color: #b91c1c; font-size: 12px; line-height: 1.45; }.planning-warnings p { margin: 0; }.planning-warnings p + p { margin-top: 4px; }
.editor-warning { color:#ff7b87 !important; border-left:2px solid #ef4444; padding-left:10px; }.floating-sticker { position:absolute; z-index:12; pointer-events:auto; cursor:move; user-select:none; font-size:28px; filter:drop-shadow(0 4px 8px rgba(0,0,0,.18)); transform:rotate(-8deg); }.floating-sticker.selected { outline:2px dashed #c084fc; outline-offset:4px; }.sticker-resize { position:absolute; right:-7px; bottom:-7px; width:12px; height:12px; border-radius:3px; background:#c084fc; cursor:nwse-resize; }.sticker-delete { position:absolute; top:-12px; right:-12px; border:0; border-radius:50%; width:20px; height:20px; background:#dc2626; color:white; cursor:pointer; line-height:18px; }.event-reveal { animation: eventReveal .55s cubic-bezier(.2,.8,.2,1) both; }
@keyframes spin { to { transform:rotate(360deg); } } @keyframes orbitPulse { 50% { transform:scale(1.05); box-shadow:0 0 55px #a78bfa, inset 0 0 36px rgba(139,92,246,.7); } } @keyframes coreGlow { to { transform:scale(1.14) rotate(8deg); } } @keyframes fillCine { to { width:100%; } } @keyframes cineText { 0%,18% { opacity:0; transform:translateY(10px); } 24%,44% { opacity:1; transform:translateY(0); } 52%,100% { opacity:0; transform:translateY(-10px); } } @keyframes eventReveal { from { opacity:0; transform:scale(.84) translateY(8px); } to { opacity:1; transform:scale(1) translateY(0); } }
@media (max-width: 680px) { .editor-layout { display:block; padding:12px; }.editor-sidebar { display:block; }.editor-brand { margin:4px 4px 12px; }.editor-tabs { flex-direction:row; gap:4px; }.editor-tab { flex:1; justify-content:center; padding:10px 4px; font-size:12px; }.editor-tab span { display:none; }.editor-panel { margin-top:10px; padding:16px; }.editor-panel-head { margin-bottom:14px; }.color-grid { gap:14px; }.app { padding:26px 12px 54px; } }
/* Mode éditeur : atelier + aperçu côte à côte, sans surface blanche. */
html.editor-active, html.editor-active body { background:#0b0816; color:#f5f3ff; }
.editor-workspace { display:grid; grid-template-columns:190px minmax(280px,1fr) minmax(390px,1.35fr); gap:20px; align-items:start; }
.editor-workspace .editor-layout { display:contents; }
.editor-workspace .editor-sidebar { grid-column:1; position:sticky; top:20px; padding:18px 0; }
.editor-workspace .editor-panel { grid-column:2; position:sticky; top:20px; }
.editor-workspace .plan-card { grid-column:3; position:sticky; top:20px; margin:0; background:#141026; border-color:#30234d; color:#eee9ff; }
.editor-workspace .plan-card .export-zone { background:transparent; }
.editor-workspace .plan-card .day { background:#211a38; border-color:#40335f; }
.editor-workspace .plan-card .day h3, .editor-workspace .plan-card .legend-item { color:#eee9ff; }
.editor-workspace .plan-card .event { background:var(--atelier-event-bg, inherit); color:inherit; }
.editor-workspace .plan-card .event span, .editor-workspace .plan-card .hint, .editor-workspace .plan-card .rest { color:inherit; }
.editor-workspace .plan-card .badge-ia { background:#2d2250; color:#d8b4fe; }
.editor-workspace .plan-card .list li { background:#211a38; border-color:#40335f; color:#f5f3ff; }
.editor-workspace .plan-card .list small { color:#c8bfdf; }
.editor-workspace .row.end .btn, .editor-workspace .plan-card .btn.ghost { background:#211a38; border-color:#6d4db0; color:#eee9ff; }
.editor-workspace input[type=file] { color:#d8cef0; background:#17112c; border:1px solid #493c6b; border-radius:10px; padding:5px; }
.editor-workspace input[type=file]::file-selector-button { border:0; border-radius:8px; padding:8px 12px; margin-right:8px; background:#7c3aed; color:#fff; cursor:pointer; font:inherit; }
@media (max-width: 1050px) { .editor-workspace { grid-template-columns:180px minmax(260px,1fr) minmax(320px,1fr); gap:12px; } }
@media (max-width: 760px) { .editor-workspace { display:block; } .editor-workspace .editor-sidebar, .editor-workspace .editor-panel, .editor-workspace .plan-card { position:static; } .editor-workspace .editor-layout { display:block; } .editor-workspace .plan-card { margin-top:14px; } }

@media print {
  @page { size: A4 landscape; margin: 8mm; }
  .editor-layout, .no-print, .week-frame, .plan-card .export-zone, .plan-card > .editor, .plan-card > .hint { display:none !important; }
  body, .app, .editor-workspace, .editor-workspace .plan-card { background:#fff !important; color:#151515 !important; }
  .app { max-width:none; padding:0; }.editor-workspace { display:block; }.editor-workspace .plan-card { display:block; border:0; box-shadow:none; margin:0; padding:0; }
  .print-grid-wrap { --print-accent: var(--atelier-event-bg, #7c3aed); display:block !important; color:#151515; }.print-grid-wrap .print-title { color: var(--print-accent); }
}

.paint-canvas { position:absolute; inset:0; width:100%; height:100%; z-index:8; touch-action:none; cursor:crosshair; }
.paint-tools { display:grid; grid-template-columns:repeat(3, minmax(70px,1fr)); gap:8px; }
.paint-tool { min-height:58px; border:1px solid #58477c; background:#211a3a; color:#eee9ff; border-radius:12px; cursor:pointer; font-size:20px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px; }
.paint-tool small { font-size:10px; color:#c8bfdf; }
.paint-tool.active { background:#7c3aed; border-color:#c084fc; box-shadow:0 0 0 2px rgba(192,132,252,.22); }
.paint-actions { display:flex; gap:8px; }
.star-field { position:absolute; inset:0; z-index:0; color:#f5d0fe; letter-spacing:clamp(14px,4vw,48px); font-size:clamp(18px,3vw,34px); opacity:.7; animation: twinkle 1.4s ease-in-out infinite alternate; white-space:normal; line-height:4; text-align:center; transform:rotate(-8deg) scale(1.5); text-shadow:0 0 12px #c084fc; pointer-events:none; }
.cinematic-core { font-family:Georgia, 'Times New Roman', serif; font-weight:800; letter-spacing:.14em; font-size:clamp(30px,6vw,58px); }
@keyframes twinkle { from { opacity:.25; transform:rotate(-8deg) scale(1.45); } to { opacity:.9; transform:rotate(-8deg) scale(1.58); } }
@media (max-width: 680px) { .paint-tools { grid-template-columns:repeat(3,1fr); } }


/* Atelier : cadre fixe et interactions de dessin au-dessus du planning. */
.week-frame { position:relative; border:2px solid rgba(167,139,250,.55); border-radius:18px; padding:14px; margin-top:16px; background:rgba(10,7,24,.18); overflow:hidden; }
.week-frame .week { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; margin-top:0; }
.week-frame .day { min-width:0; min-height:145px; cursor:grab; user-select:none; touch-action:none; }
.week-frame .day:active { cursor:grabbing; }
.paint-canvas { user-select:none; -webkit-user-select:none; touch-action:none; }
@media (max-width:680px) { .week-frame .week { grid-template-columns:repeat(2,minmax(0,1fr)); } }
`;