'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import { ArrowPathIcon, DocumentTextIcon, PencilSquareIcon, UserIcon } from '@heroicons/react/24/outline';
import { DocumentTextIcon as DocumentTextIconSolid, UserIcon as UserIconSolid } from '@heroicons/react/24/solid';
import { IconSwap } from '@/components/ui/icon';
import { SpacedRepetitionManager } from '@/lib/spaced-repetition';

interface FileStats {
    id: string;
    title: string;
    filename: string;
    totalQuestions: number;
    known: number;
    learning: number;
    new: number;
    lastLearnedAt?: string | null;
    learningPhaseStatus?: 'intro' | 'scaffolded' | 'free';
}

type SortKey = 'title-asc' | 'title-desc' | 'known-desc' | 'learning-desc' | 'new-desc' | 'total-desc' | 'last-learned-desc';

export default function LearnIndexPage(): JSX.Element {
    const { data: session } = useSession();
    const user = session?.user;
    const [avatarFailed, setAvatarFailed] = useState(false);

    const [availableFiles, setAvailableFiles] = useState<FileStats[]>([]);
    const [isLoadingFiles, setIsLoadingFiles] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sortKey, setSortKey] = useState<SortKey>('last-learned-desc');

    const fetchFiles = useCallback(async (showLoader: boolean) => {
        if (showLoader) setIsLoadingFiles(true);

        try {
            const response = await fetch('/api/files', { cache: 'no-store' });
            if (!response.ok) throw new Error('Failed to list files');
            const data = await response.json();

            const filesWithStats = data.files.map((f: { id: string; title: string; filename: string; totalQuestions: number; known?: number; learning?: number; new?: number; lastLearnedAt?: string | null; learningPhaseStatus?: 'intro' | 'scaffolded' | 'free' }) => {
                const hasServerStats = typeof f.known === 'number' && typeof f.learning === 'number' && typeof f.new === 'number';
                const stats = hasServerStats
                    ? { known: f.known, learning: f.learning, new: f.new }
                    : SpacedRepetitionManager.getStoredStats(f.id, f.totalQuestions);
                return {
                    ...f,
                    ...stats,
                };
            });

            setAvailableFiles(filesWithStats);
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

        const refreshIfVisible = () => {
            if (document.visibilityState === 'visible') {
                void fetchFiles(false);
            }
        };

        window.addEventListener('focus', refreshIfVisible);
        document.addEventListener('visibilitychange', refreshIfVisible);

        return () => {
            window.removeEventListener('focus', refreshIfVisible);
            document.removeEventListener('visibilitychange', refreshIfVisible);
        };
    }, [fetchFiles]);

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

    const sortedFiles = useMemo(() => {
        const files = [...availableFiles];
        const byTitle = (a: FileStats, b: FileStats) => a.title.localeCompare(b.title, 'de');
        const byLastLearned = (a: FileStats, b: FileStats) => {
            const aTime = a.lastLearnedAt ? new Date(a.lastLearnedAt).getTime() : 0;
            const bTime = b.lastLearnedAt ? new Date(b.lastLearnedAt).getTime() : 0;
            return bTime - aTime;
        };

        files.sort((a, b) => {
            switch (sortKey) {
                case 'title-asc':
                    return byTitle(a, b);
                case 'title-desc':
                    return byTitle(b, a);
                case 'known-desc':
                    return b.known - a.known || byTitle(a, b);
                case 'learning-desc':
                    return b.learning - a.learning || byTitle(a, b);
                case 'new-desc':
                    return b.new - a.new || byTitle(a, b);
                case 'total-desc':
                    return b.totalQuestions - a.totalQuestions || byTitle(a, b);
                case 'last-learned-desc':
                default:
                    return byLastLearned(a, b) || byTitle(a, b);
            }
        });

        return files;
    }, [availableFiles, sortKey]);

    const avatarContent = useMemo(() => {
        if (user?.image && !avatarFailed) {
            return (
                <Image
                    src={user.image}
                    alt="Account"
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

    return (
        <div className="relative">
            <div className="relative flex flex-col gap-6">
                {isLoadingFiles ? (
                    <div className="flex min-h-[calc(100vh-7rem)] w-full flex-col items-center justify-center gap-3 rounded-3xl bg-card p-10 shadow-sm">
                        <ArrowPathIcon className="h-6 w-6 animate-spin text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                            Einen Moment, wir laden gerade deine Lernsets...
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {sortedFiles.map((file) => {
                            const total = file.totalQuestions || 1;
                            const knownPct = Math.round((file.known / total) * 100);
                            const learningPct = Math.round((file.learning / total) * 100);
                            const newPct = Math.max(0, 100 - knownPct - learningPct);
                            const phaseMeta = getPhaseMeta(file.learningPhaseStatus);

                            return (
                                <Card key={file.id} className="group border-border bg-card shadow-sm transition hover:border-foreground/20">
                                    <CardContent className="flex flex-col gap-4 p-5">
                                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                            <div className="flex items-center gap-3">
                                                <IconSwap
                                                    outline={DocumentTextIcon}
                                                    solid={DocumentTextIconSolid}
                                                    className="h-6 w-6 shrink-0 text-muted-foreground group-hover:text-foreground"
                                                />
                                                <div className="min-w-0 flex flex-1 items-center">
                                                    <h3 className="break-words text-lg font-semibold leading-none text-foreground">
                                                        {file.title}
                                                    </h3>
                                                </div>
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

                                        <div>
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-3 flex-1 overflow-hidden rounded-full bg-secondary">
                                                    <div
                                                        className="bg-success"
                                                        style={{ width: `${knownPct}%` }}
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
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                        {sortedFiles.length === 0 && (
                            <div className="rounded-3xl border border-border bg-card p-8 text-center text-muted-foreground shadow-sm">
                                Keine Lernsets gefunden.
                            </div>
                        )}
                    </div>
                )}

                {error && (
                    <Alert variant="destructive" className="mt-4">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}
            </div>
        </div>
    );
}
