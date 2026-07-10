export type SectionType =
  | "hero" | "stats" | "about" | "services" | "gallery"
  | "milestone" | "features" | "contact" | "cta" | "richtext";

export interface Media {
  id: number;
  title: string;
  url: string | null;
  alt: string;
  caption: string;
  width: number | null;
  height: number | null;
}

export interface Card {
  id: number;
  order: number;
  title: string;
  text: string;
  icon: string;
  image: Media | null;
  link: string;
  link_label: string;
  extra: Record<string, unknown>;
}

export interface Section {
  id: number;
  type: SectionType;
  anchor: string;
  order: number;
  eyebrow: string;
  title: string;
  subtitle: string;
  body: string;
  bg_color: string;
  bg_image: Media | null;
  parallax: boolean;
  wave: boolean;
  options: Record<string, unknown>;
  cards: Card[];
}

export interface PageContent {
  id: number;
  slug: string;
  title: string;
  nav_label: string;
  meta_title: string;
  meta_description: string;
  og_image: Media | null;
  sections: Section[];
}

export interface ArticleListItem {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  cover: Media | null;
  author: string;
  category: string;
  published_at: string | null;
}

export interface ArticleDetail extends ArticleListItem {
  body: string;
}

export interface NavItem {
  slug: string;
  title: string;
  nav_label: string;
  order: number;
}

export interface SiteSettings {
  brand_name: string;
  slogan: string;
  tagline: string;
  address: string;
  phones: string;
  phones_list: string[];
  email: string;
  city: string;
  whatsapp: string;
  facebook: string;
  linkedin: string;
  instagram: string;
  twitter: string;
  logo: Media | null;
  logo_white: Media | null;
  default_meta_title: string;
  default_meta_description: string;
  default_og_image: Media | null;
}

export interface Cta {
  label: string;
  style?: string;
  href?: string;
  action?: string;
}
