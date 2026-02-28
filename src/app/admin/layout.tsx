import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard — howdoihelp.ai",
  description: "Resource management dashboard",
  robots: "noindex, nofollow",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
