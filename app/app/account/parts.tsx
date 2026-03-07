"use client";

import Image from "next/image";
import { signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import { UserIcon as UserIconSolid } from "@heroicons/react/24/solid";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";

export function AccountDeleteAction(): JSX.Element {
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleDeleteAccount = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/account", { method: "DELETE" });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Account konnte nicht gelöscht werden.");
      }

      await signOut({ callbackUrl: "/" });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Account konnte nicht gelöscht werden.");
      setIsDeleting(false);
    }
  };

  return (
    <>
      <LoadingButton
        variant="destructive"
        className="w-full sm:w-auto text-background hover:text-background"
        onClick={() => {
          if (isDeleting) return;
          setShowConfirmModal(true);
        }}
        isLoading={false}
        text="Account löschen"
      />

      {showConfirmModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/25 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-lg">
            <h3 className="text-base font-semibold text-foreground">Account wirklich löschen?</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Dein Account, alle Lernsets und alle verknüpften Daten werden dauerhaft gelöscht. Das kann nicht rückgängig gemacht werden.
            </p>
            {errorMessage && (
              <p className="mt-3 text-sm text-destructive">{errorMessage}</p>
            )}
            <div className="mt-4 flex flex-col gap-2">
              <Button
                variant="outline"
                onClick={() => setShowConfirmModal(false)}
                className="w-full whitespace-normal"
                disabled={isDeleting}
              >
                Abbrechen
              </Button>
              <LoadingButton
                variant="destructive"
                onClick={handleDeleteAccount}
                className="w-full whitespace-normal text-background hover:text-background"
                isLoading={isDeleting}
                loadingText="Lösche Account"
                text="Ja, Account löschen"
              />
            </div>
          </div>
        </div>
      )}
    </>
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
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setFailed(false);
    setLoaded(false);
  }, [image]);

  if (!image || failed) {
    return (
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
        <UserIconSolid className="h-5 w-5" />
      </span>
    );
  }

  return (
    <span className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-border bg-muted">
      {!loaded && <UserIconSolid className="h-5 w-5 text-muted-foreground" />}
      <Image
        src={image}
        alt={name ? `${name} Avatar` : "Avatar"}
        width={48}
        height={48}
        sizes="48px"
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-150 ${loaded ? "opacity-100" : "opacity-0"}`}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
    </span>
  );
}
