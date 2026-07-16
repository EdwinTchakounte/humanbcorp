/**
 * E2E navigateur de l'inscription manuelle (Flow C) : un admin inscrit un
 * apprenant sans passer par un paiement, et le lien d'accès part.
 *
 * Lancer : node scripts/e2e_inscription_manuelle.mjs  (dashboard :3007, backend :8011)
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
const EMAIL = `e2e-offert-${SFX}@hbc.test`;

try {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.locator("input").first().fill("admin");
  await page.locator('input[type="password"]').fill("Admin@HBC2026");
  await page.getByRole("button", { name: /connexion|connecter/i }).first().click();
  await page.waitForURL((u) => !u.pathname.endsWith("/login"), { timeout: 20000 }).catch(() => {});

  // On pose une capacité sur une session : sans cela, le test des « places
  // restantes » dépendrait des données présentes en base.
  const cible = await page.evaluate(async () => {
    const h = { Authorization: `Bearer ${localStorage.getItem("hbc_access")}`, "Content-Type": "application/json" };
    const r = await fetch("http://127.0.0.1:8011/api/v1/modules/publications/?page_size=1", { headers: h });
    const pub = ((await r.json()).results || [])[0];
    if (!pub) return null;
    await fetch(`http://127.0.0.1:8011/api/v1/modules/publications/${pub.id}/`, {
      method: "PATCH", headers: h, body: JSON.stringify({ capacite: 50 }),
    });
    return pub.title;
  });
  ok("Une session avec capacité est disponible pour le test", cible !== null);

  await page.goto(`${BASE}/inscriptions`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1800);
  ok("Page inscriptions chargée sans erreur JS", jsErrors.length === 0);
  if (jsErrors.length) console.log("   →", jsErrors[0].slice(0, 160));

  const bouton = page.getByRole("button", { name: /Inscrire un apprenant/i });
  ok("Le bouton « Inscrire un apprenant » est présent", (await bouton.count()) > 0);

  await bouton.click();
  await page.waitForTimeout(700);
  ok("La modale s'ouvre et explique le geste",
    await page.getByText(/sans passer par un paiement/i).isVisible().catch(() => false));

  // Le sélecteur annonce les places restantes : une place offerte reste une place.
  const options = await page.locator("select").last().locator("option").allTextContents();
  ok(`Les sessions sont proposées (${options.length})`, options.length > 1);
  ok("…avec leurs places restantes", options.some((o) => /place\(s\)/.test(o)));

  await page.getByLabel(/E-mail/i).fill(EMAIL);
  await page.getByLabel(/Prénom/i).fill("E2E");
  await page.getByLabel(/^Nom$/i).fill("Offert");
  // On cible la session à capacité par sa valeur : selectOption n'accepte pas
  // d'expression régulière sur le libellé.
  const select = page.locator("select").last();
  const val = await select.locator("option", { hasText: cible.slice(0, 18) }).first().getAttribute("value");
  await select.selectOption(val);
  await page.waitForTimeout(300);

  await page.getByRole("button", { name: /Inscrire et envoyer le lien/i }).click();
  await page.waitForTimeout(2500);

  const confirme = await page.getByText(/lien d'accès lui a été envoyé|déjà inscrit|complète/i)
    .first().isVisible().catch(() => false);
  ok("Un retour explicite est affiché", confirme);

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1800);
  ok("L'apprenant apparaît dans la liste", await page.getByText(EMAIL, { exact: false })
    .first().isVisible().catch(() => false)
    || await page.getByText(/E2E Offert/i).first().isVisible().catch(() => false));

  ok("Le renvoi de lien est proposé sur les inscriptions confirmées",
    (await page.getByRole("button", { name: /Renvoyer le lien/i }).count()) > 0);
  ok("Aucune erreur JS pendant le parcours", jsErrors.length === 0);
  if (jsErrors.length) console.log("   →", jsErrors[0].slice(0, 160));
} catch (e) {
  console.log("ERREUR:", String(e).split("\n")[0]);
  ok("Exception pendant le test", false);
} finally {
  const passed = results.filter(Boolean).length;
  console.log(`\n==== ${passed}/${results.length} étapes OK ====`);
  await browser.close();
}
