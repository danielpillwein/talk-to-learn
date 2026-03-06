'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingButton } from '@/components/ui/loading-button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import {
    ArrowLeftIcon,
    ArrowPathIcon,
    CheckCircleIcon,
    MicrophoneIcon,
    StopIcon,
    XCircleIcon,
} from '@heroicons/react/24/outline';
import {
    ArrowLeftIcon as ArrowLeftIconSolid,
    ArrowPathIcon as ArrowPathIconSolid,
    CheckCircleIcon as CheckCircleIconSolid,
    MicrophoneIcon as MicrophoneIconSolid,
    StopIcon as StopIconSolid,
    XCircleIcon as XCircleIconSolid,
} from '@heroicons/react/24/solid';
import { IconSwap } from '@/components/ui/icon';
import { SpacedRepetitionManager } from '@/lib/spaced-repetition';

type LearningStage = 'intro' | 'scaffolded' | 'free';
type CardLearningState =
    | 'unseen'
    | 'explained_with_help'
    | 'explained_freely'
    | 'skipped_known_unknown';

type CardMode = 'intro' | 'scaffolded' | 'free';

interface Question {
    id: number;
    question: string;
    modelAnswer: string;
    seen: boolean;
    hasScaffoldedExplanation: boolean;
    state: CardLearningState;
}

interface SupportiveFeedback {
    type: 'supportive';
    message: string;
    recommendation: 'understood' | 'review_later';
    grading: {
        enabled: false;
    };
}

interface GradedEvaluationResult {
    mode: 'graded';
    score: number;
    feedback: string;
    userAnswer: string;
    modelAnswer: string;
    question: string;
}

interface SupportiveEvaluationResult {
    mode: 'supportive';
    feedback: SupportiveFeedback;
    userAnswer: string;
    modelAnswer: string;
    question: string;
}

type EvaluationResult = GradedEvaluationResult | SupportiveEvaluationResult;

interface ProgressResponse {
    stats: { known: number; learning: number; new: number };
    nextQuestionId: number | null;
    learningPhase: 'intro' | 'scaffolded' | 'free';
    learningStage?: LearningStage;
}

interface StageNotice {
    title: string;
    description: string;
}

function resolveStageFromProgress(payload: {
    learningPhase: 'intro' | 'scaffolded' | 'free';
    learningStage?: LearningStage;
}): LearningStage {
    if (payload.learningStage) {
        return payload.learningStage;
    }

    if (payload.learningPhase === 'free') {
        return 'free';
    }

    return payload.learningPhase === 'scaffolded' ? 'scaffolded' : 'intro';
}

