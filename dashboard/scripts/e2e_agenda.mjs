/**
 * E2E navigateur de l'agenda : un créneau se rattache à une **cohorte**
 * (session vendue) et non plus à un programme, et la liste des participants
 * affiche les inscrits de cette cohorte.
 *
 * Lancer : node scripts/e2e_agenda.mjs  (dashboard sur :3007, backend sur :8011)
 */
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:3007";
const results = [];
const ok = (s, c) => { results.push(!!c); console.log(`${c ? "OK" : "KO"}  ${s}`); };

const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
page.setDefaultTimeout(20000);

// Une erreur JS non catchée ne fait pas échouer un test Playwright : on la
// surveille explicitement, sinon la page peut « passer » tout en étant cassée.
const jsErrors = [];
page.on("pageerror", (e) => jsErrors.push(String(e)));

try {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.locator("input").first().fill("admin");
  await page.locator('input[type="password"]').fill("Admin@HBC2026");
  await page.getByRole("button", { name: /connexion|connecter/i }).first().click();
  await page.waitForURL((u) => !u.pathname.endsWith("/login"), { timeout: 20000 }).catch(() => {});

  await page.goto(`${BASE}/agenda`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  ok("Page agenda chargée sans erreur JS", jsErrors.length === 0);
  if (jsErrors.length) console.log("   →", jsErrors[0].slice(0, 160));

  const nouveau = page.getByRole("button", { name: /nouvel|créer|ajouter/i }).first();
  ok("Bouton de création présent", (await nouveau.count()) > 0);

  await nouveau.click();
  await page.waitForTimeout(700);
  ok("Le formulaire demande une « Session » (cohorte), plus une formation",
    await page.getByText(/Session concernée/i).isVisible().catch(() => false));

  const options = await page.locator("select").last().locator("option").allTextContents();
  ok(`Les cohortes vendues sont proposées (${options.length} option(s))`, options.length > 1);
  console.log("   →", options.slice(0, 4).join(" | "));

  // Fermer la modale : laissée ouverte, elle intercepte les clics suivants.
  await page.getByRole("button", { name: /annuler|fermer/i }).first().click().catch(() => {});
  await page.waitForTimeout(600);

  // L'agenda s'ouvre en vue calendrier : les badges cohorte ne sont rendus que
  // dans la vue liste, il faut y basculer pour tester le rattachement.
  await page.getByRole("button", { name: /liste/i }).first().click();
  await page.waitForTimeout(1200);

  const badge = page.locator('button[title="Voir les participants"]').first();
  ok("Des créneaux rattachés à une cohorte sont affichés", (await badge.count()) > 0);

  await badge.click();
  await page.waitForTimeout(1500);
  ok("La modale des participants s'ouvre",
    await page.getByText(/Apprenants inscrits/i).isVisible().catch(() => false));
  ok("Aucune erreur JS après ouverture des participants", jsErrors.length === 0);
} catch (e) {
  console.log("ERREUR:", String(e).split("\n")[0]);
  ok("Exception pendant le test", false);
} finally {
  const passed = results.filter(Boolean).length;
  console.log(`\n==== ${passed}/${results.length} étapes OK ====`);
  await browser.close();
}
