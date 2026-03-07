import type { Metadata } from "next";
import CreateDeckPageClient from "./create-deck-page-client";

export const metadata: Metadata = {
  title: "Lernset erstellen – Talk to Learn",
};

export default function CreateDeckPage(): JSX.Element {
  return <CreateDeckPageClient />;
}
