"use client";

import { signOut } from "next-auth/react";
import { useState } from "react";
import { UserIcon } from "@heroicons/react/24/outline";
import { UserIcon as UserIconSolid } from "@heroicons/react/24/solid";
import { IconSwap } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";

export function AccountActions() {
  return (
    <Button
      variant="outline"
      className="w-full md:w-auto"
      onClick={() => signOut({ callbackUrl: "/" })}
    >
      Abmelden
    </Button>
  );
}

export function AvatarBadge({
  name,
  image,
}: {
  name?: string | null;
  image?: string | null;
}) {
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
    <img
      src={image}
      alt={name ? `${name} Avatar` : "Avatar"}
      className="h-12 w-12 rounded-full object-cover"
      onError={() => setFailed(true)}
    />
  );
}
