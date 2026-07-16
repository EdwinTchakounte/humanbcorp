import ChromeLayout from "@/components/ChromeLayout";

export default function EnLayout({ children }: { children: React.ReactNode }) {
  // `<html lang>` vit dans le layout racine, commun aux deux langues : le faire
  // varier imposerait de lire les en-têtes de requête, donc un rendu dynamique
  // sur tout le site — un prix disproportionné. `lang` étant valide sur
  // n'importe quel élément, on marque ici le sous-arbre anglais : les lecteurs
  // d'écran retiennent le `lang` le plus proche et prononcent correctement.
  return (
    <div lang="en">
      <ChromeLayout lang="en">{children}</ChromeLayout>
    </div>
  );
}
