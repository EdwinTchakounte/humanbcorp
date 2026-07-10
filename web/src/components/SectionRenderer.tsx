import type { Section } from "@/lib/types";
import Hero from "@/components/sections/Hero";
import Stats from "@/components/sections/Stats";
import About from "@/components/sections/About";
import Services from "@/components/sections/Services";
import Gallery from "@/components/sections/Gallery";
import Milestone from "@/components/sections/Milestone";
import Contact from "@/components/sections/Contact";
import RichText from "@/components/sections/RichText";
import Cta from "@/components/sections/Cta";

/** Aiguille chaque section vers son composant de rendu selon `type`. */
export default function SectionRenderer({ section }: { section: Section }) {
  switch (section.type) {
    case "hero":
      return <Hero section={section} />;
    case "stats":
      return <Stats section={section} />;
    case "about":
      return <About section={section} />;
    case "services":
      return <Services section={section} />;
    case "features":
      return <Services section={section} />;
    case "gallery":
      return <Gallery section={section} />;
    case "milestone":
      return <Milestone section={section} />;
    case "contact":
      return <Contact section={section} />;
    case "cta":
      return <Cta section={section} />;
    default:
      return <RichText section={section} />;
  }
}
