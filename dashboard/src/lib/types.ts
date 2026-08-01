export type SectionType =
  | "hero" | "stats" | "about" | "services" | "gallery"
  | "milestone" | "features" | "contact" | "cta" | "richtext";

export interface Media {
  id: number;
  title: string;
  url: string | null;
  alt: string;
  caption: string;
  tags: string;
  width: number | null;
  height: number | null;
  order: number;
  is_active: boolean;
}

export interface Card {
  id: number;
  section: number;
  order: number;
  title: string;
  title_en: string;
  text: string;
  text_en: string;
  icon: string;
  image: number | null;
  image_detail: Media | null;
  link: string;
  link_label: string;
  link_label_en: string;
  extra: Record<string, unknown>;
  is_active: boolean;
}

export interface Section {
  id: number;
  page: number;
  type: SectionType;
  anchor: string;
  order: number;
  eyebrow: string;
  eyebrow_en: string;
  title: string;
  title_en: string;
  subtitle: string;
  subtitle_en: string;
  body: string;
  body_en: string;
  bg_color: string;
  bg_image: number | null;
  bg_image_detail: Media | null;
  parallax: boolean;
  wave: boolean;
  options: Record<string, unknown>;
  is_active: boolean;
  cards: Card[];
}

export interface Page {
  id: number;
  slug: string;
  title: string;
  title_en: string;
  nav_label: string;
  nav_label_en: string;
  show_in_nav: boolean;
  order: number;
  meta_title: string;
  meta_title_en: string;
  meta_description: string;
  meta_description_en: string;
  og_image: number | null;
  is_active: boolean;
}

export interface Article {
  id: number;
  slug: string;
  title: string;
  title_en: string;
  excerpt: string;
  excerpt_en: string;
  body: string;
  body_en: string;
  cover: number | null;
  cover_detail: Media | null;
  author: string;
  category: string;
  published_at: string | null;
  order: number;
  is_active: boolean;
}

export interface ModuleItem {
  key: string;
  label: string;
  icon: string;
  native: boolean;
  can_write: boolean;
  path?: string;
  admin_path?: string;
}

export interface Profile {
  id: number;
  username: string;
  full_name: string;
  email: string;
  is_admin: boolean;
  is_teacher?: boolean;
  is_recruiter?: boolean;
  is_staff: boolean;
  is_superuser: boolean;
  groups: string[];
  modules: ModuleItem[];
}

export interface TeacherItem {
  id: number;
  name: string;
  email: string;
}

export interface EventItem {
  id: number;
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  is_test: boolean | null;
  is_active: boolean;
  user: number;
  user_name: string;
  created_at: string;
  // Cohorte (offre vendue) à laquelle appartient ce créneau — le calendrier est
  // propre à la session, pas au programme.
  publication_id: number | null;
  publication_title: string | null;
  participants_count: number;
  // Séance du programme couverte par ce créneau (« la séance 3 a lieu le 12 mars »).
  seance: number | null;
  seance_title?: string | null;
  seance_order?: number | null;
}

export interface MeetingItem {
  id: number;
  m_type: number;
  link_url: string | null;
  event: number;
  event_title: string;
  is_active: boolean;
  created_at: string;
}

export interface ThemeItem {
  id: number;
  title: string;
  is_visible: boolean;
  t_type: number;
  t_type_label: string;
  sequence: number | null;
  sequence_numero: number | null;
  session_year: string | null;
  categorie: number | null;
  categorie_name: string | null;
  classes?: number[];
  classes_names: string[];
  instructors?: number[];
  instructors_detail?: { id: number; name: string; email: string }[];
  seances_count: number;
  image_url: string | null;
  is_active: boolean;
}

export interface SeanceItem {
  id: number;
  title: string;
  theme: number;
  s_type: number;
  s_type_label: string;
  activities_count: number;
  is_active: boolean;
  order: number;
}

export interface ActivityItem {
  id: number;
  title: string;
  seance: number;
  a_type: number;
  a_type_label: string;
  state: number;
  is_active: boolean;
  order: number;
}

export interface ComponentItem {
  id: number;
  activity: number;
  title: string;
  paragraph: string | null;
  video_url: string | null;
  video_file_url?: string | null;
  audio_url?: string | null;
  audio_file_url?: string | null;
  image_url: string | null;
  number: number;
}

