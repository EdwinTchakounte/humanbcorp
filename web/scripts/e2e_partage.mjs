/**
 * E2E du partage social (WhatsApp, LinkedIn, Facebook).
 *
 * Ces plateformes ne lisent QUE le HTML servi — jamais le JavaScript. Un aperçu
 * cassé ne se voit nulle part dans l'application : il faut lire les balises
 * réellement émises. Ce test le fait.
 *
 * Piège d'origine : Next ne fusionne pas les métadonnées en profondeur. Une page
 * qui définit `openGraph` REMPLACE celui du layout racine ; et `openGraph:
 * undefined` — clé présente mais vide — l'effaçait entièrement. L'accueil se
 * partageait donc sans le moindre aperçu.
 *
 * Lancer : node scripts/e2e_partage.mjs   (vitrine :3000, API :8011)
 */
const WEB = "http://127.0.0.1:3000";
const API = "http://127.0.0.1:8011";

const results = [];
const ok = (s, c, extra = "") => {
  results.push(!!c);
  console.log(`${c ? "OK" : "KO"}  ${s}${extra ? `  — ${extra}` : ""}`);
};

/** Extrait les balises og:* / twitter:* du HTML servi. */
async function meta(url) {
  const html = await (await fetch(url)).text();
  const tags = {};
  for (const m of html.matchAll(/<meta property="(og:[^"]+)" content="([^"]*)"/g)) tags[m[1]] = m[2];
  for (const m of html.matchAll(/<meta name="(twitter:[^"]+)" content="([^"]*)"/g)) tags[m[1]] = m[2];
  const t = html.match(/<title>([^<]*)<\/title>/);
  return { tags, title: t ? t[1] : "" };
}

// Les 7 balises sans lesquelles l'aperçu est incomplet ou absent.
const REQUISES = ["og:title", "og:description", "og:url", "og:image", "og:type", "og:site_name", "og:locale"];

