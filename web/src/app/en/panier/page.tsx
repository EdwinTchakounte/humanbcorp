import type { Metadata } from "next";
import CheckoutPanier from "@/components/cart/CheckoutPanier";

export const metadata: Metadata = {
  title: "My cart",
  robots: { index: false, follow: false },
};

export default function PanierPageEn() {
  return <CheckoutPanier lang="en" />;
}
