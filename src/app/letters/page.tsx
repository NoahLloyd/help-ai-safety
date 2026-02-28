import type { Metadata } from "next";
import { fetchPublicResources } from "@/app/admin/actions";
import { CATEGORIES } from "@/lib/categories";
import { CategoryListing } from "@/components/public/category-listing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Letters & Petitions — howdoihelp.ai",
  description: "Open letters, pledges, and statements about AI safety you can sign.",
};

export default async function LettersPublicPage() {
  const resources = await fetchPublicResources("letters");
  const category = CATEGORIES.find((c) => c.id === "letters")!;
  return <CategoryListing category={category} resources={resources} />;
}