try {
  // ── 1. Accueil ─────────────────────────────────────────────────────────
  console.log("\n── 1. La page d'accueil est partageable ──");
  const home = await meta(`${WEB}/`);
  const manquantes = REQUISES.filter((k) => !home.tags[k]);
  ok("Toutes les balises d'aperçu sont présentes", manquantes.length === 0, manquantes.join(", "));
  ok("Une image d'aperçu est servie", !!home.tags["og:image"], home.tags["og:image"]);

  // ── 2. Détail d'une formation ──────────────────────────────────────────
  console.log("\n── 2. Une formation partage SON image, pas le logo ──");
  const cat = await (await fetch(`${API}/api/v1/site/formations/`)).json();
  const avecImage = (cat.results || []).find((f) => f.image_url);
  if (!avecImage) {
    ok("IGNORÉ : aucune formation avec image en base", true);
  } else {
    const f = await meta(`${WEB}/formations/${avecImage.id}`);
    const abs = REQUISES.filter((k) => !f.tags[k]);
    ok("Toutes les balises d'aperçu sont présentes", abs.length === 0, abs.join(", "));
    ok("L'image est celle de la formation", f.tags["og:image"] === avecImage.image_url,
      f.tags["og:image"]);
    ok("…et non le logo générique", !/brand\/logo/.test(f.tags["og:image"] || ""));
    ok("Le titre n'est pas dupliqué (« … — HBC-RH | HBC-RH »)",
      !/HBC-RH.*HBC-RH/.test(f.tags["og:title"] || ""), f.tags["og:title"]);
    ok("L'URL de partage est posée", !!f.tags["og:url"], f.tags["og:url"]);
    ok("Une alternative textuelle accompagne l'image", !!f.tags["og:image:alt"]);
  }

  // ── 3. Une formation SANS image retombe sur le logo ────────────────────
  console.log("\n── 3. Sans image propre, le logo prend le relais ──");
  const sansImage = (cat.results || []).find((f) => !f.image_url);
  if (!sansImage) {
    ok("IGNORÉ : toutes les formations ont une image", true);
  } else {
    const f = await meta(`${WEB}/formations/${sansImage.id}`);
    ok("L'aperçu reste complet", REQUISES.every((k) => f.tags[k]));
    ok("Le logo sert d'image de repli", /brand\/logo/.test(f.tags["og:image"] || ""),
      f.tags["og:image"]);
  }

  // ── 4. Les URLs doivent être absolues ──────────────────────────────────
  console.log("\n── 4. Les URLs sont absolues (une URL relative ne s'affiche pas) ──");
  ok("og:image est absolue", /^https?:\/\//.test(home.tags["og:image"] || ""), home.tags["og:image"]);
  ok("og:url est absolue", /^https?:\/\//.test(home.tags["og:url"] || ""), home.tags["og:url"]);

  // ── 5. Version anglaise ────────────────────────────────────────────────
  console.log("\n── 5. La version anglaise est partageable aussi ──");
  const en = await meta(`${WEB}/en`);
  ok("Aperçu complet sur /en", REQUISES.every((k) => en.tags[k]),
    REQUISES.filter((k) => !en.tags[k]).join(", "));
  ok("La locale annoncée est l'anglais", en.tags["og:locale"] === "en_US", en.tags["og:locale"]);
  // ── 6. Données structurées ─────────────────────────────────────────────
  console.log("\n── 6. Google comprend ce que la page décrit ──");
  const html = await (await fetch(`${WEB}/formations/${(cat.results || [])[0].id}`)).text();
  const blocs = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
    .map((m) => { try { return JSON.parse(m[1]); } catch { return null; } })
    .filter(Boolean);
  const course = blocs.find((b) => b["@type"] === "Course");
  ok("La formation est balisée comme un cours (schema.org/Course)", !!course);
  if (course) {
    ok("…avec son fournisseur", !!course.provider?.name);
    ok("…son prix et sa devise", course.offers?.priceCurrency === "XAF");
    ok("…et sa disponibilité", /InStock|SoldOut/.test(course.offers?.availability || ""));
  }

  const offres = await (await fetch(`${API}/api/v1/site/offres/`)).json();
  const offre = (offres.results || [])[0];
  if (!offre) {
    ok("IGNORÉ : aucune offre d'emploi en base", true);
  } else {
    const h = await (await fetch(`${WEB}/carrieres/${offre.slug}`)).text();
    const jp = [...h.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
      .map((m) => { try { return JSON.parse(m[1]); } catch { return null; } })
      .find((b) => b && b["@type"] === "JobPosting");
    ok("L'offre est balisée pour Google for Jobs (JobPosting)", !!jp);
    if (jp) ok("…avec son employeur et son lieu", !!jp.hiringOrganization?.name && !!jp.jobLocation?.address);
  }

  // ── 7. Un article sans couverture reste partageable ─────────────────────
  console.log("\n── 7. Les articles aussi (même bug que l'accueil) ──");
  const arts = await (await fetch(`${API}/api/v1/site/articles/`)).json();
  const art = (arts.results || arts || [])[0];
  if (!art) {
    ok("IGNORÉ : aucun article en base", true);
  } else {
    const a = await meta(`${WEB}/blog/${art.slug}`);
    ok("Aperçu complet sur un article", REQUISES.every((k) => a.tags[k]),
      REQUISES.filter((k) => !a.tags[k]).join(", "));
    ok("…annoncé comme un article, pas un site", a.tags["og:type"] === "article", a.tags["og:type"]);
  }

  // ── 8. Le plan du site expose ce qu'on vend ────────────────────────────
  console.log("\n── 8. Le plan du site n'oublie plus les formations ──");
  const sm = await (await fetch(`${WEB}/sitemap.xml`)).text();
  const nb = (sm.match(/\/formations\/\d+/g) || []).length;
  ok(`Les formations figurent au sitemap (${nb} URL)`, nb > 0);
  ok("La page des formations aussi", /<loc>[^<]*\/formations<\/loc>/.test(sm));
} catch (e) {
  console.log("ERREUR:", String(e).split("\n")[0]);
  ok("Exception pendant le test", false);
} finally {
  const passed = results.filter(Boolean).length;
  console.log(`\n==== ${passed}/${results.length} étapes OK ====`);
}
