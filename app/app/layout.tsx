import type { ReactNode } from "react";
import { AppHeader } from "@/components/app-header";

export default function AppLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <div className="pt-24 pb-12">
        <div className="mx-auto w-full max-w-6xl px-6">{children}</div>
      </div>
    </div>
  );
}
