'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mic, Square, Loader2, CheckCircle2, RotateCcw, XCircle, RefreshCw } from 'lucide-react';
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

export default function Home() {
    const [questions, setQuestions] = useState<Question[]>([]);
    const [currentQuestionId, setCurrentQuestionId] = useState<number | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [isEvaluating, setIsEvaluating] = useState(false);
    const [result, setResult] = useState<EvaluationResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [micPermission, setMicPermission] = useState<'prompt' | 'granted' | 'denied'>('prompt');
    const [stats, setStats] = useState({ known: 0, learning: 0, new: 0 });

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const srManagerRef = useRef<SpacedRepetitionManager | null>(null);

    useEffect(() => {
        const loadQuestions = async () => {
            try {
                const response = await fetch('/api/questions');
                if (!response.ok) {
                    throw new Error('Failed to load questions');
                }
                const data = await response.json();
                setQuestions(data.questions);

                // Initialize SR Manager
                const manager = new SpacedRepetitionManager(data.questions.length);
                srManagerRef.current = manager;

                // Get first question
                const nextId = manager.getNextQuestion();
                setCurrentQuestionId(nextId);

                // Update stats
                setStats(manager.getStats());
            } catch (err) {
                setError('Fehler beim Laden der Fragen');
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };

        loadQuestions();
    }, []);

    // Trigger MathJax rendering when question or result changes
    useEffect(() => {
        if (typeof window !== 'undefined' && (window as any).MathJax) {
            (window as any).MathJax.typesetPromise?.().catch((err: any) => console.error('MathJax error:', err));
        }
    }, [currentQuestionId, questions, result]);

    const currentQuestion = currentQuestionId !== null ? questions[currentQuestionId] : null;

    const requestMicPermission = async () => {
        try {
            setError(null);
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop());
            setMicPermission('granted');
        } catch (err) {
            setMicPermission('denied');
            setError('Mikrofon-Berechtigung verweigert. Bitte erlaube den Zugriff in deinen Browser-Einstellungen.');
            console.error(err);
        }
    };

    const startRecording = async () => {
        try {
            setError(null);
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);

            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, {
                    type: 'audio/webm',
                });
                await evaluateAnswer(audioBlob);
                stream.getTracks().forEach((track) => track.stop());
            };

            mediaRecorder.start();
            mediaRecorderRef.current = mediaRecorder;
            setIsRecording(true);
        } catch (err) {
            setError('Fehler beim Zugriff auf das Mikrofon');
            console.error(err);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const evaluateAnswer = async (audioBlob: Blob) => {
        if (currentQuestionId === null) return;

        setIsEvaluating(true);
        setError(null);

        const formData = new FormData();
        formData.append('file', audioBlob, 'recording.webm');
        formData.append('questionId', currentQuestionId.toString());

        try {
            const response = await fetch('/api/evaluate', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error('Evaluation failed');
            }

            const data = await response.json();
            setResult(data);
        } catch (err) {
            setError('Fehler bei der Auswertung');
            console.error(err);
        } finally {
            setIsEvaluating(false);
        }
    };

    const handleReview = (type: 'known' | 'review' | 'wrong') => {
        if (!srManagerRef.current || currentQuestionId === null) return;

        if (type === 'known') {
            srManagerRef.current.markAsKnown(currentQuestionId);
        } else if (type === 'review') {
            srManagerRef.current.markAsReview(currentQuestionId);
        } else {
            srManagerRef.current.markAsWrong(currentQuestionId);
        }

        // Get next question
        const nextId = srManagerRef.current.getNextQuestion();
        setCurrentQuestionId(nextId);
        setResult(null);
        setError(null);

        // Update stats
        setStats(srManagerRef.current.getStats());
    };

    const handleReset = () => {
        if (!srManagerRef.current) return;

        if (confirm('Möchtest du wirklich den gesamten Fortschritt zurücksetzen?')) {
            srManagerRef.current.reset();
            window.location.reload();
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4">
                <Card className="w-full max-w-2xl">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-center gap-2 text-muted-foreground">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <span>Lade Fragen...</span>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (!currentQuestion) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4">
                <Card className="w-full max-w-2xl">
                    <CardContent className="p-6">
                        <div className="text-center space-y-4">
                            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
                            <h2 className="text-2xl font-bold">Alle Fragen bearbeitet! 🎉</h2>
                            <p className="text-muted-foreground">
                                Du hast alle fälligen Fragen durchgearbeitet. Komm später wieder für Wiederholungen.
                            </p>
                            <Button onClick={handleReset} variant="outline">
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Fortschritt zurücksetzen
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Header with Stats and Reset */}
                <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                        <h1 className="text-4xl font-bold text-slate-900 mb-2">Talk to Learn</h1>
                        <div className="flex flex-wrap gap-4 text-sm">
                            <div className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                <span className="text-slate-600">
                                    <strong className="text-green-700">{stats.known}</strong> gelernt
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <RotateCcw className="h-4 w-4 text-yellow-500" />
                                <span className="text-slate-600">
                                    <strong className="text-yellow-700">{stats.learning}</strong> zu wiederholen
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <XCircle className="h-4 w-4 text-slate-400" />
                                <span className="text-slate-600">
                                    <strong className="text-slate-700">{stats.new}</strong> neu
                                </span>
                            </div>
                        </div>
                    </div>
                    <Button onClick={handleReset} variant="outline" size="sm">
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                </div>

                {/* Question Card */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-xl">Frage</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-lg leading-relaxed">{currentQuestion.question}</p>
                    </CardContent>
                </Card>

                {/* Recording Controls */}
                {!result && (
                    <Card>
                        <CardContent className="p-6">
                            <div className="flex flex-col items-center gap-4">
                                {micPermission === 'prompt' && (
                                    <div className="text-center space-y-4">
                                        <p className="text-sm text-muted-foreground">
                                            Für die Aufnahme benötigen wir Zugriff auf dein Mikrofon.
                                        </p>
                                        <Button
                                            size="lg"
                                            onClick={requestMicPermission}
                                            className="w-full md:w-auto"
                                        >
                                            <Mic className="mr-2 h-5 w-5" />
                                            Mikrofon-Zugriff erlauben
                                        </Button>
                                    </div>
                                )}

                                {micPermission === 'granted' && !isRecording && !isEvaluating && (
                                    <Button
                                        size="lg"
                                        onClick={startRecording}
                                        className="w-full md:w-auto"
                                    >
                                        <Mic className="mr-2 h-5 w-5" />
                                        Aufnahme starten
                                    </Button>
                                )}

                                {isRecording && (
                                    <Button
                                        size="lg"
                                        onClick={stopRecording}
                                        variant="destructive"
                                        className="w-full md:w-auto animate-pulse"
                                    >
                                        <Square className="mr-2 h-5 w-5" />
                                        Aufnahme beenden
                                    </Button>
                                )}

                                {isEvaluating && (
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                        <span>Wird ausgewertet...</span>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Error Alert */}
                {error && (
                    <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {/* Result Display */}
                {result && (
                    <div className="space-y-4">
                        {/* Score Card */}
                        <Card className={`border-2 ${result.score < 6
                            ? 'border-red-500 bg-red-50'
                            : result.score < 8
                                ? 'border-yellow-500 bg-yellow-50'
                                : 'border-green-500 bg-green-50'
                            }`}>
                            <CardContent className="p-8">
                                <div className="text-center space-y-4">
                                    <div>
                                        <div className={`text-6xl font-bold ${result.score < 6
                                            ? 'text-red-600'
                                            : result.score < 8
                                                ? 'text-yellow-600'
                                                : 'text-green-600'
                                            }`}>
                                            {result.score}
                                            <span className="text-3xl text-muted-foreground">/10</span>
                                        </div>
                                    </div>
                                    <p className="text-lg text-slate-700">{result.feedback}</p>
                                </div>
                            </CardContent>
                        </Card>

                        {/* User Answer */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Deine Antwort</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-slate-700">{result.userAnswer}</p>
                            </CardContent>
                        </Card>

                        {/* Model Answer */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Musterantwort</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-slate-700">{result.modelAnswer}</p>
                            </CardContent>
                        </Card>

                        {/* Anki-Style Review Buttons */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Button
                                onClick={() => handleReview('wrong')}
                                variant="destructive"
                                className="h-auto py-4 flex flex-col gap-1"
                            >
                                <XCircle className="h-5 w-5" />
                                <span className="font-semibold">War falsch</span>
                                <span className="text-xs opacity-90">in 2 Minuten</span>
                            </Button>

                            <Button
                                onClick={() => handleReview('review')}
                                variant="outline"
                                className="h-auto py-4 flex flex-col gap-1 border-2 border-yellow-500 hover:bg-yellow-50"
                            >
                                <RotateCcw className="h-5 w-5 text-yellow-600" />
                                <span className="font-semibold text-yellow-700">Muss üben</span>
                                <span className="text-xs text-yellow-600">in 10 Minuten</span>
                            </Button>

                            <Button
                                onClick={() => handleReview('known')}
                                className="h-auto py-4 flex flex-col gap-1 bg-green-600 hover:bg-green-700"
                            >
                                <CheckCircle2 className="h-5 w-5" />
                                <span className="font-semibold">Kann ich!</span>
                                <span className="text-xs opacity-90">vorerst fertig</span>
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}
