import { redirect } from "next/navigation";

/**
 * `/pages` n'a pas d'écran propre : la liste des pages du site est servie par la
 * racine du dashboard (`/`). Sans cette redirection, l'URL — devinable, et citée
 * par le fil d'Ariane — retombait sur un 404.
 */
export default function PagesIndex() {
  redirect("/");
}