export default function LearnDetailPage(): JSX.Element {
    const params = useParams<{ slug: string }>();
    const router = useRouter();
    const deckId = params?.slug ? decodeURIComponent(params.slug) : '';

    const [questions, setQuestions] = useState<Question[]>([]);
    const [deckTitle, setDeckTitle] = useState<string>('');
    const [currentQuestionId, setCurrentQuestionId] = useState<number | null>(null);
    const [learningStage, setLearningStage] = useState<LearningStage>('intro');
    const [isRecording, setIsRecording] = useState(false);
    const [isEvaluating, setIsEvaluating] = useState(false);
    const [result, setResult] = useState<EvaluationResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
    const [isRequestingMic, setIsRequestingMic] = useState(false);
    const [reviewLoading, setReviewLoading] = useState<null | 'known' | 'review' | 'wrong'>(null);
    const [micPermission, setMicPermission] = useState<'prompt' | 'granted' | 'denied'>('prompt');
    const [stats, setStats] = useState({ known: 0, learning: 0, new: 0 });
    const [knownUnknownRevealed, setKnownUnknownRevealed] = useState(false);
    const [showTranscript, setShowTranscript] = useState(false);
    const [isSubmittingProgress, setIsSubmittingProgress] = useState(false);
    const [stageNotice, setStageNotice] = useState<StageNotice | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const recordingStartedAtRef = useRef<number | null>(null);
    const srManagerRef = useRef<SpacedRepetitionManager | null>(null);

    const updateQuestionState = (questionIndex: number, patch: Partial<Question>) => {
        setQuestions((prev) =>
            prev.map((question) =>
                question.id === questionIndex
                    ? {
                          ...question,
                          ...patch,
                      }
                    : question
            )
        );
    };

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
                const initialStage =
                    data.deckLearningPhase === 'free'
                        ? 'free'
                        : data.deckLearningPhase === 'scaffolded'
                        ? 'scaffolded'
                        : 'intro';
                setLearningStage(initialStage);

                const manager = new SpacedRepetitionManager(data.questions.length, deckId);
                srManagerRef.current = manager;

                let usedServer = false;
                try {
                    const progressResponse = await fetch(`/api/progress?deckId=${encodeURIComponent(deckId)}`);
                    if (progressResponse.ok) {
                        const progressData = (await progressResponse.json()) as ProgressResponse;
                        setCurrentQuestionId(progressData.nextQuestionId);
                        setStats(progressData.stats);
                        setLearningStage(resolveStageFromProgress(progressData));
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
                setKnownUnknownRevealed(false);
                setShowTranscript(false);
                setStageNotice(null);
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
    }, [currentQuestionId, questions, result, knownUnknownRevealed]);

    const handleBackToSelection = () => {
        router.push('/app/learn');
    };

    const requestMicPermission = async () => {
        try {
            setError(null);
            setIsRequestingMic(true);
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach((track) => track.stop());
            setMicPermission('granted');
        } catch (err) {
            setMicPermission('denied');
            setError('Mikrofon-Berechtigung verweigert.');
        } finally {
            setIsRequestingMic(false);
        }
    };

    const currentQuestion = currentQuestionId !== null ? questions[currentQuestionId] : null;
    const questionText = currentQuestion?.question ?? '';
    const answerText = currentQuestion?.modelAnswer ?? '';
    const introKnown = questions.filter((question) => question.seen).length;
    const introLearning = 0;
    const introNew = Math.max(0, questions.length - introKnown);
    const displayStats =
        learningStage === 'intro'
            ? { known: introKnown, learning: introLearning, new: introNew }
            : stats;
    const totalProgress = Math.max(1, displayStats.known + displayStats.learning + displayStats.new);
    const knownPct = Math.round((displayStats.known / totalProgress) * 100);
    const learningPct = Math.round((displayStats.learning / totalProgress) * 100);
    const newPct = Math.max(0, 100 - knownPct - learningPct);
    const cardMode: CardMode =
        learningStage === 'intro'
            ? 'intro'
            : learningStage === 'scaffolded'
            ? 'scaffolded'
            : currentQuestion?.hasScaffoldedExplanation
            ? 'free'
            : 'free';
    const stageMeta =
        cardMode === 'intro'
            ? { label: 'Einführung', className: 'bg-accent text-foreground' }
            : cardMode === 'scaffolded'
            ? { label: 'Üben', className: 'bg-accent text-foreground' }
            : { label: 'Erklären', className: 'bg-accent text-foreground' };
    const stageTooltipDescription =
        cardMode === 'intro'
            ? `Aktuell siehst du Frage und Antwort. So kannst du dich mit dem Set vertraut machen. 
Danach wirst du schrittweise zum aktiven Erklären geführt.`
            : cardMode === 'scaffolded'
            ? `Du siehst weiterhin auch die Antworten. Zusätzlich hast du jetzt aber die Möglichkeit, es in eigenen Worten zu formulieren und dein Verständnis zu überprüfen.`
            : cardMode === 'free'
            ? `Du siehst nur noch die Fragen. Beim Antworten hast du keine Hilfe mehr, nur noch du und dein Gedächtnis.`
            : `1) Einführung: Frage + Lösung sehen
2) Üben: Lösung in eigenen Worten erklären
3) Erklären: nur mit der Frage erklären`;
    const stageTooltipTitle ='Was heißt das?';

    const evaluateAnswer = async (audioBlob: Blob, speechSeconds: number) => {
        if (currentQuestionId === null || !deckId) return;
        setIsEvaluating(true);
        setError(null);

        const evaluationMode = cardMode === 'scaffolded' ? 'supportive' : 'graded';
        const formData = new FormData();
        formData.append('file', audioBlob, 'recording.webm');
        formData.append('questionId', currentQuestionId.toString());
        formData.append('deckId', deckId);
        formData.append('evaluationMode', evaluationMode);
        formData.append('speechSeconds', String(speechSeconds));
        formData.append('tzOffsetMinutes', String(new Date().getTimezoneOffset()));

        try {
            const response = await fetch('/api/evaluate', {
                method: 'POST',
                body: formData,
            });
            if (!response.ok) throw new Error('Evaluation failed');
            const data = await response.json();

            if (evaluationMode === 'supportive') {
                setShowTranscript(false);
                setResult({
                    mode: 'supportive',
                    feedback: data.feedback,
                    userAnswer: data.userAnswer,
                    modelAnswer: data.modelAnswer,
                    question: data.question,
                });
            } else {
                setShowTranscript(false);
                setResult({
                    mode: 'graded',
                    score: data.score,
                    feedback: data.feedback,
                    userAnswer: data.userAnswer,
                    modelAnswer: data.modelAnswer,
                    question: data.question,
                });
            }
        } catch (err) {
            setError('Fehler bei der Auswertung');
            console.error(err);
        } finally {
            setIsEvaluating(false);
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
                const startedAt = recordingStartedAtRef.current ?? Date.now();
                const elapsedMs = Math.max(0, Date.now() - startedAt);
                const speechSeconds = Math.max(0, Math.round(elapsedMs / 1000));
                recordingStartedAtRef.current = null;
                await evaluateAnswer(audioBlob, speechSeconds);
                stream.getTracks().forEach((track) => track.stop());
            };

            mediaRecorder.start();
            recordingStartedAtRef.current = Date.now();
            setIsRecording(true);
        } catch (err) {
            setError('Fehler beim Zugriff auf das Mikrofon');
            recordingStartedAtRef.current = null;
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const postProgress = async (payload: Record<string, unknown>) => {
        const response = await fetch('/api/progress', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            throw new Error('Progress update failed');
        }

        return (await response.json()) as ProgressResponse;
    };

    const applyProgressResponse = (data: ProgressResponse, previousStage: LearningStage) => {
        const nextStage = resolveStageFromProgress(data);
        setCurrentQuestionId(data.nextQuestionId);
        setStats(data.stats);
        setLearningStage(nextStage);
        setResult(null);
        setError(null);
        setKnownUnknownRevealed(false);
        setShowTranscript(false);

        if (previousStage === 'intro' && nextStage === 'scaffolded') {
            setStageNotice({
                title: 'nächste Lernstufe freigeschalten: Üben',
                description: `Du kennst jetzt alle Karten des Lernsets.
Zeit zu zeigen, was du gelernt hast.

Aber keine Sorge, wir werfen dich nicht ins kalte Wasser:
Du siehst die Antworten weiterhin und kannst es in eigenen Worten erklären :)`,
            });
        } else if (previousStage === 'scaffolded' && nextStage === 'free') {
            setStageNotice({
                title: 'nächste Lernstufe freigeschalten: Erklären',
                description: `Zeit, das Ganze aufs nächste Level zu heben.
Ab jetzt werden dir nur noch die Fragen angezeigt.
Die Antworten solltest du mittlerweile kennen ;)`,
            });
        } else {
            setStageNotice(null);
        }
    };

    const handleIntroNext = async () => {
        if (currentQuestionId === null || !deckId || isSubmittingProgress) return;
        setIsSubmittingProgress(true);

        try {
            const previousStage = learningStage;
            updateQuestionState(currentQuestionId, { seen: true });
            const data = await postProgress({
                deckId,
                action: 'mark_seen',
                questionId: currentQuestionId,
            });
            applyProgressResponse(data, previousStage);
        } catch (err) {
            setError('Fehler beim Fortschritt-Update');
            console.error(err);
        } finally {
            setIsSubmittingProgress(false);
        }
    };

    const handleSkipKnownUnknown = async () => {
        if (currentQuestionId === null || !deckId || isSubmittingProgress) return;
        setIsSubmittingProgress(true);

        try {
            const previousStage = learningStage;
            updateQuestionState(currentQuestionId, {
                seen: true,
                hasScaffoldedExplanation: true,
                state: 'skipped_known_unknown',
            });

            const data = await postProgress({
                deckId,
                action: 'skip_known_unknown',
                questionId: currentQuestionId,
            });
            applyProgressResponse(data, previousStage);
        } catch (err) {
            setError('Fehler beim Überspringen');
            console.error(err);
        } finally {
            setIsSubmittingProgress(false);
        }
    };

    const handleReview = async (type: 'known' | 'review' | 'wrong') => {
        if (!srManagerRef.current || currentQuestionId === null) return;
        if (reviewLoading) return;
        setReviewLoading(type);

        let usedServer = false;
        try {
            const previousStage = learningStage;
            updateQuestionState(currentQuestionId, {
                seen: true,
                hasScaffoldedExplanation: true,
                state: 'explained_freely',
            });

            const data = await postProgress({
                deckId,
                questionId: currentQuestionId,
                outcome: type,
            });
            applyProgressResponse(data, previousStage);
            usedServer = true;
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
            setResult(null);
            setKnownUnknownRevealed(false);
            setError(null);
        }

        setReviewLoading(null);
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
                const data = (await response.json()) as ProgressResponse;
                setCurrentQuestionId(data.nextQuestionId);
                setStats(data.stats);
                setLearningStage(resolveStageFromProgress(data));
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
            setLearningStage('intro');
        }

        setResult(null);
        setKnownUnknownRevealed(false);
        setReviewLoading(null);
        setStageNotice(null);
    };

    if (isLoadingQuestions) {
        return (
            <div className="flex min-h-[calc(100vh-7rem)] w-full flex-col items-center justify-center gap-3 rounded-3xl bg-card p-10 shadow-sm">
                <ArrowPathIcon className="h-6 w-6 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                    Einen Moment, wir laden gerade dein Lernset...
                </p>
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
            <main className="py-2 md:py-3">
                <div className="space-y-6">
                    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm md:p-4">
                        <div className="flex w-full items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2">
                                <Button variant="ghost" size="icon" onClick={handleBackToSelection} className="group shrink-0">
                                    <IconSwap outline={ArrowLeftIcon} solid={ArrowLeftIconSolid} className="h-5 w-5" />
                                </Button>
                                <h1 className="min-w-0 text-xl font-bold text-foreground truncate">
                                    {deckTitle || 'Lernset'}
                                </h1>
                            </div>
                            <span className={`inline-flex h-10 shrink-0 items-center rounded-[999px] px-4 text-sm ${stageMeta.className}`}>
                                <span>{stageMeta.label}</span>
                                <InfoTooltip
                                    title={stageTooltipTitle}
                                    description={stageTooltipDescription}
                                    multilineDescription
                                    placement="bottom-left"
                                    contentClassName="w-[15rem] max-w-[90vw] md:w-[28rem]"
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
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center gap-3">
                                <div className="flex h-3 flex-1 overflow-hidden rounded-full bg-secondary">
                                    <div className="bg-success" style={{ width: `${knownPct}%` }} />
                                    <div className="bg-warning" style={{ width: `${learningPct}%` }} />
                                    <div className="bg-muted-foreground/30" style={{ width: `${newPct}%` }} />
                                </div>
                                <div className="shrink-0 text-sm text-muted-foreground">
                                    (
                                    <span className="mx-1 inline-flex items-center gap-1">
                                        <span className="h-2 w-2 rounded-full bg-success" />
                                        {displayStats.known}
                                    </span>
                                    <span className="mx-1 inline-flex items-center gap-1">
                                        <span className="h-2 w-2 rounded-full bg-warning" />
                                        {displayStats.learning}
                                    </span>
                                    <span className="mx-1 inline-flex items-center gap-1">
                                        <span className="h-2 w-2 rounded-full bg-muted-foreground" />
                                        {displayStats.new}
                                    </span>
                                    )
                                </div>
                            </div>
                        </div>
                    </div>

                    {cardMode === 'intro' ? (
                        <Card className="border-border bg-card shadow-sm">
                            <CardContent className="space-y-5 p-6">
                                <h2 className="deck-question text-2xl font-semibold leading-tight text-foreground">
                                    {questionText}
                                </h2>
                                <hr className="-mx-6 border-border" />
                                <div>
                                    <h3 className="intro-label text-sm font-medium text-muted-foreground">
                                        Antwort
                                    </h3>
                                    <p className="intro-text mt-2 text-base leading-relaxed text-foreground">{answerText}</p>
                                </div>
                                {!stageNotice && !result && (
                                    <div className="pt-1">
                                        <Button
                                            onClick={handleIntroNext}
                                            aria-label="Nächste Frage"
                                            className="h-10 w-full rounded-xl px-4 text-sm md:w-auto"
                                            disabled={isSubmittingProgress}
                                        >
                                            Nächste Frage
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ) : (
                        <Card className="border-border bg-card shadow-sm">
                            <CardContent className="space-y-5 p-6">
                                <h2 className="deck-question text-2xl font-semibold leading-tight text-foreground">
                                    {questionText}
                                </h2>

                                {cardMode === 'scaffolded' && result?.mode === 'supportive' ? (
                                    <>
                                        <hr className="-mx-6 border-border" />
                                        <div className="space-y-4">
                                            <div>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <h3 className="text-sm font-medium text-muted-foreground">KI-Einschätzung</h3>
                                                    <span className="inline-flex items-center gap-1.5 rounded-[999px] bg-accent px-2.5 py-1 text-xs font-medium text-foreground">
                                                        <span
                                                            className={`h-2.5 w-2.5 rounded-full ${
                                                                result.feedback.recommendation === 'understood'
                                                                    ? 'bg-success'
                                                                    : 'bg-warning'
                                                            }`}
                                                            aria-hidden="true"
                                                        ></span>
                                                        <span>
                                                            {result.feedback.recommendation === 'understood'
                                                                ? 'verstanden'
                                                                : 'später nochmal fragen'}
                                                        </span>
                                                    </span>
                                                </div>
                                                <p className="mt-2 text-sm font-medium text-foreground">{result.feedback.message}</p>
                                            </div>
                                            <hr className="-mx-6 border-border" />
                                            <div>
                                                <h3 className="text-sm font-medium text-muted-foreground">Antwort</h3>
                                                <p className="mt-2 max-h-52 overflow-y-auto pr-1 text-sm leading-relaxed text-foreground">
                                                    {answerText}
                                                </p>
                                            </div>
                                            <div>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setShowTranscript((prev) => !prev)}
                                                    className="h-8 rounded-lg px-3 text-xs"
                                                >
                                                    {showTranscript ? 'Meine Antwort ausblenden' : 'Meine Antwort anzeigen'}
                                                </Button>
                                                {showTranscript && (
                                                    <div className="mt-2 rounded-xl bg-secondary/25 p-3">
                                                        <h4 className="text-xs font-medium text-muted-foreground">Deine Antwort</h4>
                                                        <p className="mt-1 max-h-44 overflow-y-auto pr-1 text-sm leading-relaxed text-foreground">
                                                            {result.userAnswer}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    (cardMode === 'scaffolded' || knownUnknownRevealed || !!result) && (
                                        <>
                                            <hr className="-mx-6 border-border" />
                                            <div>
                                                <h3 className="text-sm font-medium text-muted-foreground">Antwort</h3>
                                                <p className="mt-2 text-base leading-relaxed text-foreground">{answerText}</p>
                                            </div>
                                        </>
                                    )
                                )}

                                {!stageNotice && !result && (
                                    <div className="pt-1">
                                        {knownUnknownRevealed ? (
                                            <>
                                                <Card className="w-full border-border bg-secondary">
                                                    <CardContent className="p-4 text-center space-y-2">
                                                        <p className="font-medium">Völlig okay - genau dafür ist Lernen da.</p>
                                                    </CardContent>
                                                </Card>
                                                <Button
                                                    size="lg"
                                                    onClick={handleSkipKnownUnknown}
                                                    className="group mt-4 w-full py-8 text-lg rounded-xl"
                                                    disabled={isSubmittingProgress}
                                                >
                                                    Weiter
                                                </Button>
                                            </>
                                        ) : (
                                            <div className="flex flex-col items-center gap-4">

                                                {cardMode === 'free' && (
                                                    <Button
                                                        size="lg"
                                                        variant="outline"
                                                        onClick={() => setKnownUnknownRevealed(true)}
                                                        className="group w-full py-8 text-lg rounded-xl"
                                                    >
                                                        Ich weiß es noch nicht
                                                    </Button>
                                                )}

                                                {micPermission === 'prompt' ? (
                                                    <LoadingButton
                                                        onClick={requestMicPermission}
                                                        className="group h-10 w-full rounded-xl px-4 text-sm"
                                                        isLoading={isRequestingMic}
                                                        loadingText="Prüfe"
                                                        text="Mikrofon erlauben"
                                                        startIcon={
                                                            <IconSwap
                                                                outline={MicrophoneIcon}
                                                                solid={MicrophoneIconSolid}
                                                                className="h-5 w-5"
                                                            />
                                                        }
                                                    />
                                                ) : !isRecording && !isEvaluating ? (
                                                    <Button onClick={startRecording} className="group h-10 w-full gap-1.5 rounded-xl px-4 text-sm leading-none">
                                                        <IconSwap
                                                            outline={MicrophoneIcon}
                                                            solid={MicrophoneIconSolid}
                                                            className="h-5 w-5 items-center justify-center"
                                                        />
                                                        <span>Sags in deinen eigenen Worten</span>
                                                    </Button>
                                                ) : isRecording ? (
                                                    <Button onClick={stopRecording} variant="destructive" className="group h-10 w-full gap-1.5 rounded-xl px-4 text-sm leading-none animate-pulse">
                                                        <StopIconSolid className="h-5 w-5 shrink-0" />
                                                        <span>Stop</span>
                                                    </Button>
                                                ) : (
                                                    <div className="flex items-center gap-2 py-4 text-muted-foreground">
                                                        <ArrowPathIcon className="h-4 w-4 animate-spin" /> Auswertung...
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {stageNotice || cardMode === 'intro' || !result ? null : result.mode === 'supportive' ? (
                        <div className="animate-in fade-in slide-in-from-bottom-4">
                            <div className="grid gap-2 md:grid-cols-2">
                                <Button
                                    onClick={() => handleReview('known')}
                                    variant={result.feedback.recommendation === 'understood' ? 'default' : 'outline'}
                                    disabled={reviewLoading !== null}
                                    isLoading={reviewLoading === 'known'}
                                    loadingText="Speichere"
                                    className="h-10 rounded-xl px-4 text-sm"
                                >
                                    Hab ich verstanden
                                </Button>
                                <Button
                                    onClick={() => handleReview('review')}
                                    variant={result.feedback.recommendation === 'review_later' ? 'default' : 'outline'}
                                    disabled={reviewLoading !== null}
                                    isLoading={reviewLoading === 'review'}
                                    loadingText="Speichere"
                                    className="h-10 rounded-xl px-4 text-sm"
                                >
                                    Frag mich später nochmal
                                </Button>
                            </div>
                        </div>
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
                                    <div className="text-4xl font-black">
                                        {result.score}
                                        <span className="text-lg text-muted-foreground font-normal">/10</span>
                                    </div>
                                    <p className="font-medium">{result.feedback}</p>
                                </CardContent>
                            </Card>

                            <div className="grid md:grid-cols-2 gap-4">
                                <Card className="bg-secondary border-border">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm uppercase text-muted-foreground">Du</CardTitle>
                                    </CardHeader>
                                    <CardContent className="text-sm">{result.userAnswer}</CardContent>
                                </Card>
                                <Card className="bg-secondary border-border">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm uppercase text-muted-foreground">Lösung</CardTitle>
                                    </CardHeader>
                                    <CardContent className="text-sm">{result.modelAnswer}</CardContent>
                                </Card>
                            </div>

                            <div className="grid grid-cols-3 gap-2 pt-4">
                                <Button
                                    onClick={() => handleReview('wrong')}
                                    disabled={reviewLoading !== null}
                                    isLoading={reviewLoading === 'wrong'}
                                    loadingText="Speichere"
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
                                    disabled={reviewLoading !== null}
                                    isLoading={reviewLoading === 'review'}
                                    loadingText="Speichere"
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
                                    disabled={reviewLoading !== null}
                                    isLoading={reviewLoading === 'known'}
                                    loadingText="Speichere"
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

                    {error && (
                        <Alert variant="destructive">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}
                </div>

                {stageNotice && (
                    <div className="fixed inset-x-0 bottom-0 top-24 z-50 flex items-center justify-center bg-background p-4">
                        <div className="relative mt-16 w-full max-w-2xl md:mt-20">
                            <Image
                                src="/mascot/otter-celebration.png"
                                alt="Otter feiert den Lernfortschritt"
                                width={480}
                                height={480}
                                className="absolute bottom-full left-1/2 mb-[-41px] h-56 w-56 -translate-x-1/2 object-contain md:mb-[-58px] md:h-80 md:w-80"
                                priority
                            />
                            <Card className="w-full border-2 border-info/50 bg-info/20 shadow-sm">
                                <CardContent className="space-y-4 p-6 text-center md:p-8">
                                    <h2 className="text-2xl font-semibold text-foreground">{stageNotice.title}</h2>
                                    <p className="whitespace-pre-line text-base leading-relaxed text-foreground/90">
                                        {stageNotice.description}
                                    </p>
                                    <Button onClick={() => setStageNotice(null)} className="h-10 px-6 text-sm">
                                        Ich bin ready
                                    </Button>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                )}
            </main>
        </>
    );
}
