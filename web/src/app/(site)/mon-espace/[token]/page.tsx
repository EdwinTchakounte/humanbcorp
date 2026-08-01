import type { Metadata } from "next";
import LearnerSpace from "@/components/learner/LearnerSpace";

export const metadata: Metadata = {
  title: "Mon espace — HBC-RH",
  robots: { index: false, follow: false }, // espace privé accessible par lien magique
};

export default function MonEspacePage({ params }: { params: { token: string } }) {
  return (
    <section className="py-14 md:py-20">
      <div className="container-hbc max-w-6xl">
        <LearnerSpace token={params.token} />
      </div>
    </section>
  );
}
