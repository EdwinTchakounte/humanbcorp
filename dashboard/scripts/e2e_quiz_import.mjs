import { chromium } from "playwright";
import fs from "fs";
import os from "os";
import path from "path";

const BASE = "http://127.0.0.1:3007";
const OUT = "/home/tchakounte/Desktop/HumanB/presentation/e2e";
const THEME = 44, AID = 35; // quiz "Quiz final"
const results = [];
const ok = (s, c) => { results.push(!!c); console.log(`${c ? "OK" : "KO"}  ${s}`); };

// Fichier CSV temporaire à importer
const csv = "question,option1,option2,option3,correct,points,type\n"
  + "Couleur du ciel ?,Rouge,Bleu,Vert,2,1,radio\n"
  + "Nombres pairs ?,2,3,4,\"1,3\",2,checkbox\n";
const csvPath = path.join(os.tmpdir(), `quiz_import_${Date.now()}.csv`);
fs.writeFileSync(csvPath, csv);

const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5, acceptDownloads: true });
const page = await ctx.newPage();
page.setDefaultTimeout(20000);

try {
  // login admin
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.locator("input").first().fill("admin");
  await page.locator('input[type="password"]').fill("Admin@HBC2026");
  await page.getByRole("button", { name: /connexion|connecter/i }).first().click().catch(async () => { await page.locator('button[type="submit"]').click(); });
  await page.waitForURL((u) => !u.pathname.endsWith("/login"), { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1000);

  // page d'édition de l'activité quiz
  await page.goto(`${BASE}/formations/${THEME}/contenu/activite/${AID}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  ok("Page activité quiz chargée", await page.getByText(/Questions du quiz/i).isVisible().catch(() => false));

  // ouvrir la modale d'import
  await page.getByRole("button", { name: /Importer/i }).first().click();
  await page.waitForTimeout(500);
  ok("Modale d'import ouverte", await page.getByText(/Importer des questions/i).isVisible().catch(() => false));
  ok("Boutons modèle CSV/Excel présents", await page.getByRole("button", { name: /Modèle CSV/i }).isVisible().catch(() => false));

  // télécharger le modèle CSV (vérifie l'auth sur l'endpoint template)
  const [dl] = await Promise.all([
    page.waitForEvent("download").catch(() => null),
    page.getByRole("button", { name: /Modèle CSV/i }).click(),
  ]);
  ok("Téléchargement du modèle CSV déclenché", !!dl);

  // uploader le fichier + importer
  await page.locator('input[type="file"]').setInputFiles(csvPath);
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: /^Importer$/ }).click();
  await page.waitForTimeout(2000);
  ok("Résultat import affiché (question(s) importée(s))", await page.getByText(/question\(s\) importée/i).isVisible().catch(() => false));
  await page.screenshot({ path: `${OUT}/10_import_quiz.jpeg`, type: "jpeg", quality: 90 });

  // fermer et vérifier que les questions apparaissent
  await page.getByRole("button", { name: /Fermer/i }).click();
  await page.waitForTimeout(1000);
  ok("Question importée « Couleur du ciel » visible", await page.getByText(/Couleur du ciel/i).first().isVisible().catch(() => false));
  ok("Question importée « Nombres pairs » visible", await page.getByText(/Nombres pairs/i).first().isVisible().catch(() => false));
  await page.screenshot({ path: `${OUT}/11_quiz_apres_import.jpeg`, type: "jpeg", quality: 90, fullPage: true });

} catch (e) {
  console.log("ERREUR:", String(e).split("\n")[0]);
  await page.screenshot({ path: `${OUT}/error_import.jpeg`, type: "jpeg", quality: 90 }).catch(() => {});
} finally {
  fs.unlinkSync(csvPath);
  const passed = results.filter(Boolean).length;
  console.log(`\n==== ${passed}/${results.length} étapes OK ====`);
  await browser.close();
}
