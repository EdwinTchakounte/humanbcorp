import type { Metadata } from "next";
import LearnerSpace from "@/components/learner/LearnerSpace";

export const metadata: Metadata = {
  title: "Mon espace — HBC-RH",
  robots: { index: false, follow: false }, // espace privé accessible par lien magique
};

export default function MonEspacePage({ params }: { params: { token: string } }) {
  return (
    <section className="py-10 md:py-14">
      {/* Espace client en pleine largeur (pas de conteneur centré) : on exploite
          tout l'écran, avec un simple padding latéral responsive. */}
      <div className="w-full px-4 md:px-6 lg:px-8">
        <LearnerSpace token={params.token} />
      </div>
    </section>
  );
}
