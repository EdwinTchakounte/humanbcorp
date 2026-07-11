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
  is_staff: boolean;
  is_superuser: boolean;
  groups: string[];
  modules: ModuleItem[];
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
  theme_id: number | null;
  theme_title: string | null;
  participants_count: number;
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
  classes_names: string[];
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
}

export interface ActivityItem {
  id: number;
  title: string;
  seance: number;
  a_type: number;
  a_type_label: string;
  state: number;
  is_active: boolean;
}

export interface ComponentItem {
  id: number;
  activity: number;
  title: string;
  paragraph: string | null;
  video_url: string | null;
  image_url: string | null;
  number: number;
}

export interface ActivityDocItem {
  id: number;
  activity: number;
  title: string;
  url: string | null;
  m_type: number;
}

export interface QuizOptionEdit {
  id?: number;
  title: string;
  is_answer: boolean;
}
export interface QuizQuestionItem {
  id: number;
  title: string;
  description: string;
  points: number;
  number: number;
  input_type: number; // 1=checkbox 2=radio
  options: { id: number; title: string; is_answer: boolean }[];
}

export interface FormationsOverview {
  counts: { themes: number; sessions: number; sequences: number; classes: number; categories: number };
  sessions: { id: number; year: string }[];
  sequences: { id: number; numero: number; session: number; session_year: string }[];
  categories: { id: number; name: string }[];
  classes: { id: number; name: string }[];
}

export interface PublicationItem {
  id: number;
  title: string;
  description: string;
  date: string;
  price: string;
  is_private: boolean;
  categorie: number | null;
  categorie_name: string | null;
  tags_names: string[];
  children_count: number;
  events_count: number;
  image_url: string | null;
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
