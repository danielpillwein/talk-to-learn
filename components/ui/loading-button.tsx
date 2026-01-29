import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Button } from "@/components/ui/button";

type LoadingButtonProps = ComponentProps<typeof Button> & {
  text: string;
  loadingText?: string;
  startIcon?: ReactNode;
  href?: string;
};

export function LoadingButton({
  text,
  loadingText,
  startIcon,
  href,
  isLoading,
  ...props
}: LoadingButtonProps): JSX.Element {
  const content = startIcon ? (
    <span className="inline-flex items-center gap-2">
      {startIcon}
      <span>{text}</span>
    </span>
  ) : (
    text
  );

  if (href) {
    return (
      <Button isLoading={isLoading} loadingText={loadingText} asChild {...props}>
        <Link href={href}>{content}</Link>
      </Button>
    );
  }

  return (
    <Button isLoading={isLoading} loadingText={loadingText} {...props}>
      {content}
    </Button>
  );
}
