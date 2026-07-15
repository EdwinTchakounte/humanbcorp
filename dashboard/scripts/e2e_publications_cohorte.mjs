/**
 * E2E navigateur des champs de cohorte sur une Publication : type d'offre,
 * dates de session, places, durée d'accès — et bascule en accès libre.
 *
 * Lancer : node scripts/e2e_publications_cohorte.mjs  (dashboard :3007, backend :8011)
 */
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:3007";
const results = [];
const ok = (s, c) => { results.push(!!c); console.log(`${c ? "OK" : "KO"}  ${s}`); };

const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
page.setDefaultTimeout(20000);

const jsErrors = [];
page.on("pageerror", (e) => jsErrors.push(String(e)));

const SFX = String(Date.now()).slice(-6);

try {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.locator("input").first().fill("admin");
  await page.locator('input[type="password"]').fill("Admin@HBC2026");
  await page.getByRole("button", { name: /connexion|connecter/i }).first().click();
  await page.waitForURL((u) => !u.pathname.endsWith("/login"), { timeout: 20000 }).catch(() => {});

  await page.goto(`${BASE}/publications`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1800);
  ok("Page publications chargée sans erreur JS", jsErrors.length === 0);
  if (jsErrors.length) console.log("   →", jsErrors[0].slice(0, 160));

  await page.getByRole("button", { name: /nouvelle|créer|ajouter/i }).first().click();
  await page.waitForTimeout(800);
  ok("Bloc « Session » présent dans le formulaire",
    await page.getByText(/^Session$/).isVisible().catch(() => false));
  ok("Le type d'offre est proposé",
    await page.getByText(/Type d'offre/i).isVisible().catch(() => false));
  ok("Les dates de session sont visibles par défaut (mode cohorte)",
    await page.getByText(/Début de session/i).isVisible().catch(() => false));
  ok("Les places et la durée d'accès sont proposées",
    (await page.getByText(/Places \(vide = illimité\)/i).isVisible().catch(() => false)) &&
    (await page.getByText(/Accès pendant/i).isVisible().catch(() => false)));

  // En accès libre, les dates de session n'ont pas de sens : elles disparaissent.
  const modeSelect = page.locator("select").filter({ hasText: /Session à dates fixes/ }).first();
  await modeSelect.selectOption("2");
  await page.waitForTimeout(600);
  ok("En accès libre, les dates de session disparaissent",
    !(await page.getByText(/Début de session/i).isVisible().catch(() => false)));
  ok("…et l'aide explique l'ancrage sur l'achat",
    await page.getByText(/après l'achat/i).isVisible().catch(() => false));

  await modeSelect.selectOption("1");
  await page.waitForTimeout(500);
  ok("Retour en cohorte : les dates réapparaissent",
    await page.getByText(/Début de session/i).isVisible().catch(() => false));

  ok("Aucune erreur JS pendant la manipulation", jsErrors.length === 0);
  if (jsErrors.length) console.log("   →", jsErrors[0].slice(0, 160));
} catch (e) {
  console.log("ERREUR:", String(e).split("\n")[0]);
  ok("Exception pendant le test", false);
} finally {
  const passed = results.filter(Boolean).length;
  console.log(`\n==== ${passed}/${results.length} étapes OK ====`);
  await browser.close();
}
