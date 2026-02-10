'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
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

    useEffect(() => {
        const fetchFiles = async () => {
            try {
                const response = await fetch('/api/files');
                if (!response.ok) throw new Error('Failed to list files');
                const data = await response.json();

                const filesWithStats = data.files.map((f: { id: string; title: string; filename: string; totalQuestions: number; known?: number; learning?: number; new?: number; lastLearnedAt?: string | null }) => {
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
            } catch (err) {
                console.error(err);
                setError('Konnte Lernsets nicht laden.');
            } finally {
                setIsLoadingFiles(false);
            }
        };
        fetchFiles();
    }, []);

    const toSlug = (id: string) => encodeURIComponent(id);

    const formatLastLearned = (value?: string | null) => {
        if (!value) return 'Noch nicht gelernt';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return 'Noch nicht gelernt';
        return new Intl.DateTimeFormat('de-DE', {
            dateStyle: 'medium',
            timeStyle: 'short',
        }).format(date);
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
                    <div className="flex justify-center rounded-3xl border border-border bg-card p-10 shadow-sm">
                        <ArrowPathIcon className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <div className="space-y-4">
                        {sortedFiles.map((file) => {
                            const total = file.totalQuestions || 1;
                            const knownPct = Math.round((file.known / total) * 100);
                            const learningPct = Math.round((file.learning / total) * 100);
                            const newPct = Math.max(0, 100 - knownPct - learningPct);

                            return (
                                <Card key={file.id} className="group border-border bg-card shadow-sm transition hover:border-foreground/20">
                                    <CardContent className="flex flex-col gap-4 p-5">
                                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                            <div className="flex items-start gap-3">
                                                <IconSwap
                                                    outline={DocumentTextIcon}
                                                    solid={DocumentTextIconSolid}
                                                    className="mt-1 h-6 w-6 shrink-0 text-muted-foreground group-hover:text-foreground"
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <h3 className="break-words text-lg font-semibold leading-tight text-foreground">
                                                        {file.title}
                                                    </h3>
                                                    <p className="mt-1 text-sm text-muted-foreground">
                                                        Zuletzt gelernt: {formatLastLearned(file.lastLearnedAt)}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
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

                                        <div className="space-y-2">
                                            <div className="flex h-3 overflow-hidden rounded-full bg-secondary">
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
                                            <div className="grid grid-cols-3 gap-2 text-sm text-muted-foreground">
                                                <div className="flex items-center gap-1">
                                                    <span className="h-2 w-2 rounded-full bg-success" />
                                                    Gelernt {file.known}
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <span className="h-2 w-2 rounded-full bg-warning" />
                                                    Wiederholen {file.learning}
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                                                    Offen {file.new}
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
