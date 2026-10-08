// api/plan.js
// Étape 1 : l'algorithme calcule tous les créneaux libres (aucun conflit possible).
// Étape 2 : Claude choisit quels créneaux utiliser et quelle activité y mettre.
// Si l'IA échoue, l'algorithme de secours prend le relais.

import Anthropic from "@anthropic-ai/sdk";

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

const SLOTS = {
  matin: { start: 6 * 60, end: 11 * 60 },
  midi: { start: 11 * 60, end: 14 * 60 },
  soir: { start: 17 * 60, end: 22 * 60 },
};

const LEVELS = {
  debutant: { sessions: 2, duration: 45 },
  intermediaire: { sessions: 3, duration: 60 },
  avance: { sessions: 4, duration: 75 },
};

const MODEL = "claude-sonnet-4-5";

const toMin = (hhmm) => {
  const [h, m] = String(hhmm).split(":").map(Number);
  return h * 60 + (m || 0);
};

const toHHMM = (min) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
};

const overlaps = (aStart, aEnd, bStart, bEnd, margin = 30) =>
  aStart < bEnd + margin && bStart < aEnd + margin;

/* ---------- Recherche de créneaux ---------- */

function findSlot(dayBusy, duration, preferredSlots, limits) {
  const earliest = limits.earliest ?? 6 * 60;
  const latest = limits.latest ?? 22 * 60;

  for (const slotName of preferredSlots) {
    const slot = SLOTS[slotName];
    if (!slot) continue;
    const from = Math.max(slot.start, earliest);
    const to = Math.min(slot.end, latest);

    for (let start = from; start + duration <= to; start += 15) {
      const end = start + duration;
      const conflict = dayBusy.some((b) => overlaps(start, end, b.start, b.end));
      if (!conflict) return { start, end };
    }
  }
  return null;
}

function findCommonSlot(busyA, busyB, duration, slotsA, slotsB, limitsA, limitsB) {
  const names = slotsA.filter((s) => slotsB.includes(s));
  const earliest = Math.max(limitsA.earliest, limitsB.earliest);
  const latest = Math.min(limitsA.latest, limitsB.latest);

  for (const slotName of names) {
    const slot = SLOTS[slotName];
    if (!slot) continue;
    const from = Math.max(slot.start, earliest);
    const to = Math.min(slot.end, latest);

    for (let start = from; start + duration <= to; start += 15) {
      const end = start + duration;
      const conflict =
        busyA.some((b) => overlaps(start, end, b.start, b.end)) ||
        busyB.some((b) => overlaps(start, end, b.start, b.end));
      if (!conflict) return { start, end };
    }
  }
  return null;
}

/* ---------- Préparation d'une personne ---------- */

function prepare(person) {
  const {
    name = "Moi",
    fixed = [],
    level = "debutant",
    wants = [],
    preferredDays = [],
    preferredSlots = ["soir"],
    maxSessions = 7,
    earliest = "06:00",
    latest = "22:00",
  } = person;

  const cfg = LEVELS[level] || LEVELS.debutant;

  const busy = {};
  DAYS.forEach((d) => (busy[d] = []));
  const events = [];

  fixed.forEach((a) => {
    if (!DAYS.includes(a.day)) return;
    busy[a.day].push({ start: toMin(a.start), end: toMin(a.end) });
    events.push({ title: a.title, day: a.day, start: a.start, end: a.end, fixed: true });
  });

  const target = Math.max(0, Math.min(cfg.sessions, Number(maxSessions) || 0));
  const candidateDays = (preferredDays.length ? preferredDays : DAYS).filter((d) => DAYS.includes(d));
  const slots = preferredSlots.length ? preferredSlots : ["soir"];

  return {
    name,
    level,
    cfg,
    busy,
    events,
    wants: wants.map((w) => w.title).filter(Boolean),
    candidateDays,
    slots,
    limits: { earliest: toMin(earliest), latest: toMin(latest) },
    target,
    added: 0,
    usedDays: new Set(),
  };
}

