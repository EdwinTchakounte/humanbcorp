import { getDocuments, type Lang, type PublicDocument } from "@/lib/api";

const L = {
  fr: {
    eyebrow: "Ressources",
    title: "Documents à télécharger",
    lead: "Brochures, catalogues de formations et fiches pratiques — en libre accès.",
    empty: "Aucun document disponible pour le moment.",
    fallbackGroup: "Documents",
    download: "Télécharger",
  },
  en: {
    eyebrow: "Resources",
    title: "Documents to download",
    lead: "Brochures, training catalogues and fact sheets — freely available.",
    empty: "No document available at the moment.",
    fallbackGroup: "Documents",
    download: "Download",
  },
} as const;

function fmtSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export default async function DocumentsList({ lang }: { lang: Lang }) {
  const t = L[lang];
  const docs = await getDocuments();

  const groups = new Map<string, PublicDocument[]>();
  for (const d of docs) {
    const key = d.category || t.fallbackGroup;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(d);
  }

  return (
    <section className="py-14 md:py-20">
      <div className="container-hbc">
        <header className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">{t.eyebrow}</p>
          <h1 className="mt-3 text-3xl md:text-4xl">{t.title}</h1>
          <p className="mt-4 text-lg text-muted">{t.lead}</p>
        </header>

        {docs.length === 0 ? (
          <p className="mt-12 text-center text-muted">{t.empty}</p>
        ) : (
          <div className="mx-auto mt-12 max-w-3xl space-y-10">
            {Array.from(groups.entries()).map(([category, items]) => (
              <div key={category}>
                <h2 className="mb-4 text-xl">{category}</h2>
                <div className="grid gap-3">
                  {items.map((d) => (
                    <a
                      key={d.id}
                      href={d.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      download
                      className="group flex items-center gap-4 rounded-2xl border border-line/70 bg-white p-4 shadow-hbc-sm transition hover:-translate-y-0.5 hover:shadow-hbc"
                    >
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-2xl text-brand">
                        <i className="bx bxs-file" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-base font-semibold text-ink">{d.title}</h3>
                        {d.description && <p className="truncate text-sm text-muted">{d.description}</p>}
                        <p className="mt-0.5 text-xs text-muted">
                          {d.ext}
                          {d.size ? ` · ${fmtSize(d.size)}` : ""}
                        </p>
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-accent">
                        <i className="bx bx-download text-lg" />
                        <span className="hidden sm:inline">{t.download}</span>
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
