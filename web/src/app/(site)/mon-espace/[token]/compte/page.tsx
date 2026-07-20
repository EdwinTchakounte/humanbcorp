import type { Metadata } from "next";
import Link from "next/link";

import DefinirMotDePasse from "@/components/learner/DefinirMotDePasse";

// Page privée, atteinte par lien signé : elle ne doit pas être indexée.
export const metadata: Metadata = {
  title: "Définir mon mot de passe",
  robots: { index: false, follow: false },
};

export default function ComptePage({ params }: { params: { token: string } }) {
  return (
    <section className="py-14 md:py-20">
      <div className="container-hbc max-w-lg">
        <Link
          href={`/mon-espace/${params.token}`}
          className="mb-8 inline-flex items-center gap-1 text-sm font-semibold text-muted transition hover:text-brand"
        >
          <i className="bx bx-left-arrow-alt" /> Mon espace
        </Link>
        <DefinirMotDePasse token={params.token} />
      </div>
    </section>
  );
}
