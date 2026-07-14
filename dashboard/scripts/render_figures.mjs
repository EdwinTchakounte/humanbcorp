import { chromium } from "playwright";
import { fileURLToPath } from "url";

const SCRATCH = "/tmp/claude-1000/-home-tchakounte-Desktop-HumanB/30088fbb-bf2d-410a-9792-ae6b7eb73400/scratchpad";
const OUT = "/home/tchakounte/Desktop/HumanB/presentation";

const figs = [
  { html: `${SCRATCH}/fig_metier.html`, out: `${OUT}/01_flux_metier.jpeg` },
  { html: `${SCRATCH}/fig_archi.html`, out: `${OUT}/02_architecture.jpeg` },
];

const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
const page = await browser.newPage({ viewport: { width: 1680, height: 1000 }, deviceScaleFactor: 2 });

for (const f of figs) {
  await page.goto(`file://${f.html}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  await page.locator(".page").screenshot({ path: f.out, type: "jpeg", quality: 95 });
  console.log("OK", f.out);
}
await browser.close();
