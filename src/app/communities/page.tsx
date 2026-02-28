import type { Metadata } from "next";
import { fetchPublicResources } from "@/app/admin/actions";
import { CommunitiesExplorer } from "@/components/public/communities-explorer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Communities — howdoihelp.ai",
  description:
    "Join AI safety groups, EA chapters, rationality meetups, and advocacy movements near you.",
};

export default async function CommunitiesPublicPage() {
  const resources = await fetchPublicResources("communities");
  return <CommunitiesExplorer resources={resources} />;
}
