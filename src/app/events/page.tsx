import type { Metadata } from "next";
import { fetchPublicResources } from "@/app/admin/actions";
import { EventsClientPage } from "./events-client-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Events — howdoihelp.ai",
  description: "Upcoming AI safety events, workshops, meetups, and gatherings.",
};

export default async function EventsPage() {
  const resources = await fetchPublicResources("events");
  return <EventsClientPage resources={resources} />;
}
