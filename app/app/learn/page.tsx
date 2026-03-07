import type { Metadata } from "next";
import LearnIndexPageClient from "./learn-index-page-client";

export const metadata: Metadata = {
  title: "Meine Lernsets – Talk to Learn",
};

export default function LearnIndexPage(): JSX.Element {
  return <LearnIndexPageClient />;
}
