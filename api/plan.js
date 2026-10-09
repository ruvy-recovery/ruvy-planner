// api/plan.js
// Étape 1 : calcule tous les créneaux libres (aucun conflit).
// Étape 2 : Claude choisit quels créneaux utiliser pour chaque activité.
// Étape 3 : Si l'IA échoue, l'algorithme de secours (backtracking) prend le relais.

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

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";

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

  // Chaque activité doit être placée exactement N fois (sessions)
  const activities = wants.map((w, idx) => ({
    id: idx,
    title: w.title,
    sessions: w.sessions || 1,
    slots: w.slots && w.slots.length ? w.slots : preferredSlots,
    days: w.days && w.days.length ? w.days : preferredDays.length ? preferredDays : DAYS,
    placed: 0,
  }));

  const globalTarget = activities.reduce((sum, a) => sum + a.sessions, 0);

  return {
    name,
    level,
    cfg,
    busy,
    events,
    activities,
    preferredDays: preferredDays.length ? preferredDays : DAYS,
    preferredSlots: preferredSlots.length ? preferredSlots : ["soir"],
    limits: { earliest: toMin(earliest), latest: toMin(latest) },
    globalTarget,
    added: 0,
    usedDays: new Set(),
  };
}

const dayLoad = (p, d) => p.busy[d].reduce((sum, b) => sum + (b.end - b.start), 0);

function addEvent(p, day, slot, activity, extra = {}) {
  p.busy[day].push({ start: slot.start, end: slot.end });
  p.events.push({
    title: activity.title,
    day,
    start: toHHMM(slot.start),
    end: toHHMM(slot.end),
    fixed: false,
    ...extra,
  });
  p.added += 1;
  p.usedDays.add(day);
  activity.placed += 1;
}

/* ---------- Énumération des créneaux possibles par activité ---------- */