const dayLoad = (p, d) => p.busy[d].reduce((sum, b) => sum + (b.end - b.start), 0);

function addEvent(p, day, slot, title, extra = {}) {
  p.busy[day].push({ start: slot.start, end: slot.end });
  p.events.push({
    title,
    day,
    start: toHHMM(slot.start),
    end: toHHMM(slot.end),
    fixed: false,
    ...extra,
  });
  p.added += 1;
  p.usedDays.add(day);
}

/* ---------- Algorithme de secours (sans IA) ---------- */

function placeSolo(p) {
  const titles = p.wants.length ? p.wants : ["Séance"];
  let titleIndex = p.added;
  const days = [...p.candidateDays].sort((a, b) => dayLoad(p, a) - dayLoad(p, b));

  for (const day of days) {
    if (p.added >= p.target) break;
    if (p.usedDays.has(day)) continue;

    const slot = findSlot(p.busy[day], p.cfg.duration, p.slots, p.limits);
    if (!slot) continue;

    addEvent(p, day, slot, titles[titleIndex % titles.length]);
    titleIndex++;
  }
}

function placeTogether(a, b) {
  const duration = Math.max(a.cfg.duration, b.cfg.duration);
  const wantsB = new Map(b.wants.map((t) => [t.toLowerCase(), t]));
  const shared = a.wants.filter((t) => wantsB.has(t.toLowerCase()));

  const commonDays = a.candidateDays.filter((d) => b.candidateDays.includes(d));
  const days = [...commonDays].sort(
    (x, y) => dayLoad(a, x) + dayLoad(b, x) - (dayLoad(a, y) + dayLoad(b, y))
  );

  const goal = Math.min(
    Math.max(1, Math.floor(Math.min(a.target, b.target) / 2)),
    a.target - a.added,
    b.target - b.added
  );

  let titleIndex = 0;
  let placed = 0;

  for (const day of days) {
    if (placed >= goal) break;
    if (a.usedDays.has(day) || b.usedDays.has(day)) continue;

    const slot = findCommonSlot(
      a.busy[day],
      b.busy[day],
      duration,
      a.slots,
      b.slots,
      a.limits,
      b.limits
    );
    if (!slot) continue;

    const title = shared.length ? shared[titleIndex % shared.length] : "Séance ensemble";
    addEvent(a, day, slot, title, { together: true });
    addEvent(b, day, slot, title, { together: true });
    titleIndex++;
    placed++;
  }
}

/* ---------- Choix par l'IA ---------- */

// Liste tous les créneaux possibles pour une personne (un par jour et par moment de la journée)
function candidateSlots(p) {
  const list = [];
  for (const day of p.candidateDays) {
    for (const slotName of p.slots) {
      const slot = findSlot(p.busy[day], p.cfg.duration, [slotName], p.limits);
      if (slot) {
        list.push({
          id: list.length,
          day,
          moment: slotName,
          start: toHHMM(slot.start),
          end: toHHMM(slot.end),
        });
      }
    }
  }
  return list;
}

async function aiChoose(people) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const payload = people.map((p) => ({
    nom: p.name,
    niveau: p.level,
    seances_a_placer: p.target,
    activites_voulues: p.wants.length ? p.wants : ["Séance"],
    activites_fixes_deja_en_place: p.events
      .filter((e) => e.fixed)
      .map((e) => `${e.day} ${e.start}-${e.end} ${e.title}`),
    creneaux_libres: candidateSlots(p),
  }));

  const prompt = `Tu es un coach sportif. Voici les données de ${people.length} personne(s).
Pour chaque personne, choisis exactement "seances_a_placer" créneaux parmi "creneaux_libres" (utilise leur "id") et attribue une activité à chacun.

Règles :
- Maximum 1 séance par jour et par personne.
- Répartis les séances sur la semaine (évite les jours consécutifs si possible).
- Alterne les types d'activités (ne mets pas deux séances identiques d'affilée).
- Évite une séance intense la veille d'une activité fixe lourde.
- Utilise uniquement les activités de "activites_voulues".
- Ajoute une courte note utile (10 mots maximum) pour chaque séance.

Réponds UNIQUEMENT avec du JSON valide, sans texte autour, dans ce format :
{"plans":[{"nom":"...","seances":[{"id":0,"activite":"...","note":"..."}]}]}

Données :
${JSON.stringify(payload)}`;

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    messages: [{ role: "user", content: prompt }],
  });

  const text = msg.content.map((c) => c.text || "").join("");
  const jsonText = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  return JSON.parse(jsonText);
}

