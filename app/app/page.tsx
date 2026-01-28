import { redirect } from "next/navigation";

export default function AppIndexPage(): void {
  redirect("/app/learn");
}