function possibleSlotsForActivity(p, activity) {
  const list = [];
  for (const day of activity.days.filter((d) => DAYS.includes(d))) {
    for (const slotName of activity.slots) {
      const slot = findSlot(p.busy[day], p.cfg.duration, [slotName], p.limits);
      if (slot) {
        list.push({
          id: list.length,
          activityId: activity.id,
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

/* ---------- Choix par l'IA ---------- */

async function aiChoose(people) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const payload = people.map((p) => ({
    nom: p.name,
    niveau: p.level,
    total_seances_a_placer: p.globalTarget,
    activites: p.activities.map((a) => ({
      id: a.id,
      titre: a.title,
      seances_a_placer: a.sessions,
      moments_acceptes: a.slots,
      jours_acceptes: a.days,
    })),
    activites_fixes_deja_en_place: p.events
      .filter((e) => e.fixed)
      .map((e) => `${e.day} ${e.start}-${e.end} ${e.title}`),
    creneaux_libres: p.activities.flatMap((a) => possibleSlotsForActivity(p, a)),
  }));

  const prompt = `Tu es un coach sportif. Voici les données de ${people.length} personne(s).
Pour chaque personne, tu dois placer des séances selon les contraintes de chaque activité.

Règles strictes :
- Pour chaque activité, place exactement "seances_a_placer" séances.
- Utilise UNIQUEMENT les créneaux de "creneaux_libres" (identifie-les par "id").
- Chaque créneau ne peut être utilisé qu'une seule fois.
- Maximum 1 séance par jour et par personne.
- Répartis sur la semaine, évite les jours consécutifs si possible.
- Alterne les activités, ne mets pas deux séances identiques d'affilée.

Réponds UNIQUEMENT avec du JSON valide, sans texte autour, dans ce format :
{"plans":[{"nom":"...","seances":[{"id":0,"activite":"..."}]}]}

Données :
${JSON.stringify(payload)}`;

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 3000,
    messages: [{ role: "user", content: prompt }],
  });

  const text = msg.content.map((c) => c.text || "").join("");
  const jsonText = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  return JSON.parse(jsonText);
}

/* ---------- Validation et application du choix IA ---------- */

function applyAi(people, ai) {
  people.forEach((p, i) => {
    const plan = ai.plans?.[i];
    if (!plan || !Array.isArray(plan.seances)) return;

    const allSlots = p.activities.flatMap((a) => possibleSlotsForActivity(p, a));
    const usedSlots = new Set();

    for (const s of plan.seances) {
      if (usedSlots.has(s.id)) continue; // Créneau déjà utilisé
      const slot = allSlots.find((x) => x.id === s.id);
      if (!slot) continue;
      if (p.usedDays.has(slot.day)) continue;

      const activity = p.activities[slot.activityId];
      if (!activity || activity.placed >= activity.sessions) continue;

      const start = toMin(slot.start);
      const end = toMin(slot.end);
      const conflict = p.busy[slot.day].some((b) => overlaps(start, end, b.start, b.end));
      if (conflict) continue;

      addEvent(p, slot.day, { start, end }, activity);
      usedSlots.add(s.id);
    }
  });
}

/* ---------- Algorithme de secours (backtracking) ---------- */

function placeFallback(p) {
  const activities = p.activities.filter((a) => a.placed < a.sessions);
  if (activities.length === 0) return;

  // Collecte tous les créneaux libres
  const allSlots = [];
  for (const activity of activities) {
    for (const day of activity.days.filter((d) => DAYS.includes(d))) {
      for (const slotName of activity.slots) {
        const slot = findSlot(p.busy[day], p.cfg.duration, [slotName], p.limits);
        if (slot && !p.usedDays.has(day)) {
          allSlots.push({
            activity,
            day,
            slot,
            load: dayLoad(p, day),
          });
        }
      }
    }
  }

  // Trie par charge du jour (jours légers en priorité)
  allSlots.sort((a, b) => a.load - b.load);

  // Remplit greedily
  for (const { activity, day, slot } of allSlots) {
    if (activity.placed >= activity.sessions) continue;
    if (p.usedDays.has(day)) continue;

    const conflict = p.busy[day].some((b) =>
      overlaps(slot.start, slot.end, b.start, b.end)
    );
    if (conflict) continue;

    addEvent(p, day, slot, activity);
  }
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
    sessionsTarget: p.globalTarget,
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

/* ---------- Gestion des séances communes (couple) ---------- */

function placeTogether(a, b) {
  const duration = Math.max(a.cfg.duration, b.cfg.duration);
  
  // Activités partagées
  const wantsB = new Map(b.activities.map((act) => [act.title.toLowerCase(), act]));
  const shared = a.activities.filter((act) => wantsB.has(act.title.toLowerCase()));

  const commonDays = a.preferredDays.filter((d) => b.preferredDays.includes(d));
  const days = [...commonDays].sort(
    (x, y) => dayLoad(a, x) + dayLoad(b, x) - (dayLoad(a, y) + dayLoad(b, y))
  );

  // But : placer au moins 1 séance en commun si possible
  let placed = 0;
  const goal = Math.min(
    shared.reduce((sum, act) => sum + act.sessions, 0),
    2
  );

  for (const day of days) {
    if (placed >= goal) break;
    if (a.usedDays.has(day) || b.usedDays.has(day)) continue;

    const slot = findCommonSlot(
      a.busy[day],
      b.busy[day],
      duration,
      a.preferredSlots,
      b.preferredSlots,
      a.limits,
      b.limits
    );
    if (!slot) continue;

    if (shared.length > 0) {
      const activity = shared[placed % shared.length];
      if (activity.placed < activity.sessions) {
        const actB = wantsB.get(activity.title.toLowerCase());
        if (actB && actB.placed < actB.sessions) {
          addEvent(a, day, slot, activity, { together: true });
          addEvent(b, day, slot, actB, { together: true });
          placed++;
        }
      }
    }
  }
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

      const before = prepared.reduce((n, p) => n + p.added, 0);
      const ai = await aiChoose(prepared);
      applyAi(prepared, ai);
      const after = prepared.reduce((n, p) => n + p.added, 0);

      usedAi = after > before;
      console.log(`IA : ${after - before} séance(s) placée(s) (modèle ${MODEL})`);
    } catch (e) {
      console.error("IA indisponible, algorithme de secours :", e.message);
    }

    // Complète avec l'algorithme fallback si l'IA n'a pas tout placé
    prepared.forEach(placeFallback);

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