export interface ActivityDocItem {
  id: number;
  activity: number;
  title: string;
  url: string | null;
  m_type: number;
  mime_type?: string;
}

export interface QuizOptionEdit {
  id?: number;
  title: string;
  is_answer: boolean;
  image?: string | null;
}
export interface QuizQuestionItem {
  id: number;
  title: string;
  description: string;
  points: number;
  number: number;
  kind: number; // 1=QCM 2=Vrai/Faux 3=Texte 4=Numérique 5=Association 6=Ordonnancement
  image?: string | null;
  input_type: number; // 1=checkbox 2=radio
  options: { id: number; title: string; is_answer: boolean; image?: string | null }[];
}

export interface FormationsOverview {
  counts: { themes: number; sessions: number; sequences: number; classes: number; categories: number };
  sessions: { id: number; year: string }[];
  sequences: { id: number; numero: number; session: number; session_year: string }[];
  categories: { id: number; name: string }[];
  classes: { id: number; name: string }[];
}

export interface SuiviQuiz {
  activity_id: number;
  title: string;
  score: number;
  max_score: number;
  percent: number;
}
export interface SuiviLearner {
  id: number;
  name: string;
  email: string;
  progress: { done: number; total: number; percent: number };
  quizzes: SuiviQuiz[];
}
export interface SuiviFormation {
  id: number;
  title: string;
  // Le suivi est groupé par session (cohorte), pas par programme.
  mode?: number;
  date_debut?: string | null;
  date_fin?: string | null;
  programmes?: string[];
  activities_total: number;
  quiz_count: number;
  learners_count: number;
  learners: SuiviLearner[];
}
export interface SuiviResponse {
  formations: SuiviFormation[];
}

export interface PublicationItem {
  // Bascules d'affichage (fiche publique + flyer de partage)
  show_price?: boolean;
  show_dates?: boolean;
  show_places?: boolean;
  show_categorie?: boolean;
  id: number;
  title: string;
  description: string;
  date: string;
  price: string;
  is_private: boolean;
  categorie: number | null;
  categorie_name: string | null;
  tags_names: string[];
  themes_titles?: { id: number; title: string }[];
  parent?: number | null;
  children_count: number;
  events_count: number;
  image_url: string | null;
  // Cohorte : la Publication est la session vendue.
  mode?: number;
  date_debut?: string | null;
  date_fin?: string | null;
  capacite?: number | null;
  acces_duree_mois?: number | null;
  places_restantes?: number | null;
  // Animateurs de la session (≠ auteurs du programme, cf. ThemeItem.instructors).
  instructors?: number[];
  instructors_detail?: { id: number; name: string; email: string }[];
}

export interface PublicationsOverview {
  counts: { publications: number; public: number; categories: number; tags: number; spaces: number };
  categories: { id: number; name: string }[];
  tags: { id: number; name: string }[];
}

export interface PaiementItem {
  id: number;
  owner: number;
  owner_name: string;
  montant: string;
  status: number;
  status_label: string;
  method: number;
  method_label: string;
  tranche: number;
  is_active: boolean;
  created_at: string;
}

export interface PaiementsOverview {
  counts: { total: number; success: number; failed: number; pending: number };
  total_encaisse: number;
  statuses: { value: number; label: string }[];
  methods: { value: number; label: string }[];
}

export interface InscriptionItem {
  id: number;
  participant: number;
  participant_name: string;
  publication: number;
  publication_title: string;
  status: number;
  status_label: string;
  is_active: boolean;
  created_at: string;
}

export interface OrderItem {
  id: number;
  buyer: number;
  buyer_name: string;
  status: number;
  status_label: string;
  total_amount: string;
  is_active: boolean;
  created_at: string;
}

export interface InscriptionsOverview {
  counts: { inscriptions: number; confirmed: number; waiting: number; orders: number; orders_paid: number };
  total_orders_paid: number;
  inscription_statuses: { value: number; label: string }[];
  order_statuses: { value: number; label: string }[];
}

export interface ChatProjectItem {
  id: number;
  name: string;
  user: number;
  user_name: string;
  created_at: string;
  messages_count: number;
}

