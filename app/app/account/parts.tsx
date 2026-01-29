"use client";

import Image from "next/image";
import { signOut } from "next-auth/react";
import { useState } from "react";
import { UserIcon } from "@heroicons/react/24/outline";
import { UserIcon as UserIconSolid } from "@heroicons/react/24/solid";
import { IconSwap } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";

export function AccountActions(): JSX.Element {
  const [isSigningOut, setIsSigningOut] = useState(false);

  return (
    <LoadingButton
      variant="outline"
      className="w-full md:w-auto"
      onClick={() => {
        if (isSigningOut) return;
        setIsSigningOut(true);
        void signOut({ callbackUrl: "/" });
      }}
      isLoading={isSigningOut}
      loadingText="Abmelden"
      text="Abmelden"
    />
  );
}

type AvatarBadgeProps = {
  name?: string | null;
  image?: string | null;
};

export function AvatarBadge({
  name,
  image,
}: AvatarBadgeProps): JSX.Element {
  const [failed, setFailed] = useState(false);
  const initial = name?.trim()?.charAt(0)?.toUpperCase();

  if (!image || failed) {
    return (
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
        {initial ?? (
          <IconSwap outline={UserIcon} solid={UserIconSolid} className="h-5 w-5" />
        )}
      </span>
    );
  }

  return (
    <Image
      src={image}
      alt={name ? `${name} Avatar` : "Avatar"}
      width={48}
      height={48}
      sizes="48px"
      className="h-12 w-12 rounded-full object-cover"
      onError={() => setFailed(true)}
    />
  );
}
