import { chromium } from "playwright";
import fs from "fs";

const OUT = "/home/tchakounte/Desktop/HumanB/presentation";
const LOGO = `data:image/png;base64,${fs.readFileSync("/home/tchakounte/Desktop/HumanB/web/public/brand/logo-mark.png").toString("base64")}`;

/* ---------- Design system commun ---------- */
const CSS = `
:root{--navy:#1C2F57;--blue:#3C5EA5;--blue2:#2D467B;--soft:#EEF2FA;--orange:#EC7123;
--orange-soft:#FDEDE1;--teal:#00B894;--teal-soft:#E4F7F1;--ink:#1F2733;--muted:#5C6675;
--line:#E2E8F2;--paper:#FFFFFF;--bg:#F6F8FC;--violet:#6D5AE0;}
*{box-sizing:border-box;margin:0;padding:0;font-family:-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
body{background:var(--bg);color:var(--ink)}
.page{width:1680px;padding:52px 56px 46px;background:var(--bg)}
.head{display:flex;align-items:center;justify-content:space-between;margin-bottom:32px}
.brand{display:flex;align-items:center;gap:16px}
.logo{height:66px;width:auto;display:block}
h1{font-size:29px;color:var(--navy);letter-spacing:-.4px}
.sub{font-size:15px;color:var(--muted);margin-top:3px}
.tag-m{background:var(--orange-soft);color:var(--orange);font-weight:700;font-size:13px;padding:9px 16px;border-radius:999px;border:1px solid #F6D3BB}
.tag-a{background:var(--soft);color:var(--blue2);font-weight:700;font-size:13px;padding:9px 16px;border-radius:999px;border:1px solid #CBD8EE}
.lane{background:var(--paper);border:1px solid var(--line);border-radius:18px;padding:20px 22px;margin-bottom:16px;
box-shadow:0 6px 22px rgba(28,47,87,.05);display:flex;align-items:center;gap:22px}
.lanehdr{width:220px;flex-shrink:0;display:flex;align-items:center;gap:14px}
.ic{width:50px;height:50px;border-radius:13px;display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0}
.ic.b{background:var(--soft)}.ic.o{background:var(--orange-soft)}.ic.t{background:var(--teal-soft)}.ic.v{background:#EFEBFC}
.laneName{font-size:17px;font-weight:800;color:var(--navy)}
.laneRole{font-size:12.5px;color:var(--muted);margin-top:2px}
.flow{display:flex;align-items:stretch;flex:1}
.step{flex:1;background:var(--soft);border:1px solid #DEE6F3;border-radius:13px;padding:13px 15px}
.step.pay{background:var(--orange-soft);border-color:#F3C8AC}
.step.goal{background:var(--teal-soft);border-color:#BDEBDF}
.stepTop{display:flex;align-items:center;gap:8px;margin-bottom:5px}
.num{width:22px;height:22px;border-radius:50%;background:var(--blue);color:#fff;font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.step.pay .num{background:var(--orange)}.step.goal .num{background:var(--teal)}
.stepT{font-size:14.5px;font-weight:700;color:var(--ink);line-height:1.15}
.stepS{font-size:12px;color:var(--muted);line-height:1.35}
.arrow{width:32px;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#B7C4DA;font-size:22px;font-weight:700}
.foot{margin-top:14px;display:flex;gap:24px;align-items:center;flex-wrap:wrap}
.chip{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--muted)}
.dot{width:12px;height:12px;border-radius:3px}
.badge{display:inline-flex;align-items:center;gap:6px;background:#fff;border:1px solid var(--line);border-radius:999px;padding:5px 11px;font-size:12px;color:var(--navy);font-weight:600}
.section{background:var(--paper);border:1px solid var(--line);border-radius:18px;padding:22px 24px;margin-bottom:16px;box-shadow:0 6px 22px rgba(28,47,87,.05)}
.secTitle{font-size:13px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin-bottom:16px}
.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
.grid2{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}
.gcard{background:var(--soft);border:1px solid #DCE5F3;border-radius:14px;padding:15px 16px}
.gcard .gT{font-size:15.5px;font-weight:800;color:var(--blue2);font-family:monospace;display:flex;align-items:center;gap:9px}
.gcard .gD{font-size:12.5px;color:var(--muted);line-height:1.4;margin-top:5px}
.gicon{font-size:19px}
.node{background:var(--soft);border:1px solid #D5E0F1;border-radius:11px;padding:9px 14px;font-weight:800;font-size:14px;color:var(--navy);white-space:nowrap}
.node.leaf{background:var(--teal-soft);border-color:#BDEBDF;color:#0a7a5c;font-size:13px}
.node.prod{background:var(--orange-soft);border-color:#F3C8AC;color:#b4551a}
.node.sm{font-size:12.5px;padding:7px 11px}
.cx{color:#A9B8D2;font-size:20px;font-weight:800;padding:0 10px}
.card{background:var(--paper);border:1px solid var(--line);border-radius:16px;padding:16px 18px;box-shadow:0 6px 20px rgba(28,47,87,.05)}
.seqrow{display:flex;align-items:center;gap:16px;padding:14px 4px;border-bottom:1px dashed var(--line)}
.seqrow:last-child{border-bottom:none}
.seqnum{width:30px;height:30px;border-radius:50%;background:var(--navy);color:#fff;font-weight:800;font-size:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.seqnum.pay{background:var(--orange)}.seqnum.ok{background:var(--teal)}
.actor{background:#fff;border:1.5px solid var(--blue);color:var(--blue2);border-radius:999px;padding:5px 12px;font-size:12.5px;font-weight:700;white-space:nowrap}
.actor.ext{border-color:var(--orange);color:var(--orange)}
.sarrow{color:#9fb0cd;font-weight:800}
.seqTxt{flex:1;font-size:14px;color:var(--ink)}
.seqTxt b{color:var(--navy)}
.note{background:var(--orange-soft);border:1px solid #F3C8AC;border-radius:12px;padding:12px 16px;font-size:13px;color:#8a3d10;margin-top:14px}
.mediarow{display:flex;gap:10px;flex-wrap:wrap;margin-top:6px}
.mpill{display:flex;align-items:center;gap:7px;background:#fff;border:1px solid var(--line);border-radius:10px;padding:8px 12px;font-size:13px;font-weight:600;color:var(--ink)}
.tree{font-family:monospace;font-size:14px;line-height:1.9;color:var(--ink)}
.tree .lv1{color:var(--navy);font-weight:800}
.tree .lv2{color:var(--blue2);font-weight:700}
.tree .lv3{color:#0a7a5c}
.tierlbl{font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;margin-bottom:12px;display:flex;align-items:center;gap:8px;color:var(--muted)}
.pill{width:10px;height:10px;border-radius:3px}
`;

