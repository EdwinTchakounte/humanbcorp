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
// Compilation à la demande de Next en mode dev : la 1re visite
// d'une route peut prendre ~40 s. Sans rapport avec la production (pré-compilée).
page.setDefaultNavigationTimeout(60000);

// Titres des séances dans l'ordre affiché par l'arbre.
const seanceTitles = () =>
  page.locator(".card .flex.items-center.gap-3.p-4 .font-medium").allTextContents();

try {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.locator("input").first().fill("admin");
  await page.locator('input[type="password"]').fill("Admin@HBC2026");
  await page.getByRole("button", { name: /connexion|connecter/i }).first().click();
  await page.waitForURL((u) => !u.pathname.endsWith("/login"), { timeout: 20000 }).catch(() => {});

  // Le test crée SA propre formation à 2 séances, plutôt que d'en chercher une
  // parmi les données existantes : la liste est triée par -id et plafonnée,
  // donc les formations historiques (celles qui ont des séances) se retrouvent
  // enfouies sous les données de test récentes et deviennent introuvables. Un
  // test qui dépend de l'état de la base finit toujours par mentir.
  await page.goto(`${BASE}/formations`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  const SFX = String(Date.now()).slice(-6);
  const seed = await page.evaluate(async (sfx) => {
    const h = {
      Authorization: `Bearer ${localStorage.getItem("hbc_access")}`,
      "Content-Type": "application/json",
    };
    const API = "http://127.0.0.1:8011/api/v1";
    const t = await (await fetch(`${API}/modules/themes/`, {
      method: "POST", headers: h,
      body: JSON.stringify({ title: `Ordre E2E ${sfx}`, t_type: 1, is_visible: true }),
    })).json();
    for (const nom of [`Alpha ${sfx}`, `Beta ${sfx}`]) {
      await fetch(`${API}/modules/seances/`, {
        method: "POST", headers: h,
        body: JSON.stringify({ title: nom, theme: t.id, s_type: 0 }),
      });
    }
    return t.id;
  }, SFX);
  ok("Formation de test à 2 séances créée", !!seed, `theme #${seed}`);
  const themeId = seed;

  await page.goto(`${BASE}/formations/${themeId}/contenu`, { waitUntil: "domcontentloaded" });
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
    await page.reload({ waitUntil: "domcontentloaded" });
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
  // Nettoyage : le test ne laisse rien derrière lui (il ne doit pas nourrir la
  // pollution qu'il contourne). La suppression d'une séance jamais suivie ne
  // demande pas de confirmation, la formation part avec.
  try {
    if (typeof themeId !== "undefined" && themeId) {
      await page.evaluate(async (id) => {
        const h = { Authorization: `Bearer ${localStorage.getItem("hbc_access")}` };
        const API = "http://127.0.0.1:8011/api/v1";
        const ss = ((await (await fetch(`${API}/modules/seances/?theme=${id}`, { headers: h })).json()).results) || [];
        for (const s of ss) await fetch(`${API}/modules/seances/${s.id}/`, { method: "DELETE", headers: h });
        await fetch(`${API}/modules/themes/${id}/`, { method: "DELETE", headers: h });
      }, themeId);
    }
  } catch { /* le nettoyage est best-effort */ }
  const passed = results.filter(Boolean).length;
  console.log(`\n==== ${passed}/${results.length} étapes OK ====`);
  await browser.close();
}
