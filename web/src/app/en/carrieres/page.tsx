import type { Metadata } from "next";
import OffersList from "@/components/recruitment/OffersList";

export const metadata: Metadata = {
  title: "Careers",
  description: "Join HBC-RH: browse our job openings and apply online.",
};

export default function EnCarrieresPage() {
  return <OffersList lang="en" />;
}
