"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { IconSwap } from "@/components/ui/icon";
import {
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  CreditCardIcon,
  UserIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import {
  ArrowRightOnRectangleIcon as ArrowRightOnRectangleIconSolid,
  CreditCardIcon as CreditCardIconSolid,
  UserIcon as UserIconSolid,
} from "@heroicons/react/24/solid";

export function AppHeader(): JSX.Element {
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = session?.user;
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileLearnMenuOpen, setMobileLearnMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (menuRef.current.contains(event.target as Node)) return;
      setMenuOpen(false);
    };

    if (menuOpen) {
      document.addEventListener("mousedown", handleClick);
    }

    return () => {
      document.removeEventListener("mousedown", handleClick);
    };
  }, [menuOpen]);

  const avatarContent = useMemo(() => {
    if (user?.image && !avatarFailed) {
      return (
        <Image
          src={user.image}
          alt="Profil"
          width={32}
          height={32}
          sizes="32px"
          className="h-8 w-8 rounded-full object-cover"
          onError={() => setAvatarFailed(true)}
        />
      );
    }

    return (
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
        {user?.name?.charAt(0) ?? (
          <IconSwap outline={UserIcon} solid={UserIconSolid} className="h-4 w-4" />
        )}
      </span>
    );
  }, [user?.image, user?.name, avatarFailed]);

  const isLearnPage = pathname?.startsWith("/app/learn");

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            <Link href="/app/learn" className="flex items-center gap-3 font-semibold">
              <Image
                src="/mascot/favicon.png"
                alt="Talk-to-Learn"
                width={40}
                height={40}
                sizes="40px"
                className="h-10 w-10 rounded-full object-cover"
                priority
              />
              <span className="hidden max-w-[140px] truncate text-base sm:max-w-none md:inline-flex">
                Talk-to-Learn
              </span>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/app/learn"
              className="hidden text-sm font-normal text-muted-foreground transition hover:text-foreground md:inline-flex"
            >
              Zu meinen Lernsets
            </Link>
            <Link
              href="/app/create"
              className="hidden rounded-full bg-warning px-5 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-150 ease-out hover:bg-warning/90 hover:shadow-md hover:-translate-y-[1px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:inline-flex"
            >
              Neues Deck
            </Link>
            <div className="relative hidden md:block" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((prev) => !prev)}
                className="group flex h-11 w-11 items-center justify-center rounded-full border border-border bg-background shadow-sm transition hover:border-foreground/20"
                aria-label="Profil"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                {avatarContent}
              </button>
              {menuOpen && (
                <div
                  className="absolute right-0 top-14 z-50 w-56 rounded-2xl border border-border bg-card p-2 shadow-lg"
                  role="menu"
                >
                  <button
                    type="button"
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-normal text-foreground transition hover:bg-muted"
                    role="menuitem"
                  >
                    <IconSwap
                      outline={ArrowRightOnRectangleIcon}
                      solid={ArrowRightOnRectangleIconSolid}
                      className="h-4 w-4 text-muted-foreground group-hover:text-foreground"
                    />
                    Abmelden
                  </button>
                  <div className="my-1 border-t border-border" role="separator" />
                  <Link
                    href="/app/account"
                    className="group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-normal text-foreground transition hover:bg-muted"
                    role="menuitem"
                  >
                    <IconSwap
                      outline={UserIcon}
                      solid={UserIconSolid}
                      className="h-4 w-4 text-muted-foreground group-hover:text-foreground"
                    />
                    Mein Account
                  </Link>
                  <Link
                    href="/app/account#abo"
                    className="group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-normal text-foreground transition hover:bg-muted"
                    role="menuitem"
                  >
                    <IconSwap
                      outline={CreditCardIcon}
                      solid={CreditCardIconSolid}
                      className="h-4 w-4 text-muted-foreground group-hover:text-foreground"
                    />
                    Mein Abo
                  </Link>
                </div>
              )}
            </div>
            {isLearnPage && (
              <button
                type="button"
                onClick={() => setMobileLearnMenuOpen(true)}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-background text-foreground transition md:hidden"
                aria-label="Menü öffnen"
              >
                <Bars3Icon className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      </nav>
      {isLearnPage && (
        <div
          className={`md:hidden ${mobileLearnMenuOpen ? "pointer-events-auto" : "pointer-events-none"}`}
        >
          <div
            className={`fixed inset-0 z-40 bg-black/30 transition-opacity duration-200 ${
              mobileLearnMenuOpen ? "opacity-100" : "opacity-0"
            }`}
            onClick={() => setMobileLearnMenuOpen(false)}
            aria-hidden="true"
          />
          <div
            className={`fixed right-0 top-0 z-50 h-full w-80 bg-background shadow-2xl transition-transform duration-200 ease-out ${
              mobileLearnMenuOpen ? "translate-x-0" : "translate-x-full"
            }`}
          >
            <aside className="flex h-full flex-col gap-6 px-6 py-6">
              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setMobileLearnMenuOpen(false)}
                  className="rounded-full p-2 text-muted-foreground transition hover:text-foreground"
                  aria-label="Menü schließen"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
              <nav className="flex flex-1 flex-col gap-2 text-sm">
                <Link
                  href="/app/learn"
                  onClick={() => setMobileLearnMenuOpen(false)}
                  className="rounded-2xl px-3 py-3 font-normal text-foreground transition hover:bg-muted"
                >
                  Zu meinen Lernsets
                </Link>
                <Link
                  href="/app/create"
                  onClick={() => setMobileLearnMenuOpen(false)}
                  className="rounded-2xl bg-warning px-3 py-3 font-semibold text-primary-foreground shadow-sm transition hover:bg-warning/90"
                >
                  Neues Deck
                </Link>
                <div className="rounded-2xl bg-muted/30 p-3">
                  <div className="text-sm font-semibold text-muted-foreground">Profil</div>
                  <div className="mt-3 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => signOut({ callbackUrl: "/" })}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-normal text-foreground transition hover:bg-muted"
                    >
                      <IconSwap
                        outline={ArrowRightOnRectangleIcon}
                        solid={ArrowRightOnRectangleIconSolid}
                        className="h-4 w-4 text-muted-foreground group-hover:text-foreground"
                      />
                      Abmelden
                    </button>
                    <div className="my-1 border-t border-border" role="separator" />
                    <Link
                      href="/app/account"
                      onClick={() => setMobileLearnMenuOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-normal text-foreground transition hover:bg-muted"
                    >
                      <IconSwap
                        outline={UserIcon}
                        solid={UserIconSolid}
                        className="h-4 w-4 text-muted-foreground group-hover:text-foreground"
                      />
                      Mein Account
                    </Link>
                    <Link
                      href="/app/account#abo"
                      onClick={() => setMobileLearnMenuOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-normal text-foreground transition hover:bg-muted"
                    >
                      <IconSwap
                        outline={CreditCardIcon}
                        solid={CreditCardIconSolid}
                        className="h-4 w-4 text-muted-foreground group-hover:text-foreground"
                      />
                      Mein Abo
                    </Link>
                  </div>
                </div>
              </nav>
            </aside>
          </div>
        </div>
      )}
    </>
  );
}
