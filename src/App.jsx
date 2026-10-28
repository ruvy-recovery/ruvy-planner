// src/App.jsx
import { useState, useEffect, useRef } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
const SHOPIFY_URL = "https://ruvyrecovery.myshopify.com";

const BOXES = [
  {
    id: "jjb",
    name: "JJB",
    color: "#E8B923",
    title: "Les essentiels du Jiu-Jitsu brésilien",
    image: "/box-jjb.jpg",
    products: [
      { name: "Wet Bag", desc: "Sac imperméable pour les vêtements humides après l'entraînement." },
      { name: "Finger Tape", desc: "Protection des doigts pendant la pratique." },
      { name: "Serviette microfibre", desc: "Compacte, pour la transpiration." },
      { name: "Mini kit premiers secours", desc: "Pansements et matériel de nettoyage." },
      { name: "Mini kit coupe-ongles", desc: "Hygiène et ne pas blesser ses partenaires." },
    ],
  },
  {
    id: "run",
    name: "RUN",
    color: "#F37021",
    title: "Les accessoires pour courir confortablement",
    image: "/box-run.jpg",
    products: [
      { name: "Ceinture running", desc: "Téléphone, clés, petits objets." },
      { name: "Stick anti-frottements", desc: "Prévient les irritations." },
      { name: "Serviette microfibre", desc: "Compacte et légère." },
      { name: "Dossard RUVY stylé", desc: "Réutilisable, aux couleurs de la marque." },
      { name: "Chaussettes techniques", desc: "Confort, limite les frottements." },
    ],
  },
  {
    id: "gym",
    name: "GYM",
    color: "#9A9A9A",
    title: "Les indispensables de la musculation",
    image: "/box-gym.jpg",
    products: [
      { name: "Serviette microfibre", desc: "Toujours à portée de main." },
      { name: "Grips / protections des mains", desc: "Frottements et callosités." },
      { name: "Mini bande élastique de résistance", desc: "Échauffement, mobilité, activation." },
      { name: "Balle de massage", desc: "Récupération." },
      { name: "Support téléphone compact", desc: "Suivre son programme RUVY Planner ou filmer ses exercices." },
    ],
  },
  {
    id: "bachata",
    name: "BACHATA",
    color: "#E3262E",
    title: "Les essentiels pour profiter pleinement de la danse",
    image: "/box-bachata.jpg",
    products: [
      { name: "Éventail compact", desc: "Pour les sessions intenses." },
      { name: "Petite serviette microfibre", desc: "Pratique et discrète." },
      { name: "Chaussettes adaptées à la danse", desc: "Confort et adhérence." },
      { name: "Protections anti-ampoules", desc: "Pour danser sans douleur." },
      { name: "Petite pochette de rangement", desc: "Tout garder à portée de main." },
    ],
  },
];