// Applique le choix de l'IA après avoir vérifié chaque séance
function applyAi(people, ai) {
  people.forEach((p, i) => {
    const plan = ai.plans?.[i];
    if (!plan || !Array.isArray(plan.seances)) return;

    const slots = candidateSlots(p);

    for (const s of plan.seances) {
      if (p.added >= p.target) break;
      const slot = slots.find((x) => x.id === s.id);
      if (!slot) continue;
      if (p.usedDays.has(slot.day)) continue;

      const start = toMin(slot.start);
      const end = toMin(slot.end);
      const conflict = p.busy[slot.day].some((b) => overlaps(start, end, b.start, b.end));
      if (conflict) continue;

      addEvent(p, slot.day, { start, end }, s.activite || "Séance", {
        note: String(s.note || "").slice(0, 100),
      });
    }
  });
}

/* ---------- Sortie ---------- */

function finish(p) {
  p.events.sort(
    (x, y) => DAYS.indexOf(x.day) - DAYS.indexOf(y.day) || toMin(x.start) - toMin(y.start)
  );

  const freeDays = DAYS.filter((d) => !p.events.some((e) => e.day === d));
  const restDay = freeDays.includes("Dimanche") ? "Dimanche" : freeDays[freeDays.length - 1] || null;

  return {
    name: p.name,
    level: p.level,
    events: p.events,
    restDay,
    sessionsAdded: p.added,
    sessionsTarget: p.target,
  };
}

function commonSlots(busyA, busyB) {
  const result = [];
  DAYS.forEach((day) => {
    const all = [...busyA[day], ...busyB[day]].sort((x, y) => x.start - y.start);
    let cursor = 7 * 60;
    const dayEnd = 22 * 60;

    for (const b of all) {
      if (b.start - cursor >= 60) result.push({ day, start: toHHMM(cursor), end: toHHMM(b.start) });
      cursor = Math.max(cursor, b.end);
    }
    if (dayEnd - cursor >= 60) result.push({ day, start: toHHMM(cursor), end: toHHMM(dayEnd) });
  });
  return result;
}

/* ---------- Handler ---------- */

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  try {
    const body = req.body || {};
    const couple = Boolean(body.couple);
    const people = Array.isArray(body.people) ? body.people : [];

    if (people.length === 0) {
      return res.status(400).json({ error: "Aucune personne fournie" });
    }

    const prepared = people.slice(0, couple ? 2 : 1).map(prepare);

    // 1. Séances communes d'abord (couple uniquement)
    if (couple && prepared.length === 2) {
      placeTogether(prepared[0], prepared[1]);
    }

    // 2. Le reste : IA d'abord, algorithme de secours ensuite
    let usedAi = false;
    try {
      if (!process.env.ANTHROPIC_API_KEY) throw new Error("Clé ANTHROPIC_API_KEY absente");
      const ai = await aiChoose(prepared);
      applyAi(prepared, ai);
      usedAi = true;
    } catch (e) {
      console.error("IA indisponible, algorithme de secours :", e.message);
    }

    // Complète avec l'algorithme classique si l'IA n'a pas tout placé
    prepared.forEach(placeSolo);

    const response = {
      couple,
      ai: usedAi,
      plans: prepared.map(finish),
    };

    if (couple && prepared.length === 2) {
      response.commonSlots = commonSlots(prepared[0].busy, prepared[1].busy);
    }

    return res.status(200).json(response);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erreur lors de la génération du planning" });
  }
}