const page1 = (title, sub, tag, tagCls, body) => `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>${CSS}</style></head>
<body><div class="page"><div class="head"><div class="brand"><img class="logo" src="${LOGO}" alt="HBC">
<div><h1>${title}</h1><div class="sub">${sub}</div></div></div><div class="${tagCls}">${tag}</div></div>${body}</div></body></html>`;

/* helpers */
const step = (n, t, s, cls = "") => `<div class="step ${cls}"><div class="stepTop"><div class="num">${n}</div><div class="stepT">${t}</div></div><div class="stepS">${s}</div></div>`;
const AR = `<div class="arrow">›</div>`;
const lane = (ic, icCls, name, role, steps) => `<div class="lane"><div class="lanehdr"><div class="ic ${icCls}">${ic}</div><div><div class="laneName">${name}</div><div class="laneRole">${role}</div></div></div><div class="flow">${steps}</div></div>`;
const actorHtml = (a) => `<span class="actor ${a && a.ext ? "ext" : ""}">${(a && a.label) || a}</span>`;
const seq = (n, from, arrow, to, txt, cls = "") => `<div class="seqrow"><div class="seqnum ${cls}">${n}</div>${actorHtml(from)}<span class="sarrow">${arrow}</span>${actorHtml(to)}<div class="seqTxt">${txt}</div></div>`;

