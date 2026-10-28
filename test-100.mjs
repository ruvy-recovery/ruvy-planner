import { chromium, devices } from 'playwright';
import fs from 'fs';

const URL = process.env.URL || 'https://ruvy-planner.vercel.app/';
const N = Number(process.env.N || 100);
const PARALLELE = 4;
fs.mkdirSync('captures', { recursive: true });

// ---------- profils variés ----------
const duos = [['Léa','Hugo'],['Inès','Yanis'],['Sarah','Tom'],['Emma','Lucas'],['Fatou','Moussa'],['Chloé','Nathan'],['Jade','Adam'],['Camille','Camille'],['Aya','Rayan'],['Zoé','Jean-Baptiste']];
const contraintes = ['travaille de nuit','horaires décalés le week-end','2 enfants à récupérer à 16h30','étudiant en partiel','télétravail lundi et vendredi','sport tous les matins à 7h','aucune contrainte','garde alternée une semaine sur deux','trajets de 1h30 par jour','ramadan / jeûne'];
const envies = ['plus de soirées en amoureux','économiser pour un voyage','cuisiner ensemble','voir la famille le dimanche','faire du sport à deux','se reposer, on est épuisés','sortir au resto une fois par semaine','apprendre une langue',"ranger l'appart",'zéro écran le soir'];
const styles = ['minimaliste','coloré','pastel','sombre','vintage','kawaii','pro / sobre','nature'];
const textesBizarres = ['', ' ', 'a'.repeat(400), '😍🔥💕', '<b>test</b>', 'ÉÀÇ ü ñ'];

function profil(i) {
  const [a, b] = duos[i % duos.length];
  return {
    id: i,
    prenoms: `${a} et ${b}`,
    contraintes: contraintes[i % contraintes.length] + ', ' + contraintes[(i * 3 + 1) % contraintes.length],
    envies: envies[i % envies.length],
    style: styles[i % styles.length],
    bizarre: i % 10 === 9 ? textesBizarres[i % textesBizarres.length] : null,
    mobile: i % 2 === 0,
  };
}

function texteDuChamp(p, n) {
  if (p.bizarre !== null) return p.bizarre;
  return [p.prenoms, p.contraintes, p.envies, p.style][n % 4];
}

const BOUTON_GENERER = /g[ée]n[ée]r|cr[ée]er|planifi|lancer|c'est parti/i;
const BOUTON_SUIVANT = /suivant|continuer|commencer|valider|ok|next/i;

// ---------- test d'un profil ----------
async function tester(browser, p) {
  const ctx = await browser.newContext(p.mobile ? devices['iPhone 13'] : { viewport: { width: 1366, height: 800 } });
  const page = await ctx.newPage();
  const r = { id: p.id, mobile: p.mobile, bizarre: p.bizarre !== null, statut: 'pas-de-generation', erreursJs: [], api: null };
  page.on('pageerror', e => r.erreursJs.push(String(e.message).slice(0, 200)));

  try {
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });

    for (let etape = 0; etape < 6 && !r.api; etape++) {
      // remplir les champs visibles
      const champs = await page.locator('input:visible:not([type=checkbox]):not([type=radio]):not([type=submit]), textarea:visible').all();
      for (let n = 0; n < champs.length; n++) {
        try { await champs[n].fill(texteDuChamp(p, n), { timeout: 2000 }); } catch {}
      }
      // cocher 1 option au hasard s'il y a des cases / choix
      const choix = await page.locator('input[type=checkbox]:visible, input[type=radio]:visible').all();
      if (choix.length) { try { await choix[p.id % choix.length].check({ timeout: 2000 }); } catch {} }

      const gen = page.getByRole('button', { name: BOUTON_GENERER }).first();
      const suiv = page.getByRole('button', { name: BOUTON_SUIVANT }).first();

      if (await gen.isVisible().catch(() => false)) {
        const t0 = Date.now();
        const reponse = page.waitForResponse(res => res.request().method() === 'POST', { timeout: 90000 }).catch(() => null);
        await gen.click();
        const res = await reponse;
        if (!res) { r.statut = 'pas-de-generation'; break; }
        r.api = { ms: Date.now() - t0, code: res.status(), url: res.url().slice(0, 80) };
        r.statut = res.ok() ? 'ok' : 'echec-api';
        await page.waitForTimeout(2500);
      } else if (await suiv.isVisible().catch(() => false)) {
        await suiv.click();
        await page.waitForTimeout(800);
      } else break;
    }

    if (r.statut === 'ok' && r.erreursJs.length) r.statut = 'erreur-js';

    r.extrait = (await page.locator('body').innerText()).slice(0, 300);
    await page.screenshot({ path: `captures/${p.id}-${p.mobile ? 'mobile' : 'pc'}-${r.statut}.png`, fullPage: true });

    if (p.mobile) {
      r.debordementHorizontal = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
    }

    // perte de données au rechargement ?
    if (r.api) {
      const avant = (await page.locator('body').innerText()).length;
      await page.reload({ waitUntil: 'networkidle' });
      const apres = (await page.locator('body').innerText()).length;
      r.persisteApresReload = apres >= avant * 0.7;
    }
  } catch (e) {
    r.statut = 'crash';
    r.erreur = String(e.message).slice(0, 200);
  }

  await ctx.close();
  console.log(`#${p.id} ${p.mobile ? '📱' : '💻'} ${r.statut} ${r.api ? r.api.ms + 'ms' : ''}`);
  return r;
}

// ---------- lancement ----------
const browser = await chromium.launch();
const resultats = [];
const file = Array.from({ length: N }, (_, i) => profil(i));
await Promise.all(Array.from({ length: Math.min(PARALLELE, N) }, async () => {
  while (file.length) resultats.push(await tester(browser, file.shift()));
}));
await browser.close();

const compte = s => resultats.filter(r => r.statut === s).length;
const tempsApi = resultats.filter(r => r.api).map(r => r.api.ms).sort((a, b) => a - b);
const resume = {
  total: N, ok: compte('ok'), echecApi: compte('echec-api'), erreurJs: compte('erreur-js'),
  pasDeGeneration: compte('pas-de-generation'), crash: compte('crash'),
  debordementMobile: resultats.filter(r => r.mobile && r.debordementHorizontal).length,
  perteApresReload: resultats.filter(r => r.persisteApresReload === false).length,
  apiMedianeMs: tempsApi[Math.floor(tempsApi.length / 2)], apiMaxMs: tempsApi.at(-1),
};
fs.writeFileSync('rapport.json', JSON.stringify({ resume, resultats }, null, 2));
console.log('\nRÉSUMÉ', resume);