function useReveal() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      document.querySelectorAll(".landing-root .reveal").forEach((el) => el.classList.add("is-visible"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-visible");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    const els = document.querySelectorAll(".landing-root .reveal");
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

function BoxImage({ src, alt, color, onTilt }) {
  const [errored, setErrored] = useState(false);
  const ref = useRef(null);

  function handleMouseMove(e) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    const rx = (-y * 10).toFixed(2);
    const ry = (x * 10).toFixed(2);
    el.style.transform = `translateY(0) rotateX(${rx}deg) rotateY(${ry}deg)`;
    if (onTilt) onTilt(true);
  }
  function handleMouseLeave() {
    const el = ref.current;
    if (!el) return;
    el.style.transform = "";
    if (onTilt) onTilt(false);
  }

  if (errored) {
    return (
      <div
        className="lp-slide-photo-fallback"
        style={{ "--halo": color }}
        aria-label={alt}
      >
        {alt}
      </div>
    );
  }

  return (
    <img
      ref={ref}
      className="lp-slide-photo"
      src={src}
      alt={alt}
      loading="lazy"
      style={{ "--halo": color }}
      onError={() => setErrored(true)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    />
  );
}

const landingCss = `
.landing-root{--lp-orange:#f37021;--lp-gold:#d5ad55;--lp-bg:#080909;--lp-muted:#b6b8b9;background:var(--lp-bg);color:#f7f7f4;font-family:Montserrat,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;width:100vw;position:relative;left:50%;margin-left:-50vw;overflow:hidden;text-align:left;line-height:1.5}
.landing-root *,.landing-root *:before,.landing-root *:after{box-sizing:border-box}
.landing-root h1,.landing-root h2,.landing-root h3,.landing-root p{margin-top:0}
.landing-root .reveal{opacity:0;transform:translateY(18px);transition:opacity .65s ease,transform .65s ease}.landing-root .reveal.is-visible{opacity:1;transform:none}
.lp-hero{min-height:690px;display:flex;align-items:center;padding:76px max(6vw,22px);position:relative;background:radial-gradient(ellipse at 78% 48%,rgba(213,173,85,.16),transparent 39%),radial-gradient(ellipse at 8% 12%,rgba(243,112,33,.16),transparent 35%),linear-gradient(130deg,#090a0a,#111211 60%,#0b0c0c);isolation:isolate}
.lp-hero:after{content:"";position:absolute;inset:0;z-index:-1;opacity:.15;background-image:linear-gradient(rgba(255,255,255,.1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.1) 1px,transparent 1px);background-size:72px 72px;mask-image:linear-gradient(90deg,transparent,#000 70%)}
.lp-hero-grid{width:min(1240px,100%);margin:auto;display:grid;grid-template-columns:minmax(0,.9fr) minmax(420px,1.1fr);gap:clamp(28px,5vw,76px);align-items:center}
.lp-hero-copy{position:relative;z-index:1}.lp-logo{width:clamp(100px,13vw,154px);height:auto;object-fit:contain;margin:0 0 24px;filter:drop-shadow(0 8px 22px rgba(243,112,33,.2))}
.lp-headline,.lp-title,.lp-slide-title{font-family:Anton,Impact,"Arial Narrow",sans-serif;text-transform:uppercase;letter-spacing:.01em;line-height:1.02}.lp-headline{font-size:clamp(3rem,6.6vw,6rem);max-width:670px;margin:0 0 20px;background:linear-gradient(120deg,#fff 24%,#efd6bb 78%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}.lp-headline em{font-style:normal;color:var(--lp-orange);-webkit-text-fill-color:var(--lp-orange)}
.lp-sub{color:#d0d1cf;font-size:clamp(1rem,1.35vw,1.13rem);line-height:1.75;max-width:570px;margin:0 0 28px}.lp-actions{display:flex;flex-wrap:wrap;gap:12px}.lp-btn{appearance:none;border:1px solid transparent;border-radius:5px;padding:15px 22px;min-height:52px;display:inline-flex;align-items:center;justify-content:center;text-decoration:none;font:800 .82rem Montserrat,system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;transition:transform .2s ease,background .2s ease,border-color .2s ease}.lp-btn:hover{transform:translateY(-2px)}.lp-btn-primary{background:var(--lp-orange);color:#fff;box-shadow:0 9px 24px rgba(243,112,33,.2)}.lp-btn-primary:hover{background:#ff8137}.lp-btn-secondary{border-color:#656866;color:#f5f5f2;background:rgba(0,0,0,.18)}.lp-btn-secondary:hover{border-color:var(--lp-orange);color:#ffb078}
.lp-planner-preview{padding:18px;border:1px solid rgba(255,255,255,.12);border-radius:14px;background:linear-gradient(145deg,rgba(31,33,31,.98),rgba(13,14,14,.98));box-shadow:0 28px 80px rgba(0,0,0,.46),0 0 55px rgba(213,173,85,.08);transform:rotate(1deg)}.lp-preview-top{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:2px 3px 16px}.lp-preview-brand{font-size:.7rem;font-weight:900;letter-spacing:.16em}.lp-preview-brand b{color:var(--lp-orange)}.lp-preview-label{color:#9fa29f;font-size:.67rem;letter-spacing:.08em;text-transform:uppercase}.lp-preview-week{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:7px}.lp-day{min-width:0;min-height:216px;padding:10px 7px;border-radius:7px;background:#202220;border:1px solid rgba(255,255,255,.055)}.lp-day-name{text-align:center;color:#c5c7c3;font-size:.59rem;font-weight:800;letter-spacing:.04em;margin-bottom:12px}.lp-day-date{text-align:center;color:#858984;font-size:.57rem;margin-top:-9px;margin-bottom:12px}.lp-event{padding:7px 5px;border-radius:4px;background:#33312b;border-left:2px solid var(--lp-gold);font-size:.55rem;color:#eee9db;line-height:1.35;margin-bottom:7px}.lp-event.orange{background:#38281f;border-color:var(--lp-orange);color:#ffe1cd}.lp-event.muted{background:#2a2b2a;border-color:#8d938d;color:#d3d5d1}.lp-preview-foot{display:flex;align-items:center;justify-content:space-between;padding:14px 3px 2px;color:#aeb1ab;font-size:.64rem}.lp-preview-pill{border:1px solid rgba(243,112,33,.46);color:#ffb27c;border-radius:99px;padding:5px 9px;font-size:.6rem}
.lp-scroll-cue{position:absolute;bottom:24px;left:max(6vw,22px);color:#9fa19d;font-size:.65rem;letter-spacing:.2em}
.lp-section{padding:88px max(6vw,22px);position:relative}.lp-section-inner{width:min(1160px,100%);margin:0 auto}.lp-eyebrow{display:block;color:var(--lp-orange);font-weight:900;font-size:.7rem;letter-spacing:.2em;text-transform:uppercase;margin-bottom:13px}.lp-title{font-size:clamp(2.1rem,4.3vw,3.6rem);margin:0 0 16px}.lp-text{color:#c3c5c2;font-size:1rem;line-height:1.75;max-width:770px;margin:0}.lp-text strong{color:#fff}.lp-orange{color:#ff9756}
.lp-about{background:#141615;border-top:1px solid rgba(255,255,255,.05);border-bottom:1px solid rgba(255,255,255,.05)}.lp-about-grid{display:grid;grid-template-columns:1fr .85fr;gap:58px;align-items:center}.lp-about-card{position:relative;border:1px solid rgba(213,173,85,.25);background:linear-gradient(135deg,#20221f,#101211);border-radius:12px;padding:28px;overflow:hidden}.lp-about-card:after{content:"";position:absolute;right:-65px;top:-90px;width:240px;height:240px;border:1px solid rgba(213,173,85,.16);border-radius:50%;box-shadow:0 0 0 24px rgba(213,173,85,.025),0 0 0 48px rgba(213,173,85,.02)}.lp-about-card h3{font-size:1.15rem;margin:0 0 10px;position:relative;z-index:1}.lp-about-card p{position:relative;z-index:1;color:#c3c5c2;line-height:1.7;margin:0}.lp-about-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:27px}.lp-stat{padding:16px 13px;border-top:2px solid var(--lp-gold);background:rgba(255,255,255,.035)}.lp-stat strong{display:block;color:#f1d18a;font-size:1.6rem;line-height:1.15}.lp-stat span{display:block;color:#b3b5b1;font-size:.68rem;margin-top:6px}
.lp-slider{--halo:#d5ad55;position:relative;padding:78px max(4vw,18px) 88px;background:#080909;overflow:hidden}.lp-slider:before{content:"";position:absolute;inset:0;background:radial-gradient(ellipse at 50% 0%,color-mix(in srgb,var(--halo) 12%,transparent),transparent 55%);pointer-events:none}.lp-slider-heading{max-width:1160px;margin:0 auto 26px;position:relative}.lp-slider-heading h2{font-family:Anton,Impact,sans-serif;font-size:clamp(2rem,4vw,3.2rem);text-transform:uppercase;margin:0}.lp-slider-heading p{color:#aeb0ac;margin:7px 0 0}.lp-box-row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:15px;max-width:1160px;margin:0 auto;position:relative}.lp-box-tile{display:grid;grid-template-columns:minmax(100px,.7fr) 1fr;align-items:center;gap:14px;min-height:185px;padding:16px;border:1px solid rgba(255,255,255,.1);border-radius:10px;background:linear-gradient(145deg,#171918,#101111);color:#f5f5f2;text-align:left;cursor:pointer;transition:transform .25s,border-color .25s,background .25s}.lp-box-tile:hover{transform:translateY(-3px);border-color:var(--tile-color)}.lp-box-tile.active{border-color:var(--tile-color);background:linear-gradient(145deg,#22231f,#121313);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--tile-color) 20%,transparent)}.lp-tile-photo{width:100%;height:132px;object-fit:contain;filter:drop-shadow(0 8px 15px color-mix(in srgb,var(--tile-color) 24%,transparent))}.lp-slide-photo{display:block;width:100%;height:132px;object-fit:contain;transform:perspective(700px);transition:transform .2s ease}.lp-slide-photo-fallback{height:132px;border-radius:7px;display:grid;place-items:center;background:radial-gradient(circle,color-mix(in srgb,var(--halo) 24%,#171817),#101111 70%);font-family:Anton,Impact,sans-serif;font-size:1.6rem;color:var(--halo)}.lp-tile-copy{min-width:0}.lp-tile-index{font-size:.61rem;color:var(--tile-color);font-weight:900;letter-spacing:.13em}.lp-tile-title{font-family:Anton,Impact,sans-serif;font-size:1.45rem;margin:4px 0 5px}.lp-tile-desc{font-size:.71rem;line-height:1.5;color:#b9bbb7}.lp-slider-controls{max-width:1160px;margin:18px auto 0;display:flex;align-items:center;justify-content:space-between;gap:12px;position:relative}.lp-slider-arrows{display:flex;gap:8px}.lp-slider-arrow{width:40px;height:40px;border:1px solid #555954;background:#171918;color:#fff;border-radius:50%;font-size:1.4rem;cursor:pointer}.lp-slider-arrow:hover{border-color:var(--lp-orange);color:var(--lp-orange)}.lp-slider-position{font-size:.71rem;letter-spacing:.12em;color:#aaa}.lp-slider-dots{display:flex;gap:8px;align-items:center}.lp-dot{width:8px;height:8px;padding:0;border:0;border-radius:50%;background:#555;cursor:pointer}.lp-dot.is-active{width:22px;border-radius:9px;background:var(--lp-orange)}.lp-products-panel{max-width:1160px;margin:28px auto 0;padding:24px;border:1px solid rgba(255,255,255,.09);border-radius:10px;background:#121414;position:relative}.lp-products-panel h3{font-family:Anton,Impact,sans-serif;font-size:1.5rem;text-transform:uppercase;margin:0 0 6px}.lp-products-panel>p{color:#acafaa;margin:0 0 18px}.lp-products{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}.lp-product{padding:13px;background:#1b1e1c;border-radius:6px}.lp-product-name{display:block;font-size:.76rem;font-weight:800;color:#f2f1eb;margin-bottom:5px}.lp-product-desc{display:block;color:#aaada8;font-size:.67rem;line-height:1.5}.lp-coming-soon{text-align:center;color:#878b86;font-size:.8rem;margin:22px 0 0}.lp-shop-link{display:block;text-align:center;margin-top:14px}.lp-footer-link{color:#e8bd75;font-weight:800;font-size:.77rem;text-decoration:none}.lp-footer-link:hover{color:#fff}
.lp-planner{background:linear-gradient(120deg,#191a17,#121411 50%,#191711);border-top:1px solid rgba(213,173,85,.13);border-bottom:1px solid rgba(213,173,85,.13)}.lp-planner-layout{display:grid;grid-template-columns:.85fr 1.15fr;gap:44px;align-items:center}.lp-planner-copy .lp-text{margin-bottom:23px}.lp-prices{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-top:19px}.lp-price{padding:14px 12px;border:1px solid rgba(255,255,255,.12);border-radius:7px;background:rgba(0,0,0,.18)}.lp-price span{display:block;color:#aeb0ac;font-size:.66rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em}.lp-price strong{display:block;margin-top:5px;color:#f4d593;font-size:1.04rem}.lp-discount{margin-top:12px;padding:13px 14px;border-left:3px solid var(--lp-orange);background:rgba(243,112,33,.09);font-size:.78rem;color:#e2e3dd;line-height:1.6}.lp-discount strong{color:#ff9b5d}.lp-steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:13px;margin-top:30px;align-items:stretch}.lp-step{height:100%;min-height:182px;padding:19px 16px;border:1px solid rgba(255,255,255,.1);border-radius:8px;background:linear-gradient(145deg,#20221e,#151715);display:flex;flex-direction:column}.lp-step-num{color:var(--lp-orange);font-family:Anton,Impact,sans-serif;font-size:1.5rem;line-height:1}.lp-step-title{font-size:.89rem;margin:13px 0 8px}.lp-step-desc{font-size:.75rem;line-height:1.55;color:#b3b6b0;margin:0}.lp-planner-cta{margin-top:20px}
.lp-ambition{background:linear-gradient(180deg,#0b0c0b,#11130f 55%,#0b0c0b);text-align:center}.lp-ambition-inner{max-width:850px;margin:auto}.lp-ambition .lp-text{margin:0 auto}.lp-faq{background:#151716}.lp-faq-layout{display:grid;grid-template-columns:.7fr 1.3fr;gap:48px}.lp-faq-list{border-top:1px solid rgba(255,255,255,.15)}.lp-faq details{border-bottom:1px solid rgba(255,255,255,.15)}.lp-faq summary{list-style:none;cursor:pointer;padding:18px 30px 18px 0;font-weight:800;font-size:.91rem;position:relative}.lp-faq summary::-webkit-details-marker{display:none}.lp-faq summary:after{content:"+";position:absolute;right:2px;color:var(--lp-orange);font-size:1.3rem;top:12px}.lp-faq details[open] summary:after{content:"−"}.lp-faq details p{margin:0;padding:0 28px 18px 0;color:#bfc1bd;font-size:.85rem;line-height:1.7}
.lp-footer{padding:32px max(6vw,22px);display:flex;align-items:center;justify-content:space-between;gap:18px;background:#080909;border-top:1px solid rgba(255,255,255,.08)}.lp-footer-signature{margin:0;color:#d8d9d5;font-size:.86rem;font-weight:800}.lp-footer-signature em{color:#f3bd69;font-style:normal}.lp-footer-social{display:flex;align-items:center;flex-wrap:wrap;gap:16px}.lp-social{color:#d7d9d4;text-decoration:none;font-size:.77rem;font-weight:800}.lp-social:hover{color:var(--lp-orange)}.lp-delivery{font-size:.69rem;color:#92958f}
@media(max-width:900px){.lp-hero{min-height:auto;padding-top:80px;padding-bottom:75px}.lp-hero-grid{grid-template-columns:1fr;max-width:720px}.lp-hero-copy{max-width:680px}.lp-planner-preview{transform:none}.lp-about-grid,.lp-planner-layout,.lp-faq-layout{grid-template-columns:1fr;gap:30px}.lp-box-row{grid-template-columns:repeat(2,minmax(0,1fr))}.lp-box-tile:last-child{display:none}.lp-products{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:600px){.lp-section{padding:64px 20px}.lp-hero{padding:62px 20px 66px}.lp-hero-grid{gap:30px}.lp-headline{font-size:clamp(2.8rem,15vw,4.2rem)}.lp-planner-preview{padding:10px;border-radius:10px}.lp-preview-week{gap:4px}.lp-day{min-height:156px;padding:7px 3px}.lp-day-name{font-size:.49rem;letter-spacing:0}.lp-day-date{font-size:.48rem}.lp-event{font-size:.47rem;padding:6px 3px}.lp-preview-label{font-size:.55rem}.lp-scroll-cue{left:20px}.lp-about-grid{gap:24px}.lp-about-stats{gap:6px}.lp-stat{padding:13px 8px}.lp-stat strong{font-size:1.3rem}.lp-stat span{font-size:.61rem}.lp-slider{padding:60px 16px 65px}.lp-box-row{grid-template-columns:1fr}.lp-box-tile:nth-child(n+2){display:none}.lp-box-tile{min-height:164px;grid-template-columns:125px 1fr}.lp-tile-photo,.lp-slide-photo-fallback{height:120px}.lp-products-panel{padding:18px}.lp-products{grid-template-columns:repeat(2,minmax(0,1fr))}.lp-prices{grid-template-columns:1fr;gap:7px}.lp-price{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 12px}.lp-price strong{margin:0}.lp-steps{grid-template-columns:1fr;gap:10px}.lp-step{min-height:0;padding:16px}.lp-footer{align-items:flex-start;flex-direction:column;padding:27px 20px}.lp-footer-social{gap:14px}.lp-slider-controls{justify-content:space-between}}
@media(prefers-reduced-motion:reduce){.landing-root .reveal{opacity:1;transform:none;transition:none}.landing-root *{scroll-behavior:auto!important;transition-duration:.01ms!important}}
`;

function Landing({ onStart }) {
  const [slideIdx, setSlideIdx] = useState(0);
  const touchStartX = useRef(null);
  useReveal();
  useEffect(() => {
    if (typeof document === "undefined") return;
    const id = "ruvy-landing-fonts";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id; link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Anton&family=Montserrat:wght@400;600;700;800;900&display=swap";
    document.head.appendChild(link);
  }, []);
  const next = () => setSlideIdx((i) => (i + 1) % BOXES.length);
  const prev = () => setSlideIdx((i) => (i - 1 + BOXES.length) % BOXES.length);
  const goto = (i) => setSlideIdx(Math.max(0, Math.min(BOXES.length - 1, i)));
  useEffect(() => {
    function onKey(e) { if (e.key === "ArrowRight") next(); else if (e.key === "ArrowLeft") prev(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function onTouchStart(e) { touchStartX.current = e.touches[0].clientX; }
  function onTouchEnd(e) {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) { if (dx < 0) next(); else prev(); }
    touchStartX.current = null;
  }
  const slide = BOXES[slideIdx];
  const visibleBoxes = [-1, 0, 1].map((offset) => BOXES[(slideIdx + offset + BOXES.length) % BOXES.length]);
  return (
    <div className="landing-root">
      <style>{landingCss}</style>
      <section className="lp-hero">
        <div className="lp-hero-grid">
          <div className="lp-hero-copy reveal is-visible">
            <img src="/logo.png" alt="RUVY" className="lp-logo" onError={(e) => { e.currentTarget.style.display = "none"; }} />
            <h1 className="lp-headline">START YOUR <em>SPORT</em> RIGHT.</h1>
            <p className="lp-sub">Des Starter Packs pensés pour les vrais besoins des sportifs débutants et confirmés. Chaque box rassemble les accessoires essentiels pour démarrer ta discipline, bien équipé et bien organisé.</p>
            <div className="lp-actions">
              <button type="button" className="lp-btn lp-btn-primary" onClick={onStart}>Créer mon planning</button>
              <a className="lp-btn lp-btn-secondary" href={SHOPIFY_URL} target="_blank" rel="noopener noreferrer">Découvrir les boxes</a>
            </div>
          </div>
          <div className="lp-planner-preview reveal is-visible" aria-label="Aperçu du RUVY Planner">
            <div className="lp-preview-top"><span className="lp-preview-brand"><b>RUVY</b> PLANNER</span><span className="lp-preview-label">Ma semaine · exemple</span></div>
            <div className="lp-preview-week">
              {[["LUN","12",["Sport · 18h","Travail"]],["MAR","13",["Repos","Perso"]],["MER","14",["Sport · 19h","Récupération"]],["JEU","15",["Travail","Marche"]],["VEN","16",["Sport · 17h"]],["SAM","17",["Sortie","Temps libre"]],["DIM","18",["Repos","Préparer la semaine"]]].map(([day,date,events],i) => (
                <div className="lp-day" key={day}><div className="lp-day-name">{day}</div><div className="lp-day-date">{date}</div>{events.map((event,j)=><div key={event} className={'lp-event '+((j===0&&i%2===0)?'orange':(j===1?'muted':''))}>{event}</div>)}</div>
              ))}
            </div>
            <div className="lp-preview-foot"><span>Un rythme adapté à ta semaine</span><span className="lp-preview-pill">Sport · perso · pro</span></div>
          </div>
        </div>
        <div className="lp-scroll-cue">SCROLL ↓</div>
      </section>

      <section className="lp-section lp-about">
        <div className="lp-section-inner lp-about-grid">
          <div className="reveal">
            <span className="lp-eyebrow">QU'EST-CE QUE RUVY ?</span>
            <h2 className="lp-title">Une marque française.<br />Des Starter Packs sportifs.</h2>
            <p className="lp-text"><strong>RUVY</strong> est une jeune marque française spécialisée dans la création de <span className="lp-orange"> Starter Packs sportifs</span>, conçus pour accompagner les personnes qui débutent ou pratiquent une discipline sportive.</p>
            <p className="lp-text" style={{marginTop:12}}>Notre mission : <strong>rendre le sport plus accessible, pratique et organisé.</strong></p>
            <div className="lp-about-stats"><div className="lp-stat"><strong>4</strong><span>disciplines déjà intégrées</span></div><div className="lp-stat"><strong>1</strong><span>Planner pour s'organiser</span></div><div className="lp-stat"><strong>Tout âge</strong><span>débutant ou confirmé</span></div></div>
          </div>
          <div className="lp-about-card reveal"><h3>Une box = tout ce qu'il te faut.</h3><p>Chaque box rassemble des accessoires utiles : <strong>hygiène, confort, équipement, récupération, organisation</strong>. Tu reçois un kit prêt à l'emploi pour ta discipline.</p><p style={{marginTop:14}}><span className="lp-orange">RUVY ne propose pas simplement des accessoires.</span><br />Chaque box est pensée autour de véritables besoins, identifiés grâce aux expériences et aux retours des pratiquants.</p></div>
        </div>
      </section>

      <section className="lp-slider" style={{"--halo":slide.color}} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div className="lp-slider-heading reveal"><span className="lp-eyebrow">TROUVE TON DÉPART</span><h2>Les boxs RUVY</h2><p>Quatre disciplines, des essentiels pensés pour la pratique.</p></div>
        <div className="lp-box-row" aria-live="polite">
          {visibleBoxes.map((box,position)=><button key={box.id} type="button" className={'lp-box-tile '+(position===1?'active':'')} style={{"--tile-color":box.color}} onClick={()=>goto(BOXES.findIndex((b)=>b.id===box.id))} aria-pressed={position===1}>
            <BoxImage src={box.image} alt={box.name} color={box.color} />
            <span className="lp-tile-copy"><span className="lp-tile-index">BOX {BOXES.findIndex((b)=>b.id===box.id)+1} / 4</span><span className="lp-tile-title">{box.name}</span><span className="lp-tile-desc">{box.title}</span></span>
          </button>)}
        </div>
        <div className="lp-slider-controls"><div className="lp-slider-arrows"><button type="button" className="lp-slider-arrow" aria-label="Précédent" onClick={prev}>‹</button><button type="button" className="lp-slider-arrow" aria-label="Suivant" onClick={next}>›</button></div><div className="lp-slider-dots" role="tablist" aria-label="Position dans les boxs">{BOXES.map((b,i)=><button key={b.id} type="button" className={'lp-dot'+(i===slideIdx?' is-active':'')} aria-label={'Afficher '+b.name} aria-selected={i===slideIdx} onClick={()=>goto(i)} />)}</div><span className="lp-slider-position">{slideIdx+1} / {BOXES.length}</span></div>
        <div className="lp-products-panel reveal"><h3>{slide.name} — {slide.title}</h3><p>Une sélection d'essentiels pour ta pratique :</p><div className="lp-products">{slide.products.map((p)=><div key={p.name} className="lp-product"><span className="lp-product-name">{p.name}</span><span className="lp-product-desc">{p.desc}</span></div>)}</div></div>
        <p className="lp-coming-soon">D'autres disciplines arrivent bientôt.</p>
        <div className="lp-shop-link"><a className="lp-footer-link" href={SHOPIFY_URL} target="_blank" rel="noopener noreferrer">Voir toute la boutique</a></div>
      </section>

      <section className="lp-section lp-planner">
        <div className="lp-section-inner lp-planner-layout reveal">
          <div className="lp-planner-copy"><span className="lp-eyebrow">INCLUS AVEC TA BOX</span><h2 className="lp-title">RUVY Planner.</h2><p className="lp-text">L'outil parfait pour organiser ta vie sportive, professionnelle et personnelle — inclus avec chaque box RUVY. Scan, configure, et c'est parti.</p>
            <div className="lp-prices"><div className="lp-price"><span>Mensuel</span><strong>3,99 EUR/mois</strong></div><div className="lp-price"><span>Annuel</span><strong>29,99 EUR/an</strong></div><div className="lp-price"><span>One-Shot</span><strong>14,99 EUR</strong></div></div>
            <div className="lp-discount"><strong>Avec une box : -30% sur le Planner et les abonnements.</strong><br />Sans achat de box, les prix affichés sont les prix de base.</div>
            <div className="lp-planner-cta"><button type="button" className="lp-btn lp-btn-primary" onClick={onStart}>Créer mon planning</button></div>
          </div>
          <div><div className="lp-steps">
            <div className="lp-step"><span className="lp-step-num">01</span><h3 className="lp-step-title">Tu reçois ta box</h3><p className="lp-step-desc">Tous les accessoires essentiels pour démarrer ta discipline.</p></div>
            <div className="lp-step"><span className="lp-step-num">02</span><h3 className="lp-step-title">Tu scannes le QR code</h3><p className="lp-step-desc">À l'intérieur de ta box, un QR code te mène directement au Planner.</p></div>
            <div className="lp-step"><span className="lp-step-num">03</span><h3 className="lp-step-title">Tu crées ton planning</h3><p className="lp-step-desc">Personnalise ton organisation et démarre ta progression.</p></div>
          </div></div>
        </div>
      </section>

      <section className="lp-section lp-ambition"><div className="lp-ambition-inner reveal"><span className="lp-eyebrow">NOTRE AMBITION</span><h2 className="lp-title" style={{marginTop:12}}>Un écosystème sportif complet.</h2><p className="lp-text" style={{margin:'16px auto 0',textAlign:'center'}}>RUVY ambitionne de devenir un <strong>écosystème autour du sport</strong> : des Starter Packs adaptés à chaque discipline, et un planner intelligent pour suivre ta progression. Que tu sois <strong>débutant</strong> ou <strong>confirmé</strong>, RUVY t'accompagne à chaque étape.</p></div></section>

      <section className="lp-section lp-faq"><div className="lp-section-inner lp-faq-layout"><div className="reveal"><span className="lp-eyebrow">ON T'EXPLIQUE</span><h2 className="lp-title">Questions fréquentes.</h2><p className="lp-text">Les infos essentielles avant de te lancer, quel que soit ton âge ou ton niveau.</p></div><div className="lp-faq-list reveal">
        <details><summary>C'est quoi une box RUVY ?</summary><p>Un Starter Pack qui rassemble des accessoires utiles autour d'une discipline sportive pour démarrer ou pratiquer avec les essentiels à portée de main.</p></details>
        <details><summary>À quoi sert le QR code dans la box ?</summary><p>Il te donne accès au RUVY Planner pour organiser ta semaine et personnaliser ton planning sportif, personnel et professionnel.</p></details>
        <details><summary>Le Planner est-il payant ?</summary><p>Oui, le RUVY Planner est proposé en formule mensuelle, annuelle ou One-Shot. Les prix de base sont indiqués sur cette page.</p></details>
        <details><summary>Comment fonctionne la réduction de 30% ?</summary><p>L'achat d'une box RUVY donne droit à -30% sur le Planner et les abonnements. Sans achat de box, les prix de base s'appliquent.</p></details>
        <details><summary>Pour qui sont les boxs et le Planner ?</summary><p>Pour les sportifs de tout âge, débutants comme confirmés, qui souhaitent s'équiper et organiser leur pratique à leur rythme.</p></details>
      </div></div></section>

      <footer className="lp-footer"><p className="lp-footer-signature">RUVY — <em>Ton sport.</em> Ton Starter Pack. Ton départ.</p><div className="lp-footer-social"><span className="lp-delivery">Livraison des boxs · modalités et délais précisés sur la boutique</span><a className="lp-social" href="https://www.instagram.com/ruvy.fr/" target="_blank" rel="noopener noreferrer">Instagram · ruvy.fr</a><a className="lp-social" href="https://www.tiktok.com/@ruvy4511" target="_blank" rel="noopener noreferrer">TikTok · @ruvy4511</a><a className="lp-footer-link" href={SHOPIFY_URL} target="_blank" rel="noopener noreferrer">Visiter la boutique</a></div></footer>
    </div>
  );
}



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
const ACCESS_STORAGE_KEY = "ruvy-planner-access-v1";
const STRIPE_LINKS = {
  mensuel: "https://buy.stripe.com/REMPLACER_MENSUEL",
  annuel: "https://buy.stripe.com/test_eVq7sNb307nRbBs0Pu8IU00",
  oneshot: "https://buy.stripe.com/REMPLACER_ONESHOT",
};
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

// Les anciennes versions stockaient parfois une position libre sur les séances.
// On la retire à l’hydratation afin que la grille reste la seule source de placement.
function withoutEventCoordinates(result) {
  if (!result || !Array.isArray(result.plans)) return result;
  return {
    ...result,
    plans: result.plans.map((plan) => ({
      ...plan,
      events: Array.isArray(plan.events)
        ? plan.events.map((event) => {
            if (!event || typeof event !== "object") return event;
            const { x, y, ...scheduledEvent } = event;
            return scheduledEvent;
          })
        : plan.events,
    })),
  };
}

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
    saved.result = withoutEventCoordinates(saved.result);
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
  const [showLanding, setShowLanding] = useState(true);
  const [showPricing, setShowPricing] = useState(false);
  const [access, setAccess] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(ACCESS_STORAGE_KEY) || "null");
    } catch {
      return null;
    }
  });
  const [referralCode, setReferralCode] = useState("");
  const [referralMessage, setReferralMessage] = useState("");
  const [pricingNotice, setPricingNotice] = useState("");

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
  const [selectedSticker, setSelectedSticker] = useState(null);
  const stickerDragRef = useRef(null);
  const [atelierDayOrder, setAtelierDayOrder] = useState(DAYS);
  const atelierDayDragRef = useRef(null);
  const paintCanvasRef = useRef(null);
  const paintDrawingRef = useRef(false);
  const [exporting, setExporting] = useState(false);
  const [printPreview, setPrintPreview] = useState(false);
  const generationController = useRef(null);

  const [draft, setDraft] = useState({ title: "", days: [], start: "18:00", end: "19:00" });
  const [wantDraft, setWantDraft] = useState("");

  // édition d'un événement du résultat : { plan, index } ou null
  const [editing, setEditing] = useState(null);

  const exportRef = useRef(null);

  const person = people[active] || people[0];
  const progress = Math.round((Math.min(step, 2) / 2) * 100);

  const saveAccess = (record) => {
    try {
      localStorage.setItem(ACCESS_STORAGE_KEY, JSON.stringify(record));
      setAccess(record);
      return true;
    } catch {
      setError("Impossible d'enregistrer l'accès sur cet appareil. Vérifie les réglages de stockage du navigateur.");
      return false;
    }
  };

  const selectPlan = (plan) => {
    // Mémorise l’offre avant la redirection ; le paiement doit être confirmé côté serveur.
    if (!saveAccess({ unlocked: false, type: "plan", plan, status: "pending_payment", selectedAt: new Date().toISOString() })) return;
    window.location.href = STRIPE_LINKS[plan];
  };

  const applyReferralCode = (event) => {
    event.preventDefault();
    if (referralCode.trim().toUpperCase() !== "MIMIS100") {
      setReferralMessage("Code invalide. Vérifie le code et réessaie.");
      return;
    }
    const record = { unlocked: true, type: "referral", code: "MIMIS100", appliedAt: new Date().toISOString() };
    if (!saveAccess(record)) return;
    setReferralMessage("");
    setPricingNotice("Code MIMIS100 appliqué : ton accès gratuit est activé !");
    setShowPricing(false);
    setShowLanding(false);
    setStep(0);
    window.scrollTo(0, 0);
  };

  useEffect(() => {
    document.documentElement.classList.toggle("editor-active", !showLanding && step === 4);
    return () => document.documentElement.classList.remove("editor-active");
  }, [step, showLanding]);

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
    const controller = new AbortController();
    generationController.current = controller;
    try {
      const r = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ couple, people }),
        signal: controller.signal,
      });
      if (!r.ok) throw new Error("Erreur serveur");
      const data = await r.json();
      setResult(withoutEventCoordinates(data));
      setStep(4);
      setActive(0);
      setEditing(null);
      window.setTimeout(() => setCinematic(false), 6000);
    } catch (e) {
      if (e.name !== "AbortError") setError("Impossible de générer le planning. Réessaie dans un instant.");
    } finally {
      if (generationController.current === controller) generationController.current = null;
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

  const applyTheme = (theme) => {
    setPaintBackground(theme.bgColor);
    setStyle((prev) => ({
      ...prev,
      ...theme,
      ...(theme.theme === "aurora"
        ? { background: "", surfaceColor: "", surfaceBorder: "", softSurface: "", dayColor: "", blockColor: "" }
        : {}),
    }));
  };
  const goHome = () => {
    generationController.current?.abort();
    generationController.current = null;
    setLoading(false);
    setResult(null);
    setCinematic(false);
    setPrintPreview(false);
    setEditing(null);
    setActive(0);
    setStep(0);
    setShowLanding(true);
    document.documentElement.classList.remove("editor-active");
    delete document.documentElement.dataset.plannerTheme;
    window.scrollTo(0, 0);
  };
  const selectEditorTab = (tab) => { setEditorTab(tab); setPaintTool("move"); setSelectedSticker(null); };
  const selectPaintTool = (tool) => { setPaintTool(tool); setSelectedSticker(null); };
  const addSticker = (sticker) => setStyleKey({ stickers: [...(style.stickers || []), { emoji: sticker, x: 18 + ((style.stickers || []).length * 17) % 70, y: 16 + ((style.stickers || []).length * 23) % 65, size: 28, rotation: -8 }] });
  const updateSticker = (index, patch) => setStyleKey({ stickers: (style.stickers || []).map((s, i) => i === index ? { ...s, ...patch } : s) });
  const startStickerDrag = (e, index, resize = false) => {
    e.stopPropagation(); e.preventDefault();
    if (e.button != null && e.button !== 0) return;
    const frame = e.currentTarget.closest(".export-zone"); if (!frame) return;
    const stickerEl = e.currentTarget.closest(".floating-sticker");
    const rect = frame.getBoundingClientRect(); const sticker = style.stickers[index];
    const stickerRect = stickerEl?.getBoundingClientRect();
    const scaleX = rect.width / Math.max(1, frame.offsetWidth);
    const scaleY = rect.height / Math.max(1, frame.offsetHeight);
    stickerDragRef.current = {
      index, resize, frame, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, moved: false,
      offsetX: stickerRect ? (e.clientX - stickerRect.left) / scaleX : 0,
      offsetY: stickerRect ? (e.clientY - stickerRect.top) / scaleY : 0,
      startSize: sticker.size || 28, startXPos: sticker.x, startYPos: sticker.y,
      startStickerWidth: stickerRect ? stickerRect.width / scaleX : 0,
      startStickerHeight: stickerRect ? stickerRect.height / scaleY : 0,
    };
    setSelectedSticker(index); e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const moveSticker = (e) => {
    const drag = stickerDragRef.current; if (!drag || drag.pointerId !== e.pointerId) return;
    e.preventDefault();
    const dx = e.clientX - drag.startX, dy = e.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) <= 5) return;
    drag.moved = true;
    const rect = drag.frame.getBoundingClientRect();
    if (drag.resize) {
      const scaleX = rect.width / Math.max(1, drag.frame.offsetWidth);
      const scaleY = rect.height / Math.max(1, drag.frame.offsetHeight);
      updateSticker(drag.index, { size: Math.max(16, Math.min(140, drag.startSize + (dx / scaleX + dy / scaleY) / 2)) });
    } else {
      const scaleX = rect.width / Math.max(1, drag.frame.offsetWidth);
      const scaleY = rect.height / Math.max(1, drag.frame.offsetHeight);
      const width = drag.frame.clientWidth, height = drag.frame.clientHeight;
      const maxX = Math.max(0, width - drag.startStickerWidth);
      const maxY = Math.max(0, height - drag.startStickerHeight);
      const left = Math.max(0, Math.min(maxX, (e.clientX - rect.left) / scaleX - drag.frame.clientLeft + drag.frame.scrollLeft - drag.offsetX));
      const top = Math.max(0, Math.min(maxY, (e.clientY - rect.top) / scaleY - drag.frame.clientTop + drag.frame.scrollTop - drag.offsetY));
      updateSticker(drag.index, { x: Math.max(0, Math.min(100, left / width * 100)), y: Math.max(0, Math.min(100, top / height * 100)) });
    }
  };
  const endStickerDrag = (e) => {
    if (stickerDragRef.current && (e?.pointerId == null || stickerDragRef.current.pointerId === e.pointerId)) stickerDragRef.current = null;
  };
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
      else { setPaintBackground(paintColor); setStyleKey({ bgColor: paintColor, background: "", dayColor: paintColor }); }
      return;
    }
    beginPaint(e);
  };
  const endPaint = () => { paintDrawingRef.current = false; };
  const undoPaint = () => { const last = paintHistory.at(-1); if (!last) return; setPaintFuture(f => [...f, snapshotCanvas()]); setPaintHistory(h => h.slice(0,-1)); const c=paintCanvasRef.current; if(c){c.getContext("2d").clearRect(0,0,c.width,c.height); restoreCanvas(last);} };
  const redoPaint = () => { const next = paintFuture.at(-1); if (!next) return; setPaintHistory(h => [...h, snapshotCanvas()]); setPaintFuture(f => f.slice(0,-1)); const c=paintCanvasRef.current; if(c){c.getContext("2d").clearRect(0,0,c.width,c.height); restoreCanvas(next);} };
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
    return <div className="print-grid-wrap" data-planner-theme={style.theme || "aurora"} style={{ "--print-accent": style.accent, color: style.textColor || "#151515", background: style.background || style.bgColor }} aria-label="Grille imprimable du planning">
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
            onDragStart={(e) => { if (e.target.closest?.(".event")) { e.preventDefault(); return; } atelierDayDragRef.current = d; e.dataTransfer.effectAllowed = "move"; }}
            onDragOver={(e) => { if (paintTool === "move") e.preventDefault(); }}
            onDrop={(e) => {
              e.preventDefault();
              const from = atelierDayDragRef.current;
              if (paintTool === "move" && from && from !== d) setAtelierDayOrder(order => { const next=[...order]; const a=next.indexOf(from), b=next.indexOf(d); [next[a],next[b]]=[next[b],next[a]]; return next; });
              atelierDayDragRef.current = null;
            }}
            style={{ position: "relative", overflow: "hidden", backgroundColor: style.dayColor || style.bgColor, borderColor: style.surfaceBorder || undefined }}>
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
                    onClick={canEdit ? () => startEdit(e.owner, e.evIndex) : undefined}
                    onDoubleClick={() => paintTool === "bucket" && setStyleKey({ blockColor: paintColor })}
                    style={{
                      background: c.bg,
                      borderLeft: `3px solid ${warns.length ? "#dc2626" : c.border}`,
                      opacity: e.fixed ? 0.85 : 1,
                      userSelect: "none", WebkitUserSelect: "none",
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

  if (showLanding) {
    return <Landing onStart={() => {
      setShowLanding(false);
      if (access?.unlocked) {
        setStep(0);
      } else {
        setReferralMessage("");
        setShowPricing(true);
      }
      window.scrollTo(0, 0);
    }} />;
  }

  if (showPricing) {
    return (
      <main className="pricing-page">
        <style>{css}</style>
        <header className="pricing-header">
          <button type="button" className="pricing-back" onClick={() => { setShowPricing(false); setShowLanding(true); }}>← Retour</button>
          <p className="pricing-eyebrow">RUVY PLANNER · À TOI DE JOUER</p>
          <h1>Choisis ta formule</h1>
          <p className="pricing-intro">Un planning pensé pour trouver le bon rythme, à deux ou en solo.</p>
        </header>
        <section className="pricing-grid" aria-label="Formules RUVY Planner">
          <article className="pricing-card">
            <p className="pricing-kicker">LIBERTÉ</p>
            <h2>RUVY Planner - Mensuel</h2>
            <p className="pricing-price">3,99 <span>€/mois</span></p>
            <p className="pricing-detail">Facturé chaque mois</p>
            <button type="button" className="pricing-choose" onClick={() => selectPlan("mensuel")}>Choisir le mensuel <span>↗</span></button>
          </article>
          <article className="pricing-card pricing-card-featured">
            <span className="pricing-badge">LE PLUS AVANTAGEUX</span>
            <p className="pricing-kicker">MEILLEURE VALEUR</p>
            <h2>RUVY Planner - Annuel</h2>
            <p className="pricing-price">29,99 <span>€/an</span></p>
            <p className="pricing-detail">≈ 2,50 €/mois · Économise 17,89 € / an (≈ 37 %)</p>
            <button type="button" className="pricing-choose" onClick={() => selectPlan("annuel")}>Choisir l'annuel <span>↗</span></button>
          </article>
          <article className="pricing-card">
            <p className="pricing-kicker">SANS ABONNEMENT</p>
            <h2>RUVY Planner - One-Shot</h2>
            <p className="pricing-price">14,99 <span>€</span></p>
            <p className="pricing-detail">Paiement unique</p>
            <button type="button" className="pricing-choose" onClick={() => selectPlan("oneshot")}>Choisir le paiement unique <span>↗</span></button>
          </article>
        </section>
        <form className="referral-box" onSubmit={applyReferralCode}>
          <label htmlFor="ruvy-referral">Tu as un code de parrainage ?</label>
          <p>Entre-le ici pour débloquer ton accès.</p>
          <div className="referral-row">
            <input id="ruvy-referral" className="input" value={referralCode} onChange={(event) => { setReferralCode(event.target.value); setReferralMessage(""); }} placeholder="Code de parrainage" autoComplete="off" />
            <button type="submit" className="pricing-redeem">Appliquer</button>
          </div>
          {referralMessage && <p className="referral-error" role="alert">{referralMessage}</p>}
        </form>
        <p className="pricing-footnote">Paiement sécurisé par Stripe · Accès à ton planning après sélection.</p>
      </main>
    );
  }

  return (
    <div className="app">
      <style>{css}</style>

      {pricingNotice && <div className="access-success" role="status">✓ {pricingNotice}<button type="button" aria-label="Fermer" onClick={() => setPricingNotice("")}>×</button></div>}
      {cinematic && (
        <div className="cinematic no-print" role="status" aria-live="polite">
          <button type="button" className="btn ghost cinematic-home" onClick={goHome}>← Retour à l'accueil</button>
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
          <div className="profile-heading">
            <h2>Pour qui est ce planning ?</h2>
            <button type="button" className="btn ghost home-button" onClick={goHome}>← Retour à l'accueil</button>
          </div>
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
                <div className="color-grid"><label className="field">Fond<input type="color" className="color" value={style.bgColor} onChange={(e) => setStyleKey({ bgColor: e.target.value, background: "", dayColor: e.target.value })} /></label><label className="field">Accent<input type="color" className="color" value={style.accent} onChange={(e) => setStyleKey({ accent: e.target.value })} /></label><label className="field">Texte<input type="color" className="color" value={style.textColor || "#151515"} onChange={(e) => setStyleKey({ textColor: e.target.value })} /></label></div>
                <div><label className="label">Thèmes prêts à l'emploi</label><div className="theme-row"><button className="theme theme-aurora" aria-pressed={style.theme === "aurora"} onClick={() => applyTheme({ theme: "aurora", bgColor: "#101026", accent: "#a78bfa", textColor: "#f5f3ff" })}>Aurora</button><button className="theme theme-sunset" aria-pressed={style.theme === "sunset"} onClick={() => applyTheme({ theme: "sunset", bgColor: "#fff1e6", background: "linear-gradient(135deg, #fff7ed 0%, #ffe2c5 55%, #f8c9ac 100%)", accent: "#b64018", textColor: "#382219", blockColor: "#f8d6bd", dayColor: "rgba(255,250,246,.88)", surfaceColor: "#fffaf6", surfaceBorder: "#f1c5a7", softSurface: "#ffefe2" })}>Sunset</button><button className="theme theme-forest" aria-pressed={style.theme === "forest"} onClick={() => applyTheme({ theme: "forest", bgColor: "#e7f3e9", background: "linear-gradient(135deg, #eff8ef 0%, #d9eedc 52%, #c5e3cc 100%)", accent: "#176b45", textColor: "#153b2a", blockColor: "#d4ead8", dayColor: "rgba(247,255,248,.9)", surfaceColor: "#f8fff9", surfaceBorder: "#b8d8c3", softSurface: "#eaf6ec" })}>Forêt</button></div></div>
                <label className="label">Arrière-plan <input type="file" accept="image/*" onChange={onBgImage} /></label>{style.bgImage && <><button className="link" onClick={() => setStyleKey({ bgImage: "" })}>Retirer l'image</button><label className="field slider">Transparence : {Math.round(style.bgOpacity * 100)} %<input type="range" min="0" max="1" step="0.05" value={style.bgOpacity} onChange={(e) => setStyleKey({ bgOpacity: Number(e.target.value) })} /></label></>}
              </div>}
              {editorTab === "paint" && <div className="control-grid"><p className="hint">Dessine directement sur le planning. Le pot colore la zone ciblée, la pipette reprend une couleur, et les personnalisations restent en mémoire uniquement pendant cette session.</p><div className="paint-tools"><button className={paintTool === "move" ? "paint-tool active" : "paint-tool"} onClick={() => selectPaintTool("move")}>↖<small>Clic normal</small></button>{[["pen","✎","Stylo"],["bucket","▧","Pot"],["eraser","⌫","Gomme"],["picker","⌾","Pipette"],["marker","▰","Surligneur"]].map(([id,icon,label]) => <button key={id} className={paintTool===id ? "paint-tool active" : "paint-tool"} onClick={() => selectPaintTool(id)}>{icon}<small>{label}</small></button>)}</div><label className="label">Épaisseur : {paintSize}px<input type="range" min="2" max="32" value={paintSize} onChange={(e) => setPaintSize(Number(e.target.value))} /></label><label className="label">Couleur<input type="color" className="color" value={paintColor} onChange={(e) => setPaintColor(e.target.value)} /></label><div className="paint-actions"><button className="theme" onClick={undoPaint}>↶ Annuler</button><button className="theme" onClick={redoPaint}>↷ Rétablir</button></div><label className="label">Fond du planning<select className="input" value={paintBackground} onChange={(e) => { setPaintBackground(e.target.value); setStyleKey({ bgColor: e.target.value, background: "", dayColor: e.target.value }); }}><option value="#18132c">Violet profond</option><option value="#25143d">Prune</option><option value="#172554">Bleu nuit</option><option value="#1f2937">Ardoise</option></select></label></div>}
              {editorTab === "stickers" && <div className="control-grid"><p className="hint">Choisis un signe distinctif, puis ajoute des images par jour comme arrière-plan ou logo.</p><div className="sticker-palette">{["🔥","⚡","🏋️","🥊","🏃","🧘","🚴","🏆","💪","🌙"].map((x) => <button key={x} className="sticker-btn" onClick={() => addSticker(x)}>{x}</button>)}</div><label className="label">Images / logos par jour</label><div className="day-images">{DAYS.map((d) => <div key={d} className="day-image-row"><span>{SHORT[d]}</span><input type="file" accept="image/*" onChange={(e) => onDayImage(d, e)} />{style.dayImages[d] && <img src={style.dayImages[d]} alt={`Miniature ${SHORT[d]}`} />}{style.dayImages[d] && <button className="link" onClick={() => removeDayImage(d)}>Retirer</button>}</div>)}</div>{Object.keys(style.dayImages).length > 0 && <label className="field slider">Transparence : {Math.round(style.dayImageOpacity * 100)} %<input type="range" min="0" max="1" step="0.05" value={style.dayImageOpacity} onChange={(e) => setStyleKey({ dayImageOpacity: Number(e.target.value) })} /></label>}<div className="sticker-list">{(style.stickers || []).map((s, i) => <button key={i} className="sticker-chip" onClick={() => removeSticker(i)}>{s.emoji} <small>retirer</small></button>)}</div></div>}
              {editorTab === "edit" && <div className="control-grid"><p className="hint">Clique sur une séance ajoutée dans le planning pour modifier son jour, ses horaires ou la supprimer.</p>{renderEditor()}<p className="warn-text editor-warning">⚠ Les séances ajoutées peuvent être décalées de 30 minutes maximum. Les avertissements restent sans blocage.</p></div>}
            </section>
          </div>

          {/* Planning (zone exportée) */}
          <section className="card plan-card">
            <div
              ref={exportRef}
              className="export-zone"
              data-planner-theme={style.theme || "aurora"}
              style={{ "--atelier-event-bg": style.blockColor || "transparent", background: style.background || style.bgColor, color: style.textColor || "#151515", borderColor: style.accent, position: "relative", overflow: "hidden" }}
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
          <div className="print-preview-modal"><button className="btn ghost print-preview-home" onClick={goHome}>← Retour à l'accueil</button><button className="btn ghost print-preview-close" onClick={() => setPrintPreview(false)}>Fermer</button>{renderPrintGrid()}</div>
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
.editor-sidebar { display: flex; flex-direction: column; }.editor-brand { display:flex; gap:10px; align-items:center; margin-bottom: 28px; }.editor-brand > span { display:grid; place-items:center; width:34px; height:34px; border-radius:11px; background:linear-gradient(135deg,#c084fc,#7c3aed); box-shadow:0 0 20px #7c3aed; }.editor-brand strong,.editor-brand small { display:block; }.editor-brand small { color:#aaa3c9; font-size:10px; margin-top:3px; }.editor-tabs { display:flex; flex-direction:column; gap:6px; }.editor-tab { border:0; background:transparent; color:#aaa3c9; text-align:left; padding:12px 10px; border-radius:12px; font:inherit; cursor:pointer; display:flex; gap:10px; align-items:center; }.editor-tab.active { color:#fff; background:rgba(167,139,250,.18); box-shadow:inset 3px 0 #c084fc; }.editor-panel { min-width:0; background:rgba(255,255,255,.055); border:1px solid rgba(255,255,255,.1); border-radius:18px; padding:22px; }.editor-panel-head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:20px; }.editor-panel h2 { color:#fff; margin:5px 0 0; }.eyebrow { color:#c084fc; font-size:10px; font-weight:700; letter-spacing:.16em; }.editor-status { color:#86efac; font-size:11px; }.control-grid { display:grid; gap:16px; }.editor-panel .label { color:#dcd6f2; }.editor-panel .input,.editor-panel .color { background:rgba(8,6,20,.45); border-color:#493c6b; color:#fff; }.editor-panel .hint { color:#b9b1d0; }.color-grid { display:flex; gap:24px; }.theme-row { display:flex; gap:8px; flex-wrap:wrap; }.theme { border:1px solid #5b4a83; color:#fff; border-radius:10px; padding:10px 14px; cursor:pointer; background:#26203d; }.theme-aurora { background:linear-gradient(135deg,#16122e,#6d28d9); }.theme-sunset { background:linear-gradient(135deg,#7c2d12,#fb923c); }.theme-forest { background:linear-gradient(135deg,#14532d,#65a30d); }.sticker-palette { display:flex; flex-wrap:wrap; gap:8px; }.sticker-btn { border:1px solid #58477c; background:#211a3a; border-radius:12px; font-size:24px; width:46px; height:46px; cursor:pointer; transition:transform .15s; }.sticker-btn:hover { transform:translateY(-3px) rotate(-4deg); }.sticker-list { display:flex; gap:8px; flex-wrap:wrap; }.sticker-chip { border:1px solid #66538d; background:#2a2147; color:#fff; border-radius:99px; padding:6px 10px; cursor:pointer; }.sticker-chip small { color:#b8add4; }.editor-warning { color:#ff7b87 !important; border-left:2px solid #ef4444; padding-left:10px; }.floating-sticker { position:absolute; z-index:12; pointer-events:auto; cursor:move; user-select:none; font-size:28px; filter:drop-shadow(0 4px 8px rgba(0,0,0,.18)); transform:rotate(-8deg); outline:none; }.floating-sticker:focus, .floating-sticker:focus-visible, .floating-sticker.selected { outline:none; }.sticker-resize { position:absolute; right:-5px; bottom:-5px; width:7px; height:7px; border-radius:50%; border:1px solid rgba(255,255,255,.9); background:rgba(192,132,252,.75); box-shadow:0 1px 3px rgba(0,0,0,.25); cursor:nwse-resize; }.sticker-delete { position:absolute; top:-12px; right:-12px; border:0; border-radius:50%; width:20px; height:20px; background:#dc2626; color:white; cursor:pointer; line-height:18px; }.event-reveal { animation: eventReveal .55s cubic-bezier(.2,.8,.2,1) both; }
@keyframes spin { to { transform:rotate(360deg); } } @keyframes orbitPulse { 50% { transform:scale(1.05); box-shadow:0 0 55px #a78bfa, inset 0 0 36px rgba(139,92,246,.7); } } @keyframes coreGlow { to { transform:scale(1.14) rotate(8deg); } } @keyframes fillCine { to { width:100%; } } @keyframes cineText { 0%,18% { opacity:0; transform:translateY(10px); } 24%,44% { opacity:1; transform:translateY(0); } 52%,100% { opacity:0; transform:translateY(-10px); } } @keyframes eventReveal { from { opacity:0; transform:scale(.84) translateY(8px); } to { opacity:1; transform:scale(1) translateY(0); } }
@media (max-width: 680px) { .editor-layout { display:block; padding:12px; }.editor-sidebar { display:block; }.editor-brand { margin:4px 4px 12px; }.editor-tabs { flex-direction:row; gap:4px; }.editor-tab { flex:1; justify-content:center; padding:10px 4px; font-size:12px; }.editor-tab span { display:none; }.editor-panel { margin-top:10px; padding:16px; }.editor-panel-head { margin-bottom:14px; }.color-grid { gap:14px; }.app { padding:26px 12px 54px; } }
/* Mode éditeur : atelier + aperçu côte à côte, sans surface blanche. */
html.editor-active, html.editor-active body { background:#f7f7f5; color:#151515; }
.editor-workspace { display:grid; grid-template-columns:190px minmax(280px,1fr) minmax(390px,1.35fr); gap:20px; align-items:start; }
.editor-workspace .editor-layout { display:contents; }
.editor-workspace .editor-sidebar { grid-column:1; position:sticky; top:20px; padding:18px 0; }
.editor-workspace .editor-panel { grid-column:2; position:sticky; top:20px; }
.editor-workspace .plan-card { grid-column:3; position:sticky; top:20px; margin:0; background:#141026; border-color:#30234d; color:#eee9ff; }
.editor-workspace .plan-card .export-zone { background:transparent; }
.editor-workspace .plan-card .day { background:#211a38; border-color:#40335f; }
.editor-workspace .plan-card .day h3, .editor-workspace .plan-card .legend-item { color:#eee9ff; }
.editor-workspace .plan-card .event { background:var(--atelier-event-bg, #f5f0ff); color:#151515; }
.editor-workspace .plan-card .event strong, .editor-workspace .plan-card .event span { color:#151515; }

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
  body, .app { background:#fff !important; color:#151515 !important; }
  .editor-layout, .no-print, .plan-card > .editor, .plan-card > .hint, .print-grid-wrap { display:none !important; }
  .app { width:100%; max-width:none; margin:0; padding:0; }
  .editor-workspace { display:block !important; width:100%; max-width:none; margin:0; }
  .editor-workspace .plan-card { display:block !important; width:100%; margin:0; padding:0; border:0; box-shadow:none; background:transparent; color:inherit; }
  .plan-card .export-zone { display:block !important; position:relative !important; width:100%; overflow:visible !important; border:1px solid currentColor; break-inside:avoid; page-break-inside:avoid; print-color-adjust:exact !important; -webkit-print-color-adjust:exact !important; }
  .plan-card .export-zone, .plan-card .export-zone * { print-color-adjust:exact !important; -webkit-print-color-adjust:exact !important; }
  .plan-card .week-frame { display:block !important; width:100%; overflow:visible; }
  .plan-card .week-frame .week { display:grid !important; grid-template-columns:repeat(7,minmax(0,1fr)) !important; gap:4px; width:100%; }
  .plan-card .week-frame .day { min-width:0; min-height:0; padding:6px 4px; break-inside:avoid; page-break-inside:avoid; }
  .plan-card .week-frame .day, .plan-card .week-frame .day * { white-space:nowrap; }
  .plan-card .week-frame .event { font-size:8px; padding:4px 3px; margin-bottom:3px; }
  .plan-card .week-frame .event strong, .plan-card .week-frame .event span { font-size:8px; }
  .plan-card .paint-canvas { display:block !important; visibility:visible !important; }
  .plan-card .export-zone img, .plan-card .export-zone canvas { print-color-adjust:exact !important; -webkit-print-color-adjust:exact !important; }
  .plan-card .export-zone .sticker-resize, .plan-card .export-zone .sticker-delete { display:none !important; }
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
.week-frame .day { min-width:0; min-height:145px; user-select:none; }
.paint-canvas { user-select:none; -webkit-user-select:none; touch-action:none; }
@media (max-width:680px) { .week-frame .week { grid-template-columns:repeat(2,minmax(0,1fr)); } }

/* Retour à l'accueil, au niveau de l'en-tête de l'étape Profil. */
.profile-heading { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; margin-bottom:24px; }
.profile-heading h2 { margin:0; }
.home-button { min-height:44px; flex:0 0 auto; }

/* Couleurs du thème limitées au contenu du planning, jamais aux commandes de l'atelier. */
.export-zone[data-planner-theme="sunset"] .rest { color:#60321f; background:#ffe7d5; border-color:#edc09e; }
.export-zone[data-planner-theme="forest"] .rest { color:#205239; background:#e0f1e3; border-color:#afd1b8; }
.export-zone[data-planner-theme="sunset"] .badge-ia { color:#7c2d12; background:#ffead9; }
.export-zone[data-planner-theme="forest"] .badge-ia { color:#155b3a; background:#e0f2e4; }
.export-zone[data-planner-theme="sunset"] .list li, .export-zone[data-planner-theme="sunset"] .want-card { background:#fff4eb; border-color:#f1c5a7; }
.export-zone[data-planner-theme="forest"] .list li, .export-zone[data-planner-theme="forest"] .want-card { background:#eff8f0; border-color:#b8d8c3; }
.export-zone[data-planner-theme="sunset"] .list li, .export-zone[data-planner-theme="sunset"] .event strong, .export-zone[data-planner-theme="sunset"] .event span { color:#382219; }
.export-zone[data-planner-theme="forest"] .list li, .export-zone[data-planner-theme="forest"] .event strong, .export-zone[data-planner-theme="forest"] .event span { color:#153b2a; }
.export-zone[data-planner-theme="sunset"] .list small { color:#70574a; }
.export-zone[data-planner-theme="forest"] .list small { color:#496b57; }
.export-zone[data-planner-theme="aurora"] .event strong,
.export-zone[data-planner-theme="aurora"] .event span { color:#201a32 !important; }

/* Les thèmes colorent le planning imprimable/aperçu, jamais la page globale. */
.print-grid-wrap[data-planner-theme="sunset"] { --print-accent:#b64018; color:#382219; background:#fffaf6; }
.print-grid-wrap[data-planner-theme="sunset"] .print-grid th,
.print-grid-wrap[data-planner-theme="sunset"] .print-grid td { color:#382219; }
.print-grid-wrap[data-planner-theme="sunset"] .print-rest { color:#70574a; }
.print-grid-wrap[data-planner-theme="forest"] { --print-accent:#176b45; color:#153b2a; background:#f8fff9; }
.print-grid-wrap[data-planner-theme="forest"] .print-grid th,
.print-grid-wrap[data-planner-theme="forest"] .print-grid td { color:#153b2a; }
.print-grid-wrap[data-planner-theme="forest"] .print-rest { color:#496b57; }
.cinematic-home { position:fixed; z-index:2; top:max(16px,env(safe-area-inset-top)); left:max(16px,env(safe-area-inset-left)); min-height:44px; }
.print-preview-home { position:absolute; top:12px; left:12px; z-index:1; min-height:44px; }
@media (max-width:680px) { .profile-heading { align-items:stretch; flex-direction:column; } .home-button { width:100%; min-height:46px; } .print-preview-modal { padding:72px 14px 20px; } .print-preview-home { top:14px; left:14px; } .print-preview-close { top:14px; right:14px; } }


/* Ajustements ciblés de la mise en page de l’Atelier uniquement. */
html.editor-active .app {
  width: 100%;
  max-width: none;
  margin: 0 auto;
  padding: 32px clamp(16px, 2.4vw, 36px) 64px;
  box-sizing: border-box;
}
.editor-workspace {
  width: 100%;
  max-width: 1500px;
  margin: 0 auto;
  grid-template-columns: 220px minmax(320px, .9fr) minmax(440px, 1.2fr);
  gap: 18px;
  align-items: start;
}
.editor-workspace .editor-sidebar,
.editor-workspace .editor-panel,
.editor-workspace .plan-card {
  position: static;
  min-width: 0;
  align-self: start;
}
.editor-workspace .editor-sidebar {
  padding: 16px 12px;
  border-radius: 18px;
}
.editor-brand { gap: 10px; align-items: center; margin: 0 0 22px; }
.editor-brand > span { flex: 0 0 34px; }
.editor-brand > div { min-width: 0; }
.editor-brand strong { line-height: 1.2; }
.editor-brand small { line-height: 1.25; margin-top: 4px; }
.editor-tabs { min-width: 0; }
.editor-tab { min-width: 0; gap: 8px; padding: 11px 8px; font-size: 13px; }
.editor-tab > span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.editor-workspace .editor-sidebar .editor-tab:not(.active) { color: rgba(255,255,255,.78); }
.editor-workspace .editor-sidebar .editor-tab:not(.active):hover {
  color: #fff;
  background: rgba(255,255,255,.12);
}
.editor-workspace .editor-panel { padding: 20px; }
.editor-workspace .editor-panel .control-grid { min-width: 0; }
.editor-workspace .editor-panel .label { min-width: 0; }
.editor-workspace .editor-panel .input,
.editor-workspace .editor-panel input[type="file"] {
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  min-width: 0;
}
.editor-workspace .editor-panel input[type="file"] {
  padding: 6px;
  font-size: 12px;
}
.editor-workspace .editor-panel input[type="file"]::file-selector-button {
  max-width: 100%;
  margin-right: 6px;
  padding: 6px 9px;
  font-size: 12px;
}
.editor-workspace .plan-card { margin: 0; }
@media (max-width: 1050px) and (min-width: 761px) {
  .editor-workspace { grid-template-columns: 190px minmax(270px, .9fr) minmax(340px, 1.1fr); gap: 14px; }
  .editor-workspace .editor-panel { padding: 16px; }
}
@media (max-width: 760px) {
  html.editor-active .app { padding: 26px 12px 54px; }
  .editor-workspace { display: block; }
  .editor-workspace .editor-sidebar,
  .editor-workspace .editor-panel,
  .editor-workspace .plan-card { position: static; }
  .editor-workspace .editor-sidebar { margin-bottom: 10px; }
  .editor-workspace .editor-layout { display: block; }
  .editor-workspace .plan-card { margin-top: 14px; }
  .editor-tab { font-size: 12px; }
}

/* Palette fixe de l’Atelier — portée uniquement par la vue personnalisateur. */
html.editor-active, html.editor-active body {
  background: #0F172A !important;
  color: #F1F5F9;
}
html.editor-active .app {
  padding: 0;
  background: #0F172A;
  color: #F1F5F9;
}
.editor-workspace {
  box-sizing: border-box;
  width: 100%;
  max-width: none;
  min-height: 100vh;
  margin: 0;
  padding: 32px clamp(16px, 2.4vw, 36px) 48px;
  border-radius: 0;
  background: #0F172A;
  color: #F1F5F9;
}
.editor-workspace .editor-sidebar {
  box-sizing: border-box;
  background: #1E293B;
  border: 1px solid #334155;
}
.editor-workspace .editor-brand strong,
.editor-workspace .editor-panel h2,
.editor-workspace .editor-panel .label,
.editor-workspace .editor-panel .field,
.editor-workspace .editor-panel .field label {
  color: #F1F5F9;
}
.editor-workspace .editor-brand small,
.editor-workspace .editor-panel .hint,
.editor-workspace .editor-panel .eyebrow,
.editor-workspace .editor-panel .editor-status,
.editor-workspace .editor-panel .label em,
.editor-workspace .editor-sidebar .editor-tab:not(.active) {
  color: #94A3B8;
}
.editor-workspace .editor-sidebar .editor-tab.active {
  color: #fff;
  background: rgba(139, 92, 246, 0.18);
  box-shadow: inset 3px 0 #8B5CF6;
}
.editor-workspace .editor-sidebar .editor-tab:not(.active):hover {
  color: #F1F5F9;
  background: rgba(148, 163, 184, 0.10);
}
.editor-workspace .editor-panel {
  background: #1E293B;
  border: 1px solid #334155;
  color: #F1F5F9;
}
.editor-workspace .editor-panel .input,
.editor-workspace .editor-panel input[type="file"] {
  background: #0F172A;
  border-color: #334155;
  color: #F1F5F9;
}
.editor-workspace .editor-panel .input:focus {
  border-color: #8B5CF6;
  box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.2);
}
.editor-workspace .editor-panel .color {
  background: #0F172A;
  border-color: #334155;
}
.editor-workspace .editor-panel input[type="file"]::file-selector-button {
  background: #8B5CF6;
  color: #fff;
}
.editor-workspace .plan-card {
  background: #0F172A;
  border-color: #334155;
  color: #F1F5F9;
}
@media (max-width: 760px) {
  .editor-workspace {
    min-height: 100vh;
    padding: 22px 12px 40px;
    border-radius: 0;
  }
}
@media print {
  html.editor-active, html.editor-active body {
    background: #fff !important;
    color: #151515 !important;
  }
  html.editor-active .app,
  .editor-workspace {
    background: transparent !important;
  }
  .editor-workspace .editor-sidebar,
  .editor-workspace .editor-panel {
    display: none !important;
  }
  .editor-workspace .plan-card {
    background: transparent !important;
    border-color: transparent !important;
    color: inherit !important;
  }
}




/* RUVY Planner — parcours de choix tarifaire */
.pricing-page { min-height:100vh; max-width:none; margin:0; padding:clamp(28px,6vw,76px) 24px 44px; color:#f4f1ed; background:#111; font-family:Montserrat, Inter, system-ui, sans-serif; }
.pricing-page * { box-sizing:border-box; }
.pricing-header { max-width:1060px; margin:0 auto 38px; position:relative; text-align:center; }
.pricing-back { position:absolute; left:0; top:0; padding:10px 14px; border:1px solid #484848; border-radius:999px; background:transparent; color:#ddd; font:600 13px Montserrat,system-ui,sans-serif; cursor:pointer; }
.pricing-back:hover { border-color:#f37021; color:#fff; }
.pricing-eyebrow,.pricing-kicker { color:#f37021; font-size:11px; font-weight:800; letter-spacing:.18em; }
.pricing-eyebrow { margin:20px 0 12px; }
.pricing-header h1 { margin:0; color:#fff; font-family:Anton, Impact, sans-serif; font-size:clamp(42px,7vw,76px); font-weight:400; letter-spacing:.025em; line-height:1; }
.pricing-intro { color:#aaa; font-size:15px; margin:14px 0 0; }
.pricing-grid { max-width:1060px; margin:0 auto; display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); align-items:stretch; gap:16px; }
.pricing-card { position:relative; display:flex; flex-direction:column; padding:28px 24px 24px; min-height:270px; background:#1b1b1b; border:1px solid #373737; border-radius:18px; }
.pricing-card-featured { border:2px solid #f37021; background:linear-gradient(155deg,#25201c,#191919 64%); box-shadow:0 14px 55px rgba(243,112,33,.13); transform:translateY(-7px); }
.pricing-badge { position:absolute; right:16px; top:16px; padding:6px 9px; color:#141414; background:#f37021; border-radius:999px; font-size:9px; font-weight:900; letter-spacing:.08em; }
.pricing-kicker { margin:0 0 12px; }
.pricing-card h2 { min-height:48px; margin:0; color:#fff; font-size:18px; line-height:1.35; }
.pricing-price { color:#fff; margin:24px 0 0; font-size:42px; line-height:1; font-weight:800; letter-spacing:-.05em; }
.pricing-price span { color:#aaa; font-size:15px; font-weight:600; letter-spacing:0; }
.pricing-detail { min-height:40px; margin:10px 0 22px; color:#aaa; font-size:12px; line-height:1.6; }
.pricing-choose,.pricing-redeem { width:100%; min-height:48px; padding:12px 14px; border:1px solid #f37021; border-radius:10px; background:#f37021; color:#111; font:800 14px Montserrat,system-ui,sans-serif; cursor:pointer; transition:transform .15s,background .15s; }
.pricing-choose { margin-top:auto; display:flex; align-items:center; justify-content:space-between; }
.pricing-choose:hover,.pricing-redeem:hover { background:#ff873d; transform:translateY(-1px); }
.pricing-card:not(.pricing-card-featured) .pricing-choose { background:transparent; color:#f4f1ed; border-color:#555; }
.pricing-card:not(.pricing-card-featured) .pricing-choose:hover { border-color:#f37021; color:#fff; }
.referral-box { max-width:650px; margin:34px auto 0; padding:22px 24px; border:1px solid #373737; border-radius:16px; background:#191919; }
.referral-box label { display:block; color:#fff; font-size:15px; font-weight:800; }
.referral-box > p { margin:6px 0 14px; color:#aaa; font-size:13px; }
.referral-row { display:flex; gap:10px; }
.referral-row .input { flex:1; min-width:0; background:#111; border-color:#484848; color:#fff; }
.referral-row .input:focus { border-color:#f37021; box-shadow:0 0 0 3px rgba(243,112,33,.14); }
.pricing-redeem { width:auto; min-width:130px; }
.referral-error { color:#ff7777 !important; font-weight:700; }
.pricing-footnote { margin:18px 0 0; text-align:center; color:#777; font-size:11px; }
.access-success { position:relative; display:flex; align-items:center; justify-content:space-between; gap:14px; margin:0 auto 18px; max-width:820px; padding:13px 16px; border:1px solid #83c99c; border-radius:12px; background:#eaf7ee; color:#14532d; font-weight:700; }
.access-success button { border:0; background:transparent; color:inherit; font-size:22px; cursor:pointer; }
@media(max-width:760px) { .pricing-page { padding:24px 14px 36px; }.pricing-header { padding-top:36px; }.pricing-back { top:0; }.pricing-grid { grid-template-columns:1fr; gap:12px; }.pricing-card { min-height:0; }.pricing-card-featured { transform:none; order:-1; }.pricing-card h2,.pricing-detail { min-height:0; }.pricing-choose { margin-top:8px; }.referral-box { padding:18px; } }
@media(max-width:420px) { .referral-row { flex-direction:column; }.pricing-redeem { width:100%; } }
`;