import type { ArticleDetail, ArticleListItem, NavItem, PageContent, SiteSettings } from "./types";

export type Lang = "fr" | "en";

const API = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8011";
// Revalidation ISR (secondes) : le contenu édité dans le dashboard réapparaît sans redéploiement.
const REVALIDATE = Number(process.env.NEXT_PUBLIC_REVALIDATE || 60);

function q(lang: Lang, extra = ""): string {
  const parts = [lang === "en" ? "lang=en" : "", extra].filter(Boolean);
  return parts.length ? `?${parts.join("&")}` : "";
}

async function get<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API}/api/v1${path}`, { next: { revalidate: REVALIDATE } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function getNav(lang: Lang = "fr"): Promise<NavItem[]> {
  const data = await get<{ results?: NavItem[] } | NavItem[]>(`/site/nav/${q(lang)}`);
  if (!data) return [];
  return Array.isArray(data) ? data : data.results ?? [];
}

export function getPage(slug: string, lang: Lang = "fr"): Promise<PageContent | null> {
  return get<PageContent>(`/site/pages/${slug}/${q(lang)}`);
}

export function getSettings(lang: Lang = "fr"): Promise<SiteSettings | null> {
  return get<SiteSettings>(`/site/settings/${q(lang)}`);
}

export async function getArticles(lang: Lang = "fr"): Promise<ArticleListItem[]> {
  const data = await get<{ results?: ArticleListItem[] } | ArticleListItem[]>(`/site/articles/${q(lang)}`);
  if (!data) return [];
  return Array.isArray(data) ? data : data.results ?? [];
}

export function getArticle(slug: string, lang: Lang = "fr"): Promise<ArticleDetail | null> {
  return get<ArticleDetail>(`/site/articles/${slug}/${q(lang)}`);
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function sendChat(
  messages: ChatMessage[]
): Promise<{ ok: boolean; reply?: string; detail?: string }> {
  try {
    const res = await fetch(`${API}/api/v1/chat/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, detail: data.detail || "Chat indisponible." };
    return { ok: true, reply: data.reply };
  } catch {
    return { ok: false, detail: "Réseau indisponible." };
  }
}

// ---------------------------------------------------------------------------
// Formations publiques + inscription/paiement invité
// ---------------------------------------------------------------------------
export interface PublicFormation {
  id: number;
  title: string;
  description: string;
  /** `null` si le responsable a masqué le prix (≠ gratuit). */
  price: string | null;
  categorie_name: string | null;
  image_url: string | null;
  date: string;
  // Session vendue : dates et places, ou accès libre (mode 2).
  mode: number;
  date_debut: string | null;
  date_fin: string | null;
  capacite: number | null;
  places_restantes: number | null;
  complete: boolean;
  /** École organisatrice — `null` tant que tout relève de HBC-RH. */
  ecole: string | null;
}

export async function getFormations(): Promise<PublicFormation[]> {
  const data = await get<{ results?: PublicFormation[] }>(`/site/formations/`);
  return data?.results ?? [];
}

export async function getFormation(id: string | number): Promise<PublicFormation | null> {
  return get<PublicFormation>(`/site/formations/${id}/`);
}

