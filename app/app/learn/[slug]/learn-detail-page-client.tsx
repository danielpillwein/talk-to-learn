'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingButton } from '@/components/ui/loading-button';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import { useToast } from '@/components/ui/toast/useToast';
import {
    ArrowLeftIcon,
    ArrowPathIcon,
    ChevronRightIcon,
    CheckCircleIcon,
    MicrophoneIcon,
    StopIcon,
    XCircleIcon,
} from '@heroicons/react/24/outline';
import {
    ArrowLeftIcon as ArrowLeftIconSolid,
    ArrowPathIcon as ArrowPathIconSolid,
    CheckCircleIcon as CheckCircleIconSolid,
    CheckIcon as CheckIconSolid,
    MicrophoneIcon as MicrophoneIconSolid,
    SparklesIcon as SparklesIconSolid,
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
    shortFeedback: string;
    improvement: string;
    score: number;
    content: number;
    completeness: number;
    understanding: number;
    clarity: number;
    recommendation: 'understood' | 'review_later';
    grading: {
        enabled: true;
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
    headline: string;
    status: string;
    bullets: [string, string, string];
    ctaLabel: string;
    secondaryCtaLabel?: string;
    progressLabel: string;
    otterMessage: string;
    primaryAction?: 'dismiss' | 'restart_free';
    secondaryAction?: 'back_to_overview';
}

const REVIEW_TRANSITION_MS = 180;
const INTRO_PRIMARY_ACTION_LABEL = 'Als verstanden markieren';
const INTRO_REVIEW_ACTION_LABEL = 'Später wiederholen';
const SUPPORTIVE_PRIMARY_ACTION_LABEL = INTRO_PRIMARY_ACTION_LABEL;
const SUPPORTIVE_REVIEW_ACTION_LABEL = INTRO_REVIEW_ACTION_LABEL;
const RECORDING_WAVE_BARS = 24;
const RECORDING_WAVE_HISTORY_MS = 1000;

function EvaluationState(): JSX.Element {
    return (
        <div className="w-full rounded-xl bg-foreground/10 px-4 py-3">
            <div className="flex items-start gap-3">
                <div className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-foreground/10">
                    <div className="loader loader-inline" aria-hidden="true">
                        <div />
                        <div />
                        <div />
                    </div>
                </div>
                <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">KI analysiert deine Antwort</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Dauert nur einen Moment</p>
                </div>
            </div>
        </div>
    );
}

function ScoreGauge({ score }: { score: number }): JSX.Element {
    const safeMax = 10;
    const clampedScore = Math.min(Math.max(score, 0), safeMax);
    const percent = (clampedScore / safeMax) * 100;

    return (
        <div className="relative w-[132px] shrink-0">
            <svg viewBox="0 0 120 72" className="h-[88px] w-full" aria-hidden="true">
                <path
                    d="M12 60 A48 48 0 0 1 108 60"
                    fill="none"
                    stroke="rgba(255,255,255,0.14)"
                    strokeWidth="10"
                    strokeLinecap="round"
                    pathLength={100}
                />
                <path
                    d="M12 60 A48 48 0 0 1 108 60"
                    fill="none"
                    stroke="rgb(245 186 8)"
                    strokeWidth="10"
                    strokeLinecap="round"
                    pathLength={100}
                    strokeDasharray={`${percent} 100`}
                />
            </svg>
            <div className="pointer-events-none absolute inset-x-0 bottom-[9px] text-center">
                <span className="text-[1.55rem] font-semibold leading-none text-foreground tabular-nums">
                    {clampedScore}/10
                </span>
            </div>
        </div>
    );
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

function LearnDetailSkeleton({ stage, onBack }: { stage: LearningStage; onBack: () => void }): JSX.Element {
    const showAnswerSkeleton = stage !== 'free';
    const showUnknownButtonSkeleton = stage === 'free';
    const showMainActionSkeleton = true;

    return (
        <main className="py-2 md:py-3">
            <div className="space-y-6">
                <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm md:p-4">
                    <div className="flex w-full items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                            <Button variant="ghost" size="icon" onClick={onBack} className="group shrink-0">
                                <IconSwap outline={ArrowLeftIcon} solid={ArrowLeftIconSolid} className="h-5 w-5" />
                            </Button>
                            <div className="skeleton h-7 w-48 max-w-[55vw] rounded-md" />
                        </div>
                        <div className="skeleton h-10 w-28 rounded-full" />
                    </div>
                    <div className="mt-1 flex items-center gap-3">
                        <div className="skeleton h-3 flex-1 rounded-full" />
                        <div className="shrink-0 text-sm text-muted-foreground">
                            (
                            <span className="mx-1 inline-flex items-center gap-1">
                                <span className="h-2 w-2 rounded-full bg-success" />
                                <span className="skeleton inline-block h-3 w-4 rounded-sm" />
                            </span>
                            <span className="mx-1 inline-flex items-center gap-1">
                                <span className="h-2 w-2 rounded-full bg-warning" />
                                <span className="skeleton inline-block h-3 w-4 rounded-sm" />
                            </span>
                            <span className="mx-1 inline-flex items-center gap-1">
                                <span className="h-2 w-2 rounded-full bg-muted-foreground" />
                                <span className="skeleton inline-block h-3 w-4 rounded-sm" />
                            </span>
                            )
                        </div>
                    </div>
                </div>

                <Card className="border-border bg-card shadow-sm">
                    <CardContent className="space-y-5 p-6">
                        <div className="space-y-2">
                            <div className="skeleton skeleton-text long" />
                            <div className="skeleton skeleton-text medium" />
                        </div>

                        {showAnswerSkeleton ? (
                            <>
                                <hr className="-mx-6 border-border" />
                                <div className="space-y-2">
                                    <h3 className="text-sm font-medium text-muted-foreground">Musterlösung</h3>
                                    <div className="skeleton h-20 w-full rounded-xl" />
                                </div>
                            </>
                        ) : null}

                        <div className="pt-1 space-y-3">
                            {showUnknownButtonSkeleton ? <div className="skeleton h-10 w-full rounded-xl" /> : null}
                            {showMainActionSkeleton ? <div className="skeleton h-10 w-full rounded-xl" /> : null}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </main>
    );
}

export default function LearnDetailPage(): JSX.Element {
    const params = useParams<{ slug: string }>();
    const router = useRouter();
    const toast = useToast();
    const deckId = params?.slug ? decodeURIComponent(params.slug) : '';

    const [questions, setQuestions] = useState<Question[]>([]);
    const [deckTitle, setDeckTitle] = useState<string>('');
    const [currentQuestionId, setCurrentQuestionId] = useState<number | null>(null);
    const [learningStage, setLearningStage] = useState<LearningStage>('intro');
    const [isRecording, setIsRecording] = useState(false);
    const [isEvaluating, setIsEvaluating] = useState(false);
    const [result, setResult] = useState<EvaluationResult | null>(null);
    const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
    const [isRequestingMic, setIsRequestingMic] = useState(false);
    const [reviewLoading, setReviewLoading] = useState<null | 'known' | 'review' | 'wrong'>(null);
    const [micPermission, setMicPermission] = useState<'prompt' | 'granted' | 'denied'>('prompt');
    const [stats, setStats] = useState({ known: 0, learning: 0, new: 0 });
    const [knownUnknownRevealed, setKnownUnknownRevealed] = useState(false);
    const [showTranscript, setShowTranscript] = useState(false);
    const [showModelAnswer, setShowModelAnswer] = useState(false);
    const [isSubmittingProgress, setIsSubmittingProgress] = useState(false);
    const [stageNotice, setStageNotice] = useState<StageNotice | null>(null);
    const [isStageNoticeBusy, setIsStageNoticeBusy] = useState(false);
    const [isQuestionTransitionLoading, setIsQuestionTransitionLoading] = useState(false);
    const [recordingElapsedSeconds, setRecordingElapsedSeconds] = useState(0);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const recordingStartedAtRef = useRef<number | null>(null);
    const waveformCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const waveformAnimationFrameRef = useRef<number | null>(null);
    const waveformAudioContextRef = useRef<AudioContext | null>(null);
    const waveformAnalyserRef = useRef<AnalyserNode | null>(null);
    const waveformSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const waveformDataRef = useRef<Uint8Array | null>(null);
    const waveformEnergyRef = useRef(0);
    const waveformEnergyTimestampRef = useRef(0);
    const waveformNoiseFloorRef = useRef(0.03);
    const waveformHistoryRef = useRef<number[]>(Array.from({ length: RECORDING_WAVE_BARS }, () => 0));
    const waveformHistoryLastPushRef = useRef(0);
    const srManagerRef = useRef<SpacedRepetitionManager | null>(null);
    const confettiTimeoutRef = useRef<number | null>(null);

    const playLevelUpConfetti = useCallback(async () => {
        const confettiModule = await import('canvas-confetti');
        const confetti = confettiModule.default;
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

        confettiTimeoutRef.current = window.setTimeout(() => {
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
            confettiTimeoutRef.current = null;
        }, 220);
    }, []);

    const stopWaveformVisualization = useCallback(() => {
        if (waveformAnimationFrameRef.current !== null) {
            window.cancelAnimationFrame(waveformAnimationFrameRef.current);
            waveformAnimationFrameRef.current = null;
        }

        waveformSourceRef.current?.disconnect();
        waveformAnalyserRef.current?.disconnect();

        waveformSourceRef.current = null;
        waveformAnalyserRef.current = null;
        waveformDataRef.current = null;
        waveformEnergyRef.current = 0;
        waveformEnergyTimestampRef.current = 0;
        waveformNoiseFloorRef.current = 0.03;
        waveformHistoryRef.current = Array.from({ length: RECORDING_WAVE_BARS }, () => 0);
        waveformHistoryLastPushRef.current = 0;

        if (waveformAudioContextRef.current) {
            const ctx = waveformAudioContextRef.current;
            waveformAudioContextRef.current = null;
            void ctx.close().catch(() => undefined);
        }
    }, []);

    const startWaveformVisualization = useCallback(
        async (stream: MediaStream) => {
            try {
                stopWaveformVisualization();

                const AudioContextCtor =
                    window.AudioContext ||
                    ((window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ?? null);
                if (!AudioContextCtor) return;

                const audioContext = new AudioContextCtor();
                if (audioContext.state === 'suspended') {
                    await audioContext.resume().catch(() => undefined);
                }
                const analyser = audioContext.createAnalyser();
                analyser.fftSize = 512;
                analyser.smoothingTimeConstant = 0.2;
                const source = audioContext.createMediaStreamSource(stream);
                source.connect(analyser);

                const freqData = new Uint8Array(analyser.frequencyBinCount);

                waveformAudioContextRef.current = audioContext;
                waveformAnalyserRef.current = analyser;
                waveformSourceRef.current = source;
                waveformDataRef.current = freqData;

                const draw = () => {
                    const canvas = waveformCanvasRef.current;
                    const activeAnalyser = waveformAnalyserRef.current;
                    const activeData = waveformDataRef.current;
                    if (!activeAnalyser || !activeData) return;
                    if (!canvas) {
                        waveformAnimationFrameRef.current = window.requestAnimationFrame(draw);
                        return;
                    }

                    activeAnalyser.getByteFrequencyData(activeData);

                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        waveformAnimationFrameRef.current = window.requestAnimationFrame(draw);
                        return;
                    }

                    const bounds = canvas.getBoundingClientRect();
                    if (bounds.width === 0 || bounds.height === 0) {
                        waveformAnimationFrameRef.current = window.requestAnimationFrame(draw);
                        return;
                    }

                    const dpr = window.devicePixelRatio || 1;
                    const displayWidth = Math.floor(bounds.width);
                    const displayHeight = Math.floor(bounds.height);
                    const renderWidth = Math.floor(displayWidth * dpr);
                    const renderHeight = Math.floor(displayHeight * dpr);

                    if (canvas.width !== renderWidth || canvas.height !== renderHeight) {
                        canvas.width = renderWidth;
                        canvas.height = renderHeight;
                    }

                    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                    ctx.clearRect(0, 0, displayWidth, displayHeight);

                    const binsToUse = Math.min(144, activeData.length);
                    let total = 0;
                    let peak = 0;
                    for (let i = 0; i < binsToUse; i += 1) {
                        const value = activeData[i];
                        total += value;
                        if (value > peak) peak = value;
                    }
                    const avg = binsToUse > 0 ? total / (binsToUse * 255) : 0;
                    const peakNorm = peak / 255;
                    const energyRaw = Math.min(0.9, avg * 0.22 + peakNorm * 0.9);
                    const now = performance.now();
                    const dtMs = waveformEnergyTimestampRef.current > 0 ? now - waveformEnergyTimestampRef.current : 16.67;
                    waveformEnergyTimestampRef.current = now;
                    const noiseFloorAlpha = 1 - Math.exp(-dtMs / 2200);
                    const currentNoiseFloor = waveformNoiseFloorRef.current;
                    const noiseFollowAlpha =
                        energyRaw < currentNoiseFloor + 0.045 ? noiseFloorAlpha : noiseFloorAlpha * 0.1;
                    const nextNoiseFloor =
                        currentNoiseFloor + (energyRaw - currentNoiseFloor) * noiseFollowAlpha;
                    waveformNoiseFloorRef.current = Math.min(0.35, Math.max(0.01, nextNoiseFloor));
                    const gate = waveformNoiseFloorRef.current + 0.028;
                    const normalizedEnergy = Math.max(0, (energyRaw - gate) / Math.max(0.001, 1 - gate));
                    const shapedEnergy = Math.min(1, Math.pow(normalizedEnergy, 0.85) * 1.15);
                    const prevEnergy = waveformEnergyRef.current;
                    const attackAlpha = 1 - Math.exp(-dtMs / 55);
                    const releaseAlpha = 1 - Math.exp(-dtMs / 180);
                    const alpha = shapedEnergy > prevEnergy ? attackAlpha : releaseAlpha;
                    waveformEnergyRef.current = prevEnergy + (shapedEnergy - prevEnergy) * alpha;

                    const historyIntervalMs = RECORDING_WAVE_HISTORY_MS / RECORDING_WAVE_BARS;
                    if (waveformHistoryLastPushRef.current <= 0) {
                        waveformHistoryLastPushRef.current = now;
                    }

                    while (now - waveformHistoryLastPushRef.current >= historyIntervalMs) {
                        waveformHistoryLastPushRef.current += historyIntervalMs;
                        const history = waveformHistoryRef.current;
                        history.shift();
                        history.push(Math.min(1, waveformEnergyRef.current * 0.78 + shapedEnergy * 0.22));
                    }

                    const centerY = displayHeight / 2;
                    const barCount = RECORDING_WAVE_BARS;
                    const gap = 4;
                    const barWidth = Math.max(
                        1.25,
                        Math.min(3.2, (displayWidth - gap * (barCount - 1)) / barCount)
                    );
                    const startX = 0;
                    const baseHeight = 2;
                    const maxHeight = Math.max(16, Math.floor(displayHeight * 0.92));

                    ctx.fillStyle = 'rgba(166, 228, 200, 0.9)';
                    const history = waveformHistoryRef.current;
                    for (let i = 0; i < barCount; i += 1) {
                        const historyLevel = Math.min(1, Math.max(0, history[i] ?? 0));
                        const liveLevel = Math.min(1, Math.pow(historyLevel, 0.9) * 1.02);
                        const barHeight = Math.max(baseHeight, liveLevel * maxHeight);
                        const x = startX + i * (barWidth + gap);
                        const y = centerY - barHeight / 2;
                        const radius = Math.min(barWidth / 2, barHeight / 2);
                        if (typeof ctx.roundRect === 'function') {
                            ctx.beginPath();
                            ctx.roundRect(x, y, barWidth, barHeight, radius);
                            ctx.fill();
                        } else {
                            ctx.fillRect(x, y, barWidth, barHeight);
                        }
                    }

                    waveformAnimationFrameRef.current = window.requestAnimationFrame(draw);
                };

                waveformAnimationFrameRef.current = window.requestAnimationFrame(draw);
            } catch {
                stopWaveformVisualization();
            }
        },
        [stopWaveformVisualization]
    );

    const updateQuestionState = useCallback((questionIndex: number, patch: Partial<Question>) => {
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
    }, []);

    useEffect(() => {
        if (!deckId) return;

        const loadQuestions = async () => {
            setIsLoadingQuestions(true);
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
                setShowModelAnswer(false);
                setStageNotice(null);
            } catch (err) {
                toast.error('Lernset konnte nicht geladen werden.', 'Bitte versuche es erneut.');
                console.error(err);
            } finally {
                setIsLoadingQuestions(false);
            }
        };

        loadQuestions();
    }, [deckId, toast]);

    useEffect(() => {
        return () => {
            if (confettiTimeoutRef.current !== null) {
                window.clearTimeout(confettiTimeoutRef.current);
            }
            stopWaveformVisualization();
        };
    }, [stopWaveformVisualization]);

    useEffect(() => {
        if (typeof window !== 'undefined' && (window as any).MathJax) {
            (window as any).MathJax.typesetPromise?.().catch((err: any) => console.error(err));
        }
    }, [currentQuestionId, questions, result, knownUnknownRevealed]);

    useEffect(() => {
        if (typeof navigator === 'undefined') return;
        if (!('permissions' in navigator) || typeof navigator.permissions?.query !== 'function') return;

        let isCancelled = false;
        let permissionStatus: PermissionStatus | null = null;

        const syncPermission = () => {
            if (!permissionStatus || isCancelled) return;
            if (permissionStatus.state === 'granted') {
                setMicPermission('granted');
                return;
            }
            if (permissionStatus.state === 'denied') {
                setMicPermission('denied');
                return;
            }
            setMicPermission('prompt');
        };

        const bind = async () => {
            try {
                permissionStatus = await navigator.permissions.query({
                    name: 'microphone' as PermissionName,
                });
                if (isCancelled) return;
                syncPermission();
                permissionStatus.addEventListener('change', syncPermission);
            } catch {}
        };

        void bind();

        return () => {
            isCancelled = true;
            permissionStatus?.removeEventListener('change', syncPermission);
        };
    }, []);

    useEffect(() => {
        if (!isRecording) {
            setRecordingElapsedSeconds(0);
            return;
        }

        const updateElapsed = () => {
            const startedAt = recordingStartedAtRef.current ?? Date.now();
            const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
            setRecordingElapsedSeconds(elapsedSeconds);
        };

        updateElapsed();
        const intervalId = window.setInterval(updateElapsed, 250);

        return () => {
            window.clearInterval(intervalId);
        };
    }, [isRecording]);

    const handleBackToSelection = () => {
        router.push('/app/learn');
    };

    const handleStageNoticePrimary = useCallback(async () => {
        if (!stageNotice || isStageNoticeBusy) return;

        if (stageNotice.primaryAction === 'restart_free') {
            if (!deckId) return;
            setIsStageNoticeBusy(true);
            try {
                const response = await fetch(`/api/decks/${encodeURIComponent(deckId)}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ learningStage: 'free' }),
                });
                if (!response.ok) throw new Error('Failed to restart free run');
                const progressResponse = await fetch(`/api/progress?deckId=${encodeURIComponent(deckId)}`);
                if (!progressResponse.ok) throw new Error('Failed to load deck progress after restart');
                const progressData = (await progressResponse.json()) as ProgressResponse;

                setCurrentQuestionId(progressData.nextQuestionId);
                setStats(progressData.stats);
                setLearningStage(resolveStageFromProgress(progressData));
                setResult(null);
                setKnownUnknownRevealed(false);
                setShowTranscript(false);
                setShowModelAnswer(false);
                setIsQuestionTransitionLoading(false);
                setStageNotice(null);
            } catch (err) {
                toast.error('Neuer Durchgang konnte nicht gestartet werden.', 'Bitte versuche es erneut.');
                console.error(err);
            } finally {
                setIsStageNoticeBusy(false);
            }
            return;
        }

        setStageNotice(null);
    }, [deckId, isStageNoticeBusy, router, stageNotice, toast]);

    const handleStageNoticeSecondary = useCallback(() => {
        if (!stageNotice || isStageNoticeBusy) return;
        if (stageNotice.secondaryAction === 'back_to_overview') {
            router.push('/app/learn');
            return;
        }
        setStageNotice(null);
    }, [isStageNoticeBusy, router, stageNotice]);

    const requestMicPermission = async () => {
        try {
            setIsRequestingMic(true);
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach((track) => track.stop());
            setMicPermission('granted');
        } catch (err) {
            setMicPermission('denied');
            toast.error('Mikrofon-Berechtigung verweigert.', 'Erlaube das Mikrofon in deinem Browser.');
        } finally {
            setIsRequestingMic(false);
        }
    };

    const currentQuestion = currentQuestionId !== null ? questions[currentQuestionId] : null;
    const questionText = currentQuestion?.question ?? '';
    const answerText = currentQuestion?.modelAnswer ?? '';
    const recordingDurationLabel = `${String(Math.floor(recordingElapsedSeconds / 60)).padStart(2, '0')}:${String(
        recordingElapsedSeconds % 60
    ).padStart(2, '0')}`;
    const displayStats = stats;
    const totalProgress = Math.max(1, displayStats.known + displayStats.learning + displayStats.new);
    const knownPct = Math.round((displayStats.known / totalProgress) * 100);
    const learningPct = Math.round((displayStats.learning / totalProgress) * 100);
    const newPct = Math.max(0, 100 - knownPct - learningPct);
    const showKnownLearningDivider = knownPct > 0 && learningPct > 0;
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

    useEffect(() => {
        if (isLoadingQuestions) return;
        if (stageNotice) return;
        if (currentQuestionId !== null) return;
        if (questions.length === 0) return;
        router.replace('/app/learn');
    }, [currentQuestionId, isLoadingQuestions, questions.length, router, stageNotice]);

    const evaluateAnswer = async (audioBlob: Blob, speechSeconds: number) => {
        if (currentQuestionId === null || !deckId) return;
        setIsEvaluating(true);

        const evaluationMode = cardMode === 'intro' ? 'graded' : 'supportive';
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
                setShowModelAnswer(false);
                setResult({
                    mode: 'supportive',
                    feedback: data.feedback,
                    userAnswer: data.userAnswer,
                    modelAnswer: data.modelAnswer,
                    question: data.question,
                });
            } else {
                setShowTranscript(false);
                setShowModelAnswer(false);
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
            toast.error('Auswertung fehlgeschlagen.', 'Bitte versuche es erneut.');
            console.error(err);
        } finally {
            setIsEvaluating(false);
        }
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            await startWaveformVisualization(stream);
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
                stopWaveformVisualization();
                await evaluateAnswer(audioBlob, speechSeconds);
                stream.getTracks().forEach((track) => track.stop());
            };

            mediaRecorder.start();
            recordingStartedAtRef.current = Date.now();
            setIsRecording(true);
        } catch (err) {
            toast.error('Fehler beim Mikrofonzugriff.', 'Bitte prüfe deine Browser-Berechtigungen.');
            recordingStartedAtRef.current = null;
            stopWaveformVisualization();
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            stopWaveformVisualization();
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const postProgress = useCallback(async (payload: Record<string, unknown>) => {
        const response = await fetch('/api/progress', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            throw new Error('Progress update failed');
        }

        return (await response.json()) as ProgressResponse;
    }, []);

    const applyProgressResponse = useCallback((data: ProgressResponse, previousStage: LearningStage) => {
        const nextStage = resolveStageFromProgress(data);
        setCurrentQuestionId(data.nextQuestionId);
        setStats(data.stats);
        setLearningStage(nextStage);
        setResult(null);
        setKnownUnknownRevealed(false);
        setShowTranscript(false);
        setShowModelAnswer(false);

        if (previousStage === 'intro' && nextStage === 'scaffolded') {
            void playLevelUpConfetti();
            setStageNotice({
                headline: 'Level Up!',
                status: 'Üben freigeschaltet',
                bullets: [
                    'Du erklärst jetzt aktiv in deinen eigenen Worten.',
                    'Die Musterlösung bleibt als Orientierung sichtbar.',
                    'Dein Fortschritt steigt mit jeder klaren Antwort.',
                ],
                ctaLabel: 'Jetzt üben',
                progressLabel: 'Level 2 von 3',
                otterMessage: 'Starker Fortschritt. Weiter geht’s.',
                primaryAction: 'dismiss',
            });
        } else if (previousStage === 'scaffolded' && nextStage === 'free') {
            void playLevelUpConfetti();
            setStageNotice({
                headline: 'Level Up!',
                status: 'Erklären freigeschaltet',
                bullets: [
                    'Ab jetzt siehst du nur noch die Frage.',
                    'Du rufst Wissen frei aus dem Gedächtnis ab.',
                    'Das ist die stärkste Form von aktivem Lernen.',
                ],
                ctaLabel: 'Jetzt erklären',
                progressLabel: 'Level 3 von 3',
                otterMessage: 'Jetzt zählt, was du wirklich kannst.',
                primaryAction: 'dismiss',
            });
        } else if (previousStage === 'free' && nextStage === 'free' && data.nextQuestionId === null) {
            void playLevelUpConfetti();
            setStageNotice({
                headline: 'Stark!',
                status: 'Du hast dieses Deck komplett durch.',
                bullets: [
                    'Alle Karten in diesem Durchgang sind abgeschlossen.',
                    'Für langfristiges Lernen lohnt sich ein neuer Durchgang.',
                    'Oder spring zurück und wähle ein anderes Lernset.',
                ],
                ctaLabel: 'Neuen Durchgang starten',
                secondaryCtaLabel: 'Zur Lernset-Übersicht',
                progressLabel: 'Deck abgeschlossen',
                otterMessage: 'Jetzt zählt’s richtig: nächster Durchgang oder neues Set.',
                primaryAction: 'restart_free',
                secondaryAction: 'back_to_overview',
            });
        } else {
            setStageNotice(null);
        }
    }, [playLevelUpConfetti]);

    const handleIntroNext = useCallback(async () => {
        if (currentQuestionId === null || !deckId || isSubmittingProgress) return;
        setIsSubmittingProgress(true);
        setIsQuestionTransitionLoading(true);

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
            toast.error('Fortschritt konnte nicht gespeichert werden.', 'Bitte versuche es erneut.');
            console.error(err);
        } finally {
            setIsSubmittingProgress(false);
            setIsQuestionTransitionLoading(false);
        }
    }, [currentQuestionId, deckId, isSubmittingProgress, learningStage, postProgress, applyProgressResponse, updateQuestionState, toast]);

    const handleIntroReviewLater = useCallback(async () => {
        if (currentQuestionId === null || !deckId || isSubmittingProgress) return;
        setIsSubmittingProgress(true);
        setIsQuestionTransitionLoading(true);

        try {
            const previousStage = learningStage;
            updateQuestionState(currentQuestionId, { seen: true });
            const data = await postProgress({
                deckId,
                action: 'intro_review_later',
                questionId: currentQuestionId,
            });
            applyProgressResponse(data, previousStage);
        } catch (err) {
            toast.error('Konnte nicht für später markiert werden.', 'Bitte versuche es erneut.');
            console.error(err);
        } finally {
            setIsSubmittingProgress(false);
            setIsQuestionTransitionLoading(false);
        }
    }, [currentQuestionId, deckId, isSubmittingProgress, learningStage, postProgress, applyProgressResponse, updateQuestionState, toast]);

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
            toast.error('Überspringen fehlgeschlagen.', 'Bitte versuche es erneut.');
            console.error(err);
        } finally {
            setIsSubmittingProgress(false);
        }
    };

    const handleReview = useCallback(async (type: 'known' | 'review' | 'wrong') => {
        if (!srManagerRef.current || currentQuestionId === null) return;
        if (reviewLoading) return;
        setReviewLoading(type);
        setIsQuestionTransitionLoading(true);

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
            setShowModelAnswer(false);
        }

        await new Promise((resolve) => setTimeout(resolve, REVIEW_TRANSITION_MS));
        setReviewLoading(null);
        setIsQuestionTransitionLoading(false);
    }, [currentQuestionId, deckId, reviewLoading, learningStage, postProgress, applyProgressResponse, updateQuestionState]);

    const isSupportiveDecisionVisible =
        !stageNotice && cardMode !== 'intro' && result?.mode === 'supportive';
    const isIntroDecisionVisible = !stageNotice && cardMode === 'intro' && !result;

    useEffect(() => {
        if (!isSupportiveDecisionVisible) return;

        const onKeyDown = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null;
            const isTypingTarget =
                target instanceof HTMLInputElement ||
                target instanceof HTMLTextAreaElement ||
                Boolean(target?.closest('[contenteditable="true"]'));

            if (isTypingTarget || reviewLoading !== null) {
                return;
            }

            if (event.key === '1') {
                event.preventDefault();
                void handleReview('known');
                return;
            }

            if (event.key === '2') {
                event.preventDefault();
                void handleReview('review');
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isSupportiveDecisionVisible, reviewLoading, handleReview]);

    useEffect(() => {
        if (!isIntroDecisionVisible) return;

        const onKeyDown = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null;
            const isTypingTarget =
                target instanceof HTMLInputElement ||
                target instanceof HTMLTextAreaElement ||
                Boolean(target?.closest('[contenteditable="true"]'));

            if (isTypingTarget || isSubmittingProgress) {
                return;
            }

            if (event.key === '1') {
                event.preventDefault();
                void handleIntroNext();
                return;
            }

            if (event.key === '2') {
                event.preventDefault();
                void handleIntroReviewLater();
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isIntroDecisionVisible, isSubmittingProgress, handleIntroNext, handleIntroReviewLater]);

    if (isLoadingQuestions || (currentQuestionId === null && !stageNotice)) {
        return <LearnDetailSkeleton stage={learningStage} onBack={handleBackToSelection} />;
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
                                    {isQuestionTransitionLoading ? (
                                        <span className="block space-y-2">
                                            <span className="skeleton block h-8 w-full rounded-md" />
                                            <span className="skeleton block h-8 w-3/4 rounded-md" />
                                        </span>
                                    ) : (
                                        questionText
                                    )}
                                </h2>
                                <hr className="-mx-6 border-border" />
                                <div>
                                    <h3 className="intro-label text-sm font-medium text-muted-foreground">Musterlösung</h3>
                                    <div className="intro-text mt-2 text-base leading-relaxed text-foreground">
                                        {isQuestionTransitionLoading ? (
                                            <div className="space-y-2">
                                                <div className="skeleton h-5 w-full rounded-md" />
                                                <div className="skeleton h-5 w-11/12 rounded-md" />
                                                <div className="skeleton h-5 w-4/5 rounded-md" />
                                            </div>
                                        ) : (
                                            answerText
                                        )}
                                    </div>
                                </div>
                                {!stageNotice && !result && (
                                    <div className="pt-1">
                                        <div className="flex flex-wrap gap-2">
                                            <Button
                                                onClick={handleIntroNext}
                                                aria-label={INTRO_PRIMARY_ACTION_LABEL}
                                                className="h-10 w-full rounded-xl px-4 text-sm sm:w-auto sm:min-w-[11.5rem]"
                                                disabled={isSubmittingProgress}
                                            >
                                                <CheckIconSolid className="h-4 w-4 shrink-0" />
                                                <span>{INTRO_PRIMARY_ACTION_LABEL}</span>
                                            </Button>
                                            <Button
                                                onClick={handleIntroReviewLater}
                                                aria-label={INTRO_REVIEW_ACTION_LABEL}
                                                variant="outline"
                                                className="h-10 w-full rounded-xl px-4 text-sm sm:w-auto sm:min-w-[11.5rem]"
                                                disabled={isSubmittingProgress}
                                            >
                                                <ArrowPathIcon className="h-4 w-4 shrink-0" />
                                                <span>{INTRO_REVIEW_ACTION_LABEL}</span>
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ) : (
                        <Card className="border-border bg-card shadow-sm">
                            <CardContent className="space-y-5 p-6">
                                <h2 className="deck-question text-2xl font-semibold leading-tight text-foreground">
                                    {isQuestionTransitionLoading ? (
                                        <span className="block space-y-2">
                                            <span className="skeleton block h-8 w-full rounded-md" />
                                            <span className="skeleton block h-8 w-3/4 rounded-md" />
                                        </span>
                                    ) : (
                                        questionText
                                    )}
                                </h2>

                                {result?.mode === 'supportive' ? (
                                    <>
                                        <hr className="-mx-6 border-border" />
                                        <div className="space-y-4">
                                            <div className="rounded-2xl bg-foreground/5 p-4">
                                                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                                                    <div className="flex justify-center sm:block">
                                                        <ScoreGauge score={result.feedback.score} />
                                                    </div>
                                                    <div className="hidden h-16 w-px bg-border sm:block" />
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                                                            <SparklesIconSolid
                                                                className="h-4 w-4 text-muted-foreground"
                                                                aria-hidden="true"
                                                            />
                                                            <span>Feedback</span>
                                                        </div>
                                                        <p className="mt-2 text-base font-normal leading-relaxed text-foreground">
                                                            {result.feedback.shortFeedback}
                                                        </p>
                                                        <p className="mt-2 text-base font-normal leading-relaxed text-foreground">
                                                            {result.feedback.improvement}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                            <hr className="-mx-6 border-border" />
                                            <div>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowModelAnswer((prev) => !prev)}
                                                    className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                                                    aria-expanded={showModelAnswer}
                                                >
                                                    <ChevronRightIcon
                                                        className={`h-4 w-4 transition-transform ${showModelAnswer ? 'rotate-90' : ''}`}
                                                    />
                                                    <span>Musterlösung</span>
                                                </button>
                                                {showModelAnswer && (
                                                    <div className="mt-2 rounded-xl bg-secondary/25 p-3">
                                                        <p className="mt-1 max-h-44 overflow-y-auto pr-1 text-sm leading-relaxed text-foreground">
                                                        {isQuestionTransitionLoading ? (
                                                            <div className="space-y-2">
                                                                <div className="skeleton h-4 w-full rounded-md" />
                                                                <div className="skeleton h-4 w-11/12 rounded-md" />
                                                                <div className="skeleton h-4 w-4/5 rounded-md" />
                                                            </div>
                                                        ) : (
                                                            answerText
                                                        )}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowTranscript((prev) => !prev)}
                                                    className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                                                    aria-expanded={showTranscript}
                                                >
                                                    <ChevronRightIcon
                                                        className={`h-4 w-4 transition-transform ${showTranscript ? 'rotate-90' : ''}`}
                                                    />
                                                    <span>Meine Antwort</span>
                                                </button>
                                                {showTranscript && (
                                                    <div className="mt-2 rounded-xl bg-secondary/25 p-3">
                                                        <p className="mt-1 max-h-44 overflow-y-auto pr-1 text-sm leading-relaxed text-foreground">
                                                            {result.userAnswer}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="pt-1">
                                                <div className="flex flex-wrap gap-2">
                                                    <Button
                                                        onClick={() => handleReview('known')}
                                                        variant="default"
                                                        disabled={reviewLoading !== null}
                                                        isLoading={reviewLoading === 'known'}
                                                        loadingText="Speichere"
                                                        aria-label={SUPPORTIVE_PRIMARY_ACTION_LABEL}
                                                        className="h-10 w-full rounded-xl px-4 text-sm sm:w-auto sm:min-w-[11.5rem]"
                                                    >
                                                        <CheckIconSolid className="h-4 w-4 shrink-0" />
                                                        <span>{SUPPORTIVE_PRIMARY_ACTION_LABEL}</span>
                                                    </Button>
                                                    <Button
                                                        onClick={() => handleReview('review')}
                                                        variant="outline"
                                                        disabled={reviewLoading !== null}
                                                        isLoading={reviewLoading === 'review'}
                                                        loadingText="Speichere"
                                                        aria-label={SUPPORTIVE_REVIEW_ACTION_LABEL}
                                                        className="h-10 w-full rounded-xl px-4 text-sm sm:w-auto sm:min-w-[11.5rem]"
                                                    >
                                                        <ArrowPathIcon className="h-4 w-4 shrink-0" />
                                                        <span>{SUPPORTIVE_REVIEW_ACTION_LABEL}</span>
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    (cardMode === 'scaffolded' || !!result || knownUnknownRevealed) && (
                                        <>
                                            <hr className="-mx-6 border-border" />
                                            <div>
                                                {!!result ? (
                                                    <>
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowModelAnswer((prev) => !prev)}
                                                            className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                                                            aria-expanded={showModelAnswer}
                                                        >
                                                            <ChevronRightIcon
                                                                className={`h-4 w-4 transition-transform ${
                                                                    showModelAnswer ? 'rotate-90' : ''
                                                                }`}
                                                            />
                                                            <span>Musterlösung</span>
                                                        </button>
                                                        {showModelAnswer && (
                                                            <div className="mt-2 text-base leading-relaxed text-foreground">
                                                                {isQuestionTransitionLoading ? (
                                                                    <div className="space-y-2">
                                                                        <div className="skeleton h-5 w-full rounded-md" />
                                                                        <div className="skeleton h-5 w-11/12 rounded-md" />
                                                                        <div className="skeleton h-5 w-4/5 rounded-md" />
                                                                    </div>
                                                                ) : (
                                                                    answerText
                                                                )}
                                                            </div>
                                                        )}
                                                    </>
                                                ) : (
                                                    <>
                                                        <h3 className="text-sm font-medium text-muted-foreground">Musterlösung</h3>
                                                        <div className="mt-2 text-base leading-relaxed text-foreground">
                                                            {isQuestionTransitionLoading ? (
                                                                <div className="space-y-2">
                                                                    <div className="skeleton h-5 w-full rounded-md" />
                                                                    <div className="skeleton h-5 w-11/12 rounded-md" />
                                                                    <div className="skeleton h-5 w-4/5 rounded-md" />
                                                                </div>
                                                            ) : (
                                                                answerText
                                                            )}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </>
                                    )
                                )}

                                {!stageNotice && !result && (
                                    <div className="pt-1">
                                        {knownUnknownRevealed ? (
                                            <Button
                                                onClick={handleSkipKnownUnknown}
                                                disabled={isSubmittingProgress}
                                                className="h-10 w-full rounded-xl px-4 text-sm sm:w-auto sm:min-w-[11.5rem]"
                                            >
                                                <ArrowPathIcon className="h-4 w-4 shrink-0" />
                                                <span>{SUPPORTIVE_REVIEW_ACTION_LABEL}</span>
                                            </Button>
                                        ) : (
                                            <div className="flex flex-col items-start gap-4">

                                                {micPermission === 'prompt' ? (
                                                    <LoadingButton
                                                        onClick={requestMicPermission}
                                                        className="h-10 w-full rounded-xl px-4 text-sm sm:w-auto sm:min-w-[11.5rem]"
                                                        isLoading={isRequestingMic}
                                                        loadingText="Prüfe"
                                                        text="Mikrofon erlauben"
                                                        startIcon={
                                                            <MicrophoneIconSolid className="h-5 w-5" />
                                                        }
                                                    />
                                                ) : !isRecording && !isEvaluating ? (
                                                    <div className="flex w-full flex-wrap gap-2">
                                                        <Button
                                                            onClick={startRecording}
                                                            className="h-10 w-full rounded-xl px-4 text-sm sm:w-auto sm:min-w-[11.5rem]"
                                                        >
                                                            <MicrophoneIconSolid className="h-5 w-5 items-center justify-center" />
                                                            <span>Sags in deinen eigenen Worten</span>
                                                        </Button>
                                                        {cardMode === 'free' ? (
                                                            <Button
                                                                variant="outline"
                                                                onClick={() => setKnownUnknownRevealed(true)}
                                                                className="h-10 w-full rounded-xl px-4 text-sm sm:w-auto sm:min-w-[11.5rem]"
                                                            >
                                                                Ich weiß es nicht
                                                            </Button>
                                                        ) : null}
                                                    </div>
                                                ) : isRecording ? (
                                                    <div className="grid w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
                                                        <Button
                                                            onClick={stopRecording}
                                                            variant="destructive"
                                                            className="h-10 shrink-0 rounded-xl px-4 text-sm animate-pulse"
                                                        >
                                                            <StopIconSolid className="h-5 w-5 shrink-0" />
                                                            <span className="tabular-nums">Stop · {recordingDurationLabel}</span>
                                                        </Button>
                                                        <div className="h-10 min-w-0 rounded-xl bg-foreground/10 px-3 py-2">
                                                            <canvas ref={waveformCanvasRef} className="block h-full w-full" />
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <EvaluationState />
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {stageNotice || cardMode === 'intro' || !result || result.mode === 'supportive' ? null : (
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

                </div>

                {stageNotice && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/35 p-4 backdrop-blur-sm">
                        <div className="relative w-auto max-w-[calc(100vw-2rem)]">
                            <Card className="inline-block overflow-hidden rounded-2xl border border-white/10 bg-background text-[#eef6ee]">
                                <CardContent className="space-y-5 p-5 sm:p-6">
                                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-6">
                                        <div className="space-y-4 md:max-w-[30rem]">
                                            <div className="flex items-center gap-3">
                                                <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/80">
                                                    {stageNotice.progressLabel}
                                                </span>
                                            </div>

                                            <div className="space-y-1">
                                                <h2 className="text-3xl font-extrabold leading-none tracking-tight text-white">{stageNotice.headline}</h2>
                                                <p className="text-lg font-semibold leading-tight text-white/90">{stageNotice.status}</p>
                                            </div>

                                            <ul className="space-y-2">
                                                {stageNotice.bullets.map((item) => (
                                                    <li key={item} className="flex items-start gap-2.5 text-sm leading-snug text-white/80">
                                                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-white/45" />
                                                        <span>{item}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                            <p className="text-sm text-white/85">{stageNotice.otterMessage}</p>
                                        </div>
                                        <div className="flex justify-center md:justify-end">
                                            <Image
                                                src="/mascot/otter-celebration.png"
                                                alt="Otter feiert den Fortschritt"
                                                width={260}
                                                height={260}
                                                className="h-40 w-40 object-contain sm:h-44 sm:w-44 md:h-56 md:w-56"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Button
                                            onClick={() => void handleStageNoticePrimary()}
                                            disabled={isStageNoticeBusy}
                                            className="h-11 w-full rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/95"
                                        >
                                            {stageNotice.ctaLabel}
                                        </Button>
                                        {stageNotice.secondaryCtaLabel ? (
                                            <Button
                                                onClick={handleStageNoticeSecondary}
                                                disabled={isStageNoticeBusy}
                                                variant="outline"
                                                className="h-11 w-full rounded-xl border-white/15 bg-transparent text-sm font-medium text-white/90 hover:bg-white/5"
                                            >
                                                {stageNotice.secondaryCtaLabel}
                                            </Button>
                                        ) : null}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                )}
            </main>
        </>
    );
}
