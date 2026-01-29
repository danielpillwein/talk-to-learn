import type { ComponentProps, ReactNode } from "react";
import { Button } from "@/components/ui/button";

type LoadingButtonProps = ComponentProps<typeof Button> & {
  text: string;
  loadingText?: string;
  startIcon?: ReactNode;
};

export function LoadingButton({
  text,
  loadingText,
  startIcon,
  isLoading,
  ...props
}: LoadingButtonProps): JSX.Element {
  return (
    <Button isLoading={isLoading} loadingText={loadingText} {...props}>
      {startIcon ? (
        <span className="inline-flex items-center gap-2">
          {startIcon}
          <span>{text}</span>
        </span>
      ) : (
        text
      )}
    </Button>
  );
}
