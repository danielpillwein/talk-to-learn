'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, FileText, Loader2, RotateCcw, User, XCircle } from 'lucide-react';
import { SpacedRepetitionManager } from '@/lib/spaced-repetition';

interface FileStats {
    id: string;
    title: string;
    filename: string;
    totalQuestions: number;
    known: number;
    learning: number;
    new: number;
}

export default function LearnIndexPage() {
    const { data: session } = useSession();
    const user = session?.user;
    const [avatarFailed, setAvatarFailed] = useState(false);

    const [availableFiles, setAvailableFiles] = useState<FileStats[]>([]);
    const [isLoadingFiles, setIsLoadingFiles] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchFiles = async () => {
            try {
                const response = await fetch('/api/files');
                if (!response.ok) throw new Error('Failed to list files');
                const data = await response.json();

                const filesWithStats = data.files.map((f: { id: string; title: string; filename: string; totalQuestions: number; known?: number; learning?: number; new?: number }) => {
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

    const avatarContent = useMemo(() => {
        if (user?.image && !avatarFailed) {
            return (
                <img
                    src={user.image}
                    alt="Account"
                    className="h-8 w-8 rounded-full object-cover"
                    onError={() => setAvatarFailed(true)}
                />
            );
        }

        return (
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                {user?.name?.charAt(0) ?? <User className="h-4 w-4" />}
            </span>
        );
    }, [user?.image, user?.name, avatarFailed]);

    return (
        <div className="relative min-h-screen bg-background px-6 pb-12 pt-6">
            <div className="relative mx-auto flex max-w-5xl flex-col gap-6">
                <header className="flex items-center justify-between rounded-3xl border border-border bg-card px-6 py-5 shadow-sm">
                    <div>
                        <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Talk to Learn</p>
                        <h1 className="text-3xl font-bold text-foreground">
                            Wähle dein Lernset aus
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Deine nächste 5‑Minuten‑Session wartet schon.
                        </p>
                    </div>
                    <Link
                        href="/app/account"
                        className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card shadow-sm transition hover:border-foreground/20"
                        aria-label="Account"
                    >
                        {avatarContent}
                    </Link>
                </header>

                {isLoadingFiles ? (
                    <div className="flex justify-center rounded-3xl border border-border bg-card p-10 shadow-sm">
                        <Loader2 className="animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <div className="space-y-4">
                        {availableFiles.map((file) => {
                            const total = file.totalQuestions || 1;
                            const knownPct = Math.round((file.known / total) * 100);
                            const learningPct = Math.round((file.learning / total) * 100);
                            const newPct = Math.max(0, 100 - knownPct - learningPct);

                            return (
                                <Link key={file.id} href={`/app/learn/${toSlug(file.id)}`}>
                                    <Card className="cursor-pointer border-border bg-card shadow-sm transition hover:border-foreground/20 active:scale-[0.99]">
                                        <CardContent className="flex flex-col gap-4 p-5">
                                            <div className="flex items-start gap-3">
                                                <FileText className="mt-1 h-6 w-6 shrink-0 text-muted-foreground" />
                                                <div className="min-w-0 flex-1">
                                                    <h3 className="break-words text-lg font-semibold leading-tight text-foreground">
                                                        {file.title}
                                                    </h3>
                                                    <p className="mt-1 text-sm text-muted-foreground">
                                                        Fokus-Session mit klaren Lernzielen
                                                    </p>
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
                                </Link>
                            );
                        })}
                        {availableFiles.length === 0 && (
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
