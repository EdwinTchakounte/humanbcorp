import type { Metadata } from "next";
import FormationsList from "@/components/formations/FormationsList";

export const metadata: Metadata = {
  title: "Trainings",
  description: "HBC-RH training catalogue: register and pay online.",
};

export default function EnFormationsPage() {
  return <FormationsList lang="en" />;
}