async function post<T>(path: string, body: unknown): Promise<{ ok: boolean; status: number; data: T }> {
  const res = await fetch(`${API}/api/v1${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as T;
  return { ok: res.ok, status: res.status, data };
}

export interface InscriptionResult {
  detail: string;
  order_token: string;
  order_id: number;
  amount: string;
  formation_title: string;
}

export function createInscription(payload: {
  formation_id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
}) {
  return post<InscriptionResult & { detail: string }>(`/site/inscription/`, payload);
}

// --- Panier de session anonyme (vitrine) : checkout batch multi-formations / multi-enfants ---
export interface CheckoutItem {
  formation_id: number;
  pour_moi?: boolean;
  participant?: { first_name: string; last_name: string; email: string };
}

export interface CheckoutResult {
  detail: string;
  order_token?: string;
  order_id: number;
  amount: string;
  nb_lignes: number;
  ignores?: { email: string; formation?: string; raison: string }[];
  paid: boolean;
}

export function checkoutPanier(payload: {
  acheteur: { email: string; first_name: string; last_name: string };
  adresse: {
    ligne1?: string;
    ligne2?: string;
    ville?: string;
    region?: string;
    pays?: string;
    telephone?: string;
  };
  items: CheckoutItem[];
}) {
  return post<CheckoutResult>(`/site/panier/checkout/`, payload);
}

export function payInscription(token: string, payload: { phone: string; network?: string }) {
  return post<{ detail: string; reference?: string; payment_url?: string | null }>(
    `/site/inscription/${token}/payer/`,
    payload
  );
}

export async function getInscriptionStatus(
  token: string
): Promise<{ order_id: number; status: number; paid: boolean; amount: string } | null> {
  try {
    const res = await fetch(`${API}/api/v1/site/inscription/${token}/`, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Recrutement — offres d'emploi + candidature publique
// ---------------------------------------------------------------------------
/** Entreprise révélée (offre premium non anonymisée) ; `null` sinon. */
export interface OfferCompany {
  name: string;
  logo: string | null;
  website: string | null;
}

export interface JobOffer {
  id: number;
  title: string;
  slug: string;
  /** « UCB recrute » ou « Une entreprise recrute » — calculé côté serveur. */
  headline: string;
  company: OfferCompany | null;
  // Ces champs valent `null` quand le recruteur les a désactivés ou laissés
  // vides : le rendu doit donc les traiter comme optionnels.
  department: string | null;
  location: string | null;
  contract_label: string | null;
  salary: string | null;
  description: string;
  profile: string;
  closing_date: string | null;
  is_featured: boolean;
  /** `platform` = formulaire HBC-RH ; `direct` = candidature chez le client. */
  apply: { mode: "platform" | "direct"; target: string | null };
  created_at: string;
}

export async function getOffers(): Promise<JobOffer[]> {
  const data = await get<{ results?: JobOffer[] }>(`/site/offres/`);
  return data?.results ?? [];
}

export async function getOffer(slug: string): Promise<JobOffer | null> {
  return get<JobOffer>(`/site/offres/${slug}/`);
}

export async function submitCandidature(
  form: FormData
): Promise<{ ok: boolean; detail: string }> {
  try {
    // Pas de Content-Type manuel : le navigateur pose la boundary multipart.
    const res = await fetch(`${API}/api/v1/site/candidature/`, { method: "POST", body: form });
    const data = await res.json().catch(() => ({}));
    const detail =
      data.detail ||
      (typeof data === "object" ? Object.values(data).flat().join(" ") : "") ||
      (res.ok ? "Candidature envoyée." : "Échec de l'envoi.");
    return { ok: res.ok, detail };
  } catch {
    return { ok: false, detail: "Réseau indisponible." };
  }
}

// ---------------------------------------------------------------------------
// Espace apprenant (lien magique) — contenu des formations achetées
// ---------------------------------------------------------------------------
export interface Progress {
  done: number;
  total: number;
  percent: number;
}
export interface LearnerFormation {
  publication_id: number;
  title: string;
  description: string;
  image: string | null;
  has_content: boolean;
  progress: Progress;
  // Du contenu a été ajouté/modifié depuis la dernière consultation → badge « MàJ ».
  has_update?: boolean;
  // Session : dates et échéance d'accès (durée configurée sur l'offre).
  mode: number;
  date_debut: string | null;
  date_fin: string | null;
  acces_fin: string | null;
  acces_expire: boolean;
}
export interface MySpace {
  learner: { name: string; email: string };
  formations: LearnerFormation[];
  // URL d'abonnement iCalendar : collée dans Google Agenda, elle synchronise
  // les séances et suit leurs déplacements.
  agenda_url: string;
}
export interface QuizOption {
  id: number;
  title: string;
  input_type: number; // 1=checkbox 2=radio
  /** Image de l'option (quiz à choix d'images) ; `null` si option textuelle. */
  image?: string | null;
}
export interface MatchLeft {
  id: number;
  text: string;
}
export interface OrderItem {
  id: number;
  text: string;
}
export interface QuizQuestion {
  id: number;
  index: number;
  title: string;
  description: string;
  /** 1=QCM, 2=Vrai/Faux, 3=Texte, 4=Numérique, 5=Association, 6=Ordonnancement. */
  kind?: number;
  /** Illustration de l'énoncé ; `null` si aucune. */
  image?: string | null;
  points: number;
  number: number;
  options: QuizOption[];
  /** Association : colonne gauche (à relier). */
  match_left?: MatchLeft[];
  /** Association : colonne droite mélangée (choix). */
  match_right?: string[];
  /** Ordonnancement : éléments mélangés à remettre dans l'ordre. */
  order_items?: OrderItem[];
}
export interface LearnerDoc {
  id: number;
  index: number;
  title: string;
  description: string;
  url: string | null;
  m_type: number;
  mime_type?: string;
}
export interface LearnerComponent {
  id: number;
  title: string;
  paragraph: string | null;
  image: string | null;
  video_url: string | null;
  video_file: string | null;
  audio_url: string | null;
  audio_file: string | null;
  number: number;
}
export interface QuizResult {
  question_id: number;
  is_correct: boolean;
  points: number;
  points_earned: number;
  correct_option_ids: number[];
  selected_option_ids: number[];
  /** 1=QCM 2=Vrai/Faux 3=Texte libre 4=Numérique. */
  kind?: number;
  /** Texte/numérique : ce que l'apprenant a saisi. */
  given_text?: string;
  /** Texte/numérique : réponses acceptées (révélées après correction). */
  correct_values?: string[];
  /** Association : paires correctes (révélées après correction). */
  correct_pairs?: { left: string; right: string }[];
  /** Ordonnancement : ordre correct (révélé après correction). */
  correct_order?: string[];
}
export interface SubmitQuizResponse {
  score: number;
  max_score: number;
  results: QuizResult[];
}
export interface LearnerActivity {
  id: number;
  index: number;
  title: string;
  type: number; // 1=Quizz 2=PDF 3=Link
  state: number;
  documents: LearnerDoc[];
  questions: QuizQuestion[];
  components: LearnerComponent[];
  last_attempt: { score: number; max_score: number } | null;
  completed: boolean;
}
export interface LearnerSeance {
  id: number;
  index: number;
  title: string;
  type: number; // 0=Théorie 1=Pratique 2=Exercice
  documents: LearnerDoc[];
  activities: LearnerActivity[];
}
export interface ScheduleMeeting {
  m_type: number; // 0=Google Meet 1=Zoom 2=Présentiel
  link_url: string | null;
}
export interface ScheduleEvent {
  id: number;
  title: string;
  start_time: string;
  end_time: string;
  meetings: ScheduleMeeting[];
  // Séance du programme couverte par ce créneau, si c'en est une.
  seance_id: number | null;
  seance_title: string | null;
  seance_order: number | null;
}
export interface LearnerTheme {
  id: number;
  title: string;
  image: string | null;
  objectifs: string[];
  seances: LearnerSeance[];
  progress: Progress;
}
export interface MyFormation {
  publication_id: number;
  title: string;
  description: string;
  // Le planning appartient à la cohorte (la session vendue), pas au programme :
  // deux sessions d'une même formation ont chacune leurs dates.
  schedule: ScheduleEvent[];
  themes: LearnerTheme[];
}

// ---------------------------------------------------------------------------
// Session apprenant : deux voies vers le MÊME contenu (cf. backend learner.py).
//  - "magic" : lien signé reçu par e-mail (sans compte)  → /site/mon-espace/<token>/…
//  - "jwt"   : compte activé (e-mail + mot de passe)      → /site/apprenant/…  (Bearer)
// ---------------------------------------------------------------------------
export type LearnerSession =
  | { kind: "magic"; token: string }
  | { kind: "jwt"; access: string };

/** URL + en-têtes d'un endpoint espace apprenant, selon la voie d'accès. */
function learnerReq(s: LearnerSession, suffix: string): { url: string; headers: Record<string, string> } {
  if (s.kind === "jwt") {
    // L'espace lui-même est à /site/apprenant/mon-espace/ ; les sous-ressources
    // (formation, quiz, panier…) partagent le même suffixe que la voie magique.
    const path = suffix === "" ? "mon-espace/" : suffix;
    return { url: `${API}/api/v1/site/apprenant/${path}`, headers: { Authorization: `Bearer ${s.access}` } };
  }
  return { url: `${API}/api/v1/site/mon-espace/${s.token}/${suffix}`, headers: {} };
}

// ---------------------------------------------------------------------------
// Connexion unifiée : /auth/token/ authentifie N'IMPORTE quel compte et renvoie
// le `profile` (rôle + modules), qui décide de la redirection (staff → dashboard,
// apprenant → son espace). Le JWT obtenu ouvre aussi les endpoints /site/apprenant/*.
// ---------------------------------------------------------------------------
export interface AuthModule {
  key: string;
  native: boolean;
  path: string;
}
export interface AuthProfile {
  id: number;
  username: string;
  full_name: string;
  email: string;
  is_admin: boolean;
  is_teacher: boolean;
  is_recruiter: boolean;
  is_staff: boolean;
  is_superuser: boolean;
  groups: string[];
  modules: AuthModule[];
}
export interface LoginResult {
  access: string;
  refresh: string;
  profile: AuthProfile;
}

export async function login(
  username: string,
  password: string
): Promise<{ ok: boolean; data: LoginResult | null; detail: string }> {
  try {
    const res = await fetch(`${API}/api/v1/auth/token/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      return { ok: false, data: null, detail: (data && data.detail) || "Identifiants invalides." };
    }
    return { ok: true, data: data as LoginResult, detail: "" };
  } catch {
    return { ok: false, data: null, detail: "Connexion impossible." };
  }
}

