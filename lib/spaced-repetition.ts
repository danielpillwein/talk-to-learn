// Spaced Repetition Logic for Talk-to-Learn

export type CardStatus = 'new' | 'learning' | 'known';

export interface CardProgress {
    questionId: number;
    status: CardStatus;
    nextReview: number; // timestamp in ms
    reviewCount: number;
}

export class SpacedRepetitionManager {
    private storageKey: string;
    private progress: Map<number, CardProgress>;

    // NEU: filename wird übergeben, um eindeutigen Storage Key zu erzeugen
    constructor(totalQuestions: number, filename: string) {
        this.storageKey = `talk-to-learn-progress-${filename}`;
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
        const obj = Object.fromEntries(this.progress.entries());
        localStorage.setItem(this.storageKey, JSON.stringify(obj));
    }

    // Hilfsmethode: Statische Abfrage der Stats für die Übersicht (ohne Instanziierung der ganzen Logik)
    static getStoredStats(filename: string, totalQuestions: number) {
        if (typeof window === 'undefined') return { known: 0, learning: 0, new: totalQuestions };

        const key = `talk-to-learn-progress-${filename}`;
        const stored = localStorage.getItem(key);

        let known = 0;
        let learning = 0;

        if (stored) {
            try {
                const data = JSON.parse(stored);
                Object.values(data).forEach((card: any) => {
                    if (card.status === 'known') known++;
                    if (card.status === 'learning') learning++;
                });
            } catch (e) { console.error(e) }
        }

        // Alles was nicht known oder learning ist, ist 'new'
        // Aber Achtung: Wenn neue Fragen zur CSV hinzugefügt wurden, sind die noch nicht im Storage.
        // Daher: New = Total - (Known + Learning)
        const newCards = Math.max(0, totalQuestions - known - learning);

        return { known, learning, new: newCards };
    }

    markAsKnown(questionId: number) {
        const card = this.progress.get(questionId);
        if (card) {
            card.status = 'known';
            card.nextReview = Date.now() + 365 * 24 * 60 * 60 * 1000;
            card.reviewCount++;
            this.saveProgress();
        }
    }

    markAsReview(questionId: number) {
        const card = this.progress.get(questionId);
        if (card) {
            card.status = 'learning';
            card.nextReview = Date.now() + 10 * 60 * 1000;
            card.reviewCount++;
            this.saveProgress();
        }
    }

    markAsWrong(questionId: number) {
        const card = this.progress.get(questionId);
        if (card) {
            card.status = 'learning';
            card.nextReview = Date.now() + 2 * 60 * 1000;
            card.reviewCount++;
            this.saveProgress();
        }
    }

    getNextQuestion(): number | null {
        const now = Date.now();
        const allCards = Array.from(this.progress.values());

        const dueReviews = allCards.filter(card =>
            card.status === 'learning' && card.nextReview <= now
        );

        if (dueReviews.length > 0) {
            dueReviews.sort((a, b) => a.nextReview - b.nextReview);
            return dueReviews[0].questionId;
        }

        const newCards = allCards.filter(card => card.status === 'new');
        if (newCards.length > 0) {
            const randomIndex = Math.floor(Math.random() * newCards.length);
            return newCards[randomIndex].questionId;
        }

        return null;
    }

    getStats() {
        let known = 0;
        let learning = 0;
        let newCards = 0;

        for (const card of Array.from(this.progress.values())) {
            if (card.status === 'known') known++;
            else if (card.status === 'learning') learning++;
            else newCards++;
        }

        return { known, learning, new: newCards };
    }

    reset() {
        localStorage.removeItem(this.storageKey);
        this.progress.clear();
    }
}