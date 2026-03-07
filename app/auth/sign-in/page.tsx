import type { Metadata } from "next";
import SignInPageClient from "./sign-in-page-client";

export const metadata: Metadata = {
  title: "Anmelden – Talk to Learn",
};

export default function SignInPage(): JSX.Element {
  return <SignInPageClient />;
}
