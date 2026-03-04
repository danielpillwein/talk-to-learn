'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import { useToast } from '@/components/ui/toast/useToast';
import { ArrowPathIcon, ChevronDownIcon, MagnifyingGlassIcon, PencilSquareIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { SpacedRepetitionManager } from '@/lib/spaced-repetition';

interface FileStats {
    id: string;
    title: string;
    filename: string;
    description?: string | null;
    searchText?: string;
    searchCards?: Array<{ question: string; answer: string }>;
    totalQuestions: number;
    known: number;
    learning: number;
    new: number;
    createdAt?: string | null;
    lastEditedAt?: string | null;
    learningPhaseStatus?: 'intro' | 'scaffolded' | 'free';
}

type SortOption =
    | 'lastCreatedDesc'
    | 'alphaAsc'
    | 'alphaDesc'
    | 'progressDesc'
    | 'progressAsc';

const DEFAULT_SORT: SortOption = 'lastCreatedDesc';

type QuestionAnswerMatch = {
    location: string;
    snippet: string;
    matchStart: number;
    matchLength: number;
    hasLeadingEllipsis: boolean;
    hasTrailingEllipsis: boolean;
};

function findCaseInsensitiveIndex(text: string, query: string): number {
    return text.toLocaleLowerCase('de').indexOf(query.toLocaleLowerCase('de'));
}

function createSnippet(text: string, matchIndex: number, matchLength: number): QuestionAnswerMatch {
    const radius = 56;
    const start = Math.max(0, matchIndex - radius);
    const end = Math.min(text.length, matchIndex + matchLength + radius);
    const snippet = text.slice(start, end);

    return {
        location: '',
        snippet,
        matchStart: Math.max(0, matchIndex - start),
        matchLength,
        hasLeadingEllipsis: start > 0,
        hasTrailingEllipsis: end < text.length,
    };
}

function findQuestionAnswerMatch(file: FileStats, query: string): QuestionAnswerMatch | null {
    const normalized = query.trim();
    if (!normalized) return null;

    const cards = file.searchCards ?? [];
    for (let index = 0; index < cards.length; index += 1) {
        const card = cards[index];
        const questionIndex = findCaseInsensitiveIndex(card.question, normalized);
        if (questionIndex >= 0) {
            const snippet = createSnippet(card.question, questionIndex, normalized.length);
            return { ...snippet, location: `Frage ${index + 1}` };
        }

        const answerIndex = findCaseInsensitiveIndex(card.answer, normalized);
        if (answerIndex >= 0) {
            const snippet = createSnippet(card.answer, answerIndex, normalized.length);
            return { ...snippet, location: `Antwort ${index + 1}` };
        }
    }

    return null;
}

function renderHighlightedSnippet(snippet: string, matchStart: number, matchLength: number): JSX.Element {
    const safeStart = Math.max(0, Math.min(matchStart, snippet.length));
    const safeEnd = Math.max(safeStart, Math.min(safeStart + matchLength, snippet.length));
    const before = snippet.slice(0, safeStart);
    const highlight = snippet.slice(safeStart, safeEnd);
    const after = snippet.slice(safeEnd);

    return (
        <span>
            {before}
            <mark className="bg-foreground px-[1px] text-background">{highlight}</mark>
            {after}
        </span>
    );
}

function renderHighlightedText(text: string, query: string): JSX.Element {
    const trimmed = query.trim();
    if (!trimmed) return <>{text}</>;
    const matchIndex = findCaseInsensitiveIndex(text, trimmed);
    if (matchIndex < 0) return <>{text}</>;
    return renderHighlightedSnippet(text, matchIndex, trimmed.length);
}

function HeroSearch(props: {
    searchInput: string;
    onSearchChange: (value: string) => void;
    onSearchClear: () => void;
    sortOption: SortOption;
    onSortChange: (value: SortOption) => void;
    compact: boolean;
}): JSX.Element {
    const { searchInput, onSearchChange, onSearchClear, sortOption, onSortChange, compact } = props;
    const [isSortOpen, setIsSortOpen] = useState(false);
    const sortRef = useRef<HTMLDivElement | null>(null);

    const sortOptions: Array<{ value: SortOption; label: string }> = [
        { value: 'lastCreatedDesc', label: 'Zuletzt erstellt' },
        { value: 'alphaAsc', label: 'Alphabetisch (A-Z)' },
        { value: 'alphaDesc', label: 'Alphabetisch (Z-A)' },
        { value: 'progressDesc', label: 'Fortschritt (absteigend)' },
        { value: 'progressAsc', label: 'Fortschritt (aufsteigend)' },
    ];

    const selectedSortLabel = sortOptions.find((entry) => entry.value === sortOption)?.label ?? 'Zuletzt erstellt';

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (!sortRef.current) return;
            if (!sortRef.current.contains(event.target as Node)) {
                setIsSortOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    return (
        <section className="deck-hero sticky top-[5.25rem] z-20 mt-8 mb-8 md:mt-10 md:mb-10">
            <div className="w-full rounded-2xl border border-border bg-card/95 px-4 py-4 shadow-sm backdrop-blur-sm transition md:px-6 md:py-5">
                {!compact && (
                    <div className="mb-5 text-center md:mb-6">
                        <h1 className="text-2xl font-semibold text-foreground md:text-3xl">Was möchtest du lernen?</h1>
                        <p className="mt-1 text-sm text-muted-foreground">Durchsuche deine Lernsets oder starte direkt.</p>
                    </div>
                )}
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div className="w-full text-left md:max-w-[640px] md:flex-1">
                        <div className="relative">
                            <MagnifyingGlassIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                            <input
                                type="text"
                                value={searchInput}
                                onChange={(event) => onSearchChange(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Escape') onSearchClear();
                                }}
                                placeholder="Decks durchsuchen…"
                                className="h-12 w-full rounded-xl border border-border bg-background pl-11 pr-11 text-[15px] text-foreground shadow-sm transition placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/45 md:h-[52px]"
                            />
                            {searchInput.trim() && (
                                <button
                                    type="button"
                                    onClick={onSearchClear}
                                    className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground"
                                    aria-label="Suche leeren"
                                >
                                    <XMarkIcon className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                    </div>

                    <div ref={sortRef} className="relative w-full text-left md:w-[280px] md:max-w-[280px]">
                        <label className="mb-1 block text-xs font-medium text-muted-foreground">Sortieren nach</label>
                        <button
                            type="button"
                            onClick={() => setIsSortOpen((prev) => !prev)}
                            className="flex h-11 w-full items-center justify-between rounded-xl border border-border bg-background px-3 text-sm text-foreground shadow-sm transition hover:border-foreground/30 focus:border-foreground/20 focus:outline-none"
                            aria-haspopup="listbox"
                            aria-expanded={isSortOpen}
                        >
                            <span className="truncate text-left">{selectedSortLabel}</span>
                            <ChevronDownIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        </button>

                        {isSortOpen && (
                            <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-border bg-background shadow-lg">
                                <ul role="listbox" className="py-1">
                                    {sortOptions.map((entry) => {
                                        const selected = entry.value === sortOption;
                                        return (
                                            <li key={entry.value}>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        onSortChange(entry.value);
                                                        setIsSortOpen(false);
                                                    }}
                                                    className={`w-full px-3 py-2 text-left text-sm transition ${
                                                        selected
                                                            ? 'bg-secondary text-secondary-foreground'
                                                            : 'text-foreground hover:bg-accent hover:text-accent-foreground'
                                                    }`}
                                                    role="option"
                                                    aria-selected={selected}
                                                >
                                                    {entry.label}
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}

export default function LearnIndexPage(): JSX.Element {
    const searchParams = useSearchParams();
    const toast = useToast();
    const hasPlayedConfetti = useRef(false);
    const [highlightedDeckId, setHighlightedDeckId] = useState('');
    const [items, setItems] = useState<FileStats[]>([]);
    const [isLoadingFiles, setIsLoadingFiles] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [searchInput, setSearchInput] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOption, setSortOption] = useState<SortOption>(DEFAULT_SORT);
    const [isHeroCompact, setIsHeroCompact] = useState(false);
    const clearSearch = () => {
        setSearchInput('');
        setSearchTerm('');
    };

    const fetchFiles = useCallback(async (showLoader: boolean) => {
        if (showLoader) setIsLoadingFiles(true);

        try {
            const response = await fetch('/api/files', { cache: 'no-store' });
            if (!response.ok) throw new Error('Failed to list files');
            const data = await response.json();

            const filesWithStats = data.files.map((f: {
                id: string;
                title: string;
                filename: string;
                description?: string | null;
                searchText?: string;
                searchCards?: Array<{ question?: string; answer?: string }>;
                totalQuestions: number;
                known?: number;
                learning?: number;
                new?: number;
                createdAt?: string | null;
                lastEditedAt?: string | null;
                learningPhaseStatus?: 'intro' | 'scaffolded' | 'free';
            }) => {
                const hasServerStats = typeof f.known === 'number' && typeof f.learning === 'number' && typeof f.new === 'number';
                const stats = hasServerStats
                    ? { known: f.known, learning: f.learning, new: f.new }
                    : SpacedRepetitionManager.getStoredStats(f.id, f.totalQuestions);

                return {
                    ...f,
                    ...stats,
                    searchText: String(f.searchText ?? '').toLocaleLowerCase('de'),
                    searchCards: Array.isArray(f.searchCards)
                        ? f.searchCards.map((card) => ({
                              question: String(card.question ?? ''),
                              answer: String(card.answer ?? ''),
                          }))
                        : [],
                };
            });

            setItems(filesWithStats);
            setError(null);
        } catch (err) {
            console.error(err);
            setError('Konnte Lernsets nicht laden.');
        } finally {
            if (showLoader) setIsLoadingFiles(false);
        }
    }, []);

    useEffect(() => {
        void fetchFiles(true);
    }, [fetchFiles]);

    useEffect(() => {
        const handle = window.setTimeout(() => {
            setSearchTerm(searchInput.trim());
        }, 300);

        return () => {
            window.clearTimeout(handle);
        };
    }, [searchInput]);

    useEffect(() => {
        const onScroll = () => {
            setIsHeroCompact(window.scrollY > 80);
        };
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => {
            window.removeEventListener('scroll', onScroll);
        };
    }, []);

    useEffect(() => {
        const nextDeckId = (searchParams.get('newDeck') ?? '').trim();
        if (!nextDeckId) return;
        setHighlightedDeckId((prev) => prev || nextDeckId);
    }, [searchParams]);

    useEffect(() => {
        if (searchParams.get('deleted') !== '1') return;
        window.scrollTo({ top: 0, left: 0 });
        const url = new URL(window.location.href);
        url.searchParams.delete('deleted');
        window.history.replaceState({}, '', url.toString());
    }, [searchParams]);

    useEffect(() => {
        if (hasPlayedConfetti.current) return;
        if (searchParams.get('saved') !== '1') return;
        if (isLoadingFiles) return;
        hasPlayedConfetti.current = true;
        window.scrollTo({ top: 0, left: 0 });

        const play = async () => {
            const module = await import('canvas-confetti');
            const confetti = module.default;
            confetti({
                particleCount: 70,
                spread: 55,
                angle: 58,
                startVelocity: 50,
                origin: { x: 0.03, y: 0.98 },
            });
            confetti({
                particleCount: 70,
                spread: 55,
                angle: 122,
                startVelocity: 50,
                origin: { x: 0.97, y: 0.98 },
            });
            toast.success('Lernset gespeichert', 'Dein neues Lernset ist jetzt bereit.');
            window.setTimeout(() => {
                confetti({
                    particleCount: 55,
                    spread: 70,
                    angle: 62,
                    startVelocity: 44,
                    origin: { x: 0.04, y: 0.98 },
                });
                confetti({
                    particleCount: 55,
                    spread: 70,
                    angle: 118,
                    startVelocity: 44,
                    origin: { x: 0.96, y: 0.98 },
                });
            }, 220);
            window.setTimeout(() => {
                const url = new URL(window.location.href);
                url.searchParams.delete('saved');
                url.searchParams.delete('newDeck');
                url.searchParams.delete('deleted');
                window.history.replaceState({}, '', url.toString());
            }, 1200);
        };

        const timeoutId = window.setTimeout(() => {
            void play();
        }, 300);

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [searchParams, isLoadingFiles, toast]);

    const toSlug = (id: string) => encodeURIComponent(id);

    const getPhaseMeta = (phase?: FileStats['learningPhaseStatus']) => {
        if (phase === 'intro') {
            return {
                label: 'Einführung',
                className: 'bg-accent text-foreground',
            };
        }

        if (phase === 'scaffolded') {
            return {
                label: 'Üben',
                className: 'bg-accent text-foreground',
            };
        }

        if (phase === 'free') {
            return {
                label: 'Erklären',
                className: 'bg-accent text-foreground',
            };
        }

        return {
            label: 'Status unbekannt',
            className: 'bg-secondary text-muted-foreground',
        };
    };

    const visibleItems = useMemo(() => {
        const q = searchTerm.toLocaleLowerCase('de');

        const stageRank = (stage?: FileStats['learningPhaseStatus']) => {
            if (stage === 'free') return 2;
            if (stage === 'scaffolded') return 1;
            return 0;
        };

        const getTime = (value?: string | null) => {
            if (!value) return 0;
            const time = new Date(value).getTime();
            return Number.isFinite(time) ? time : 0;
        };

        const filtered = items.filter((item) => {
            if (!q) return true;

            const fallback = `${item.title} ${String(item.description ?? '')}`.toLocaleLowerCase('de');
            const haystack = item.searchText && item.searchText.trim() ? item.searchText : fallback;
            return haystack.includes(q);
        });

        filtered.sort((a, b) => {
            const byTitle = a.title.localeCompare(b.title, 'de', { sensitivity: 'base' });

            if (sortOption === 'alphaAsc') return byTitle;
            if (sortOption === 'alphaDesc') return byTitle * -1;

            if (sortOption === 'lastCreatedDesc') {
                return getTime(b.createdAt) - getTime(a.createdAt) || byTitle;
            }

            if (sortOption === 'progressDesc') {
                const byStage = stageRank(b.learningPhaseStatus) - stageRank(a.learningPhaseStatus);
                if (byStage !== 0) return byStage;

                const aProgress = a.totalQuestions > 0 ? a.known / a.totalQuestions : 0;
                const bProgress = b.totalQuestions > 0 ? b.known / b.totalQuestions : 0;
                return bProgress - aProgress || byTitle;
            }

            if (sortOption === 'progressAsc') {
                const byStage = stageRank(a.learningPhaseStatus) - stageRank(b.learningPhaseStatus);
                if (byStage !== 0) return byStage;

                const aProgress = a.totalQuestions > 0 ? a.known / a.totalQuestions : 0;
                const bProgress = b.totalQuestions > 0 ? b.known / b.totalQuestions : 0;
                return aProgress - bProgress || byTitle;
            }

            return getTime(b.createdAt) - getTime(a.createdAt) || byTitle;
        });

        return filtered;
    }, [items, searchTerm, sortOption]);

    return (
        <div className="relative">
            <div className="relative flex flex-col gap-6">
                <div className="space-y-2">
                    <HeroSearch
                        searchInput={searchInput}
                        onSearchChange={setSearchInput}
                        onSearchClear={clearSearch}
                        sortOption={sortOption}
                        onSortChange={setSortOption}
                        compact={isHeroCompact}
                    />

                    {isLoadingFiles ? (
                        <div className="flex min-h-[50vh] w-full flex-col items-center justify-center gap-3 rounded-3xl bg-card p-10 shadow-sm">
                            <ArrowPathIcon className="h-6 w-6 animate-spin text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">
                                Einen Moment, wir laden gerade deine Lernsets...
                            </p>
                        </div>
                    ) : (
                        <>
                        {items.length === 0 && (
                            <div className="rounded-3xl border border-border bg-card p-8 text-center text-muted-foreground shadow-sm">
                                <p className="text-base text-foreground">Du hast noch keine Lernsets.</p>
                                <p className="mt-2 text-sm text-muted-foreground">Erstelle ein erstes Set, um direkt loszulegen.</p>
                                <div className="mt-4">
                                    <Button asChild>
                                        <Link href="/app/create?new=1">Erstes Lernset erstellen</Link>
                                    </Button>
                                </div>
                            </div>
                        )}

                        {items.length > 0 && visibleItems.length === 0 && (
                            <div className="rounded-3xl bg-card p-8 text-center text-muted-foreground shadow-sm">
                                <p className="text-base text-foreground">Keine Ergebnisse für '{searchTerm}'</p>
                                <div className="mt-4">
                                    <Button
                                        variant="outline"
                                        onClick={clearSearch}
                                    >
                                        Suche zurücksetzen
                                    </Button>
                                </div>
                            </div>
                        )}

                        <div className="h-2 md:h-4" />
                        {visibleItems.map((file) => {
                            const total = file.totalQuestions || 1;
                            const knownPct = Math.round((file.known / total) * 100);
                            const learningPct = Math.round((file.learning / total) * 100);
                            const newPct = Math.max(0, 100 - knownPct - learningPct);
                            const showKnownLearningDivider = knownPct > 0 && learningPct > 0;
                            const phaseMeta = getPhaseMeta(file.learningPhaseStatus);
                            const searchMatch =
                                searchTerm.trim().length > 0 ? findQuestionAnswerMatch(file, searchTerm) : null;

                            return (
                                <Card
                                    key={file.id}
                                    className={`group border-border bg-card shadow-sm transition hover:border-foreground/20 ${
                                        highlightedDeckId && highlightedDeckId === file.id
                                            ? 'ring-1 ring-warning shadow-[0_0_0_1px_color-mix(in_srgb,var(--warning)_82%,transparent),0_0_32px_8px_color-mix(in_srgb,var(--warning)_48%,transparent)]'
                                            : ''
                                    }`}
                                >
                                    <CardContent className="flex flex-col gap-4 p-5">
                                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                            <div className="min-w-0 flex flex-1 items-center">
                                                <h3 className="break-words text-lg font-semibold leading-none text-foreground">
                                                    {renderHighlightedText(file.title, searchTerm)}
                                                </h3>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className={`inline-flex h-10 items-center rounded-[999px] px-4 text-sm ${phaseMeta.className}`}>
                                                    <span>{phaseMeta.label}</span>
                                                    <InfoTooltip
                                                        title="So funktionieren die Lernstufen"
                                                        description={`1) Einführung: Frage + Lösung sehen
2) Üben: Lösung in eigenen Worten erklären
3) Erklären: nur mit der Frage erklären`}
                                                        multilineDescription
                                                        positionClassName="min-w-[20rem]"
                                                        className="ml-0.5 [&>span]:h-5 [&>span]:w-5"
                                                    >
                                                        <svg
                                                            viewBox="0 0 24 24"
                                                            stroke="currentColor"
                                                            className="h-4 w-4 fill-none text-current"
                                                        >
                                                            <path
                                                                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                                                strokeWidth="2"
                                                                strokeLinejoin="round"
                                                                strokeLinecap="round"
                                                            />
                                                        </svg>
                                                    </InfoTooltip>
                                                </span>
                                                <Button asChild>
                                                    <Link href={`/app/learn/${toSlug(file.id)}`}>Lernen</Link>
                                                </Button>
                                                <Button variant="outline" asChild>
                                                    <Link href={`/app/learn/edit/${toSlug(file.id)}`}>
                                                        <span className="inline-flex items-center gap-1">
                                                            <PencilSquareIcon className="h-4 w-4" />
                                                            Bearbeiten
                                                        </span>
                                                    </Link>
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <div className="flex h-3 flex-1 overflow-hidden rounded-full border border-secondary">
                                                <div
                                                    className="bg-success"
                                                    style={{
                                                        width: `${knownPct}%`,
                                                        borderRightWidth: showKnownLearningDivider ? '1px' : '0',
                                                        borderRightStyle: 'solid',
                                                        borderRightColor: 'var(--background)',
                                                    }}
                                                />
                                                <div
                                                    className="bg-warning"
                                                    style={{ width: `${learningPct}%` }}
                                                />
                                                <div
                                                    className="bg-muted-foreground/30"
                                                    style={{ width: `${newPct}%` }}
                                                />
                                            </div>
                                            <div className="shrink-0 text-sm text-muted-foreground">
                                                (
                                                <span className="mx-1 inline-flex items-center gap-1">
                                                    <span className="h-2 w-2 rounded-full bg-success" />
                                                    {file.known}
                                                </span>
                                                <span className="mx-1 inline-flex items-center gap-1">
                                                    <span className="h-2 w-2 rounded-full bg-warning" />
                                                    {file.learning}
                                                </span>
                                                <span className="mx-1 inline-flex items-center gap-1">
                                                    <span className="h-2 w-2 rounded-full bg-muted-foreground" />
                                                    {file.new}
                                                </span>
                                                )
                                            </div>
                                        </div>
                                        {searchMatch && (
                                            <div className="mt-3 rounded-xl border border-border/70 bg-background px-3 py-2 text-sm">
                                                <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                                                    Treffer in {searchMatch.location}
                                                </p>
                                                <p className="mt-1 text-muted-foreground">
                                                    {searchMatch.hasLeadingEllipsis ? '… ' : ''}
                                                    {renderHighlightedSnippet(
                                                        searchMatch.snippet,
                                                        searchMatch.matchStart,
                                                        searchMatch.matchLength
                                                    )}
                                                    {searchMatch.hasTrailingEllipsis ? ' …' : ''}
                                                </p>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            );
                        })}
                        </>
                    )}
                </div>

                {error && (
                    <Alert variant="destructive" className="mt-4">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}
            </div>
        </div>
    );
}
