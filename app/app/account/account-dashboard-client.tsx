"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { useToast } from "@/components/ui/toast/useToast";
import { AvatarBadge } from "./parts";
import {
  formatLimitedValue,
  getUsageProgressPercent,
  type LimitedValue,
  type PlanTier,
  type SubscriptionStatus,
} from "@/lib/account-plans";
import { cn } from "@/lib/utils";

type DashboardData = {
  plan: PlanTier;
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
  nextBillingAt: string | null;
  canManageSubscription: boolean;
  limits: {
    deckLimit: LimitedValue;
    questionsPerDeck: LimitedValue;
    speechSecondsPerDay: LimitedValue;
    aiRefine: boolean;
  };
  usage: {
    speechSecondsToday: number;
    decksCreated: number;
  };
};

type DashboardClientProps = {
  initialName?: string | null;
  email?: string | null;
  image?: string | null;
};

type SectionId = "usage" | "abo" | "danger-zone";
type UpgradeTarget = "premium" | "ultimate";
type DangerActionKind = "reset_progress" | "delete_decks" | "delete_account";

type PendingAction =
  | { kind: "upgrade"; target: UpgradeTarget }
  | { kind: "portal" }
  | { kind: "danger"; action: DangerActionKind }
  | null;

type ModalCopy = {
  title: string;
  description: string;
  confirmLabel: string;
  intent: "default" | "danger";
};

type PlanCardConfig = {
  tier: PlanTier;
  title: string;
  price: string;
  features: string[];
  highlighted?: boolean;
};

