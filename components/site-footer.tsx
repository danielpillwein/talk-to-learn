import Link from "next/link";
import { cn } from "@/lib/utils";

type SiteFooterProps = {
  className?: string;
};

export function SiteFooter({ className }: SiteFooterProps): JSX.Element {
  return (
    <footer
      className={cn(
        "flex flex-col gap-3 border-t border-border/60 pt-6 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between",
        className
      )}
    >
      <p>© {new Date().getFullYear()} Talk to Learn</p>
      <div className="flex flex-wrap gap-4">
        <Link href="/imprint" className="hover:text-foreground">
          Impressum
        </Link>
        <Link href="/privacy" className="hover:text-foreground">
          Datenschutz
        </Link>
        <Link
          href="https://www.instagram.com/dani.pillwein/"
          className="hover:text-foreground"
          target="_blank"
          rel="noreferrer"
        >
          Kontakt
        </Link>
      </div>
    </footer>
  );
}
