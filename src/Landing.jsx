import { useState, useEffect, useRef } from "react";

const SHOPIFY_URL = "https://ruvyrecovery.myshopify.com";

const BOXES = [
  {
    id: "jjb",
    nom: "RUVY JJB",
    emoji: "🥋",
    couleur: "#E8B923",
    statut: "validée",
    accroche: "Les essentiels du Jiu-Jitsu brésilien.",
    photo: "/box-jjb.jpg",
    produits: [
      ["Wet Bag", "Sac imperméable pour les vêtements humides après l'entraînement."],
      ["Finger Tape", "Protection des doigts pendant la pratique."],
      ["Serviette microfibre", "Compacte, pour la transpiration."],
      ["Mini kit premiers secours", "Pansements et matériel de nettoyage."],
      ["Mini kit coupe-ongles", "Coupe-ongles et lime pour une bonne hygiène."],
    ],
  },
  {
    id: "run",
    nom: "RUVY RUN",
    emoji: "🏃",
    couleur: "#FF7A1A",
    statut: "validée",
    accroche: "Les accessoires pour courir confortablement.",
    photo: "/box-run.jpg",
    produits: [
      ["Ceinture running", "Téléphone, clés et petits objets pendant la course."],
      ["Stick anti-frottements", "Prévient les irritations pendant l'effort."],
      ["Serviette microfibre", "Légère, pour essuyer la transpiration."],
      ["Dossard RUVY", "Accessoire réutilisable aux couleurs de la marque."],
      ["Chaussettes techniques", "Confort et moins de frottements."],
    ],
  },
  {
    id: "gym",
    nom: "RUVY GYM",
    emoji: "🏋️",
    couleur: "#9AA0A6",
    statut: "composition en cours",
    accroche: "Les indispensables de la musculation.",
    photo: "/box-gym.jpg",
    produits: [
      ["Serviette microfibre", "Hygiène et transpiration pendant les séances."],
      ["Grips / protections des mains", "Limitent frottements et callosités."],
      ["Mini bande élastique", "Échauffement, mobilité, activation musculaire."],
      ["Balle de massage", "Récupération musculaire après l'entraînement."],
      ["Support téléphone compact", "Pour suivre son programme ou filmer ses exercices."],
    ],
  },
  {
    id: "bachata",
    nom: "RUVY BACHATA",
    emoji: "💃",
    couleur: "#E0314B",
    statut: "composition en cours",
    accroche: "Les essentiels pour profiter pleinement de la danse.",
    photo: "/box-bachata.jpg",
    produits: [
      ["Éventail compact", "Se rafraîchir pendant les cours et soirées."],
      ["Petite serviette microfibre", "Pour essuyer la transpiration."],
      ["Chaussettes de danse", "Confort et mouvements facilités."],
      ["Protections anti-ampoules", "Protègent les pieds des frottements."],
      ["Petite pochette", "Pour transporter les essentiels."],
    ],
  },
];

/* ---------- Apparition douce au scroll ---------- */
function Reveal({ children, delay = 0 }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className="rv-reveal"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "none" : "translateY(28px)",
        transitionDelay: `${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

/* ---------- Photo de la box avec tilt 3D ---------- */
function BoxPhoto({ box }) {
  const ref = useRef(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0, on: false });
  const [erreur, setErreur] = useState(false);

  useEffect(() => {
    setErreur(false);
  }, [box.photo]);

  const onMove = (e) => {
    const r = ref.current.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    setTilt({ x: -py * 14, y: px * 14, on: true });
  };

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={() => setTilt({ x: 0, y: 0, on: false })}
      className="rv-photo"
      style={{
        transform: `perspective(900px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
        boxShadow: tilt.on
          ? `0 0 0 2px ${box.couleur}, 0 0 40px ${box.couleur}88, 0 30px 60px #000a`
          : `0 0 0 1px ${box.couleur}44, 0 30px 60px #0008`,
      }}
    >
      {erreur ? (
        <div className="rv-photo-vide" style={{ color: box.couleur }}>
          <span style={{ fontSize: 64 }}>{box.emoji}</span>
          <span>{box.nom}</span>
        </div>
      ) : (
        <img
          src={box.photo}
          alt={box.nom}
          onError={() => setErreur(true)}
          draggable={false}
        />
      )}
    </div>
  );
}

