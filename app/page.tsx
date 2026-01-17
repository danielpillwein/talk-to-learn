'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mic, Square, Loader2, CheckCircle2, RotateCcw, XCircle, RefreshCw, FileText, ArrowLeft } from 'lucide-react';
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

interface FileStats {
    filename: string;
    totalQuestions: number;
    known: number;
    learning: number;
    new: number;
}

export default function Home() {
    // --- STATE: SELECTION MODE ---
    const [availableFiles, setAvailableFiles] = useState<FileStats[]>([]);
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [isLoadingFiles, setIsLoadingFiles] = useState(true);

    // --- STATE: LEARNING MODE ---
    const [questions, setQuestions] = useState<Question[]>([]);
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

    // 1. Dateien laden und Stats berechnen beim Start
    useEffect(() => {
        const fetchFiles = async () => {
            try {
                const response = await fetch('/api/files');
                if (!response.ok) throw new Error('Failed to list files');
                const data = await response.json();

                // Stats für jede Datei aus LocalStorage holen
                const filesWithStats = data.files.map((f: { filename: string, totalQuestions: number }) => {
                    const stats = SpacedRepetitionManager.getStoredStats(f.filename, f.totalQuestions);
                    return {
                        ...f,
                        ...stats
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

    // 2. Fragen laden wenn Datei gewählt wurde
    useEffect(() => {
        if (!selectedFile) return;

        const loadQuestions = async () => {
            setIsLoadingQuestions(true);
            setError(null);
            try {
                const response = await fetch(`/api/questions?file=${encodeURIComponent(selectedFile)}`);
                if (!response.ok) throw new Error('Failed to load questions');
                const data = await response.json();
                setQuestions(data.questions);

                // Manager für dieses File initialisieren
                const manager = new SpacedRepetitionManager(data.questions.length, selectedFile);
                srManagerRef.current = manager;

                const nextId = manager.getNextQuestion();
                setCurrentQuestionId(nextId);
                setStats(manager.getStats());
                setResult(null);

            } catch (err) {
                setError('Fehler beim Laden der Fragen');
                console.error(err);
            } finally {
                setIsLoadingQuestions(false);
            }
        };

        loadQuestions();
    }, [selectedFile]);

    // MathJax Trigger
    useEffect(() => {
        if (typeof window !== 'undefined' && (window as any).MathJax) {
            (window as any).MathJax.typesetPromise?.().catch((err: any) => console.error(err));
        }
    }, [currentQuestionId, questions, result]);


    // --- HELPERS ---
    const formatFileName = (name: string) => {
        return name.replace('.csv', '').replace(/_/g, ' ');
    };

    const handleBackToSelection = () => {
        setSelectedFile(null);
        setQuestions([]);
        setCurrentQuestionId(null);
        setResult(null);
        setError(null);
        // Reload file list to update stats
        window.location.reload();
    };

    const requestMicPermission = async () => {
        try {
            setError(null);
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop());
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
        if (currentQuestionId === null || !selectedFile) return;
        setIsEvaluating(true);
        setError(null);

        const formData = new FormData();
        formData.append('file', audioBlob, 'recording.webm');
        formData.append('questionId', currentQuestionId.toString());
        formData.append('filename', selectedFile); // Wichtig!

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

    const handleReview = (type: 'known' | 'review' | 'wrong') => {
        if (!srManagerRef.current || currentQuestionId === null) return;

        if (type === 'known') srManagerRef.current.markAsKnown(currentQuestionId);
        else if (type === 'review') srManagerRef.current.markAsReview(currentQuestionId);
        else srManagerRef.current.markAsWrong(currentQuestionId);

        const nextId = srManagerRef.current.getNextQuestion();
        setCurrentQuestionId(nextId);
        setResult(null);
        setError(null);
        setStats(srManagerRef.current.getStats());
    };

    const handleReset = () => {
        if (!srManagerRef.current) return;
        if (confirm('Wirklich den Fortschritt für DIESES Lernset zurücksetzen?')) {
            srManagerRef.current.reset();
            const manager = srManagerRef.current;
            setCurrentQuestionId(manager.getNextQuestion());
            setStats(manager.getStats());
            setResult(null);
        }
    };

    const currentQuestion = currentQuestionId !== null ? questions[currentQuestionId] : null;

    // --- VIEW 1: FILE SELECTION ---
    if (!selectedFile) {
        return (
            <div className="min-h-screen bg-slate-50 p-4">
                <div className="max-w-md mx-auto space-y-6">
                    <div className="text-center pt-8">
                        <h1 className="text-3xl font-bold text-slate-900">Talk to Learn</h1>
                        <p className="text-slate-500">Wähle ein Lernset aus</p>
                    </div>

                    {isLoadingFiles ? (
                        <div className="flex justify-center p-8"><Loader2 className="animate-spin text-slate-400" /></div>
                    ) : (
                        <div className="space-y-3">
                            {availableFiles.map((file) => (
                                <Card
                                    key={file.filename}
                                    className="hover:border-slate-400 transition-colors cursor-pointer active:scale-[0.99]"
                                    onClick={() => setSelectedFile(file.filename)}
                                >
                                    <CardContent className="p-4 flex flex-col gap-2">
                                        <div className="flex items-start gap-3">
                                            <FileText className="h-6 w-6 text-slate-600 mt-1 shrink-0" />
                                            <div className="min-w-0 flex-1">
                                                {/* Mobile Friendly: break-words und kein truncate für den Titel, falls lang */}
                                                <h3 className="font-semibold text-lg text-slate-900 break-words leading-tight">
                                                    {formatFileName(file.filename)}
                                                </h3>
                                            </div>
                                        </div>

                                        {/* Stats Row */}
                                        <div className="flex gap-3 text-sm mt-1 pl-9 flex-wrap">
                                            <div className="flex items-center gap-1 text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                                                <CheckCircle2 className="h-3 w-3" /> {file.known}
                                            </div>
                                            <div className="flex items-center gap-1 text-yellow-700 bg-yellow-50 px-2 py-0.5 rounded-full">
                                                <RotateCcw className="h-3 w-3" /> {file.learning}
                                            </div>
                                            <div className="flex items-center gap-1 text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                                                <XCircle className="h-3 w-3" /> {file.new}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                            {availableFiles.length === 0 && (
                                <div className="text-center text-muted-foreground p-8">Keine Dateien in /data gefunden.</div>
                            )}
                        </div>
                    )}
                    {error && <Alert variant="destructive" className="mt-4"><AlertDescription>{error}</AlertDescription></Alert>}
                </div>
            </div>
        );
    }

    // --- VIEW 2: LOADING QUESTIONS ---
    if (isLoadingQuestions) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-slate-500">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <p>Lade {formatFileName(selectedFile)}...</p>
                </div>
            </div>
        );
    }

    // --- VIEW 3: ALL DONE ---
    if (currentQuestionId === null) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <Card className="w-full max-w-md text-center">
                    <CardContent className="p-8 space-y-6">
                        <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
                        <h2 className="text-2xl font-bold">Set erledigt! 🎉</h2>
                        <div className="flex gap-3 justify-center">
                            <Button onClick={handleBackToSelection} variant="outline">
                                <ArrowLeft className="mr-2 h-4 w-4" /> Zurück
                            </Button>
                            <Button onClick={handleReset} variant="ghost">
                                <RefreshCw className="mr-2 h-4 w-4" /> Reset
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // --- VIEW 4: LEARNING ---
    return (
        <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
            <div className="max-w-3xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 overflow-hidden">
                            <Button variant="ghost" size="icon" onClick={handleBackToSelection} className="shrink-0">
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                            <h1 className="text-xl font-bold text-slate-900 truncate">
                                {formatFileName(selectedFile)}
                            </h1>
                        </div>
                        <Button onClick={handleReset} variant="ghost" size="sm" className="shrink-0 text-slate-400 hover:text-red-500">
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                    </div>

                    {/* Stats Bar */}
                    <div className="grid grid-cols-3 gap-2">
                        <div className="bg-white p-2 rounded border border-slate-200 flex items-center justify-center gap-2 text-sm text-green-700">
                            <CheckCircle2 className="h-4 w-4" /> <b>{stats.known}</b>
                        </div>
                        <div className="bg-white p-2 rounded border border-slate-200 flex items-center justify-center gap-2 text-sm text-yellow-700">
                            <RotateCcw className="h-4 w-4" /> <b>{stats.learning}</b>
                        </div>
                        <div className="bg-white p-2 rounded border border-slate-200 flex items-center justify-center gap-2 text-sm text-slate-600">
                            <XCircle className="h-4 w-4" /> <b>{stats.new}</b>
                        </div>
                    </div>
                </div>

                {/* Question */}
                <Card>
                    <CardHeader><CardTitle className="text-sm text-slate-500 uppercase">Frage</CardTitle></CardHeader>
                    <CardContent>
                        <p className="text-xl font-medium leading-relaxed">{currentQuestion?.question}</p>
                    </CardContent>
                </Card>

                {/* Interaction */}
                {!result ? (
                    <Card>
                        <CardContent className="p-6 flex flex-col items-center gap-4">
                            {micPermission === 'prompt' ? (
                                <Button size="lg" onClick={requestMicPermission} className="w-full">
                                    <Mic className="mr-2 h-5 w-5" /> Mikrofon erlauben
                                </Button>
                            ) : !isRecording && !isEvaluating ? (
                                <Button size="lg" onClick={startRecording} className="w-full py-8 text-lg rounded-xl">
                                    <Mic className="mr-2 h-6 w-6" /> Antworten
                                </Button>
                            ) : isRecording ? (
                                <Button size="lg" onClick={stopRecording} variant="destructive" className="w-full py-8 text-lg rounded-xl animate-pulse">
                                    <Square className="mr-2 h-6 w-6" /> Stop
                                </Button>
                            ) : (
                                <div className="flex items-center gap-2 text-slate-500 py-4">
                                    <Loader2 className="animate-spin" /> Auswertung...
                                </div>
                            )}
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                        <Card className={`border-2 ${result.score >= 9 ? 'border-green-500 bg-green-50' : result.score < 4 ? 'border-red-500 bg-red-50' : 'border-yellow-500 bg-yellow-50'}`}>
                            <CardContent className="p-6 text-center space-y-2">
                                <div className="text-4xl font-black">{result.score}<span className="text-lg text-muted-foreground font-normal">/10</span></div>
                                <p className="font-medium">{result.feedback}</p>
                            </CardContent>
                        </Card>

                        <div className="grid md:grid-cols-2 gap-4">
                            <Card className="bg-slate-50">
                                <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-slate-500">Du</CardTitle></CardHeader>
                                <CardContent className="text-sm">{result.userAnswer}</CardContent>
                            </Card>
                            <Card className="bg-slate-50">
                                <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-slate-500">Lösung</CardTitle></CardHeader>
                                <CardContent className="text-sm">{result.modelAnswer}</CardContent>
                            </Card>
                        </div>

                        {/* Review Buttons - Nebeneinander auf allen Geräten */}
                        <div className="grid grid-cols-3 gap-2 pt-4">
                            {/* Roter Button */}
                            <Button
                                onClick={() => handleReview('wrong')}
                                className="h-auto py-4 px-1 flex flex-col gap-2 bg-red-500 hover:bg-red-600 text-white shadow-md transition-all hover:scale-[1.02]"
                            >
                                <XCircle className="h-6 w-6" />
                                <div className="flex flex-col items-center leading-none gap-1">
                                    <span className="text-base md:text-lg font-bold">War falsch</span>
                                    <span className="text-xs md:text-sm font-medium opacity-90">in 2 Minuten</span>
                                </div>
                            </Button>

                            {/* Gelber Button (Outline) */}
                            <Button
                                onClick={() => handleReview('review')}
                                variant="outline"
                                className="h-auto py-4 px-1 flex flex-col gap-2 bg-white border-2 border-yellow-500 text-yellow-600 hover:bg-yellow-50 hover:text-yellow-700 hover:border-yellow-600 shadow-sm transition-all hover:scale-[1.02]"
                            >
                                <RotateCcw className="h-6 w-6" />
                                <div className="flex flex-col items-center leading-none gap-1">
                                    <span className="text-base md:text-lg font-bold">Muss üben</span>
                                    <span className="text-xs md:text-sm font-medium">in 10 Minuten</span>
                                </div>
                            </Button>

                            {/* Grüner Button */}
                            <Button
                                onClick={() => handleReview('known')}
                                className="h-auto py-4 px-1 flex flex-col gap-2 bg-green-600 hover:bg-green-700 text-white shadow-md transition-all hover:scale-[1.02]"
                            >
                                <CheckCircle2 className="h-6 w-6" />
                                <div className="flex flex-col items-center leading-none gap-1">
                                    <span className="text-base md:text-lg font-bold">Kann ich!</span>
                                    <span className="text-xs md:text-sm font-medium opacity-90">vorerst fertig</span>
                                </div>
                            </Button>
                        </div>
                    </div>
                )}

                {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
            </div>
        </main>
    );
}