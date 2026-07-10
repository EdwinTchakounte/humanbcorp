import ChromeLayout from "@/components/ChromeLayout";

export default function EnLayout({ children }: { children: React.ReactNode }) {
  return <ChromeLayout lang="en">{children}</ChromeLayout>;
}