export interface ChatMessageItem {
  id: number;
  project: number;
  project_name: string;
  user: number;
  user_name: string;
  message: string;
  response: string | null;
  timestamp: string;
}

export interface MessagerieOverview {
  counts: { projects: number; messages: number; answered: number };
}

export const SECTION_TYPES: { value: SectionType; label: string }[] = [
  { value: "hero", label: "Hero" },
  { value: "stats", label: "Statistiques" },
  { value: "about", label: "À propos" },
  { value: "services", label: "Services / cartes" },
  { value: "features", label: "Pourquoi nous / atouts" },
  { value: "gallery", label: "Galerie" },
  { value: "milestone", label: "Chiffres-clés" },
  { value: "contact", label: "Contact" },
  { value: "cta", label: "Appel à l'action" },
  { value: "richtext", label: "Texte riche" },
];

// --- RH / Recrutement (super-admin, non-tenant) --------------------------
export interface JobOffer {
  id: number;
  title: string;
  slug: string;
  department: string;
  location: string;
  contract_type: string;
  contract_label: string;
  salary: string;
  description: string;
  profile: string;
  is_published: boolean;
  closing_date: string | null;
  applications_count: number;
  // Compte recruteur de suivi (lecture seule côté recruteur) ; null = HBC en propre
  owner: number | null;
  owner_name: string | null;
  // Entreprise qui recrute (révélée uniquement en premium)
  company_name: string;
  company_logo_url: string | null;
  company_website: string;
  // Formule commerciale
  plan: "classic" | "premium";
  is_featured: boolean;
  // Candidature directe (premium)
  apply_email: string;
  apply_url: string;
  apply_mode: "platform" | "direct";
  // Bascules d'affichage
  show_company: boolean;
  show_salary: boolean;
  show_location: boolean;
  show_contract: boolean;
  show_department: boolean;
  show_closing_date: boolean;
  /** Accroche calculée côté serveur — aperçu exact de ce que verra le public. */
  headline: string;
  created_at: string;
  updated_at: string;
}

export interface ApplicationItem {
  id: number;
  offer: number | null;
  offer_title: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  phone: string;
  cover_letter: string;
  cv_url: string | null;
  status: number;
  status_label: string;
  rating: number | null;
  assigned_to: number | null;
  assigned_to_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApplicationNote {
  id: number;
  body: string;
  author_name: string;
  created_at: string;
}

export interface RhOverview {
  offers: { total: number; published: number };
  applications: { total: number; rejected: number };
  pipeline: { value: number; label: string; count: number }[];
  statuses: { value: number; label: string }[];
}

/** Vue d'ensemble du monitoring (santé technique + activité). */
export interface MonitoringOverview {
  statut: "ok" | "attention" | "critique";
  alertes: string[];
  genere_le: string;
  services: {
    database: "ok" | "down";
    scheduler: { running: boolean; schedules: number; last_success: string | null };
  };
  paiements: { en_attente: number; bloques: number; seuil_minutes: number; valides_24h: number };
  webhooks_erreurs_24h: number;
  emails_echec_24h: number;
  activite_recente: {
    id: number; action: string; entite_type: string; entite_id: string;
    user: string | null; created_at: string;
  }[];
}

/** Une entrée du journal d'audit (action sensible tracée). */
export interface AuditEntry {
  id: number;
  action: string;
  entite_type: string;
  entite_id: string;
  user: number | null;
  user_name: string | null;
  details: Record<string, unknown>;
  ip: string;
  created_at: string;
}

export interface AuditFacets {
  actions: string[];
  entite_types: string[];
  total: number;
}

/** Espace recruteur (lecture seule) : sous-ensemble des offres du compte. */
export interface RecruiterOffer {
  id: number;
  title: string;
  slug: string;
  department: string;
  location: string;
  contract_type: string;
  contract_label: string;
  salary: string;
  is_published: boolean;
  closing_date: string | null;
  applications_count: number;
  plan: "classic" | "premium";
  is_featured: boolean;
  created_at: string;
}

/** Espace recruteur : dossier candidat visible (sans notes internes HBC). */
export interface RecruiterApplication {
  id: number;
  offer: number | null;
  offer_title: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  phone: string;
  cover_letter: string;
  cv_url: string | null;
  status: number;
  status_label: string;
  rating: number | null;
  created_at: string;
  updated_at: string;
}
