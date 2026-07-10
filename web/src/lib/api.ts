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
  price: string;
  categorie_name: string | null;
  image_url: string | null;
  date: string;
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

export function payInscription(token: string, payload: { phone: string; network: string }) {
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
export interface JobOffer {
  id: number;
  title: string;
  slug: string;
  department: string;
  location: string;
  contract_type: string;
  contract_label: string;
  description: string;
  profile: string;
  closing_date: string | null;
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
export interface LearnerFormation {
  publication_id: number;
  title: string;
  description: string;
  image: string | null;
  has_content: boolean;
}
export interface MySpace {
  learner: { name: string; email: string };
  formations: LearnerFormation[];
}
export interface QuizOption {
  id: number;
  title: string;
  input_type: number; // 1=checkbox 2=radio
}
export interface QuizQuestion {
  id: number;
  index: number;
  title: string;
  description: string;
  points: number;
  number: number;
  options: QuizOption[];
}
export interface LearnerDoc {
  id: number;
  index: number;
  title: string;
  description: string;
  url: string | null;
  m_type: number;
}
export interface LearnerComponent {
  id: number;
  title: string;
  paragraph: string | null;
  image: string | null;
  number: number;
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
}
export interface LearnerSeance {
  id: number;
  index: number;
  title: string;
  type: number; // 0=Théorie 1=Pratique 2=Exercice
  documents: LearnerDoc[];
  activities: LearnerActivity[];
}
export interface LearnerTheme {
  id: number;
  title: string;
  image: string | null;
  objectifs: string[];
  seances: LearnerSeance[];
}
export interface MyFormation {
  publication_id: number;
  title: string;
  description: string;
  themes: LearnerTheme[];
}

export async function getMySpace(token: string): Promise<MySpace | null> {
  try {
    const res = await fetch(`${API}/api/v1/site/mon-espace/${token}/`, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function getMyFormation(token: string, publicationId: number): Promise<MyFormation | null> {
  try {
    const res = await fetch(`${API}/api/v1/site/mon-espace/${token}/formation/${publicationId}/`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
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