/* ============ FIGURES MÉTIER ============ */
const TAGM = "Vue MÉTIER — ce que vit l'utilisateur";

const M_overview = page1("Flux métier — vue d'ensemble", "Parcours utilisateurs de bout en bout · vue fonctionnelle", TAGM, "tag-m",
  lane("🎓", "b", "Apprenant", "Visiteur → apprenant payant",
    step(1, "Découvre", "Catalogue sur la vitrine") + AR + step(2, "S'inscrit", "Sans compte (invité)") + AR +
    step(3, "Paie", "Mobile Money · Tara", "pay") + AR + step(4, "Accède", "Lien magique → espace") + AR +
    step(5, "Apprend", "Vidéo · audio · quiz", "goal")) +
  lane("💼", "o", "Candidat", "Recrutement",
    step(1, "Consulte", "Offres d'emploi") + AR + step(2, "Postule", "Formulaire + CV") + AR + step(3, "Accusé", "E-mail auto", "goal")) +
  lane("📄", "b", "Visiteur", "Ressources",
    step(1, "Parcourt", "Espace ressources") + AR + step(2, "Télécharge", "Document mis à dispo", "goal")) +
  lane("🛠️", "t", "Formateur · Admin", "Création de contenu",
    step(1, "Crée la formation", "+ hiérarchie complète") + AR + step(2, "Structure", "Arbre séance→activité") + AR +
    step(3, "Enrichit", "Média · quiz · docs") + AR + step(4, "Publie & relie", "Produit ↔ formation", "goal")) +
  lane("🔄", "o", "Système · Relance", "Recouvrement des paiements",
    step(1, "Réconciliation", "django-q interroge Tara") + AR + step(2, "Rattrapage", "Validé → confirmé", "goal") + AR +
    step(3, "Alerte admin", "Si bloqué > 1h", "pay") + AR + step(4, "Timeout", "Abandon après 24h")) +
  `<div class="foot"><span class="badge">✉️ E-mails automatiques (Brevo) aux étapes clés</span>
  <span class="chip"><span class="dot" style="background:var(--blue)"></span> étape</span>
  <span class="chip"><span class="dot" style="background:var(--orange)"></span> paiement</span>
  <span class="chip"><span class="dot" style="background:var(--teal)"></span> valeur délivrée</span></div>`);

const M_apprenant = page1("Parcours Apprenant — inscription → apprentissage", "De la découverte d'une formation à l'accès au contenu pédagogique", TAGM, "tag-m",
  `<div class="section"><div class="secTitle">1 · Du visiteur à l'accès payant</div>
  <div class="flow">${step(1,"Catalogue","Vitrine publique — liste des formations")}${AR}${step(2,"Inscription invité","Prénom · email — aucun compte requis")}${AR}${step(3,"Paiement","Mobile Money MTN / Orange (Tara)","pay")}${AR}${step(4,"Confirmation","Webhook ou réconciliation")}${AR}${step(5,"E-mail + lien magique","Accès sécurisé à l'espace","goal")}</div></div>
  <div class="section"><div class="secTitle">2 · Dans l'espace apprenant</div>
  <div class="mediarow">
  <span class="mpill">📹 Vidéo (embed ou fichier)</span>
  <span class="mpill">🔊 Audio (SoundCloud ou fichier)</span>
  <span class="mpill">📝 Quiz noté (score + tentatives)</span>
  <span class="mpill">📈 Progression par activité</span>
  <span class="mpill">🗓️ Planning des séances</span>
  <span class="mpill">📎 Documents (PDF / liens)</span></div></div>
  <div class="note">🔐 Le contenu se débloque car la <b>Publication payée</b> est reliée à la <b>formation (thème)</b> — l'apprenant accède exactement à ce qu'il a acheté.</div>`);

