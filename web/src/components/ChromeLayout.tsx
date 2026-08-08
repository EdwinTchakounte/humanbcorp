import Header from "@/components/Header";
import ConditionalFooter from "@/components/ConditionalFooter";
import { getNav, getSettings, type Lang } from "@/lib/api";

/** En-tête + pied de page localisés autour du contenu. */
export default async function ChromeLayout({
  lang,
  children,
}: {
  lang: Lang;
  children: React.ReactNode;
}) {
  const [nav, settings] = await Promise.all([getNav(lang), getSettings(lang)]);
  return (
    <>
      <Header nav={nav} settings={settings} lang={lang} />
      <main>{children}</main>
      <ConditionalFooter nav={nav} settings={settings} lang={lang} />
    </>
  );
}
