// Spaced Repetition Logic for Talk-to-Learn

export type CardStatus = 'new' | 'learning' | 'known';

export interface CardProgress {
    questionId: number;
    status: CardStatus;
    nextReview: number; // timestamp in ms
    reviewCount: number;
}

export class SpacedRepetitionManager {
    private storageKey = 'talk-to-learn-progress';
    private progress: Map<number, CardProgress>;

    constructor(totalQuestions: number) {
        this.progress = this.loadProgress();

        // Initialize any new questions
        for (let i = 0; i < totalQuestions; i++) {
            if (!this.progress.has(i)) {
                this.progress.set(i, {
                    questionId: i,
                    status: 'new',
                    nextReview: Date.now(),
                    reviewCount: 0,
                });
            }
        }
    }

    private loadProgress(): Map<number, CardProgress> {
        if (typeof window === 'undefined') return new Map();

        const stored = localStorage.getItem(this.storageKey);
        if (!stored) return new Map();

        try {
            const data = JSON.parse(stored);
            return new Map(Object.entries(data).map(([k, v]) => [parseInt(k), v as CardProgress]));
        } catch {
            return new Map();
        }
    }

    private saveProgress() {
        if (typeof window === 'undefined') return;

        // Map zu Objekt konvertieren für JSON Storage
        const obj = Object.fromEntries(this.progress.entries());
        localStorage.setItem(this.storageKey, JSON.stringify(obj));
    }

    markAsKnown(questionId: number) {
        const card = this.progress.get(questionId);
        if (card) {
            card.status = 'known';
            // 1 Jahr in Zukunft
            card.nextReview = Date.now() + 365 * 24 * 60 * 60 * 1000;
            card.reviewCount++;
            this.saveProgress();
        }
    }

    markAsReview(questionId: number) {
        const card = this.progress.get(questionId);
        if (card) {
            card.status = 'learning';
            // 10 Minuten
            card.nextReview = Date.now() + 10 * 60 * 1000;
            card.reviewCount++;
            this.saveProgress();
        }
    }

    markAsWrong(questionId: number) {
        const card = this.progress.get(questionId);
        if (card) {
            card.status = 'learning';
            // 2 Minuten (verkürzt, damit man es beim Testen schneller merkt)
            card.nextReview = Date.now() + 2 * 60 * 1000;
            card.reviewCount++;
            this.saveProgress();
        }
    }

    getNextQuestion(): number | null {
        const now = Date.now();
        const allCards = Array.from(this.progress.values());

        // 1. Suche nach fälligen Wiederholungen (Priorität 1!)
        // Filter: Status ist NICHT 'known' UND die Zeit ist abgelaufen (nextReview <= now)
        // UND Status ist NICHT 'new' (die behandeln wir separat zufällig)
        const dueReviews = allCards.filter(card =>
            card.status === 'learning' && card.nextReview <= now
        );

        // Wenn Wiederholungen fällig sind, nimm die, die am längsten wartet
        if (dueReviews.length > 0) {
            dueReviews.sort((a, b) => a.nextReview - b.nextReview);
            return dueReviews[0].questionId;
        }

        // 2. Wenn keine Wiederholungen fällig sind, nimm NEUE Karten
        const newCards = allCards.filter(card => card.status === 'new');

        if (newCards.length > 0) {
            // HIER IST DIE ÄNDERUNG FÜR RANDOMISIERUNG:
            // Wähle eine zufällige Karte aus den neuen Karten
            const randomIndex = Math.floor(Math.random() * newCards.length);
            return newCards[randomIndex].questionId;
        }

        // Wenn weder fällige Reviews noch neue Karten da sind -> null (Fertig oder Warten)
        return null;
    }

    getStats() {
        let known = 0;
        let learning = 0;
        let newCards = 0;

        for (const card of Array.from(this.progress.values())) {
            if (card.status === 'known') known++;
            else if (card.status === 'learning') learning++;
            else newCards++; // new
        }

        return { known, learning, new: newCards };
    }

    reset() {
        localStorage.removeItem(this.storageKey);
        this.progress.clear();
    }
}