const M_paiement = page1("Parcours Paiement — Mobile Money (Tara)", "Séquence d'un encaissement, du push STK à la confirmation", TAGM, "tag-m",
  `<div class="section"><div class="secTitle">Séquence de paiement</div>
  ${seq(1,"Apprenant","→","Vitrine","Choisit la formation et saisit son numéro (MTN / Orange).")}
  ${seq(2,"API","→",{label:"Tara",ext:true},"<b>init_payin</b> — déclenche le <b>push STK</b> vers le téléphone.","pay")}
  ${seq(3,{label:"Tara",ext:true},"→","Téléphone","L'apprenant <b>valide avec son code PIN</b> MoMo / Orange.","pay")}
  ${seq(4,{label:"Tara",ext:true},"→","API","<b>Webhook</b> de confirmation (HTTPS) … ou <b>réconciliation</b> si indisponible.")}
  ${seq(5,"API","→","API","Commande → <b>payée</b>, inscription → <b>confirmée</b>, retrait du panier.","ok")}
  ${seq(6,"API","→",{label:"Brevo",ext:true},"E-mail <b>« paiement reçu »</b> + <b>lien magique</b> vers l'espace apprenant.","ok")}
  </div>
  <div class="note">🛡️ Robustesse : si le webhook n'arrive pas, un <b>cron de réconciliation (django-q)</b> interroge Tara et clôt le paiement — aucun encaissement perdu.</div>`);

const M_recrutement = page1("Parcours Recrutement", "Du dépôt de candidature à son traitement", TAGM, "tag-m",
  lane("💼","o","Candidat","Côté public",
    step(1,"Consulte","Offres d'emploi publiées")+AR+step(2,"Postule","Formulaire + upload du CV")+AR+step(3,"Accusé reçu","E-mail de confirmation auto","goal")) +
  lane("🧑‍💼","t","Recruteur","Côté back-office",
    step(1,"Reçoit","Notification de candidature")+AR+step(2,"Consulte","Dossier + CV téléchargeable")+AR+step(3,"Traite","Suivi du statut","goal")) +
  `<div class="note" style="background:var(--teal-soft);border-color:#BDEBDF;color:#0a7a5c">📎 Le <b>CV est stocké</b> et rattaché à l'offre ; le candidat comme le recruteur reçoivent les e-mails appropriés (Brevo).</div>`);

const M_authoring = page1("Parcours Authoring — création de contenu", "Comment le formateur construit une formation complète", TAGM, "tag-m",
  `<div class="section"><div class="secTitle">1 · Créer la formation & sa hiérarchie</div>
  <div class="flow">${step(1,"Session","Année scolaire")}<span class="cx">›</span>${step(2,"Séquence","N° d'ordre")}<span class="cx">›</span>${step(3,"Catégorie","Domaine")}<span class="cx">›</span>${step(4,"Classe / niveau","Public cible")}<span class="cx">›</span>${step(5,"Formation (thème)","Créée dans le dashboard","goal")}</div></div>
  <div class="grid2">
  <div class="section" style="margin:0"><div class="secTitle">2 · Structurer (vue en arbre)</div>
  <div class="tree"><div class="lv1">▾ 📘 Formation</div><div class="lv2">&nbsp;&nbsp;▾ 🎬 Séance 1</div>
  <div class="lv3">&nbsp;&nbsp;&nbsp;&nbsp;▾ Activité — Introduction</div>
  <div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;• Texte &nbsp;• Vidéo &nbsp;• Audio</div>
  <div class="lv3">&nbsp;&nbsp;&nbsp;&nbsp;▾ Activité — Quiz</div>
  <div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;• Questions notées</div></div></div>
  <div class="section" style="margin:0"><div class="secTitle">3 · Enrichir & publier</div>
  <div class="mediarow"><span class="mpill">✍️ Texte</span><span class="mpill">🖼️ Image</span><span class="mpill">📹 Vidéo (upload/embed)</span><span class="mpill">🔊 Audio (upload/embed)</span><span class="mpill">📝 Quiz</span><span class="mpill">📎 Documents</span></div>
  <div style="margin-top:16px;display:flex;align-items:center;gap:10px"><span class="node prod">Publication (produit payant)</span><span class="cx">⟷</span><span class="node" style="background:#E7EEFB">Formation (thème)</span></div>
  <div style="font-size:12.5px;color:var(--muted);margin-top:8px">On relie le produit à la formation → l'achat débloque le contenu.</div></div>
  </div>`);

