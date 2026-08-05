import type { Metadata } from "next";
import LearnerSpace from "@/components/learner/LearnerSpace";

export const metadata: Metadata = {
  title: "Mon espace — HBC-RH",
  robots: { index: false, follow: false }, // espace privé accessible par lien magique
};

export default function MonEspacePage({ params }: { params: { token: string } }) {
  return (
    <section className="py-10 md:py-14">
      {/* Espace client vraiment pleine largeur : plus de marges latérales, juste
          un filet minimal pour ne pas coller au bord (et `px-safe` pour réserver
          l'encoche en paysage sur PWA installée). */}
      <div className="px-safe">
        <div className="w-full px-2 sm:px-3">
          <LearnerSpace token={params.token} />
        </div>
      </div>
    </section>
  );
}
