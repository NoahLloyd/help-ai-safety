import type { Metadata } from "next";
import { fetchPublicResources } from "@/app/admin/actions";
import { CATEGORIES } from "@/lib/categories";
import { CategoryListing } from "@/components/public/category-listing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Programs — howdoihelp.ai",
  description: "AI safety courses, fellowships, grants, and training programs.",
};

export default async function ProgramsPublicPage() {
  const resources = await fetchPublicResources("programs");
  const category = CATEGORIES.find((c) => c.id === "programs")!;
  return <CategoryListing category={category} resources={resources} />;
}