const M_relance = page1("Relance & recouvrement — paiements en attente", "Aucun paiement réellement validé n'est perdu : rattrapage automatique + alerte", TAGM, "tag-m",
  `<div class="section"><div class="secTitle">Cycle de vie d'un paiement en attente</div>
  ${seq(1,"Apprenant","→","Vitrine","Paiement initié mais <b>non validé</b> sur le téléphone → statut <b>en attente</b>.")}
  ${seq(2,"django-q","→",{label:"Tara",ext:true},"<b>Réconciliation</b> périodique : interroge Tara sur les paiements en attente (appel sortant).")}
  ${seq(3,{label:"Tara",ext:true},"→","API","Validé entre-temps → <b>rattrapage automatique</b> : commande confirmée, accès débloqué.","ok")}
  ${seq(4,"API","→",{label:"Admins",ext:true},"Bloqué <b>&gt; 1h</b> → e-mail d'<b>alerte</b> récapitulatif → <b>relance manuelle</b> possible.","pay")}
  ${seq(5,"API","→","API","Sans confirmation après <b>24h</b> → paiement <b>abandonné</b> (timeout).")}
  </div>
  <div class="note" style="background:var(--teal-soft);border-color:#BDEBDF;color:#0a7a5c">🛡️ Résilience : même si le webhook Tara n'arrive jamais, la réconciliation rattrape les paiements réellement validés — et les cas douteux sont remontés aux admins pour relance.</div>`);

/* ============ FIGURES ARCHITECTURE ============ */
const TAGA = "Vue ARCHITECTURE — le code / la stack";

const A_overview = page1("Architecture applicative — vue d'ensemble", "Stack découplée · 3 tiers", TAGA, "tag-a",
  `<div style="display:flex;align-items:stretch">
  <div style="flex:1"><div class="tierlbl"><span class="pill" style="background:#3b3bbf"></span> Frontends · Next.js</div>
  <div class="card" style="margin-bottom:14px"><div style="font-size:16px;font-weight:800;color:var(--navy)">🌐 Vitrine publique</div><div style="font-size:12px;color:var(--muted);margin-top:3px">Site visiteur · SSR/ISR · <code>:3000</code></div></div>
  <div class="card"><div style="font-size:16px;font-weight:800;color:var(--navy)">🛠️ Dashboard CMS</div><div style="font-size:12px;color:var(--muted);margin-top:3px">Back-office équipe · <code>:3007</code></div></div></div>
  <div style="width:72px;flex-shrink:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px"><div style="font-size:10.5px;color:var(--muted);text-align:center;font-weight:600">HTTPS·JSON<br>JWT</div><div style="color:var(--blue);font-size:26px;font-weight:800">→</div></div>
  <div style="flex:1.2"><div class="tierlbl"><span class="pill" style="background:var(--teal)"></span> API · Django REST</div>
  <div class="card" style="height:calc(100% - 28px)"><div style="font-size:16px;font-weight:800;color:var(--navy)">⚙️ API Django <span class="badge" style="background:var(--teal-soft);color:#0a7a5c">DRF</span> <code>:8011</code></div><div style="font-size:12px;color:var(--muted);margin:4px 0 12px">Auth JWT · accès par module · médias servis</div>
  <div class="mediarow">${["sitecms","lessonapp","material","contents","bucket","recruitment","calendarapp","payments","notifications"].map(a=>`<span class="node sm" style="font-family:monospace">${a}</span>`).join("")}</div></div></div>
  <div style="width:72px;flex-shrink:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px"><div style="font-size:10.5px;color:var(--muted);text-align:center;font-weight:600">ORM · APIs</div><div style="color:var(--blue);font-size:26px;font-weight:800">→</div></div>
  <div style="flex:1"><div class="tierlbl"><span class="pill" style="background:var(--orange)"></span> Données & services</div>
  <div class="card" style="margin-bottom:12px">🗄️ <b>PostgreSQL</b><div style="font-size:12px;color:var(--muted)">SQLite en dev</div></div>
  <div class="card" style="margin-bottom:12px">💳 <b>Tara Money</b><div style="font-size:12px;color:var(--muted)">Mobile Money MTN/Orange</div></div>
  <div class="card">✉️ <b>Brevo</b><div style="font-size:12px;color:var(--muted)">E-mails transactionnels</div></div></div>
  </div>`);

