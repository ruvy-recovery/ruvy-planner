// api/plan.js
// Génère le planning : activités prioritaires (fixes) + séances ajoutées selon le niveau.
// Gère le mode solo et le mode couple (créneaux communs).

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

function buildPerson(person) {
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
  const limits = { earliest: toMin(earliest), latest: toMin(latest) };

  // Occupation par jour (activités fixes)
  const busy = {};
  DAYS.forEach((d) => (busy[d] = []));
  const events = [];

  fixed.forEach((a) => {
    if (!DAYS.includes(a.day)) return;
    busy[a.day].push({ start: toMin(a.start), end: toMin(a.end) });
    events.push({
      title: a.title,
      day: a.day,
      start: a.start,
      end: a.end,
      fixed: true,
    });
  });

  // Nombre de séances à ajouter : selon le niveau, plafonné par le maximum choisi
  const target = Math.max(0, Math.min(cfg.sessions, Number(maxSessions) || 0));

  // Jours candidats : les jours préférés, sinon tous
  const candidateDays = (preferredDays.length ? preferredDays : DAYS).filter((d) =>
    DAYS.includes(d)
  );

  // On garde un jour de repos : le dernier jour candidat le moins chargé non utilisé
  const dayLoad = (d) => busy[d].reduce((sum, b) => sum + (b.end - b.start), 0);
  const sortedDays = [...candidateDays].sort((a, b) => dayLoad(a) - dayLoad(b));

  const addedEvents = [];
  const sessionTitles = wants.length ? wants.map((w) => w.title) : ["Séance"];
  let titleIndex = 0;

  for (const day of sortedDays) {
    if (addedEvents.length >= target) break;

    const slot = findSlot(busy[day], cfg.duration, preferredSlots, limits);
    if (!slot) continue;

    busy[day].push({ start: slot.start, end: slot.end });
    const ev = {
      title: sessionTitles[titleIndex % sessionTitles.length],
      day,
      start: toHHMM(slot.start),
      end: toHHMM(slot.end),
      fixed: false,
    };
    titleIndex++;
    addedEvents.push(ev);
    events.push(ev);
  }

  // Jour de repos : un jour sans aucune séance ajoutée ni activité fixe (idéalement le Dimanche)
  const freeDays = DAYS.filter((d) => busy[d].length === 0);
  const restDay = freeDays.includes("Dimanche")
    ? "Dimanche"
    : freeDays[freeDays.length - 1] || null;

  events.sort(
    (a, b) =>
      DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || toMin(a.start) - toMin(b.start)
  );

  return {
    name,
    level,
    events,
    restDay,
    sessionsAdded: addedEvents.length,
    sessionsTarget: target,
    busy,
  };
}

// Créneaux libres communs aux deux personnes (blocs d'au moins 60 min)
function commonSlots(busyA, busyB) {
  const result = [];
  DAYS.forEach((day) => {
    const all = [...busyA[day], ...busyB[day]].sort((x, y) => x.start - y.start);
    let cursor = 7 * 60;
    const dayEnd = 22 * 60;

    for (const b of all) {
      if (b.start - cursor >= 60)
        result.push({ day, start: toHHMM(cursor), end: toHHMM(b.start) });
      cursor = Math.max(cursor, b.end);
    }
    if (dayEnd - cursor >= 60)
      result.push({ day, start: toHHMM(cursor), end: toHHMM(dayEnd) });
  });
  return result;
}

export default function handler(req, res) {
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

    const built = people.slice(0, couple ? 2 : 1).map(buildPerson);

    const response = {
      couple,
      plans: built.map(({ busy, ...rest }) => rest),
    };

    if (couple && built.length === 2) {
      response.commonSlots = commonSlots(built[0].busy, built[1].busy);
    }

    return res.status(200).json(response);
  } catch (err) {
    return res.status(500).json({ error: "Erreur lors de la génération du planning" });
  }
}