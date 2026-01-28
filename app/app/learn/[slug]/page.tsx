'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Script from 'next/script';
import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    ArrowLeftIcon,
    ArrowPathIcon,
    CheckCircleIcon,
    MicrophoneIcon,
    StopIcon,
    UserIcon,
    XCircleIcon,
} from '@heroicons/react/24/outline';
import {
    ArrowLeftIcon as ArrowLeftIconSolid,
    ArrowPathIcon as ArrowPathIconSolid,
    CheckCircleIcon as CheckCircleIconSolid,
    MicrophoneIcon as MicrophoneIconSolid,
    StopIcon as StopIconSolid,
    UserIcon as UserIconSolid,
    XCircleIcon as XCircleIconSolid,
} from '@heroicons/react/24/solid';
import { IconSwap } from '@/components/ui/icon';
import { SpacedRepetitionManager } from '@/lib/spaced-repetition';


interface Question {
    id: number;
    question: string;
    modelAnswer: string;
}

interface EvaluationResult {
    score: number;
    feedback: string;
    userAnswer: string;
    modelAnswer: string;
    question: string;
}

export default function LearnDetailPage(): JSX.Element {
    const params = useParams<{ slug: string }>();
    const router = useRouter();
    const deckId = params?.slug ? decodeURIComponent(params.slug) : '';

    const { data: session } = useSession();
    const user = session?.user;
    const [avatarFailed, setAvatarFailed] = useState(false);

    const [questions, setQuestions] = useState<Question[]>([]);
    const [deckTitle, setDeckTitle] = useState<string>('');
    const [currentQuestionId, setCurrentQuestionId] = useState<number | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [isEvaluating, setIsEvaluating] = useState(false);
    const [result, setResult] = useState<EvaluationResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
    const [micPermission, setMicPermission] = useState<'prompt' | 'granted' | 'denied'>('prompt');
    const [stats, setStats] = useState({ known: 0, learning: 0, new: 0 });

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const srManagerRef = useRef<SpacedRepetitionManager | null>(null);

    useEffect(() => {
        if (!deckId) return;

        const loadQuestions = async () => {
            setIsLoadingQuestions(true);
            setError(null);
            try {
                const response = await fetch(`/api/questions?deckId=${encodeURIComponent(deckId)}`);
                if (!response.ok) throw new Error('Failed to load questions');
                const data = await response.json();
                setQuestions(data.questions);
                setDeckTitle(data.deckTitle ?? '');

                const manager = new SpacedRepetitionManager(data.questions.length, deckId);
                srManagerRef.current = manager;

                let usedServer = false;
                try {
                    const progressResponse = await fetch(`/api/progress?deckId=${encodeURIComponent(deckId)}`);
                    if (progressResponse.ok) {
                        const progressData = await progressResponse.json();
                        setCurrentQuestionId(progressData.nextQuestionId);
                        setStats(progressData.stats);
                        usedServer = true;
                    }
                } catch (progressError) {
                    console.error(progressError);
                }

                if (!usedServer) {
                    const nextId = manager.getNextQuestion();
                    setCurrentQuestionId(nextId);
                    setStats(manager.getStats());
                }

                setResult(null);
            } catch (err) {
                setError('Fehler beim Laden der Fragen');
                console.error(err);
            } finally {
                setIsLoadingQuestions(false);
            }
        };

        loadQuestions();
    }, [deckId]);

    useEffect(() => {
        if (typeof window !== 'undefined' && (window as any).MathJax) {
            (window as any).MathJax.typesetPromise?.().catch((err: any) => console.error(err));
        }
    }, [currentQuestionId, questions, result]);

    const handleBackToSelection = () => {
        router.push('/app/learn');
    };

    const requestMicPermission = async () => {
        try {
            setError(null);
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach((track) => track.stop());
            setMicPermission('granted');
        } catch (err) {
            setMicPermission('denied');
            setError('Mikrofon-Berechtigung verweigert.');
        }
    };

    const startRecording = async () => {
        try {
            setError(null);
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) audioChunksRef.current.push(event.data);
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                await evaluateAnswer(audioBlob);
                stream.getTracks().forEach((track) => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);
        } catch (err) {
            setError('Fehler beim Zugriff auf das Mikrofon');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const evaluateAnswer = async (audioBlob: Blob) => {
        if (currentQuestionId === null || !deckId) return;
        setIsEvaluating(true);
        setError(null);

        const formData = new FormData();
        formData.append('file', audioBlob, 'recording.webm');
        formData.append('questionId', currentQuestionId.toString());
        formData.append('deckId', deckId);

        try {
            const response = await fetch('/api/evaluate', {
                method: 'POST',
                body: formData,
            });
            if (!response.ok) throw new Error('Evaluation failed');
            const data = await response.json();
            setResult(data);
        } catch (err) {
            setError('Fehler bei der Auswertung');
            console.error(err);
        } finally {
            setIsEvaluating(false);
        }
    };

    const handleReview = async (type: 'known' | 'review' | 'wrong') => {
        if (!srManagerRef.current || currentQuestionId === null) return;

        let usedServer = false;
        try {
            const response = await fetch('/api/progress', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    deckId,
                    questionId: currentQuestionId,
                    outcome: type,
                }),
            });

            if (response.ok) {
                const data = await response.json();
                setCurrentQuestionId(data.nextQuestionId);
                setStats(data.stats);
                usedServer = true;
            }
        } catch (err) {
            console.error(err);
        }

        if (!usedServer) {
            if (type === 'known') srManagerRef.current.markAsKnown(currentQuestionId);
            else if (type === 'review') srManagerRef.current.markAsReview(currentQuestionId);
            else srManagerRef.current.markAsWrong(currentQuestionId);

            const nextId = srManagerRef.current.getNextQuestion();
            setCurrentQuestionId(nextId);
            setStats(srManagerRef.current.getStats());
        }

        setResult(null);
        setError(null);
    };

    const handleReset = async () => {
        if (!srManagerRef.current) return;
        if (!confirm('Wirklich den Fortschritt für DIESES Lernset zurücksetzen?')) return;

        let usedServer = false;
        try {
            const response = await fetch('/api/progress', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    deckId,
                    action: 'reset',
                }),
            });

            if (response.ok) {
                const data = await response.json();
                setCurrentQuestionId(data.nextQuestionId);
                setStats(data.stats);
                usedServer = true;
            }
        } catch (err) {
            console.error(err);
        }

        if (!usedServer) {
            srManagerRef.current.reset();
            const manager = srManagerRef.current;
            setCurrentQuestionId(manager.getNextQuestion());
            setStats(manager.getStats());
        }

        setResult(null);
    };

    const currentQuestion = currentQuestionId !== null ? questions[currentQuestionId] : null;

    const avatarContent = useMemo(() => {
        if (user?.image && !avatarFailed) {
            return (
                <Image
                    src={user.image}
                    alt="Account"
                    width={28}
                    height={28}
                    sizes="28px"
                    className="h-7 w-7 rounded-full object-cover"
                    onError={() => setAvatarFailed(true)}
                />
            );
        }

        return (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                {user?.name?.charAt(0) ?? (
                    <IconSwap outline={UserIcon} solid={UserIconSolid} className="h-4 w-4" />
                )}
            </span>
        );
    }, [user?.image, user?.name, avatarFailed]);

    if (isLoadingQuestions) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <ArrowPathIcon className="h-8 w-8 animate-spin" />
                    <p>Lade Lernset...</p>
                </div>
            </div>
        );
    }

    if (currentQuestionId === null) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-4">
                <Card className="w-full max-w-md text-center border-border bg-card">
                    <CardContent className="p-8 space-y-6">
                        <CheckCircleIcon className="h-16 w-16 text-success mx-auto" />
                        <h2 className="text-2xl font-bold">Set erledigt! 🎉</h2>
                        <div className="flex gap-3 justify-center">
                            <Button onClick={handleBackToSelection} variant="outline" className="group">
                                <IconSwap
                                    outline={ArrowLeftIcon}
                                    solid={ArrowLeftIconSolid}
                                    className="mr-2 h-4 w-4"
                                />{' '}
                                Zurück
                            </Button>
                            <Button onClick={handleReset} variant="ghost" className="group">
                                <IconSwap
                                    outline={ArrowPathIcon}
                                    solid={ArrowPathIconSolid}
                                    className="mr-2 h-4 w-4"
                                />{' '}
                                Reset
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <>
            <Script
                id="mathjax-config"
                strategy="beforeInteractive"
                dangerouslySetInnerHTML={{
                    __html: `
                        window.MathJax = {
                            tex: {
                                inlineMath: [['\\\\(', '\\\\)']],
                                displayMath: [['\\\\[', '\\\\]']],
                                processEscapes: true
                            },
                            options: {
                                skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre']
                            }
                        };
                    `,
                }}
            />
            <Script
                id="mathjax-script"
                src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"
                strategy="afterInteractive"
            />
            <main className="min-h-screen bg-background px-6 py-6">
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-4 shadow-sm md:p-5">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-center gap-2 overflow-hidden">
                            <Button variant="ghost" size="icon" onClick={handleBackToSelection} className="group shrink-0">
                                <IconSwap outline={ArrowLeftIcon} solid={ArrowLeftIconSolid} className="h-5 w-5" />
                            </Button>
                            <h1 className="text-xl font-bold text-foreground truncate">
                                {deckTitle || 'Lernset'}
                            </h1>
                        </div>
                        <div className="flex items-center gap-2">
                            <Link
                                href="/app/account"
                                className="group flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-sm font-semibold text-foreground shadow-sm transition hover:border-foreground/20"
                            >
                                {avatarContent}
                                <span className="hidden md:inline">Account</span>
                            </Link>
                            <Button onClick={handleReset} variant="ghost" size="sm" className="group shrink-0 text-muted-foreground hover:text-destructive">
                                <IconSwap outline={ArrowPathIcon} solid={ArrowPathIconSolid} className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                        <div className="bg-background p-2 rounded border border-border flex items-center justify-center gap-2 text-sm text-success">
                            <CheckCircleIcon className="h-4 w-4" /> <b>{stats.known}</b>
                        </div>
                        <div className="bg-background p-2 rounded border border-border flex items-center justify-center gap-2 text-sm text-warning">
                            <ArrowPathIcon className="h-4 w-4" /> <b>{stats.learning}</b>
                        </div>
                        <div className="bg-background p-2 rounded border border-border flex items-center justify-center gap-2 text-sm text-muted-foreground">
                            <XCircleIcon className="h-4 w-4" /> <b>{stats.new}</b>
                        </div>
                    </div>
                </div>

                <Card className="border-border bg-card shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-sm text-muted-foreground uppercase">Frage</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-xl font-medium leading-relaxed">
                            {currentQuestion?.question}
                        </p>
                    </CardContent>
                </Card>

                {!result ? (
                    <Card className="border-border bg-card shadow-sm">
                        <CardContent className="p-6 flex flex-col items-center gap-4">
                            {micPermission === 'prompt' ? (
                                <Button size="lg" onClick={requestMicPermission} className="group w-full">
                                    <IconSwap
                                        outline={MicrophoneIcon}
                                        solid={MicrophoneIconSolid}
                                        className="mr-2 h-5 w-5"
                                    />{' '}
                                    Mikrofon erlauben
                                </Button>
                            ) : !isRecording && !isEvaluating ? (
                                <Button size="lg" onClick={startRecording} className="group w-full py-8 text-lg rounded-xl">
                                    <IconSwap
                                        outline={MicrophoneIcon}
                                        solid={MicrophoneIconSolid}
                                        className="mr-2 h-6 w-6"
                                    />{' '}
                                    Antworten
                                </Button>
                            ) : isRecording ? (
                                <Button size="lg" onClick={stopRecording} variant="destructive" className="group w-full py-8 text-lg rounded-xl animate-pulse">
                                    <IconSwap
                                        outline={StopIcon}
                                        solid={StopIconSolid}
                                        className="mr-2 h-6 w-6"
                                    />{' '}
                                    Stop
                                </Button>
                            ) : (
                                <div className="flex items-center gap-2 text-muted-foreground py-4">
                                    <ArrowPathIcon className="h-4 w-4 animate-spin" /> Auswertung...
                                </div>
                            )}
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                        <Card
                            className={`border-2 ${
                                result.score >= 9
                                    ? 'border-success bg-success/10'
                                    : result.score < 4
                                    ? 'border-danger bg-danger/10'
                                    : 'border-warning bg-warning/10'
                            }`}
                        >
                            <CardContent className="p-6 text-center space-y-2">
                                <div className="text-4xl font-black">{result.score}<span className="text-lg text-muted-foreground font-normal">/10</span></div>
                                <p className="font-medium">{result.feedback}</p>
                            </CardContent>
                        </Card>

                        <div className="grid md:grid-cols-2 gap-4">
                            <Card className="bg-secondary border-border">
                                <CardHeader className="pb-2"><CardTitle className="text-sm uppercase text-muted-foreground">Du</CardTitle></CardHeader>
                                <CardContent className="text-sm">{result.userAnswer}</CardContent>
                            </Card>
                            <Card className="bg-secondary border-border">
                                <CardHeader className="pb-2"><CardTitle className="text-sm uppercase text-muted-foreground">Lösung</CardTitle></CardHeader>
                                <CardContent className="text-sm">{result.modelAnswer}</CardContent>
                            </Card>
                        </div>

                        <div className="grid grid-cols-3 gap-2 pt-4">
                            <Button
                                onClick={() => handleReview('wrong')}
                                className="group h-auto py-4 px-1 flex flex-col gap-2 bg-danger hover:bg-danger/90 text-danger-foreground shadow-sm"
                            >
                                <IconSwap outline={XCircleIcon} solid={XCircleIconSolid} className="h-6 w-6" />
                                <div className="flex flex-col items-center leading-none gap-1">
                                    <span className="text-base md:text-lg font-bold">War falsch</span>
                                    <span className="text-sm font-medium opacity-90">in 2 Minuten</span>
                                </div>
                            </Button>

                            <Button
                                onClick={() => handleReview('review')}
                                variant="outline"
                                className="group h-auto py-4 px-1 flex flex-col gap-2 bg-background border-2 border-warning text-warning hover:bg-warning/10 shadow-sm"
                            >
                                <IconSwap
                                    outline={ArrowPathIcon}
                                    solid={ArrowPathIconSolid}
                                    className="h-6 w-6"
                                />
                                <div className="flex flex-col items-center leading-none gap-1">
                                    <span className="text-base md:text-lg font-bold">Muss üben</span>
                                    <span className="text-sm font-medium">in 10 Minuten</span>
                                </div>
                            </Button>

                            <Button
                                onClick={() => handleReview('known')}
                                className="group h-auto py-4 px-1 flex flex-col gap-2 bg-success hover:bg-success/90 text-success-foreground shadow-sm"
                            >
                                <IconSwap
                                    outline={CheckCircleIcon}
                                    solid={CheckCircleIconSolid}
                                    className="h-6 w-6"
                                />
                                <div className="flex flex-col items-center leading-none gap-1">
                                    <span className="text-base md:text-lg font-bold">Kann ich!</span>
                                    <span className="text-sm font-medium opacity-90">vorerst fertig</span>
                                </div>
                            </Button>
                        </div>
                    </div>
                )}

                {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
            </div>
            </main>
        </>
    );
}
