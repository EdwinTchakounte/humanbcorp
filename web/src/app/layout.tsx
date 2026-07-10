import type { Metadata } from "next";
import "./globals.css";
import ChatWidget from "@/components/ChatWidget";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://humanbcorp.com";

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
        <meta name="theme-color" content="#1C2F57" />
      </head>
      <body className="antialiased">
        {children}
        <ChatWidget />
      </body>
    </html>
  );
}