/* ---------- Slider plein écran ---------- */
function Slider() {
  const [i, setI] = useState(0);
  const touchX = useRef(null);
  const box = BOXES[i];

  const aller = (n) => setI((n + BOXES.length) % BOXES.length);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowRight") aller(i + 1);
      if (e.key === "ArrowLeft") aller(i - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [i]);

  const onTouchStart = (e) => (touchX.current = e.touches[0].clientX);
  const onTouchEnd = (e) => {
    if (touchX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    if (Math.abs(dx) > 50) aller(dx < 0 ? i + 1 : i - 1);
    touchX.current = null;
  };

  return (
    <section
      className="rv-slider"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      style={{
        background: `radial-gradient(ellipse at 50% 35%, ${box.couleur}40 0%, #0a0a0a 65%)`,
      }}
    >
      <p className="rv-kicker">Les Starter Packs</p>

      <div className="rv-slide" key={box.id}>
        <BoxPhoto box={box} />

        <div className="rv-slide-texte">
          <h2
            className="rv-box-titre"
            style={{ color: box.couleur, WebkitTextFillColor: box.couleur }}
          >
            {box.emoji} {box.nom}
          </h2>
          <p className="rv-accroche">{box.accroche}</p>
          {box.statut !== "validée" && (
            <span className="rv-badge" style={{ borderColor: box.couleur, color: box.couleur }}>
              Composition en cours
            </span>
          )}
          <div className="rv-produits">
            {box.produits.map(([nom, desc]) => (
              <div key={nom} className="rv-produit" style={{ borderLeftColor: box.couleur }}>
                <strong>{nom}</strong>
                <span>{desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <button className="rv-fleche gauche" onClick={() => aller(i - 1)} aria-label="Précédent">
        ‹
      </button>
      <button className="rv-fleche droite" onClick={() => aller(i + 1)} aria-label="Suivant">
        ›
      </button>

      <div className="rv-points">
        {BOXES.map((b, n) => (
          <button
            key={b.id}
            onClick={() => aller(n)}
            aria-label={b.nom}
            className="rv-point"
            style={{
              background: n === i ? box.couleur : "#555",
              width: n === i ? 28 : 10,
            }}
          />
        ))}
      </div>

      <p className="rv-bientot">D'autres disciplines arrivent bientôt.</p>
    </section>
  );
}

/* ---------- Page ---------- */
export default function Landing({ onStart }) {
  return (
    <div className="rv-page">
      <style>{CSS}</style>

      {/* HERO */}
      <header className="rv-hero">
        <img
          src="/logo.png"
          alt="RUVY"
          className="rv-logo"
          onError={(e) => (e.currentTarget.style.display = "none")}
        />
        <h1>
          START YOUR
          <br />
          SPORT RIGHT.
        </h1>
        <p className="rv-sous-titre">Ton sport. Ton Starter Pack. Ton départ.</p>
        <div className="rv-boutons">
          {onStart && (
            <button className="rv-btn plein" onClick={onStart}>
              Créer mon planning
            </button>
          )}
          <a className="rv-btn vide" href={SHOPIFY_URL} target="_blank" rel="noreferrer">
            Découvrir les boxes
          </a>
        </div>
        <span className="rv-scroll">↓</span>
      </header>

      {/* QU'EST-CE QUE RUVY */}
      <section className="rv-section">
        <Reveal>
          <p className="rv-kicker">Qu'est-ce que RUVY ?</p>
          <h2 className="rv-titre">Le sport, plus accessible, pratique et organisé.</h2>
        </Reveal>
        <Reveal delay={100}>
          <p className="rv-texte">
            RUVY est une jeune marque française spécialisée dans la création de Starter Packs
            sportifs, conçus pour accompagner les personnes qui débutent ou pratiquent une
            discipline sportive.
          </p>
        </Reveal>
        <Reveal delay={200}>
          <p className="rv-texte">
            Chaque box rassemble une sélection d'accessoires utiles, choisis pour résoudre les
            problèmes du quotidien des sportifs : hygiène, confort, équipement, récupération et
            organisation.
          </p>
        </Reveal>
        <Reveal delay={300}>
          <p className="rv-texte">
            <strong>Notre différence :</strong> RUVY ne propose pas simplement des accessoires.
            Chaque box est pensée autour de véritables besoins, identifiés grâce aux expériences
            et aux retours des pratiquants.
          </p>
        </Reveal>
      </section>

      {/* SLIDER */}
      <Slider />

      {/* PLANNER */}
      <section className="rv-section">
        <Reveal>
          <p className="rv-kicker">Inclus avec ta box</p>
          <h2 className="rv-titre">RUVY Planner</h2>
          <p className="rv-texte">
            Un outil numérique pour organiser ta vie sportive, professionnelle et personnelle,
            à ton image.
          </p>
        </Reveal>
        <div className="rv-etapes">
          {[
            ["1", "Ouvre ta box", "Découvre ton Starter Pack RUVY."],
            ["2", "Scanne le QR code", "Il t'emmène directement sur RUVY Planner."],
            ["3", "Crée ton planning", "Personnalise-le, imprime-le, fais-le tien."],
          ].map(([n, t, d], k) => (
            <Reveal key={n} delay={k * 120}>
              <div className="rv-etape">
                <span className="rv-num">{n}</span>
                <strong>{t}</strong>
                <span>{d}</span>
              </div>
            </Reveal>
          ))}
        </div>
        {onStart && (
          <Reveal delay={200}>
            <button className="rv-btn plein" onClick={onStart}>
              Créer mon planning
            </button>
          </Reveal>
        )}
      </section>

      {/* FOOTER */}
      <footer className="rv-footer">
        <strong>RUVY</strong> — Ton sport. Ton Starter Pack. Ton départ.
      </footer>
    </div>
  );
}

/* ---------- Styles ---------- */
const CSS = `
html,body,#root{margin:0!important;padding:0!important;max-width:none!important;width:100%!important;background:#0a0a0a!important;display:block!important;text-align:left!important}
.rv-page *{box-sizing:border-box}
.rv-page{background:#0a0a0a;color:#f2f2f2;font-family:system-ui,-apple-system,Segoe UI,sans-serif;overflow-x:hidden;width:100%;max-width:none}
.rv-page h1,.rv-page .rv-titre{color:#f2f2f2!important;-webkit-text-fill-color:#f2f2f2!important}
.rv-page .rv-box-titre{color:inherit}
.rv-page strong{color:inherit!important}
.rv-reveal{transition:opacity .8s ease,transform .8s ease}

.rv-hero{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:40px 20px;position:relative;
  background:radial-gradient(ellipse at 50% 30%,#2a2208 0%,#0a0a0a 70%)}
.rv-logo{width:150px;height:150px;object-fit:contain;margin-bottom:28px;border-radius:28px;border:2px solid #E8B923;box-shadow:0 0 30px #E8B92355,0 0 80px #E8B92322}
.rv-hero h1{font-size:clamp(2.4rem,8vw,5.5rem);line-height:1.02;margin:0;font-weight:900;letter-spacing:-1px}
.rv-sous-titre{opacity:.7;margin:20px 0 34px;font-size:1.1rem}
.rv-boutons{display:flex;gap:14px;flex-wrap:wrap;justify-content:center}
.rv-btn{padding:15px 30px;border-radius:999px;font-weight:700;font-size:1rem;cursor:pointer;text-decoration:none;border:2px solid #E8B923;transition:transform .2s,box-shadow .2s;display:inline-block}
.rv-btn:hover{transform:translateY(-2px);box-shadow:0 8px 30px #E8B92355}
.rv-btn.plein{background:#E8B923;color:#111}
.rv-btn.vide{background:transparent;color:#E8B923}
.rv-scroll{position:absolute;bottom:26px;font-size:1.6rem;opacity:.5;animation:rv-bounce 2s infinite}
@keyframes rv-bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(8px)}}

.rv-section{max-width:820px;margin:0 auto;padding:100px 24px;text-align:center}
.rv-kicker{letter-spacing:4px;text-transform:uppercase;font-size:.78rem;opacity:.6;margin:0 0 14px}
.rv-titre{font-size:clamp(1.8rem,5vw,3rem);margin:0 0 24px;line-height:1.1}
.rv-texte{font-size:1.1rem;line-height:1.7;opacity:.85;margin:0 0 18px}

.rv-slider{min-height:100vh;position:relative;padding:70px 20px 60px;display:flex;flex-direction:column;align-items:center;justify-content:center;transition:background .6s ease}
.rv-slide{display:flex;gap:50px;align-items:center;justify-content:center;flex-wrap:wrap;max-width:1100px;animation:rv-in .6s ease}
@keyframes rv-in{from{opacity:0;transform:translateX(30px)}to{opacity:1;transform:none}}
.rv-photo{width:min(380px,80vw);aspect-ratio:1/1;border-radius:22px;overflow:hidden;background:#151515;transition:transform .15s ease-out,box-shadow .3s;animation:rv-float 5s ease-in-out infinite}
.rv-photo img{width:100%;height:100%;object-fit:cover;display:block}
.rv-photo-vide{width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;font-weight:800}
@keyframes rv-float{0%,100%{translate:0 0}50%{translate:0 -12px}}
.rv-slide-texte{flex:1;min-width:280px;max-width:480px;text-align:left}
.rv-slide-texte h2{font-size:clamp(1.8rem,4vw,2.6rem);margin:0 0 8px}
.rv-accroche{opacity:.8;margin:0 0 14px}
.rv-badge{display:inline-block;border:1px solid;border-radius:999px;padding:4px 14px;font-size:.78rem;margin-bottom:14px}
.rv-produits{display:grid;gap:8px}
.rv-produit{background:#ffffff0d;border-left:3px solid;border-radius:8px;padding:10px 14px;display:flex;flex-direction:column;gap:2px;font-size:.92rem}
.rv-produit span{opacity:.65;font-size:.84rem}
.rv-fleche{position:absolute;top:50%;transform:translateY(-50%);background:#ffffff14;color:#fff;border:none;font-size:2.4rem;width:52px;height:52px;border-radius:50%;cursor:pointer;transition:background .2s}
.rv-fleche:hover{background:#ffffff30}
.rv-fleche.gauche{left:14px}
.rv-fleche.droite{right:14px}
.rv-points{display:flex;gap:8px;margin-top:34px}
.rv-point{height:10px;border-radius:999px;border:none;cursor:pointer;transition:all .3s;padding:0}
.rv-bientot{opacity:.5;font-size:.85rem;margin-top:22px}

.rv-etapes{display:flex;gap:18px;flex-wrap:wrap;justify-content:center;margin:40px 0}
.rv-etape{background:#ffffff0d;border-radius:16px;padding:26px 22px;width:220px;display:flex;flex-direction:column;gap:8px;align-items:center}
.rv-etape span:last-child{opacity:.65;font-size:.9rem}
.rv-num{width:42px;height:42px;border-radius:50%;background:#E8B923;color:#111;display:flex;align-items:center;justify-content:center;font-weight:900}

.rv-footer{text-align:center;padding:50px 20px;opacity:.6;border-top:1px solid #ffffff14}

@media (max-width:700px){
  .rv-fleche{display:none}
  .rv-slide-texte{text-align:center}
  .rv-section{padding:70px 20px}
}
@media (prefers-reduced-motion:reduce){
  .rv-photo,.rv-scroll,.rv-slide{animation:none}
  .rv-reveal{transition:none}
}
`;