const gc = (icon, name, desc) => `<div class="gcard"><div class="gT"><span class="gicon">${icon}</span>${name}</div><div class="gD">${desc}</div></div>`;
const A_modules = page1("Backend — modules Django", "Responsabilité de chaque application", TAGA, "tag-a",
  `<div class="grid3">
  ${gc("🌐","sitecms","API publique (vitrine) + endpoints des modules du dashboard, auth & rôles.")}
  ${gc("📘","lessonapp","Structure pédagogique : Thème · Séance · Activité · Bloc + hiérarchie.")}
  ${gc("🎬","material","Composants de contenu (texte/image/vidéo/audio), quiz, progression.")}
  ${gc("💠","contents","Publication = produit payant, reliée aux formations (thèmes).")}
  ${gc("🛒","bucket","Inscriptions & commandes (panier, statuts).")}
  ${gc("💼","recruitment","Offres d'emploi & candidatures (upload CV).")}
  ${gc("🗓️","calendarapp","Agenda : événements, séances, réunions visio.")}
  ${gc("💳","payments","Encaissement Tara : init, webhook, réconciliation (django-q).")}
  ${gc("✉️","notifications","Templates e-mail transactionnels (Anymail / Brevo).")}
  </div>
  <div class="note" style="background:var(--soft);border-color:#CBD8EE;color:var(--blue2)">🧩 Chaque module du dashboard est <b>gated</b> par le profil de l'utilisateur (permission <code>HasModuleAccess</code>).</div>`);

const A_domaine = page1("Modèle de domaine", "De la structure pédagogique au produit payant", TAGA, "tag-a",
  `<div class="section"><div class="secTitle">Chaîne de composition</div>
  <div class="flow" style="align-items:center;flex-wrap:wrap">
  <span class="node">Session</span><span class="cx">1—N›</span>
  <span class="node">Séquence</span><span class="cx">1—N›</span>
  <span class="node" style="background:#E7EEFB">Thème <span style="font-weight:600;font-size:12px">(formation)</span></span><span class="cx">1—N›</span>
  <span class="node">Séance</span><span class="cx">1—N›</span>
  <span class="node">Activité</span></div>
  <div style="display:flex;align-items:center;gap:12px;margin-top:18px;flex-wrap:wrap">
  <span style="font-size:13px;color:var(--muted);font-weight:700">Activité contient →</span>
  <span class="node leaf">Composant média</span><span class="node leaf">Quiz (questions)</span><span class="node leaf">Document</span></div></div>
  <div class="section"><div class="secTitle">Lien vers le commerce</div>
  <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
  <span class="node prod">Publication (produit payant)</span><span class="cx">N—N ⟷</span><span class="node" style="background:#E7EEFB">Thème (formation)</span>
  <span style="font-size:13px;color:var(--muted);margin-left:10px">+ hiérarchie de publications via <code>parent</code></span></div>
  <div style="font-size:13px;color:var(--muted);margin-top:12px">Le paiement d'une <b>Publication</b> débloque l'accès aux <b>Thèmes</b> reliés (et à tout leur contenu).</div></div>`);

