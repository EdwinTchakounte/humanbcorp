import { chromium } from "playwright";

const BASE = "http://127.0.0.1:3007";
const OUT = "/home/tchakounte/Desktop/HumanB/presentation/e2e";
const results = [];
const ok = (s, c) => { results.push(!!c); console.log(`${c ? "OK" : "KO"}  ${s}`); };

async function login(page, user, pass) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.locator("input").first().fill(user);
  await page.locator('input[type="password"]').fill(pass);
  await page.getByRole("button", { name: /connexion|se connecter|connecter/i }).first()
    .click().catch(async () => { await page.locator('button[type="submit"]').click(); });
  await page.waitForURL((u) => !u.pathname.endsWith("/login"), { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1200);
}

const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 });
const page = await ctx.newPage();
page.setDefaultTimeout(20000);
// Compilation à la demande de Next en mode dev : la 1re visite
// d'une route peut prendre ~40 s. Sans rapport avec la production (pré-compilée).
page.setDefaultNavigationTimeout(60000);

try {
  // ─── ADMIN ───────────────────────────────────────────────
  await login(page, "admin", "Admin@HBC2026");
  ok("Admin connecté", !page.url().endsWith("/login"));

  // Suivi
  await page.goto(`${BASE}/suivi`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  ok("Page Suivi accessible (admin)", /\/suivi/.test(page.url()));
  ok("Suivi affiche des formations", await page.getByText(/apprenant\(s\)/i).first().isVisible().catch(() => false));
  ok("Suivi affiche un score quiz", await page.getByText(/%\)/).first().isVisible().catch(() => false));
  await page.screenshot({ path: `${OUT}/6_suivi_admin.jpeg`, type: "jpeg", quality: 90, fullPage: true });

  // Modale formation → affectation formateur
  await page.goto(`${BASE}/formations`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: /nouvelle formation/i }).click();
  await page.waitForTimeout(600);
  ok("Section « Formateur(s) affecté(s) » visible", await page.getByText(/Formateur\(s\) affecté/i).isVisible().catch(() => false));
  ok("Formateur « Fatou » proposé à l'affectation", await page.getByRole("button", { name: /Fatou/i }).first().isVisible().catch(() => false));
  await page.screenshot({ path: `${OUT}/7_affectation_formateur.jpeg`, type: "jpeg", quality: 90 });

  // ─── FORMATEUR ───────────────────────────────────────────
  const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 });
  const p2 = await ctx2.newPage();
  p2.setDefaultTimeout(20000);
  await login(p2, "formateur1", "Formateur@HBC2026");
  ok("Formateur connecté", !p2.url().endsWith("/login"));
  ok("Badge « Formateur » affiché", await p2.getByText(/^Formateur$/).first().isVisible().catch(() => false));

  // Sidebar restreinte : pas de Paiements/Inscriptions
  const bodyTxt = await p2.locator("aside").innerText().catch(() => "");
  ok("Sidebar contient Formations/Agenda/Suivi", /Formations/.test(bodyTxt) && /Suivi/.test(bodyTxt) && /Agenda/.test(bodyTxt));
  ok("Sidebar SANS Paiements ni Inscriptions", !/Paiements/.test(bodyTxt) && !/Inscriptions/.test(bodyTxt));

  // Formations : ne voit que la sienne
  await p2.goto(`${BASE}/formations`, { waitUntil: "domcontentloaded" });
  await p2.waitForTimeout(1200);
  await p2.screenshot({ path: `${OUT}/8_formateur_formations.jpeg`, type: "jpeg", quality: 90, fullPage: true });
  ok("Formateur voit sa formation", await p2.getByText(/Formation E2E Formateur/i).first().isVisible().catch(() => false));

  // Suivi côté formateur
  await p2.goto(`${BASE}/suivi`, { waitUntil: "domcontentloaded" });
  await p2.waitForTimeout(1200);
  ok("Formateur accède au Suivi", /\/suivi/.test(p2.url()));
  await p2.screenshot({ path: `${OUT}/9_suivi_formateur.jpeg`, type: "jpeg", quality: 90, fullPage: true });

} catch (e) {
  console.log("ERREUR:", String(e).split("\n")[0]);
  await page.screenshot({ path: `${OUT}/error_suivi.jpeg`, type: "jpeg", quality: 90 }).catch(() => {});
} finally {
  const passed = results.filter(Boolean).length;
  console.log(`\n==== ${passed}/${results.length} étapes OK ====`);
  await browser.close();
}