function parseHashSection(hash: string): SectionId | null {
  const value = hash.replace(/^#/, "").trim().toLowerCase();
  if (value === "usage" || value === "abo" || value === "danger-zone") {
    return value;
  }
  return null;
}

const SETTINGS_NAV: Array<{ id: SectionId; label: string; mobileLabel: string }> = [
  { id: "usage", label: "Nutzung", mobileLabel: "Nutzung" },
  { id: "abo", label: "Abo", mobileLabel: "Abo" },
  { id: "danger-zone", label: "Danger Zone", mobileLabel: "Danger" },
];

const PLAN_ORDER: Record<PlanTier, number> = {
  free: 0,
  premium: 1,
  ultimate: 2,
};

const PLAN_CARDS: PlanCardConfig[] = [
  {
    tier: "free",
    title: "Kostenlos",
    price: "0 € / Monat",
    features: [
      "3 Lernsets erstellen",
      "max 10 Fragen pro Lernset",
      "limitierte Sprachsekunden",
    ],
  },
  {
    tier: "premium",
    title: "Premium",
    price: "9 € / Monat",
    highlighted: true,
    features: [
      "mehr Lernset Creations",
      "bis zu 25 Fragen pro Lernset",
      "Fragen mit AI verbessern",
      "mehr Sprachsekunden",
    ],
  },
  {
    tier: "ultimate",
    title: "Ultimate",
    price: "15 € / Monat",
    features: [
      "unlimitierte Lernsets",
      "unlimitierte Fragen",
      "unlimitierte Sprachsekunden",
      "alle AI Features",
    ],
  },
];

const MOBILE_TABS_TOP_OFFSET = 72;
const MOBILE_TAB_BAR_FALLBACK_HEIGHT = 52;
const MOBILE_SECTION_SCROLL_EXTRA = 10;

function formatGermanDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatCountdownToMidnight(now: Date): string {
  const nextMidnight = new Date(now);
  nextMidnight.setHours(24, 0, 0, 0);
  const diffMs = Math.max(0, nextMidnight.getTime() - now.getTime());
  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

function progressForLimited(used: number, cap: LimitedValue): number {
  if (cap === "unlimited") return 100;
  return getUsageProgressPercent(used, cap);
}

function getModalCopy(action: PendingAction): ModalCopy {
  if (!action) {
    return {
      title: "Bist du sicher?",
      description: "Diese Aktion kann nicht rückgängig gemacht werden.",
      confirmLabel: "Bestätigen",
      intent: "default",
    };
  }

  if (action.kind === "upgrade") {
    return {
      title: "Upgrade bestätigen",
      description: `Du wirst zur Upgrade-Seite für ${action.target === "premium" ? "Premium" : "Ultimate"} weitergeleitet.`,
      confirmLabel: "Bestätigen",
      intent: "default",
    };
  }

  if (action.kind === "portal") {
    return {
      title: "Abo verwalten öffnen?",
      description: "Im Stripe Portal kannst du dein Abo verwalten oder kündigen.",
      confirmLabel: "Bestätigen",
      intent: "default",
    };
  }

  if (action.action === "reset_progress") {
    return {
      title: "Fortschritt zurücksetzen?",
      description: "Alle Lernfortschritte werden gelöscht.",
      confirmLabel: "Reset",
      intent: "default",
    };
  }

  if (action.action === "delete_decks") {
    return {
      title: "Alle Lernsets löschen?",
      description: "Diese Aktion kann nicht rückgängig gemacht werden.",
      confirmLabel: "Löschen",
      intent: "danger",
    };
  }

  return {
    title: "Account wirklich löschen?",
    description: "Diese Aktion löscht deinen Account und alle Daten dauerhaft.",
    confirmLabel: "Account löschen",
    intent: "danger",
  };
}

export function AccountDashboardClient({
  initialName,
  email,
  image,
}: DashboardClientProps): JSX.Element {
  const toast = useToast();

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  const [activeSection, setActiveSection] = useState<SectionId>("usage");
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);
  const [isRunningDangerAction, setIsRunningDangerAction] = useState(false);
  const [speechResetCountdown, setSpeechResetCountdown] = useState("00:00:00");
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isMobileTabsPinned, setIsMobileTabsPinned] = useState(false);
  const mobileTabsSentinelRef = useRef<HTMLDivElement | null>(null);

  const scrollToSection = useCallback(
    (section: SectionId, behavior: ScrollBehavior): void => {
      const target = document.getElementById(section);
      if (!target) return;

      const isMobile = window.matchMedia("(max-width: 767px)").matches;
      if (!isMobile) {
        target.scrollIntoView({ behavior, block: "start" });
        return;
      }

      const tabBarHeight =
        mobileTabsSentinelRef.current?.offsetHeight ?? MOBILE_TAB_BAR_FALLBACK_HEIGHT;
      const topOffset = MOBILE_TABS_TOP_OFFSET + tabBarHeight + MOBILE_SECTION_SCROLL_EXTRA;
      const targetTop = window.scrollY + target.getBoundingClientRect().top - topOffset;

      window.scrollTo({
        top: Math.max(0, targetTop),
        behavior,
      });
    },
    []
  );

  const loadDashboard = useCallback(async () => {
    setIsLoadingDashboard(true);

    try {
      const tzOffsetMinutes = new Date().getTimezoneOffset();
      const response = await fetch(`/api/account/dashboard?tzOffsetMinutes=${tzOffsetMinutes}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("Abo-Daten konnten nicht geladen werden.");
      }

      const payload = (await response.json()) as DashboardData;
      setDashboard(payload);
      setDashboardError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Abo-Daten konnten nicht geladen werden.";
      setDashboardError(message);
      toast.error("Abo-Daten konnten nicht geladen werden", "Bitte erneut versuchen.");
    } finally {
      setIsLoadingDashboard(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const tick = () => {
      setSpeechResetCountdown(formatCountdownToMidnight(new Date()));
    };

    tick();
    const intervalId = window.setInterval(tick, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        const next = visible[0]?.target?.id;
        if (next === "usage" || next === "abo" || next === "danger-zone") {
          setActiveSection(next);
        }
      },
      {
        threshold: [0.2, 0.45, 0.7],
        rootMargin: "-20% 0px -55% 0px",
      }
    );

    SETTINGS_NAV.forEach(({ id }) => {
      const node = document.getElementById(id);
      if (node) {
        observer.observe(node);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const applyHashScroll = (behavior: ScrollBehavior) => {
      const section = parseHashSection(window.location.hash);
      if (!section) return;
      setActiveSection(section);
      window.requestAnimationFrame(() => {
        scrollToSection(section, behavior);
      });
    };

    applyHashScroll("auto");

    const handleHashChange = () => {
      applyHashScroll("smooth");
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, [scrollToSection]);

  useEffect(() => {
    if (!pendingAction || pendingAction.kind !== "danger" || pendingAction.action !== "delete_account") {
      setDeleteConfirmText("");
    }
  }, [pendingAction]);

  useEffect(() => {
    const syncPinnedState = () => {
      if (window.matchMedia("(min-width: 768px)").matches) {
        setIsMobileTabsPinned((prev) => (prev ? false : prev));
        return;
      }

      const marker = mobileTabsSentinelRef.current;
      if (!marker) return;
      const nextPinned = marker.getBoundingClientRect().top <= MOBILE_TABS_TOP_OFFSET;
      setIsMobileTabsPinned((prev) => (prev === nextPinned ? prev : nextPinned));
    };

    syncPinnedState();
    window.addEventListener("scroll", syncPinnedState, { passive: true });
    window.addEventListener("resize", syncPinnedState);

    return () => {
      window.removeEventListener("scroll", syncPinnedState);
      window.removeEventListener("resize", syncPinnedState);
    };
  }, []);

  const openBillingPortal = useCallback(async () => {
    setIsOpeningPortal(true);

    try {
      const response = await fetch("/api/stripe/portal-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Billing Portal konnte nicht geöffnet werden.");
      }

      const payload = (await response.json()) as { url?: string };
      const url = String(payload.url ?? "").trim();
      if (!url) {
        throw new Error("Billing Portal URL fehlt.");
      }

      const popup = window.open(url, "_blank", "noopener,noreferrer");
      if (!popup) {
        window.location.assign(url);
      }
    } catch (error) {
      toast.error(
        "Billing Portal nicht verfügbar",
        error instanceof Error ? error.message : "Bitte später erneut versuchen."
      );
    } finally {
      setIsOpeningPortal(false);
    }
  }, [toast]);

  const runDangerAction = useCallback(
    async (action: DangerActionKind) => {
      setIsRunningDangerAction(true);

      try {
        if (action === "delete_account") {
          const response = await fetch("/api/account", { method: "DELETE" });
          if (!response.ok) {
            const payload = (await response.json().catch(() => null)) as { error?: string } | null;
            throw new Error(payload?.error || "Account konnte nicht gelöscht werden.");
          }

          setPendingAction(null);
          await signOut({ callbackUrl: "/" });
          return;
        }

        const response = await fetch("/api/account/danger", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error || "Aktion konnte nicht ausgeführt werden.");
        }

        if (action === "reset_progress") {
          toast.success("Fortschritt zurückgesetzt", "Alle Lernfortschritte wurden gelöscht.");
        }

        if (action === "delete_decks") {
          toast.success("Lernsets gelöscht", "Alle Lernsets wurden dauerhaft gelöscht.");
        }

        setPendingAction(null);
        await loadDashboard();
      } catch (error) {
        toast.error(
          "Aktion fehlgeschlagen",
          error instanceof Error ? error.message : "Bitte später erneut versuchen."
        );
      } finally {
        setIsRunningDangerAction(false);
      }
    },
    [loadDashboard, toast]
  );

  const handleConfirmAction = async () => {
    if (!pendingAction) return;

    if (pendingAction.kind === "upgrade") {
      const target = pendingAction.target;
      setPendingAction(null);
      window.location.assign(`/pricing?plan=${target}`);
      return;
    }

    if (pendingAction.kind === "portal") {
      setPendingAction(null);
      await openBillingPortal();
      return;
    }

    await runDangerAction(pendingAction.action);
  };

  const handleSectionClick = (section: SectionId) => {
    setActiveSection(section);
    const nextHash = `#${section}`;
    if (window.location.hash !== nextHash) {
      window.history.replaceState(null, "", nextHash);
    }
    scrollToSection(section, "smooth");
  };

  const profileName = initialName?.trim() || "Lernende:r";
  const profileEmail = email?.trim() || "keine E-Mail hinterlegt";

  const plan = dashboard?.plan ?? "free";
  const status = dashboard?.status ?? "active";
  const statusDate = formatGermanDate(dashboard?.currentPeriodEnd ?? null);
  const nextBillingDate = formatGermanDate(dashboard?.nextBillingAt ?? null);

  const deckLimit = dashboard?.limits.deckLimit ?? 3;
  const decksCreated = dashboard?.usage.decksCreated ?? 0;

  const questionsLimit = dashboard?.limits.questionsPerDeck ?? 10;
  const speechCap = dashboard?.limits.speechSecondsPerDay ?? 300;
  const speechUsed = dashboard?.usage.speechSecondsToday ?? 0;

  const statusText =
    status === "cancel_at_period_end"
      ? `Kündigung geplant - Zugriff bis ${statusDate ?? "Ende der Laufzeit"}`
      : status === "past_due"
        ? "Zahlung fehlgeschlagen"
        : null;

  const modalCopy = useMemo(() => (pendingAction ? getModalCopy(pendingAction) : null), [pendingAction]);

  const isModalBusy =
    (pendingAction?.kind === "portal" && isOpeningPortal) ||
    (pendingAction?.kind === "danger" && isRunningDangerAction);
  const needsDeletePhrase = pendingAction?.kind === "danger" && pendingAction.action === "delete_account";
  const isDeletePhraseValid = deleteConfirmText.trim() === "DELETE";
  const isConfirmDisabled = isModalBusy || (needsDeletePhrase && !isDeletePhraseValid);

  const mobileTabsNav = (
    <div className="mx-auto w-full max-w-6xl px-2">
      <nav className="-mx-1 flex gap-3">
        {SETTINGS_NAV.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => handleSectionClick(item.id)}
            className={cn(
              "relative flex-1 px-1 pb-2 text-center text-sm font-medium text-muted-foreground transition-colors duration-200 hover:text-foreground",
              activeSection === item.id && "text-foreground"
            )}
          >
            <span>{item.mobileLabel}</span>
            <span
              className={cn(
                "absolute bottom-0 left-1/2 h-0.5 w-0 -translate-x-1/2 rounded-[2px] bg-[var(--color-accent)] transition-all duration-200",
                activeSection === item.id && "w-full"
              )}
            />
          </button>
        ))}
      </nav>
    </div>
  );

  return (
    <main className="-mx-2 w-full px-4 py-2 md:mx-0 md:px-0 md:py-3">
      <div className="mb-3 flex min-h-14 items-center md:hidden">
        <div className="flex items-center gap-3">
          <AvatarBadge name={profileName} image={image ?? undefined} />
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-foreground">{profileName}</p>
            <p className="truncate text-[13px] text-muted-foreground/70">{profileEmail}</p>
          </div>
        </div>
      </div>

      <div
        ref={mobileTabsSentinelRef}
        className={cn(
          "-mx-4 mb-4 border-b border-border/60 px-4 py-3 md:hidden",
          isMobileTabsPinned
            ? "pointer-events-none invisible"
            : "bg-background/80 backdrop-blur-md"
        )}
      >
        {mobileTabsNav}
      </div>
      {isMobileTabsPinned && (
        <div
          className="fixed left-0 right-0 z-40 border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur-md md:hidden"
          style={{ top: MOBILE_TABS_TOP_OFFSET }}
        >
          {mobileTabsNav}
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-4 md:gap-8 md:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="relative hidden md:block">
          <div className="md:fixed md:top-[108px] md:left-[max(24px,calc((100vw-1152px)/2+24px))] md:w-[260px] md:max-h-[calc(100vh-118px)] md:overflow-auto md:pr-6">
            <div className="mb-6">
              <div className="flex items-center gap-3">
                <AvatarBadge name={profileName} image={image ?? undefined} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{profileName}</p>
                  <p className="truncate text-sm text-muted-foreground">{profileEmail}</p>
                </div>
              </div>
            </div>

            <nav className="flex flex-col gap-2">
              {SETTINGS_NAV.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSectionClick(item.id)}
                  className={cn(
                    "w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-muted-foreground transition hover:text-foreground",
                    activeSection === item.id && "border border-[var(--color-border)] bg-[var(--color-card)] text-foreground"
                  )}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
        </aside>

        <div className="min-w-0">
          <SettingsSection id="usage" title="Nutzung">
            {isLoadingDashboard && !dashboard ? (
              <UsageSkeleton />
            ) : (
              <>
                {dashboardError && !dashboard && (
                  <ErrorPanel message="Nutzungsdaten konnten nicht geladen werden." onRetry={() => void loadDashboard()} />
                )}

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <UsageMetricCard
                    title="Lernsets erstellt"
                    current={String(decksCreated)}
                    limit={formatLimitedValue(deckLimit)}
                    progress={progressForLimited(decksCreated, deckLimit)}
                  />
                  <UsageMetricCard
                    title="Fragen pro Lernset"
                    current={renderLimit(questionsLimit)}
                    limit={renderLimit(questionsLimit)}
                    progress={100}
                  />
                  <UsageMetricCard
                    title="Sprachsekunden heute"
                    current={String(speechUsed)}
                    limit={formatLimitedValue(speechCap)}
                    progress={progressForLimited(speechUsed, speechCap)}
                    helper={`Zurückgesetzt in ${speechResetCountdown}`}
                  />
                </div>
              </>
            )}
          </SettingsSection>

          <SettingsSection id="abo" title="Abo" className="mt-7">
            {isLoadingDashboard && !dashboard ? (
              <SubscriptionSkeleton />
            ) : (
              <>
                {dashboardError && !dashboard && (
                  <ErrorPanel message="Abo-Daten konnten nicht geladen werden." onRetry={() => void loadDashboard()} />
                )}

                {(statusText || plan !== "free") && (
                  <div className="rounded-lg border border-[var(--color-border)] bg-background p-4 text-sm">
                    {statusText && <p className="text-foreground">{statusText}</p>}
                    {plan !== "free" && (
                      <p className={cn("text-muted-foreground", statusText && "mt-1")}>
                        Nächste Abrechnung am {nextBillingDate ?? "-"}
                      </p>
                    )}
                  </div>
                )}

                <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
                  {PLAN_CARDS.map((card) => {
                    const isCurrentPlan = card.tier === plan;
                    const isUpgradePath = PLAN_ORDER[card.tier] > PLAN_ORDER[plan];
                    const canUpgradeToCard = card.tier !== "free" && isUpgradePath;

                    const ctaLabel = isCurrentPlan ? "Aktueller Plan" : canUpgradeToCard ? "Upgrade" : "Inklusive";
                    const ctaDisabled = !canUpgradeToCard;

                    return (
                      <article
                        key={card.tier}
                        className={cn(
                          "rounded-xl border p-5",
                          card.highlighted
                            ? "border-transparent [background:var(--color-accent-dark)] text-white"
                            : "border-[var(--color-border)] bg-background"
                        )}
                      >
                        <p className={cn("text-sm font-semibold", card.highlighted ? "text-white" : "text-foreground")}>
                          {card.title}
                        </p>
                        <p className={cn("mt-1 text-xl font-semibold", card.highlighted ? "text-white" : "text-foreground")}>
                          {card.price}
                        </p>

                        <ul className="mt-4 space-y-2 text-sm">
                          {card.features.map((feature) => (
                            <li
                              key={feature}
                              className={cn(card.highlighted ? "text-white/90" : "text-muted-foreground")}
                            >
                              - {feature}
                            </li>
                          ))}
                        </ul>

                        <Button
                          type="button"
                          className={cn(
                            "mt-5 w-full",
                            card.highlighted &&
                              "border-white/40 bg-white text-[var(--color-accent-dark)] hover:bg-white/90"
                          )}
                          variant={card.highlighted || ctaDisabled ? "outline" : "default"}
                          onClick={() => {
                            if (!canUpgradeToCard) return;
                            setPendingAction({ kind: "upgrade", target: card.tier as UpgradeTarget });
                          }}
                          disabled={ctaDisabled}
                        >
                          {ctaLabel}
                        </Button>
                      </article>
                    );
                  })}
                </div>

                {plan !== "free" && (
                  <div className="mt-5">
                    <LoadingButton
                      variant="outline"
                      text="Abo verwalten"
                      loadingText="Öffne Portal"
                      isLoading={isOpeningPortal}
                      onClick={() => setPendingAction({ kind: "portal" })}
                      disabled={!dashboard?.canManageSubscription || isOpeningPortal}
                      className="w-full sm:w-auto"
                    />
                    {!dashboard?.canManageSubscription && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Abo-Verwaltung ist für diesen Account aktuell nicht verfügbar.
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </SettingsSection>

          <SettingsSection
            id="danger-zone"
            title={<span className="text-[var(--color-danger)]">Danger Zone</span>}
            className="mt-7 p-6"
          >
            <div>
              <DangerActionRow
                title="Fortschritt aller Lernsets zurücksetzen"
                description="Alle Lernfortschritte werden gelöscht, deine Lernsets bleiben bestehen."
                buttonLabel="Reset Fortschritt"
                actionVariant="neutral"
                onClick={() => setPendingAction({ kind: "danger", action: "reset_progress" })}
                disabled={isRunningDangerAction}
              />
              <DangerActionRow
                title="Alle Lernsets löschen"
                description="Alle deine Lernsets und Fragen werden dauerhaft gelöscht."
                buttonLabel="Alle Lernsets löschen"
                actionVariant="danger-outline"
                onClick={() => setPendingAction({ kind: "danger", action: "delete_decks" })}
                disabled={isRunningDangerAction}
                withTopBorder
              />
              <DangerActionRow
                title="Account löschen"
                description="Dein Account und alle Daten werden dauerhaft gelöscht."
                buttonLabel="Account löschen"
                actionVariant="danger-solid"
                onClick={() => setPendingAction({ kind: "danger", action: "delete_account" })}
                disabled={isRunningDangerAction}
                withTopBorder
              />
            </div>
          </SettingsSection>
        </div>
      </div>

      {pendingAction && modalCopy && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/25 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-lg">
            <h3 className="text-base font-semibold text-foreground">{modalCopy.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{modalCopy.description}</p>
            {needsDeletePhrase && (
              <div className="mt-4 space-y-2">
                <p className="text-xs text-muted-foreground">
                  Gib zur Bestätigung <span className="font-semibold text-foreground">DELETE</span> ein.
                </p>
                <input
                  value={deleteConfirmText}
                  onChange={(event) => setDeleteConfirmText(event.target.value)}
                  className="h-10 w-full rounded-lg border border-[var(--color-border)] bg-background px-3 text-sm text-foreground focus:border-foreground/20 focus:outline-none"
                  placeholder="DELETE"
                />
              </div>
            )}

            <div className="mt-5 grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={() => setPendingAction(null)}
                className="w-full"
                disabled={isModalBusy}
              >
                Abbrechen
              </Button>
              <LoadingButton
                variant={modalCopy.intent === "danger" ? "destructive" : "default"}
                onClick={() => void handleConfirmAction()}
                className="w-full"
                isLoading={isModalBusy}
                loadingText="Bestätige"
                text={modalCopy.confirmLabel}
                disabled={isConfirmDisabled}
              />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function renderLimit(value: LimitedValue): string {
  return value === "unlimited" ? "∞" : String(value);
}

function SettingsSection({
  id,
  title,
  className,
  children,
}: {
  id: SectionId;
  title: ReactNode;
  className?: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <section
      id={id}
      className={cn("rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5", className)}
    >
      <h2 className="text-[20px] font-semibold text-foreground">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function UsageMetricCard({
  title,
  current,
  limit,
  progress,
  helper,
}: {
  title: string;
  current: string;
  limit: string;
  progress: number;
  helper?: string;
}): JSX.Element {
  return (
    <article className="rounded-lg border border-[var(--color-border)] bg-background p-4">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-3 text-lg font-semibold text-foreground">
        {current} <span className="text-sm font-medium text-muted-foreground">/ {limit}</span>
      </p>
      <div className="mt-3 h-[6px] w-full rounded-[4px] bg-[var(--color-border)]">
        <div className="h-full rounded-[4px] bg-[var(--color-accent)]" style={{ width: `${progress}%` }} />
      </div>
      {helper && <p className="mt-2 text-xs text-muted-foreground">{helper}</p>}
    </article>
  );
}

function DangerActionRow({
  title,
  description,
  buttonLabel,
  actionVariant,
  onClick,
  disabled,
  withTopBorder = false,
}: {
  title: string;
  description: string;
  buttonLabel: string;
  actionVariant: "neutral" | "danger-outline" | "danger-solid";
  onClick: () => void;
  disabled?: boolean;
  withTopBorder?: boolean;
}): JSX.Element {
  const buttonClassName =
    actionVariant === "neutral"
      ? "hover:scale-[1.02]"
      : actionVariant === "danger-outline"
        ? "border-[var(--color-danger)] text-[var(--color-danger)] hover:bg-[color-mix(in_srgb,var(--color-danger)_8%,transparent)] hover:text-[var(--color-danger)] hover:scale-[1.02]"
        : "border-[var(--color-danger)] bg-[var(--color-danger)] text-[var(--danger-foreground)] hover:bg-[color-mix(in_srgb,var(--color-danger)_88%,black)] hover:text-[var(--danger-foreground)] hover:scale-[1.02]";

  return (
    <div className={cn("py-5", withTopBorder && "border-t border-[var(--color-border)]")}>
      <div className="flex flex-col items-start justify-between gap-5 md:flex-row md:items-center">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <Button
          type="button"
          variant={actionVariant === "danger-solid" ? "destructive" : "outline"}
          className={cn(
            "w-full transition-transform duration-150 ease-out md:w-auto",
            buttonClassName
          )}
          onClick={onClick}
          disabled={disabled}
        >
          {buttonLabel}
        </Button>
      </div>
    </div>
  );
}

function UsageSkeleton(): JSX.Element {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2].map((index) => (
        <div key={index} className="space-y-3 rounded-lg border border-[var(--color-border)] bg-background p-4">
          <div className="h-4 w-1/2 rounded bg-muted" />
          <div className="h-6 w-2/3 rounded bg-muted" />
          <div className="h-[6px] w-full rounded-[4px] bg-muted" />
        </div>
      ))}
    </div>
  );
}

function SubscriptionSkeleton(): JSX.Element {
  return (
    <div className="space-y-5">
      <div className="space-y-2 rounded-lg border border-[var(--color-border)] bg-background p-4">
        <div className="h-4 w-1/3 rounded bg-muted" />
        <div className="h-4 w-1/2 rounded bg-muted" />
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <div key={index} className="space-y-3 rounded-xl border border-[var(--color-border)] bg-background p-5">
            <div className="h-5 w-1/3 rounded bg-muted" />
            <div className="h-7 w-1/2 rounded bg-muted" />
            <div className="h-20 rounded bg-muted" />
            <div className="h-10 w-full rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }): JSX.Element {
  return (
    <div className="mb-4 rounded-lg border border-[var(--color-border)] bg-background p-3 text-sm text-muted-foreground">
      <p>{message}</p>
      <Button type="button" variant="outline" size="sm" className="mt-2" onClick={onRetry}>
        Erneut laden
      </Button>
    </div>
  );
}
