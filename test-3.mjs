import { chromium } from "playwright";

const URL = "http://localhost:5173";

const PROFILS = [
  { nom: "Debutant solo", niveau: "Débutant",
    fixes: [{ titre: "Travail", jours: ["Lun","Mar","Mer","Jeu","Ven"], de: "09:00", a: "17:00" }],
    voeux: [{ titre: "Course", seances: 3 }, { titre: "Yoga", seances: 2 }] },
  { nom: "Avance chargé", niveau: "Avancé",
    fixes: [{ titre: "Cours", jours: ["Lun","Mer","Ven"], de: "08:00", a: "18:00" },
            { titre: "MMA", jours: ["Mar","Jeu"], de: "19:00", a: "20:30" }],
    voeux: [{ titre: "Musculation", seances: 4 }] },
  { nom: "Inter minimal", niveau: "Intermédiaire",
    fixes: [],
    voeux: [{ titre: "Boxe", seances: 1 }] },
];

const browser = await chromium.launch({ headless: true });

for (const p of PROFILS) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const erreurs = [];
  page.on("pageerror", (e) => erreurs.push(e.message));
  page.on("console", (m) => m.type() === "error" && erreurs.push(m.text()));

  await page.goto(URL);

  // Page d'accueil -> entrer dans l'assistant
  const entree = page.getByRole("button", { name: /commencer|créer|planning|démarrer/i }).first();
  if (await entree.count()) await entree.click();

  // Étape 0
  await page.getByText(p.niveau, { exact: true }).click();
  await page.getByRole("button", { name: "Suivant" }).click();

  // Étape 1
  for (const f of p.fixes) {
    await page.getByPlaceholder(/MMA, Travail/).fill(f.titre);
    for (const j of f.jours) await page.locator(".chips").first().getByText(j, { exact: true }).click();
    await page.locator('input[type="time"]').nth(0).fill(f.de);
    await page.locator('input[type="time"]').nth(1).fill(f.a);
    await page.getByRole("button", { name: "Ajouter" }).click();
  }
  await page.getByRole("button", { name: "Suivant" }).click();

  // Étape 2
  for (const v of p.voeux) {
    await page.getByPlaceholder(/Boxe, Yoga/).fill(v.titre);
    await page.getByRole("button", { name: "Ajouter" }).click();
    const carte = page.locator(".want-card").filter({ hasText: v.titre }).first();
    await carte.locator(".chips").first().getByText(String(v.seances), { exact: true }).click();
  }

  const debut = Date.now();
  await page.getByRole("button", { name: "Générer le planning" }).click();
  await page.waitForSelector(".editor-hidden, .no-print", { timeout: 90000 });
  await page.waitForFunction(() => !document.body.innerText.includes("Génération..."), { timeout: 90000 });
  const duree = ((Date.now() - debut) / 1000).toFixed(1);

  const echec = await page.getByText("Impossible de générer").count();
  const debordement = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  await page.screenshot({ path: `resultat-${p.nom.replace(/ /g, "_")}.png`, fullPage: true });

  console.log(`${p.nom}: ${duree}s | échec=${echec > 0} | débordement=${debordement} | erreurs JS=${erreurs.length}`);
  await page.close();
}

await browser.close();