/** Un profil avec des modules ou un statut staff = compte dashboard (pas un apprenant). */
export function isStaffProfile(p: AuthProfile): boolean {
  return (
    p.is_staff ||
    p.is_superuser ||
    p.is_admin ||
    p.is_teacher ||
    p.is_recruiter ||
    (p.modules?.length ?? 0) > 0
  );
}

export async function getMySpace(session: LearnerSession): Promise<MySpace | null> {
  try {
    const { url, headers } = learnerReq(session, "");
    const res = await fetch(url, { cache: "no-store", headers });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function getMyFormation(session: LearnerSession, publicationId: number): Promise<MyFormation | null> {
  try {
    const { url, headers } = learnerReq(session, `formation/${publicationId}/`);
    const res = await fetch(url, { cache: "no-store", headers });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function submitQuiz(
  session: LearnerSession,
  activityId: number,
  // Valeur selon le type : ids (QCM/VF/ordre), texte (texte/num), map {leftId:right} (assoc).
  answers: Record<number, unknown>
): Promise<SubmitQuizResponse | null> {
  try {
    const { url, headers } = learnerReq(session, `quiz/${activityId}/`);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ answers }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function markActivity(session: LearnerSession, activityId: number, done: boolean): Promise<boolean> {
  try {
    const { url, headers } = learnerReq(session, `activite/${activityId}/terminer/`);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ done }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Panier — souscrire à d'autres formations depuis son espace, pour soi ou pour
// des proches (typiquement un parent qui inscrit ses enfants).
// ---------------------------------------------------------------------------
export interface CatalogueItem extends PublicFormation {
  deja_inscrit: boolean;
  au_panier: boolean;
}
export interface PanierLigne {
  inscription_id: number;
  publication_id: number;
  formation: string;
  prix: string;
  participant: { id: number; nom: string; email: string };
}
export interface Panier {
  lignes: PanierLigne[];
  total: string;
  nb_lignes: number;
  nb_participants: number;
  /** Renseignés seulement en réponse à un ajout. */
  ignores?: { email: string; raison: string }[];
}
export interface Participant {
  first_name: string;
  last_name?: string;
  email: string;
}
export interface ApprenantSuivi {
  nom: string;
  email: string;
  compte_actif: boolean;
  formations: {
    publication_id: number;
    titre: string;
    confirmee: boolean;
    commande_id: number;
    payee: boolean;
  }[];
}

async function panierPost<T>(
  url: string,
  headers: Record<string, string>,
  body: unknown
): Promise<{ ok: boolean; data: T | null; detail: string }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    return {
      ok: res.ok,
      data: res.ok ? (data as T) : null,
      detail: (data && (data as { detail?: string }).detail) || (res.ok ? "" : "Une erreur est survenue."),
    };
  } catch {
    return { ok: false, data: null, detail: "Connexion impossible." };
  }
}

export async function getCatalogueApprenant(session: LearnerSession): Promise<CatalogueItem[]> {
  try {
    const { url, headers } = learnerReq(session, "catalogue/");
    const res = await fetch(url, { cache: "no-store", headers });
    if (!res.ok) return [];
    return (await res.json()).formations ?? [];
  } catch {
    return [];
  }
}

export async function getPanier(session: LearnerSession): Promise<Panier | null> {
  try {
    const { url, headers } = learnerReq(session, "panier/");
    const res = await fetch(url, { cache: "no-store", headers });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** `pourMoi` est explicite : on peut s'inscrire soi-même ET inscrire des proches. */
export async function ajouterAuPanier(
  session: LearnerSession,
  publicationId: number,
  participants: Participant[],
  pourMoi: boolean
) {
  const { url, headers } = learnerReq(session, "panier/ajouter/");
  return panierPost<Panier>(url, headers, {
    publication_id: publicationId,
    pour_moi: pourMoi,
    participants,
  });
}

export async function retirerDuPanier(session: LearnerSession, inscriptionId: number) {
  const { url, headers } = learnerReq(session, "panier/retirer/");
  return panierPost<Panier>(url, headers, { inscription_id: inscriptionId });
}

export interface CommandeCreee {
  order_id: number;
  order_token?: string;
  amount: string;
  paid: boolean;
}
export async function commanderPanier(session: LearnerSession) {
  const { url, headers } = learnerReq(session, "panier/commander/");
  return panierPost<CommandeCreee>(url, headers, {});
}

export async function getMesApprenants(session: LearnerSession): Promise<ApprenantSuivi[]> {
  try {
    const { url, headers } = learnerReq(session, "mes-apprenants/");
    const res = await fetch(url, { cache: "no-store", headers });
    if (!res.ok) return [];
    return (await res.json()).apprenants ?? [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Documents téléchargeables publics
// ---------------------------------------------------------------------------
export interface PublicDocument {
  id: number;
  title: string;
  description: string;
  category: string;
  file_url: string;
  size: number | null;
  ext: string;
}

export async function getDocuments(): Promise<PublicDocument[]> {
  const data = await get<{ results?: PublicDocument[] }>(`/site/documents/`);
  return data?.results ?? [];
}

export async function submitContact(payload: Record<string, string>): Promise<{ ok: boolean; detail: string }> {
  try {
    const res = await fetch(`${API}/api/v1/contact/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, detail: data.detail || (res.ok ? "Message envoyé." : "Échec de l'envoi.") };
  } catch {
    return { ok: false, detail: "Réseau indisponible." };
  }
}