const A_paiement = page1("Intégration paiement — Tara", "Deux chemins de confirmation : webhook & réconciliation", TAGA, "tag-a",
  `<div class="section"><div class="secTitle">Chemin nominal — webhook</div>
  ${seq(1,"API","→",{label:"Tara",ext:true},"<b>POST /api/tara/mobilepay</b> — init du paiement + push STK (URL webhook <b>HTTPS</b> requise).","pay")}
  ${seq(2,{label:"Tara",ext:true},"→","API","<b>POST /payments/webhook/tara/</b> — notification signée, vérif <b>businessId</b>.")}
  ${seq(3,"API","→","API","Application idempotente : commande payée, inscription confirmée.","ok")}
  </div>
  <div class="section"><div class="secTitle">Chemin de secours — réconciliation (sans webhook)</div>
  ${seq("A","django-q","→",{label:"Tara",ext:true},"Cron périodique : <b>check_status</b> sur les paiements en attente (appel sortant).")}
  ${seq("B","API","→","API","Même handler idempotent que le webhook → clôture du paiement.","ok")}
  </div>
  <div class="note">🔑 <b>Mode mock</b> automatique si les clés Tara sont absentes (dev). En prod, clés réelles + <b>PUBLIC_BASE_URL en HTTPS</b> (Tara refuse un webhook non-HTTPS).</div>`);

const A_securite = page1("Sécurité & contrôle d'accès", "Trois niveaux de protection", TAGA, "tag-a",
  `<div class="grid3">
  ${gc("🔑","JWT (SimpleJWT)","Dashboard & vitrine : access + refresh token. Rafraîchissement transparent côté client.")}
  ${gc("🧩","Gating par module","<code>HasModuleAccess</code> : chaque endpoint module vérifie le profil (comme l'admin Django).")}
  ${gc("🪪","Jetons signés invités","<code>django.core.signing</code> : commande & espace apprenant via lien signé — <b>anti-IDOR</b>, sans compte.")}
  </div>
  <div class="grid2" style="margin-top:16px">
  <div class="section" style="margin:0"><div class="secTitle">Paiement</div><div style="font-size:13.5px;color:var(--ink);line-height:1.7">• Webhook sur <b>HTTPS</b> uniquement<br>• Vérification du <b>businessId</b><br>• Traitement <b>idempotent</b> (rejeu sans effet)</div></div>
  <div class="section" style="margin:0"><div class="secTitle">Données & secrets</div><div style="font-size:13.5px;color:var(--ink);line-height:1.7">• Clés Tara / Brevo en <b>variables d'env</b> (jamais dans le code)<br>• Mots de passe invités <b>inutilisables</b><br>• Médias servis de façon contrôlée</div></div>
  </div>`);

/* ============ Rendu ============ */
const figures = [
  { dir:"metier", name:"00_vue_ensemble", html:M_overview },
  { dir:"metier", name:"01_parcours_apprenant", html:M_apprenant },
  { dir:"metier", name:"02_paiement_mobile_money", html:M_paiement },
  { dir:"metier", name:"03_recrutement", html:M_recrutement },
  { dir:"metier", name:"04_authoring", html:M_authoring },
  { dir:"metier", name:"05_relance", html:M_relance },
  { dir:"architecture", name:"00_vue_ensemble", html:A_overview },
  { dir:"architecture", name:"01_backend_modules", html:A_modules },
  { dir:"architecture", name:"02_modele_domaine", html:A_domaine },
  { dir:"architecture", name:"03_integration_paiement", html:A_paiement },
  { dir:"architecture", name:"04_securite_acces", html:A_securite },
];

const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
const page = await browser.newPage({ viewport: { width: 1680, height: 1000 }, deviceScaleFactor: 2 });
for (const f of figures) {
  await page.setContent(f.html, { waitUntil: "networkidle" });
  await page.waitForTimeout(200);
  const out = `${OUT}/${f.dir}/${f.name}.jpeg`;
  await page.locator(".page").screenshot({ path: out, type: "jpeg", quality: 95 });
  console.log("OK", `${f.dir}/${f.name}.jpeg`);
}
await browser.close();
