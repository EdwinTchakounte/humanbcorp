/**
 * E2E de l'UX de navigation : la recherche rapide (⌘K) et le fil d'Ariane
 * doivent réellement raccourcir l'accès aux ressources profondes.
 *
 * Lancer : node scripts/e2e_ux.mjs  (dashboard :3007, backend :8011)
 */
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:3007";
const results = [];
const ok = (s, c) => { results.push(!!c); console.log(`${c ? "OK" : "KO"}  ${s}`); };

const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
page.setDefaultTimeout(20000);
page.setDefaultNavigationTimeout(60000);
const jsErrors = [];
page.on("pageerror", (e) => jsErrors.push(String(e)));

try {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.locator("input").first().fill("admin");
  await page.locator('input[type="password"]').fill("Admin@HBC2026");
  await page.getByRole("button", { name: /connexion|connecter/i }).first().click();
  await page.waitForURL((u) => !u.pathname.endsWith("/login"), { timeout: 30000 }).catch(() => {});

  // On crée une formation repérable pour la chercher ensuite.
  const SFX = String(Date.now()).slice(-6);
  const titre = `Zephyr Recherche ${SFX}`;
  const themeId = await page.evaluate(async (t) => {
    const h = { Authorization: `Bearer ${localStorage.getItem("hbc_access")}`, "Content-Type": "application/json" };
    const r = await fetch("http://127.0.0.1:8011/api/v1/modules/themes/", {
      method: "POST", headers: h, body: JSON.stringify({ title: t, t_type: 1, is_visible: true }),
    });
    return (await r.json()).id;
  }, titre);
  ok("Formation de test créée", !!themeId);

  await page.goto(`${BASE}/agenda`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  ok("Page chargée sans erreur JS", jsErrors.length === 0);

  // ── Recherche rapide ────────────────────────────────────────────────────
  ok("Le bouton de recherche est dans le header",
    await page.getByRole("button", { name: /Rechercher/i }).first().isVisible().catch(() => false));

  // Ouverture au clavier (Ctrl+K).
  await page.keyboard.press("Control+k");
  await page.waitForTimeout(600);
  const input = page.getByPlaceholder(/Rechercher une formation/i);
  ok("Ctrl+K ouvre la palette", await input.isVisible().catch(() => false));

  await input.fill(`Zephyr Recherche ${SFX}`);
  await page.waitForTimeout(1200);
  const resultat = page.getByText(titre, { exact: false }).first();
  ok("La formation cherchée apparaît dans les résultats", await resultat.isVisible().catch(() => false));

  // Sélection → saut DIRECT au contenu de la formation (le gain de clics).
  await page.keyboard.press("Enter");
  await page.waitForTimeout(2000);
  ok("Entrée saute directement au contenu de la formation",
    page.url().includes(`/formations/${themeId}/contenu`), page.url());

  // ── Fil d'Ariane ────────────────────────────────────────────────────────
  ok("Le fil d'Ariane affiche la section « Formations »",
    await page.getByRole("navigation", { name: /Fil d'Ariane/i }).getByText(/Formations/).first().isVisible().catch(() => false));
  ok("…et le nom réel de la formation (pas un identifiant)",
    await page.getByRole("navigation", { name: /Fil d'Ariane/i }).getByText(new RegExp(`Zephyr Recherche ${SFX}`)).isVisible().catch(() => false));

  // Le segment « Formations » du fil ramène à la liste, d'un clic.
  await page.getByRole("navigation", { name: /Fil d'Ariane/i }).getByRole("link", { name: /Formations/i }).click();
  await page.waitForTimeout(1500);
  ok("Cliquer le fil ramène à la liste des formations",
    page.url().endsWith("/formations"), page.url());

  ok("Aucune erreur JS pendant le parcours", jsErrors.length === 0);
  if (jsErrors.length) console.log("   →", jsErrors[0].slice(0, 160));

  // Nettoyage.
  await page.evaluate(async (id) => {
    const h = { Authorization: `Bearer ${localStorage.getItem("hbc_access")}` };
    await fetch(`http://127.0.0.1:8011/api/v1/modules/themes/${id}/`, { method: "DELETE", headers: h });
  }, themeId);
} catch (e) {
  console.log("ERREUR:", String(e).split("\n")[0]);
  ok("Exception pendant le test", false);
} finally {
  const passed = results.filter(Boolean).length;
  console.log(`\n==== ${passed}/${results.length} étapes OK ====`);
  await browser.close();
}
