import type { Metadata } from "next";
import { AboutContent } from "./about-content";

export const metadata: Metadata = {
  title: "About — howdoihelp.ai",
  description:
    "How we connect people to the most impactful AI safety opportunities — and the algorithm behind it.",
};

export default function AboutPage() {
  return <AboutContent />;
}
