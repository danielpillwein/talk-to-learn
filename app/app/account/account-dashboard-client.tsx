"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { signOut } from "next-auth/react";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { InfoTooltip } from "@/components/ui/info-tooltip";
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
  billingInterval: "monthly" | "yearly" | null;
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
type BillingCycle = "monthly" | "yearly";

type PendingAction =
  | { kind: "upgrade"; target: UpgradeTarget }
  | { kind: "portal" }
  | { kind: "subscription_cancel" }
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
  monthlyPrice: number;
  features: string[];
  highlighted?: boolean;
  badge?: string;
  note?: string;
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
    monthlyPrice: 0,
    features: [
      "3 Lernsets insgesamt",
      "max. 10 Fragen pro Lernset",
      "300 Sekunden Erklärungszeit pro Tag",
      "AI Feedback auf deine Antworten",
    ],
  },
  {
    tier: "premium",
    title: "Premium",
    monthlyPrice: 9,
    highlighted: true,
    badge: "Beliebtester Plan",
    features: [
      "Unlimitierte Lernsets",
      "Bis zu 25 Fragen pro Lernset",
      "30 Minuten Erklärungszeit pro Tag",
      "AI Feedback auf deine Antworten",
      "Fragen mit AI verbessern",
    ],
  },
  {
    tier: "ultimate",
    title: "Ultimate",
    monthlyPrice: 15,
    features: [
      "Unlimitierte Lernsets",
      "Bis zu 50 Fragen pro Lernset",
      "Unlimitierte Erklärungszeit*",
      "AI Feedback auf deine Antworten",
      "Fragen mit AI verbessern",
      "Priority AI Verarbeitung",
    ],
    note: "*Fair Use Policy",
  },
];

const MOBILE_TABS_TOP_OFFSET = 72;
const MOBILE_TAB_BAR_FALLBACK_HEIGHT = 52;
const MOBILE_SECTION_SCROLL_EXTRA = 10;

function formatEuroPrice(value: number): string {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

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
  return getUsageProgressPercent(used, cap);
}

