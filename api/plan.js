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

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514";

const toMin = (hhmm) => {
  const [h, m] = String(hhmm || "0:0").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
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
  if (names.length === 0) return null;

  const earliest = Math.max(limitsA.earliest || 6 * 60, limitsB.earliest || 6 * 60);
  const latest = Math.min(limitsA.latest || 22 * 60, limitsB.latest || 22 * 60);

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

  // Ajoute les activités fixes
  fixed.forEach((a) => {
    if (!DAYS.includes(a.day)) return;
    const s = toMin(a.start);
    const e = toMin(a.end);
    busy[a.day].push({ start: s, end: e });
    events.push({ 
      title: a.title, 
      day: a.day, 
      start: a.start, 
      end: a.end, 
      fixed: true 
    });
  });

  // Chaque activité doit être placée exactement N fois (sessions)
  const activities = wants
    .filter((w) => w && w.title && w.sessions > 0)
    .map((w, idx) => ({
      id: idx,
      title: w.title,
      sessions: Math.max(1, w.sessions || 1),
      slots: w.slots && w.slots.length > 0 ? w.slots : preferredSlots,
      days: w.days && w.days.length > 0 ? w.days : preferredDays.length > 0 ? preferredDays : DAYS,
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
    preferredDays: preferredDays.length > 0 ? preferredDays : DAYS,
    preferredSlots: preferredSlots.length > 0 ? preferredSlots : ["soir"],
    limits: { 
      earliest: toMin(earliest), 
      latest: toMin(latest) 
    },
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
  const validDays = activity.days.filter((d) => DAYS.includes(d));
  
  for (const day of validDays) {
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
          title: activity.title,
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

  const prompt = `Tu es un coach sportif expert en planification. Voici les données de ${people.length} personne(s).
Pour chaque personne, tu dois placer des séances d'entraînement selon les contraintes de chaque activité.

**Règles STRICTES :**
1. Pour chaque activité, place EXACTEMENT "seances_a_placer" séances (ni plus, ni moins).
2. Utilise UNIQUEMENT les créneaux de "creneaux_libres" (identifie-les par leur "id").
3. Chaque créneau ne peut être utilisé qu'une seule fois dans la semaine.
4. Maximum 1 séance par jour et par personne (pas de chevauchement).
5. Répartis les séances sur la semaine (évite les jours consécutifs si possible).
6. Alterne les activités pour ne pas mettre deux séances identiques d'affilée.

**Format de réponse STRICT :**
Réponds UNIQUEMENT avec du JSON valide, sans aucun texte avant ou après :
{"plans":[{"nom":"...","seances":[{"id":0}]}]}

Où "id" est l'identifiant du créneau dans "creneaux_libres".

Données :
${JSON.stringify(payload)}`;

  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
    });

    const text = msg.content.map((c) => c.text || "").join("");
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");
    
    if (jsonStart === -1 || jsonEnd === -1) {
      throw new Error("Pas de JSON trouvé dans la réponse IA");
    }
    
    const jsonText = text.slice(jsonStart, jsonEnd + 1);
    return JSON.parse(jsonText);
  } catch (e) {
    console.error("Erreur lors du parsing IA :", e.message);
    throw e;
  }
}

/* ---------- Validation et application du choix IA ---------- */

function applyAi(people, ai) {
  if (!ai || !Array.isArray(ai.plans)) return;

  people.forEach((p, i) => {
    const plan = ai.plans[i];
    if (!plan || !Array.isArray(plan.seances)) return;

    const allSlots = p.activities.flatMap((a) => possibleSlotsForActivity(p, a));
    const usedSlotIds = new Set();

    for (const s of plan.seances) {
      if (usedSlotIds.has(s.id)) continue;
      
      const slot = allSlots.find((x) => x.id === s.id);
      if (!slot) continue;
      
      // Vérifie qu'on ne place pas 2 séances le même jour
      if (p.usedDays.has(slot.day)) continue;

      const activity = p.activities[slot.activityId];
      if (!activity || activity.placed >= activity.sessions) continue;

      const start = toMin(slot.start);
      const end = toMin(slot.end);
      
      // Double-vérification : pas de conflit
      const conflict = p.busy[slot.day].some((b) => overlaps(start, end, b.start, b.end));
      if (conflict) continue;

      addEvent(p, slot.day, { start, end }, activity);
      usedSlotIds.add(s.id);
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
    const validDays = activity.days.filter((d) => DAYS.includes(d));
    for (const day of validDays) {
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

  // Trie par charge du jour (jours légers en priorité) et par jour de la semaine
  allSlots.sort((a, b) => {
    const loadDiff = a.load - b.load;
    if (loadDiff !== 0) return loadDiff;
    return DAYS.indexOf(a.day) - DAYS.indexOf(b.day);
  });

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
    (x, y) => 
      DAYS.indexOf(x.day) - DAYS.indexOf(y.day) || 
      toMin(x.start) - toMin(y.start)
  );

  const freeDays = DAYS.filter((d) => !p.events.some((e) => e.day === d));
  const restDay = freeDays.includes("Dimanche") 
    ? "Dimanche" 
    : freeDays[freeDays.length - 1] || null;

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
  const dayStart = 7 * 60; // 7:00
  const dayEnd = 22 * 60; // 22:00

  DAYS.forEach((day) => {
    const all = [...busyA[day], ...busyB[day]].sort((x, y) => x.start - y.start);
    let cursor = dayStart;

    for (const b of all) {
      if (b.start - cursor >= 60) {
        result.push({ 
          day, 
          start: toHHMM(cursor), 
          end: toHHMM(b.start) 
        });
      }
      cursor = Math.max(cursor, b.end);
    }
    
    if (dayEnd - cursor >= 60) {
      result.push({ 
        day, 
        start: toHHMM(cursor), 
        end: toHHMM(dayEnd) 
      });
    }
  });
  
  return result;
}

/* ---------- Gestion des séances communes (couple) ---------- */

function placeTogether(a, b) {
  const duration = Math.max(a.cfg.duration, b.cfg.duration);

  // Cherche les activités partagées (même titre)
  const wantsB = new Map(b.activities.map((act) => [act.title.toLowerCase(), act]));
  const shared = a.activities.filter((act) => wantsB.has(act.title.toLowerCase()));

  if (shared.length === 0) return; // Aucune activité en commun

  const commonDays = a.preferredDays.filter((d) => b.preferredDays.includes(d));
  if (commonDays.length === 0) return;

  // Trie les jours par charge cumulée (jours moins chargés d'abord)
  const days = [...commonDays].sort(
    (x, y) => dayLoad(a, x) + dayLoad(b, x) - (dayLoad(a, y) + dayLoad(b, y))
  );

  // But : placer au moins 1 séance en commun si possible, max 2
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

    // Choisit une activité partagée qui n'a pas atteint son quota
    const activity = shared.find((act) => act.placed < act.sessions);
    if (!activity) continue;

    const actB = wantsB.get(activity.title.toLowerCase());
    if (!actB || actB.placed >= actB.sessions) continue;

    addEvent(a, day, slot, activity, { together: true });
    addEvent(b, day, slot, actB, { together: true });
    placed++;
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

    // Prépare les données des personnes
    const prepared = people.slice(0, couple ? 2 : 1).map(prepare);

    // Étape 1 : Séances communes d'abord (couple uniquement)
    if (couple && prepared.length === 2) {
      placeTogether(prepared[0], prepared[1]);
    }

    // Étape 2 : IA d'abord, puis algorithme fallback
    let usedAi = false;
    try {
      if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error("Clé ANTHROPIC_API_KEY absente");
      }

      const before = prepared.reduce((n, p) => n + p.added, 0);
      const ai = await aiChoose(prepared);
      applyAi(prepared, ai);
      const after = prepared.reduce((n, p) => n + p.added, 0);

      usedAi = after > before;
      console.log(`✅ IA : ${after - before} séance(s) placée(s) (modèle ${MODEL})`);
    } catch (e) {
      console.error(`⚠️  IA indisponible : ${e.message}`);
      console.log("   Passage à l'algorithme de secours...");
    }

    // Étape 3 : Complète avec fallback si nécessaire
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
    console.error("❌ Erreur critique :", err.message || err);
    return res.status(500).json({ error: "Erreur lors de la génération du planning" });
  }
}