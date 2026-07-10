import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Human Brain Corporation-RH",
    short_name: "HBC-RH",
    description: "Partenaire stratégique en ressources humaines à Douala et à l'international.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#1C2F57",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
