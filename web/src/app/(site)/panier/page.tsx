import type { Metadata } from "next";
import CheckoutPanier from "@/components/cart/CheckoutPanier";

export const metadata: Metadata = {
  title: "Mon panier",
  robots: { index: false, follow: false },
};

export default function PanierPage() {
  return <CheckoutPanier lang="fr" />;
}
