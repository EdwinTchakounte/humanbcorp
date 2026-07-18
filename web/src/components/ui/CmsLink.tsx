"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Lien issu du CMS. Les chemins y sont stockés en français (/services, /contact…) ;
 * sur le site anglais on les préfixe automatiquement par /en, sinon un CTA de
 * contenu renverrait le visiteur vers la version française. Les liens externes,
 * les ancres (#…) et ceux déjà préfixés /en sont laissés intacts.
 */
export default function CmsLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const enSite = pathname?.startsWith("/en");
  const localise =
    enSite && href.startsWith("/") && !href.startsWith("/en/") && href !== "/en"
      ? `/en${href}`
      : href;
  return (
    <Link href={localise} className={className}>
      {children}
    </Link>
  );
}
