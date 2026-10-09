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

const STEPS = ["Profil", "Ta semaine", "Objectifs"];

const STORAGE_KEY = "mon-planning-v1";

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

function classify(title) {
  const t = String(title).toLowerCase();
  for (const c of CATEGORIES) {
    if (c.words.some((w) => t.includes(w))) return c.name;
  }
  return "Autre";
}

function groupFixed(list) {
  const map = new Map();
  list.forEach((a) => {
    const key = `${a.title.toLowerCase()}|${a.start}|${a.end}`;
    if (!map.has(key)) {
      map.set(key, { title: a.title, start: a.start, end: a.end, days: [], indexes: [] });
    }
    const g = map.get(key);
    g.days.push(a.day);
    g.indexes.push(list.indexOf(a));
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
  preferredDays: DAYS,
  preferredSlots: ["soir"],
  earliest: "06:00",
  latest: "22:00",
});

const warningsFor = (a) => {
  const warnings = [];
  const start = parseInt(a.start?.split(":")[0] || 0);
  const end = parseInt(a.end?.split(":")[0] || 0);
  if (start >= end) warnings.push("L'heure de fin doit être après le début");
  if (end - start < 0.5) warnings.push("Minimum 30 min");
  return warnings;
};

const buildDay = (day, events) => {
  const timeToMin = (t) => parseInt(t.split(":")[0]) * 60 + parseInt(t.split(":")[1] || 0);
  const sorted = events
    .filter((e) => e.day === day)
    .sort((a, b) => timeToMin(a.start) - timeToMin(b.start));
  return {
    day,
    events: sorted,
    load: sorted.length,
  };
};

const renderWeek = (events) => {
  return DAYS.map((d) => buildDay(d, events));
};

const renderEditor = (a, idx, onEdit, onDel) => {
  const warn = warningsFor(a);
  return (
    <div key={idx} className="want-card">
      <div className="want-head">
        <div>
          <strong>{a.title}</strong>
          <span className="cat-badge">{classify(a.title)}</span>
        </div>
        <button className="btn-delete" onClick={() => onDel(idx)}>✕</button>
      </div>
      <div className="event-time">
        {a.start} → {a.end}
      </div>
      {warn.length > 0 && <p className="warn-text">⚠️ {warn.join(", ")}</p>}
    </div>
  );
};

export default function App() {
  const [step, setStep] = useState(0);
  const [couple, setCouple] = useState(false);
  const [people, setPeople] = useState([emptyPerson("Moi")]);
  const [draft, setDraft] = useState({ title: "", start: "08:00", end: "09:00", days: [] });
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState(null);
  const [personalizeData, setPersonalizeData] = useState(null);
  const [aiUsed, setAiUsed] = useState(false);
  const exportRef = useRef(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setPeople(data.people || [emptyPerson("Moi")]);
        setCouple(data.couple || false);
        setStep(data.step || 0);
      } catch (e) {
        console.error("Erreur restauration localStorage :", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ people, couple, step }));
  }, [people, couple, step]);

  const nextStep = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
  };
  const prevStep = () => {
    if (step > 0) setStep(step - 1);
  };

  const addPerson = () => {
    if (couple && people.length >= 2) return;
    setPeople([...people, emptyPerson(`Personne ${people.length + 1}`)]);
  };

  const updatePerson = (idx, updates) => {
    const newPeople = [...people];
    newPeople[idx] = { ...newPeople[idx], ...updates };
    setPeople(newPeople);
  };

  const addFixed = (idx) => {
    if (!draft.title.trim() || draft.days.length === 0) return;
    const newPeople = [...people];
    newPeople[idx].fixed.push({ ...draft });
    setPeople(newPeople);
    setDraft({ title: "", start: "08:00", end: "09:00", days: [] });
  };

  const removeFixed = (idx, fixIdx) => {
    const newPeople = [...people];
    newPeople[idx].fixed.splice(fixIdx, 1);
    setPeople(newPeople);
  };

  const addWant = (idx, actTitle, sessions, slots, days) => {
    if (!actTitle.trim()) return;
    const newPeople = [...people];
    newPeople[idx].wants.push({ title: actTitle, sessions: Math.max(1, sessions), slots, days });
    setPeople(newPeople);
  };

  const removeWant = (idx, wantIdx) => {
    const newPeople = [...people];
    newPeople[idx].wants.splice(wantIdx, 1);
    setPeople(newPeople);
  };

  const generatePlan = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ couple, people }),
      });
      const data = await response.json();
      if (response.ok) {
        setPlans(data.plans);
        setAiUsed(data.ai || false);
        setPersonalizeData({
          bgImage: null,
          bgOpacity: 20,
          dayImages: DAYS.reduce((acc, d) => ({ ...acc, [d]: null }), {}),
          dayImagesOpacity: 0,
        });
        setStep(-1); // Page de résultat + personnalisation
      } else {
        alert("Erreur : " + (data.error || "génération échouée"));
      }
    } catch (e) {
      console.error(e);
      alert("Erreur réseau");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format) => {
    if (!exportRef.current) return;
    try {
      const canvas = await html2canvas(exportRef.current, { scale: 2, useCORS: true });
      if (format === "png") {
        const link = document.createElement("a");
        link.href = canvas.toDataURL("image/png");
        link.download = "planning.png";
        link.click();
      } else if (format === "pdf") {
        const pdf = new jsPDF("p", "mm", "a4");
        const imgData = canvas.toDataURL("image/png");
        pdf.addImage(imgData, "PNG", 0, 0, 210, 297);
        pdf.save("planning.pdf");
      }
    } catch (e) {
      console.error(e);
      alert("Erreur export");
    }
  };

  const progress = ((step + 1) / STEPS.length) * 100;

  // === PAGE RÉSULTAT + PERSONNALISATION ===
  if (step === -1 && plans && personalizeData) {
    return (
      <div className="app">
        <style>{css}</style>
        <div className="result-container">
          {/* Colonne gauche : Personnalisation */}
          <div className="personalize-panel">
            <h2>🎨 Personnalisez votre planning</h2>
            <p className="hint">Ajoutez des images pour rendre votre planning plus visuel.</p>

            <section className="personalize-section">
              <h3>Image de fond du planning</h3>
              <label className="file-input-label">
                Choisir un fichier
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        setPersonalizeData({ ...personalizeData, bgImage: ev.target.result });
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
              </label>
              {personalizeData.bgImage && (
                <button
                  className="btn-secondary"
                  onClick={() => setPersonalizeData({ ...personalizeData, bgImage: null })}
                >
                  Retirer
                </button>
              )}
              <div className="slider-container">
                <label>Transparence : {personalizeData.bgOpacity}%</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={personalizeData.bgOpacity}
                  onChange={(e) =>
                    setPersonalizeData({ ...personalizeData, bgOpacity: parseInt(e.target.value) })
                  }
                  className="slider"
                />
              </div>
            </section>

            <section className="personalize-section">
              <h3>Images par jour</h3>
              {DAYS.map((day) => (
                <div key={day} className="day-image-row">
                  <span>{SHORT[day]}</span>
                  <label className="file-input-label">
                    {personalizeData.dayImages[day] ? "Changer" : "Ajouter"}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            setPersonalizeData({
                              ...personalizeData,
                              dayImages: { ...personalizeData.dayImages, [day]: ev.target.result },
                            });
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                  {personalizeData.dayImages[day] && (
                    <button
                      className="btn-icon"
                      onClick={() =>
                        setPersonalizeData({
                          ...personalizeData,
                          dayImages: { ...personalizeData.dayImages, [day]: null },
                        })
                      }
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              <div className="slider-container">
                <label>Opacité des images : {personalizeData.dayImagesOpacity}%</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={personalizeData.dayImagesOpacity}
                  onChange={(e) =>
                    setPersonalizeData({
                      ...personalizeData,
                      dayImagesOpacity: parseInt(e.target.value),
                    })
                  }
                  className="slider"
                />
              </div>
            </section>

            <div className="action-buttons">
              <button className="btn-secondary" onClick={() => setStep(STEPS.length - 1)}>
                ← Retour
              </button>
              <button
                className="btn-primary"
                onClick={() => handleExport("png")}
              >
                📥 PNG
              </button>
              <button
                className="btn-primary"
                onClick={() => handleExport("pdf")}
              >
                📄 PDF
              </button>
              <button
                className="btn-success"
                onClick={() => window.print()}
              >
                🖨️ Imprimer
              </button>
            </div>
          </div>

          {/* Colonne droite : Aperçu */}
          <div className="preview-panel">
            <h2>📋 Votre planning</h2>
            {aiUsed && <p className="badge-ai">✨ Généré avec IA</p>}
            
            <div
              ref={exportRef}
              className="week-export"
              style={{
                backgroundImage: personalizeData.bgImage
                  ? `url(${personalizeData.bgImage})`
                  : "none",
                backgroundSize: "cover",
              }}
            >
              <div
                className="week-overlay"
                style={{
                  backgroundColor: `rgba(255, 255, 255, ${1 - personalizeData.bgOpacity / 100})`,
                }}
              >
                {plans.map((plan, idx) => (
                  <div key={idx} className="person-plan">
                    <h3>{plan.name}</h3>
                    <div className="week">
                      {renderWeek(plan.events).map((day) => (
                        <div key={day.day} className="day-cell">
                          <div className="day-header">{SHORT[day.day]}</div>
                          <div className="day-content">
                            {day.events.map((evt, i) => (
                              <div
                                key={i}
                                className="event"
                                style={{
                                  backgroundColor: COLORS[idx % COLORS.length].bg,
                                  borderLeft: `4px solid ${COLORS[idx % COLORS.length].border}`,
                                }}
                              >
                                <div className="event-title">{evt.title}</div>
                                <div className="event-time-small">
                                  {evt.start}-{evt.end}
                                </div>
                              </div>
                            ))}
                          </div>
                          {personalizeData.dayImages[day.day] && (
                            <div
                              className="day-image-bg"
                              style={{
                                backgroundImage: `url(${personalizeData.dayImages[day.day]})`,
                                opacity: personalizeData.dayImagesOpacity / 100,
                              }}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // === FORMULAIRE PRINCIPAL (STEPS 0-2) ===
  return (
    <div className="app">
      <style>{css}</style>

      {/* Barre de progression */}
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: progress + "%" }}></div>
      </div>
      <div className="progress-labels">
        {STEPS.map((s, i) => (
          <span key={i} className={i === step ? "active" : ""}>
            {s}
          </span>
        ))}
      </div>

      <div className="card">
        {/* === ÉTAPE 0 : PROFIL === */}
        {step === 0 && (
          <section>
            <h2>👤 Qui êtes-vous ?</h2>
            <p className="hint">Commencez par dire si vous êtes seul ou en couple.</p>

            <div className="form-block">
              <label className="label">Mode</label>
              <div className="radio-group">
                <label className="radio">
                  <input
                    type="radio"
                    checked={!couple}
                    onChange={() => {
                      setCouple(false);
                      setPeople([emptyPerson("Moi")]);
                    }}
                  />
                  <span>Je suis seul</span>
                </label>
                <label className="radio">
                  <input
                    type="radio"
                    checked={couple}
                    onChange={() => {
                      setCouple(true);
                      if (people.length < 2) {
                        setPeople([emptyPerson("Moi"), emptyPerson("Mon partenaire")]);
                      }
                    }}
                  />
                  <span>Nous sommes deux</span>
                </label>
              </div>
            </div>

            {people.map((person, idx) => (
              <div key={idx} className="person-card">
                <div className="person-header">
                  <input
                    className="input person-name"
                    placeholder="Votre nom"
                    value={person.name}
                    onChange={(e) => updatePerson(idx, { name: e.target.value })}
                  />
                  {couple && (
                    <button
                      className="btn-delete"
                      onClick={() => setPeople(people.filter((_, i) => i !== idx))}
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="form-block">
                  <label className="label">Niveau sportif</label>
                  <div className="level-grid">
                    {LEVELS.map((lv) => (
                      <label key={lv.id} className="level-card">
                        <input
                          type="radio"
                          checked={person.level === lv.id}
                          onChange={() => updatePerson(idx, { level: lv.id })}
                        />
                        <div className="level-content">
                          <strong>{lv.label}</strong>
                          <small>{lv.desc}</small>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="form-block">
                  <label className="label">Horaires</label>
                  <div className="row spaced">
                    <div>
                      <small>Début</small>
                      <input
                        type="time"
                        value={person.earliest}
                        onChange={(e) => updatePerson(idx, { earliest: e.target.value })}
                        className="input"
                      />
                    </div>
                    <div>
                      <small>Fin</small>
                      <input
                        type="time"
                        value={person.latest}
                        onChange={(e) => updatePerson(idx, { latest: e.target.value })}
                        className="input"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </section>
        )}

        {/* === ÉTAPE 1 : TA SEMAINE === */}
        {step === 1 && (
          <section>
            <h2>📅 Ce que tu fais déjà</h2>
            <p className="hint">Les activités fixes restent prioritaires et ne bougent pas.</p>

            {people.map((person, idx) => (
              <div key={idx} className="person-card">
                <h3 className="person-title">{person.name}</h3>

                <div className="form-block">
                  <label className="label">Ajouter une activité fixe</label>
                  <input
                    className="input full"
                    placeholder="Ex : MMA, Travail, Cours..."
                    value={draft.title}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  />

                  <label className="label top">Quels jours ?</label>
                  <div className="day-check-grid">
                    {DAYS.map((d) => (
                      <label key={d} className="checkbox">
                        <input
                          type="checkbox"
                          checked={draft.days.includes(d)}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              days: e.target.checked
                                ? [...draft.days, d]
                                : draft.days.filter((x) => x !== d),
                            })
                          }
                        />
                        <span>{SHORT[d]}</span>
                      </label>
                    ))}
                  </div>

                  <label className="label top">Horaires</label>
                  <div className="row spaced">
                    <div>
                      <small>Début</small>
                      <input
                        type="time"
                        value={draft.start}
                        onChange={(e) => setDraft({ ...draft, start: e.target.value })}
                        className="input"
                      />
                    </div>
                    <div>
                      <small>Fin</small>
                      <input
                        type="time"
                        value={draft.end}
                        onChange={(e) => setDraft({ ...draft, end: e.target.value })}
                        className="input"
                      />
                    </div>
                  </div>

                  <button className="btn-primary full" onClick={() => addFixed(idx)}>
                    + Ajouter
                  </button>
                </div>

                <div className="wants-list">
                  {person.fixed.length === 0 ? (
                    <p className="want-empty">Aucune activité fixe pour le moment</p>
                  ) : (
                    person.fixed.map((f, fi) =>
                      renderEditor(f, fi, () => {}, () => removeFixed(idx, fi))
                    )
                  )}
                </div>
              </div>
            ))}
          </section>
        )}

        {/* === ÉTAPE 2 : OBJECTIFS === */}
        {step === 2 && (
          <section>
            <h2>🎯 Tes objectifs sportifs</h2>
            <p className="hint">Quels sports veux-tu faire et combien de fois par semaine ?</p>

            {people.map((person, idx) => (
              <div key={idx} className="person-card">
                <h3 className="person-title">{person.name}</h3>

                <div className="form-block">
                  <label className="label">Ajouter un objectif</label>
                  <div className="row spaced">
                    <input
                      className="input"
                      placeholder="Ex : MMA, Yoga, Running..."
                      id={`act-title-${idx}`}
                    />
                    <div>
                      <small>Séances/semaine</small>
                      <input type="number" min="1" max="7" defaultValue="1" id={`act-sessions-${idx}`} className="input" style={{ width: "80px" }} />
                    </div>
                  </div>

                  <label className="label top">Moments préférés</label>
                  <div className="slot-grid">
                    {["matin", "midi", "soir"].map((slot) => (
                      <label key={slot} className="checkbox">
                        <input type="checkbox" defaultChecked={slot === "soir"} id={`act-slot-${slot}-${idx}`} />
                        <span className="capitalize">{slot}</span>
                      </label>
                    ))}
                  </div>

                  <label className="label top">Jours acceptés</label>
                  <div className="day-check-grid">
                    {DAYS.map((d) => (
                      <label key={d} className="checkbox">
                        <input type="checkbox" defaultChecked id={`act-day-${d}-${idx}`} />
                        <span>{SHORT[d]}</span>
                      </label>
                    ))}
                  </div>

                  <button
                    className="btn-primary full"
                    onClick={() => {
                      const title = document.getElementById(`act-title-${idx}`).value;
                      const sessions = parseInt(document.getElementById(`act-sessions-${idx}`).value);
                      const slots = ["matin", "midi", "soir"].filter(
                        (s) => document.getElementById(`act-slot-${s}-${idx}`).checked
                      );
                      const days = DAYS.filter((d) => document.getElementById(`act-day-${d}-${idx}`).checked);
                      addWant(idx, title, sessions, slots, days);
                      document.getElementById(`act-title-${idx}`).value = "";
                    }}
                  >
                    + Ajouter
                  </button>
                </div>

                <div className="wants-list">
                  {person.wants.length === 0 ? (
                    <p className="want-empty">Aucun objectif pour le moment</p>
                  ) : (
                    person.wants.map((w, wi) => (
                      <div key={wi} className="want-card">
                        <div className="want-head">
                          <div>
                            <strong>{w.title}</strong>
                            <span className="sessions-badge">{w.sessions}x/sem</span>
                          </div>
                          <button className="btn-delete" onClick={() => removeWant(idx, wi)}>
                            ✕
                          </button>
                        </div>
                        <small>{w.slots.join(", ")} • {w.days.map(d => SHORT[d]).join(", ")}</small>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </section>
        )}
      </div>

      {/* Boutons navigation */}
      <div className="nav-buttons">
        {step > 0 && (
          <button className="btn-secondary" onClick={prevStep}>
            ← Retour
          </button>
        )}
        {step < STEPS.length - 1 && (
          <button className="btn-primary" onClick={nextStep}>
            Suivant →
          </button>
        )}
        {step === STEPS.length - 1 && (
          <button className="btn-success" onClick={generatePlan} disabled={loading}>
            {loading ? "⏳ Génération..." : "✨ Générer mon planning"}
          </button>
        )}
      </div>
    </div>
  );
}

const css = `
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f5f5f3; }
.app { max-width: 900px; margin: 0 auto; padding: 20px; }

/* Progression */
.progress-bar { height: 3px; background: #e0e0dc; margin-bottom: 14px; border-radius: 3px; overflow: hidden; }
.progress-fill { height: 100%; background: #2ecc71; transition: width 0.3s; }
.progress-labels { display: flex; justify-content: space-between; font-size: 12px; color: #666; margin-bottom: 28px; font-weight: 500; }
.progress-labels span.active { color: #2ecc71; }

/* Cards */
.card { background: #fff; border-radius: 14px; padding: 24px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); margin-bottom: 20px; }
.card h2 { font-size: 24px; margin-bottom: 8px; }
.card h3 { font-size: 18px; margin-top: 20px; margin-bottom: 12px; }
.hint { color: #888; font-size: 14px; margin-bottom: 20px; }

/* Formulaires */
.form-block { margin-bottom: 20px; }
.label { display: block; font-weight: 600; font-size: 14px; margin-bottom: 10px; }
.label.top { margin-top: 14px; }
.input { border: 1px solid #ddd; border-radius: 8px; padding: 10px; font-size: 14px; width: 100%; }
.input:focus { outline: none; border-color: #2ecc71; box-shadow: 0 0 0 3px rgba(46, 204, 113, 0.1); }

.input.full { width: 100%; }
.input.person-name { font-weight: 600; font-size: 16px; }

/* Radio & Checkbox */
.radio-group { display: flex; gap: 16px; }
.radio, .checkbox { display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 14px; }
.radio input, .checkbox input { width: 18px; height: 18px; cursor: pointer; }

/* Grilles */
.level-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; }
.level-card { border: 2px solid #e0e0dc; border-radius: 10px; padding: 14px; cursor: pointer; transition: all 0.2s; }
.level-card:hover { border-color: #2ecc71; }
.level-card input:checked + .level-content { color: #2ecc71; }
.level-card input { display: none; }
.level-content { pointer-events: none; }
.level-content strong { display: block; margin-bottom: 4px; }
.level-content small { color: #888; }

.day-check-grid, .slot-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(80px, 1fr)); gap: 10px; }
.slot-grid { grid-template-columns: repeat(3, 1fr); }

/* Personas */
.person-card { background: #f9f9f7; border-radius: 12px; padding: 18px; margin-bottom: 18px; border: 1px solid #ececE8; }
.person-header { display: flex; gap: 12px; margin-bottom: 16px; align-items: center; }
.person-name { flex: 1; }
.person-title { font-size: 16px; font-weight: 600; margin-bottom: 14px; }

/* Buttons */
.btn { border: none; border-radius: 8px; padding: 10px 16px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
.btn-primary { background: #2ecc71; color: #fff; }
.btn-primary:hover { background: #27ae60; }
.btn-secondary { background: #e0e0dc; color: #333; }
.btn-secondary:hover { background: #ccc; }
.btn-success { background: #27ae60; color: #fff; font-size: 16px; }
.btn-success:hover { background: #229954; }
.btn-delete { background: none; color: #dc2626; border: none; cursor: pointer; font-size: 18px; }
.btn-icon { background: none; border: none; cursor: pointer; color: #dc2626; padding: 0; font-size: 16px; }
.btn.full { width: 100%; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* Navigation */
.nav-buttons { display: flex; gap: 12px; justify-content: flex-end; }

/* Wants list */
.wants-list { display: flex; flex-direction: column; gap: 10px; margin-top: 14px; }
.want-card { border: 1px solid #ececE8; border-radius: 10px; padding: 14px; background: #fafaf8; }
.want-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 6px; }
.want-head div { display: flex; align-items: center; gap: 8px; }
.sessions-badge { background: #e3f2fd; color: #1d4ed8; font-size: 12px; padding: 2px 8px; border-radius: 6px; font-weight: 600; }
.cat-badge { background: #f2f8f4; color: #14532d; font-size: 11px; padding: 2px 6px; border-radius: 4px; }
.want-empty { color: #a3a3a3; font-size: 14px; text-align: center; padding: 20px; border: 1px dashed #e0e0dc; border-radius: 10px; }

/* Row */
.row { display: flex; gap: 12px; }
.row.spaced { justify-content: space-between; }

/* Résultats */
.result-container { display: grid; grid-template-columns: 1fr 1.5fr; gap: 20px; }

.personalize-panel { background: #fff; border-radius: 14px; padding: 24px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); }
.personalize-panel h2 { margin-bottom: 10px; }
.personalize-section { margin-bottom: 24px; padding-bottom: 20px; border-bottom: 1px solid #e0e0dc; }
.personalize-section:last-child { border-bottom: none; }
.personalize-section h3 { font-size: 16px; margin-bottom: 12px; }

.file-input-label { display: inline-block; background: #f0f0f0; border: 1px solid #ddd; border-radius: 8px; padding: 8px 14px; cursor: pointer; font-size: 14px; transition: all 0.2s; }
.file-input-label:hover { background: #e8e8e8; }
.file-input-label input { display: none; }

.slider-container { margin-top: 14px; }
.slider { width: 100%; margin-top: 8px; }

.day-image-row { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.day-image-row span { width: 40px; font-weight: 600; text-align: center; }

.action-buttons { display: flex; flex-direction: column; gap: 10px; margin-top: 20px; }
.action-buttons .btn { width: 100%; }

.preview-panel { background: #fff; border-radius: 14px; padding: 24px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); }
.preview-panel h2 { margin-bottom: 10px; }

.badge-ai { display: inline-block; background: #fef3c7; color: #92400e; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; margin-bottom: 16px; }

.week-export { border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15); }
.week-overlay { display: flex; flex-direction: column; gap: 16px; padding: 20px; }
.person-plan { background: rgba(255, 255, 255, 0.95); border-radius: 10px; padding: 16px; }
.person-plan h3 { margin-bottom: 14px; font-size: 18px; }

.week { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; }
.day-cell { background: #f9f9f7; border-radius: 10px; border: 1px solid #e0e0dc; overflow: hidden; position: relative; }
.day-header { background: #333; color: #fff; padding: 8px; text-align: center; font-weight: 600; font-size: 14px; }
.day-content { padding: 8px; display: flex; flex-direction: column; gap: 6px; min-height: 200px; }
.event { border-radius: 6px; padding: 8px; font-size: 12px; }
.event-title { font-weight: 600; }
.event-time-small { font-size: 11px; opacity: 0.8; }

.day-image-bg { position: absolute; bottom: 0; left: 0; right: 0; top: 0; background-size: cover; pointer-events: none; }

@media (max-width: 1024px) {
  .result-container { grid-template-columns: 1fr; }
  .week { grid-template-columns: repeat(4, 1fr); }
}

@media print {
  .no-print, .personalize-panel, .nav-buttons { display: none !important; }
  .app { padding: 0; }
  .card { box-shadow: none; }
}
`;