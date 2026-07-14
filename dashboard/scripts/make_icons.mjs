import { chromium } from "playwright";
import fs from "fs";

const LOGO = `data:image/png;base64,${fs.readFileSync("/home/tchakounte/Desktop/HumanB/web/public/brand/logo-mark.png").toString("base64")}`;

// Icône carrée, logo centré, fond transparent.
const squareHtml = (px) => `<!doctype html><html><head><meta charset="utf-8">
<style>*{margin:0;padding:0}body{width:${px}px;height:${px}px}
.wrap{width:${px}px;height:${px}px;display:flex;align-items:center;justify-content:center}
img{width:${Math.round(px*0.9)}px;height:${Math.round(px*0.9)}px;object-fit:contain}</style></head>
<body><div class="wrap"><img src="${LOGO}"></div></body></html>`;

const targets = [
  { px: 512, out: "/home/tchakounte/Desktop/HumanB/dashboard/src/app/icon.png" },
  { px: 512, out: "/home/tchakounte/Desktop/HumanB/web/src/app/icon.png" },
  { px: 180, out: "/home/tchakounte/Desktop/HumanB/dashboard/src/app/apple-icon.png" },
  { px: 180, out: "/home/tchakounte/Desktop/HumanB/web/public/brand/favicon-180.png" },
  { px: 64, out: "/home/tchakounte/Desktop/HumanB/web/public/favicon-64.png" },
];

const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
for (const t of targets) {
  const page = await browser.newPage({ viewport: { width: t.px, height: t.px }, deviceScaleFactor: 1 });
  await page.setContent(squareHtml(t.px), { waitUntil: "networkidle" });
  await page.locator(".wrap").screenshot({ path: t.out, type: "png", omitBackground: true });
  console.log("OK", t.px + "px →", t.out.split("/HumanB/")[1]);
  await page.close();
}
await browser.close();
