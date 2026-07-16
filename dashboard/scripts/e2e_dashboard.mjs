import { chromium } from "playwright";

const BASE = "http://127.0.0.1:3007";
const OUT = "/home/tchakounte/Desktop/HumanB/presentation/e2e";
const USER = "admin", PASS = "Admin@HBC2026";
const stamp = Date.now().toString().slice(-5);
const NAME = `Formation Playwright ${stamp}`;

const results = [];
function ok(step, cond) { results.push({ step, pass: !!cond }); console.log(`${cond ? "OK" : "KO"}  ${step}`); }

const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 });
const page = await ctx.newPage();
page.setDefaultTimeout(20000);
// Compilation à la demande de Next en mode dev : la 1re visite
// d'une route peut prendre ~40 s. Sans rapport avec la production (pré-compilée).
page.setDefaultNavigationTimeout(60000);

try {
  // 1. LOGIN
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.locator("input").first().fill(USER);
  await page.locator('input[type="password"]').fill(PASS);
  await page.screenshot({ path: `${OUT}/1_login.jpeg`, type: "jpeg", quality: 90 });
  await page.getByRole("button", { name: /connexion|se connecter|connecter/i }).first().click().catch(async () => {
    await page.locator('button[type="submit"]').click();
  });
  await page.waitForURL((u) => !u.pathname.endsWith("/login"), { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);
  ok("Login réussi (sortie de /login)", !page.url().endsWith("/login"));

  // 2. FORMATIONS
  await page.goto(`${BASE}/formations`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  const hasNew = await page.getByRole("button", { name: /nouvelle formation/i }).isVisible().catch(() => false);
  ok("Bouton « Nouvelle formation » visible", hasNew);
  await page.screenshot({ path: `${OUT}/2_formations_liste.jpeg`, type: "jpeg", quality: 90, fullPage: true });

  // 3. OUVRIR LA MODALE
  await page.getByRole("button", { name: /nouvelle formation/i }).click();
  await page.waitForTimeout(500);
  ok("Modale de création ouverte", await page.getByText(/Nouvelle formation/).first().isVisible());
  await page.getByPlaceholder(/Introduction à Python/i).fill(NAME);

  // 4. HIÉRARCHIE INLINE : session → séquence → catégorie → classe
  async function addInline(placeholderRe, value) {
    const input = page.getByPlaceholder(placeholderRe).first();
    await input.fill(value);
    await input.locator("xpath=following-sibling::button").click();
    await page.waitForTimeout(700);
  }
  await addInline(/Nouvelle session/i, `PW-${stamp}`);
  ok("Session créée inline", true);
  await addInline(/N° de séquence/i, "1");
  ok("Séquence créée inline", true);
  await addInline(/Nouvelle catégorie/i, `Cat PW-${stamp}`);
  ok("Catégorie créée inline", true);
  await addInline(/Nouvelle classe/i, `Niveau PW-${stamp}`);
  ok("Classe créée inline", true);
  await page.screenshot({ path: `${OUT}/3_form_rempli.jpeg`, type: "jpeg", quality: 90 });

  // 5. SOUMETTRE
  await page.getByRole("button", { name: /^Créer$/ }).click();
  await page.waitForTimeout(2500);
  const created = await page.getByText(NAME).first().isVisible().catch(() => false);
  ok(`Formation « ${NAME} » apparaît dans la liste`, created);
  await page.screenshot({ path: `${OUT}/4_formation_creee.jpeg`, type: "jpeg", quality: 90, fullPage: true });

  // 6. OUVRIR L'ARBRE DE CONTENU
  const row = page.locator("div", { hasText: NAME }).last();
  await row.getByRole("link", { name: /contenu/i }).first().click().catch(async () => {
    await page.getByRole("link", { name: /contenu/i }).first().click();
  });
  await page.waitForTimeout(1500);
  ok("Page Contenu (arbre) chargée", /\/contenu/.test(page.url()));
  await page.screenshot({ path: `${OUT}/5_arbre_contenu.jpeg`, type: "jpeg", quality: 90, fullPage: true });

} catch (e) {
  console.log("ERREUR:", String(e).split("\n")[0]);
  await page.screenshot({ path: `${OUT}/error.jpeg`, type: "jpeg", quality: 90 }).catch(() => {});
} finally {
  const passed = results.filter((r) => r.pass).length;
  console.log(`\n==== RÉSULTAT: ${passed}/${results.length} étapes OK ====`);
  await browser.close();
}
