/**
 * E2E navigateur du réordonnancement (Flow A) : les boutons monter/descendre
 * de l'arbre du contenu réorganisent bien les séances, et l'ordre persiste
 * après rechargement de la page.
 *
 * Lancer : node scripts/e2e_ordre.mjs  (dashboard sur :3007, backend sur :8011)
 */
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:3007";
const results = [];
const ok = (s, c) => { results.push(!!c); console.log(`${c ? "OK" : "KO"}  ${s}`); };

const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
page.setDefaultTimeout(20000);

// Titres des séances dans l'ordre affiché par l'arbre.
const seanceTitles = () =>
  page.locator(".card .flex.items-center.gap-3.p-4 .font-medium").allTextContents();

try {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.locator("input").first().fill("admin");
  await page.locator('input[type="password"]').fill("Admin@HBC2026");
  await page.getByRole("button", { name: /connexion|connecter/i }).first().click();
  await page.waitForURL((u) => !u.pathname.endsWith("/login"), { timeout: 20000 }).catch(() => {});

  // Il faut une formation d'au moins 2 séances, sinon le test ne prouve rien :
  // on interroge l'API (avec le JWT du navigateur) pour en trouver une.
  await page.goto(`${BASE}/formations`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  const themeId = await page.evaluate(async () => {
    const h = { Authorization: `Bearer ${localStorage.getItem("hbc_access")}` };
    const r = await fetch("http://127.0.0.1:8011/api/v1/modules/themes/?page_size=100", { headers: h });
    const themes = (await r.json()).results || [];
    for (const t of themes) {
      const s = await fetch(`http://127.0.0.1:8011/api/v1/modules/seances/?theme=${t.id}`, { headers: h });
      const n = ((await s.json()).results || []).length;
      if (n >= 2) return t.id;
    }
    return null;
  });
  ok("Formation avec ≥ 2 séances trouvée", themeId !== null);
  if (themeId === null) throw new Error("aucune formation réordonnable — test non concluant");

  await page.goto(`${BASE}/formations/${themeId}/contenu`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  const before = await seanceTitles();
  ok(`Arbre chargé (${before.length} séances) sur la formation ${themeId}`, before.length >= 2);

  {
    const up = page.locator('button[title="Monter la séance"]').nth(1); // 2e séance
    ok("Bouton « Monter » présent", await up.count() > 0);
    ok("« Monter » désactivé sur la 1re séance (butée)",
      await page.locator('button[title="Monter la séance"]').first().isDisabled());

    await up.click();
    await page.waitForTimeout(1500);
    const after = await seanceTitles();
    ok(`Ordre modifié : ${before[0]} ⇄ ${before[1]}`,
      after[0] === before[1] && after[1] === before[0]);

    // Persistance : l'ordre doit survivre à un rechargement (donc être en base).
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    const reloaded = await seanceTitles();
    ok("Ordre persistant après rechargement", JSON.stringify(reloaded) === JSON.stringify(after));

    // On restaure l'état initial pour ne pas laisser la base modifiée.
    await page.locator('button[title="Descendre la séance"]').first().click();
    await page.waitForTimeout(1200);
    const restored = await seanceTitles();
    ok("État initial restauré", JSON.stringify(restored) === JSON.stringify(before));
  }
} catch (e) {
  console.log("ERREUR:", String(e).split("\n")[0]);
  ok("Exception pendant le test", false);
} finally {
  const passed = results.filter(Boolean).length;
  console.log(`\n==== ${passed}/${results.length} étapes OK ====`);
  await browser.close();
}
