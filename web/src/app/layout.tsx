import type { Metadata, Viewport } from "next";
import "./globals.css";
import ChatWidget from "@/components/ChatWidget";
import { CartProvider } from "@/lib/cart";
import CartDrawer from "@/components/cart/CartDrawer";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://humanbcorp.com";

// Les variables NEXT_PUBLIC_* sont figées AU BUILD. Buildée avec une URL locale,
// la vitrine émettrait des og:image en http://localhost — WhatsApp et LinkedIn
// n'afficheraient alors aucun aperçu, sans que rien ne le signale dans
// l'application. On échoue au build : une erreur se corrige, un aperçu vide ne
// se voit pas.
if (process.env.NODE_ENV === "production" && /localhost|127\.0\.0\.1/.test(SITE_URL)) {
  throw new Error(
    `NEXT_PUBLIC_SITE_URL vaut « ${SITE_URL} » au build de production. ` +
      "Renseignez l'URL publique du site (ex. https://humanbcorp.com), " +
      "sinon les aperçus de partage pointeront vers localhost."
  );
}

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Human Brain Corporation-RH | Libérer le potentiel humain",
    template: "%s | HBC-RH",
  },
  description:
    "HBC-RH, votre partenaire stratégique en ressources humaines à Douala : recrutement local et international, management des talents, formation & coaching, externalisation RH.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/favicon-64.png", apple: "/brand/favicon-180.png" },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: "Human Brain Corporation-RH",
    images: ["/brand/logo.png"],
  },
  twitter: { card: "summary_large_image" },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "HBC-RH" },
};

// Séparé de `metadata` (contrat Next 14). `viewportFit: cover` fait passer le
// contenu sous l'encoche et la barre d'accueil en PWA installée ; les `env(safe-
// area-inset-*)` (voir globals.css) réservent alors l'espace utile. `maximumScale`
// n'est PAS bridé : brider le zoom nuit à l'accessibilité.
export const viewport: Viewport = {
  themeColor: "#1C2F57",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@500;600;700;800&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        <link rel="stylesheet" href="https://unpkg.com/boxicons@2.1.4/css/boxicons.min.css" />
      </head>
      <body className="antialiased">
        <CartProvider>
          {children}
          <CartDrawer />
          <ChatWidget />
        </CartProvider>
      </body>
    </html>
  );
}