function getModalCopy(action: PendingAction, options?: { nextBillingDate?: string | null }): ModalCopy {
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

  if (action.kind === "subscription_cancel") {
    const endDate = options?.nextBillingDate ?? "Ende der Laufzeit";
    return {
      title: "Abo kündigen",
      description:
        `Möchtest du dein Abo wirklich kündigen?\n\nDein Zugang bleibt bis zum ${endDate} aktiv.\n\nDanach wechselst du automatisch zum kostenlosen Plan.`,
      confirmLabel: "Abo kündigen",
      intent: "danger",
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
  const [isUpdatingSubscription, setIsUpdatingSubscription] = useState(false);
  const [speechResetCountdown, setSpeechResetCountdown] = useState("00:00:00");
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
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

  const updateSubscriptionCancellation = useCallback(
    async (action: "cancel" | "resume") => {
      setIsUpdatingSubscription(true);
      try {
        const response = await fetch("/api/stripe/subscription", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error || "Abo-Status konnte nicht aktualisiert werden.");
        }

        if (action === "cancel") {
          toast.success("Abo gekündigt", "Dein Zugang bleibt bis zum Ende der Laufzeit aktiv.");
          setPendingAction(null);
        } else {
          toast.success("Kündigung rückgängig gemacht", "Dein Abo läuft normal weiter.");
        }

        await loadDashboard();
      } catch (error) {
        toast.error(
          "Aktion fehlgeschlagen",
          error instanceof Error ? error.message : "Bitte später erneut versuchen."
        );
      } finally {
        setIsUpdatingSubscription(false);
      }
    },
    [loadDashboard, toast]
  );

  const handleConfirmAction = async () => {
    if (!pendingAction) return;

    if (pendingAction.kind === "upgrade") {
      const target = pendingAction.target;
      setPendingAction(null);
      window.location.assign(`/pricing?plan=${target}&billing=${billingCycle}`);
      return;
    }

    if (pendingAction.kind === "portal") {
      setPendingAction(null);
      await openBillingPortal();
      return;
    }

    if (pendingAction.kind === "subscription_cancel") {
      await updateSubscriptionCancellation("cancel");
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
  const billingInterval = dashboard?.billingInterval ?? null;

  const deckLimit = dashboard?.limits.deckLimit ?? 3;
  const decksCreated = dashboard?.usage.decksCreated ?? 0;

  const speechCap = dashboard?.limits.speechSecondsPerDay ?? 300;
  const speechUsed = dashboard?.usage.speechSecondsToday ?? 0;
  const hasReachedDeckLimit =
    plan === "free" && typeof deckLimit === "number" && decksCreated >= deckLimit;
  const hasReachedSpeechLimit =
    plan === "free" && typeof speechCap === "number" && speechUsed >= speechCap;

  const currentPlanLabel = plan === "free" ? "Kostenlos" : plan === "premium" ? "Premium" : "Ultimate";
  const billingLabel = billingInterval === "yearly" ? "Jährlich" : billingInterval === "monthly" ? "Monatlich" : "-";
  const isFreePlan = plan === "free";
  const isCancelAtPeriodEnd = status === "cancel_at_period_end";
  const isPaidActive = !isFreePlan && !isCancelAtPeriodEnd;
  const hasPaymentIssue = status === "past_due";

  const modalCopy = useMemo(
    () => (pendingAction ? getModalCopy(pendingAction, { nextBillingDate }) : null),
    [nextBillingDate, pendingAction]
  );

  const isModalBusy =
    (pendingAction?.kind === "portal" && isOpeningPortal) ||
    (pendingAction?.kind === "danger" && isRunningDangerAction) ||
    (pendingAction?.kind === "subscription_cancel" && isUpdatingSubscription);
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
                    tooltip="Maximale Anzahl an Lernsets in deinem Account."
                    current={String(decksCreated)}
                    limit={formatLimitedValue(deckLimit)}
                    progress={progressForLimited(decksCreated, deckLimit)}
                    limitReached={hasReachedDeckLimit}
                    limitReachedHint={plan === "free" ? "Upgrade auf Premium für unlimitierte Lernsets." : undefined}
                    hideLimitStatusLabel
                  />
                  <QuestionsPerDeckCapabilityCard
                    title="Fragen pro Lernset"
                    tooltip="Maximale Anzahl an Fragen innerhalb eines Lernsets."
                    plan={plan}
                  />
                  <UsageMetricCard
                    title="Erklärungszeit (Audio)"
                    tooltip="Zeit für mündliche Antworten auf Fragen. Deine Antwort wird transkribiert und von der AI bewertet."
                    current={String(speechUsed)}
                    limit={formatLimitedValue(speechCap)}
                    progress={progressForLimited(speechUsed, speechCap)}
                    helper={`Zurückgesetzt in ${speechResetCountdown}`}
                    limitReached={hasReachedSpeechLimit}
                    limitReachedHint={plan === "free" ? "Upgrade auf Premium für mehr Lernzeit." : undefined}
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

                <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4 text-sm">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Aktueller Plan</p>
                      <p className="mt-1 text-sm font-semibold text-foreground">{currentPlanLabel}</p>
                    </div>
                    {!isFreePlan && (
                      <div>
                        <p className="text-xs text-muted-foreground">
                          {isCancelAtPeriodEnd ? "Abo endet am" : "Nächste Abbuchung"}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-foreground">
                          {isCancelAtPeriodEnd ? statusDate ?? "-" : nextBillingDate ?? "-"}
                        </p>
                      </div>
                    )}
                    {!isFreePlan && (
                      <div>
                        <p className="text-xs text-muted-foreground">Abrechnung</p>
                        <p className="mt-1 text-sm font-semibold text-foreground">{billingLabel}</p>
                      </div>
                    )}
                  </div>
                  {hasPaymentIssue && (
                    <p className="mt-3 text-sm text-[var(--color-warning)]">
                      Zahlung fehlgeschlagen. Bitte Zahlungsmethode prüfen.
                    </p>
                  )}
                  {!isFreePlan && (
                    <div className="mt-3">
                      {isPaidActive && (
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full sm:w-auto"
                          onClick={() => setPendingAction({ kind: "subscription_cancel" })}
                          disabled={!dashboard?.canManageSubscription || isUpdatingSubscription}
                        >
                          Abo kündigen
                        </Button>
                      )}
                      {isCancelAtPeriodEnd && (
                        <LoadingButton
                          variant="outline"
                          text="Kündigung rückgängig machen"
                          loadingText="Aktualisiere"
                          isLoading={isUpdatingSubscription}
                          onClick={() => void updateSubscriptionCancellation("resume")}
                          className="w-full sm:w-auto"
                          disabled={!dashboard?.canManageSubscription || isUpdatingSubscription}
                        />
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-5 flex items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">Abrechnung</p>
                  <div className="inline-flex rounded-full border border-[var(--color-border)] bg-[var(--color-card)] p-1">
                    <button
                      type="button"
                      onClick={() => setBillingCycle("monthly")}
                      className={cn(
                        "inline-flex items-center rounded-full px-4 py-1.5 text-[14px] font-medium transition-all duration-200 ease-out",
                        billingCycle === "monthly"
                          ? "bg-[var(--color-accent)] text-black"
                          : "text-muted-foreground opacity-70 hover:text-foreground hover:opacity-100"
                      )}
                    >
                      Monatlich
                    </button>
                    <button
                      type="button"
                      onClick={() => setBillingCycle("yearly")}
                      className={cn(
                        "inline-flex items-center rounded-full px-4 py-1.5 text-[14px] font-medium transition-all duration-200 ease-out",
                        billingCycle === "yearly"
                          ? "bg-[var(--color-accent)] text-black"
                          : "text-muted-foreground opacity-70 hover:text-foreground hover:opacity-100"
                      )}
                    >
                      <span>Jährlich</span>
                      <span className="ml-[6px] rounded-[6px] bg-[var(--color-accent)] px-[6px] py-[2px] text-[11px] leading-none text-black">
                        -20%
                      </span>
                    </button>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
                  {PLAN_CARDS.map((card) => {
                    const isCurrentPlan = card.tier === plan;
                    const isUpgradePath = PLAN_ORDER[card.tier] > PLAN_ORDER[plan];
                    const canUpgradeToCard = card.tier !== "free" && isUpgradePath;
                    const effectiveMonthlyPrice =
                      billingCycle === "yearly" ? card.monthlyPrice * 0.8 : card.monthlyPrice;
                    const annualPrice = effectiveMonthlyPrice * 12;

                    const ctaLabel = isCurrentPlan ? "Aktueller Plan" : canUpgradeToCard ? "Upgrade" : "Inklusive";
                    const ctaDisabled = !canUpgradeToCard;

                    return (
                      <article
                        key={card.tier}
                        className={cn(
                          "relative flex h-full flex-col rounded-xl border bg-[var(--color-card)] p-5",
                          card.highlighted
                            ? "border-2 border-[var(--color-accent)]"
                            : "border-[var(--color-border)]"
                        )}
                        style={
                          card.highlighted
                            ? { boxShadow: "0 0 20px rgba(var(--color-accent-rgb), 0.25)" }
                            : undefined
                        }
                      >
                        {card.badge && (
                          <p className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-md bg-[var(--color-accent)] px-2 py-1 text-[12px] font-semibold text-black">
                            {card.badge}
                          </p>
                        )}
                        <p className="text-sm font-semibold text-foreground">{card.title}</p>
                        <p className="mt-1 text-xl font-semibold text-foreground">
                          {formatEuroPrice(effectiveMonthlyPrice)} € / Monat
                        </p>
                        {billingCycle === "yearly" && card.tier !== "free" && (
                          <p className="mt-1 text-xs text-muted-foreground/80">
                            {formatEuroPrice(annualPrice)} € / Jahr · 20% Rabatt
                          </p>
                        )}

                        <ul className="mt-4 space-y-2 text-sm">
                          {card.features.map((feature) => (
                            <li key={feature} className="text-muted-foreground">
                              {feature}
                            </li>
                          ))}
                        </ul>
                        {card.note && <p className="mt-1.5 text-xs text-muted-foreground/70">{card.note}</p>}

                        <div className="mt-auto pt-5">
                          <Button
                            type="button"
                            className="w-full"
                            variant={ctaDisabled ? "outline" : "default"}
                            onClick={() => {
                              if (!canUpgradeToCard) return;
                              setPendingAction({ kind: "upgrade", target: card.tier as UpgradeTarget });
                            }}
                            disabled={ctaDisabled}
                          >
                            {ctaLabel}
                          </Button>
                          <p
                            className={cn(
                              "mt-1.5 text-center text-xs",
                              canUpgradeToCard ? "text-muted-foreground/70" : "invisible"
                            )}
                          >
                            Jederzeit kündbar.
                          </p>
                        </div>
                      </article>
                    );
                  })}
                </div>

                {!isFreePlan && !dashboard?.canManageSubscription && (
                  <p className="mt-4 text-xs text-muted-foreground">
                    Abo-Verwaltung ist für diesen Account aktuell nicht verfügbar.
                  </p>
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
            <p
              className={cn(
                "mt-2 text-sm text-muted-foreground",
                pendingAction?.kind === "subscription_cancel" && "whitespace-pre-line"
              )}
            >
              {modalCopy.description}
            </p>
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
  tooltip,
  current,
  limit,
  progress,
  helper,
  limitReached = false,
  limitReachedHint,
  hideLimitStatusLabel = false,
}: {
  title: string;
  tooltip?: string;
  current: string;
  limit: string;
  progress: number;
  helper?: string;
  limitReached?: boolean;
  limitReachedHint?: string;
  hideLimitStatusLabel?: boolean;
}): JSX.Element {
  const currentValue = parseNumericValue(current);
  const limitValue = parseNumericValue(limit);
  const isLimitExceeded =
    currentValue !== null && limitValue !== null && currentValue > limitValue;
  const showExceededNotice = isLimitExceeded && !hideLimitStatusLabel;
  const showReachedNotice = limitReached && !isLimitExceeded && !hideLimitStatusLabel;
  const showUpgradeHint = Boolean(limitReachedHint) && (limitReached || isLimitExceeded);

  return (
    <article className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
      <div className="flex items-center gap-1.5">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {tooltip && (
          <InfoTooltip
            title={title}
            description={tooltip}
            multilineDescription
            placement="bottom-left"
            className="[&>span]:h-4 [&>span]:w-4"
            contentClassName="max-w-[min(16rem,calc(100vw-2rem))] whitespace-normal"
            arrowClassName="right-[16px]"
          >
            <svg
              viewBox="0 0 24 24"
              stroke="currentColor"
              className="h-4 w-4 fill-none text-muted-foreground transition-colors duration-300"
            >
              <path
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </svg>
          </InfoTooltip>
        )}
      </div>
      <p className="mt-3 text-lg font-semibold text-foreground">
        {current} <span className="text-sm font-medium text-muted-foreground">/ {limit}</span>
      </p>
      <div className="mt-3 h-[6px] w-full rounded-[4px] bg-[var(--color-border)]">
        <div className="h-full rounded-[4px] bg-[var(--color-accent)]" style={{ width: `${progress}%` }} />
      </div>
      {showExceededNotice && <p className="mt-1 text-xs text-[var(--color-warning)]">Limit überschritten</p>}
      {showReachedNotice && <p className="mt-1.5 text-[13px] text-[var(--color-warning)]">Limit erreicht</p>}
      {showUpgradeHint && (
        <p className="mt-1 text-[13px] text-[var(--color-warning)]">{limitReachedHint}</p>
      )}
      {helper && <p className="mt-2 text-xs text-muted-foreground">{helper}</p>}
    </article>
  );
}

function QuestionsPerDeckCapabilityCard({
  title,
  tooltip,
  plan,
}: {
  title: string;
  tooltip?: string;
  plan: PlanTier;
}): JSX.Element {
  const planLimits: Array<{ tier: PlanTier; label: string; value: string }> = [
    { tier: "free", label: "Kostenlos", value: "10" },
    { tier: "premium", label: "Premium", value: "25" },
    { tier: "ultimate", label: "Ultimate", value: "50" },
  ];

  return (
    <article className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
      <div className="flex items-center gap-1.5">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {tooltip && (
          <InfoTooltip
            title={title}
            description={tooltip}
            multilineDescription
            placement="bottom-left"
            className="[&>span]:h-4 [&>span]:w-4"
            contentClassName="max-w-[min(16rem,calc(100vw-2rem))] whitespace-normal"
            arrowClassName="right-[26px]"
          >
            <svg
              viewBox="0 0 24 24"
              stroke="currentColor"
              className="h-4 w-4 fill-none text-muted-foreground transition-colors duration-300"
            >
              <path
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </svg>
          </InfoTooltip>
        )}
      </div>
      <div className="mt-3 flex flex-col gap-1.5 text-sm">
        {planLimits.map((entry) => {
          const isCurrent = entry.tier === plan;
          return (
            <div
              key={entry.tier}
              className={cn(
                "flex items-center justify-between rounded-md px-1.5 py-1",
                isCurrent
                  ? "bg-muted font-semibold text-foreground"
                  : "text-foreground/70"
              )}
            >
              <span className="flex items-center gap-2">
                {isCurrent && (
                  <span className="inline-flex items-center rounded bg-muted-foreground/20 p-0.5 text-foreground/80">
                    <CheckCircleIcon className="h-3.5 w-3.5" />
                  </span>
                )}
                <span>{entry.label}</span>
              </span>
              <span
                className={cn(
                  "rounded px-2 py-0.5",
                  isCurrent ? "bg-muted-foreground/20 text-foreground" : "bg-muted-foreground/10 text-foreground/80"
                )}
              >
                {entry.value}
              </span>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function parseNumericValue(value: string): number | null {
  const normalized = value.replace(",", ".").replace(/[^\d.-]/g, "");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
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
        <div key={index} className="space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
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
      <div className="space-y-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
        <div className="h-4 w-1/3 rounded bg-muted" />
        <div className="h-4 w-1/2 rounded bg-muted" />
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <div key={index} className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
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
