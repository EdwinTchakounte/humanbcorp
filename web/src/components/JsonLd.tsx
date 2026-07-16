/**
 * Données structurées schema.org.
 *
 * Google ne devine pas qu'une page décrit une formation ou une offre d'emploi :
 * il faut le lui dire. Sans ce balisage, une formation reste un lien bleu parmi
 * d'autres, et une offre d'emploi n'apparaît pas dans Google for Jobs — où la
 * plupart des candidats cherchent aujourd'hui.
 *
 * Le script est rendu côté serveur : les robots ne lisent pas le JavaScript.
 */
export default function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // Contenu maîtrisé (construit depuis notre API), sérialisé en JSON.
      // On échappe `<` : une description contenant « </script> » casserait la page.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
