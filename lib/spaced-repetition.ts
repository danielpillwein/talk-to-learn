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

        const obj = Object.fromEntries(this.progress.entries());
        localStorage.setItem(this.storageKey, JSON.stringify(obj));
    }

    markAsKnown(questionId: number) {
        const card = this.progress.get(questionId);
        if (card) {
            card.status = 'known';
            card.nextReview = Date.now() + 365 * 24 * 60 * 60 * 1000; // 1 Jahr in der Zukunft
            card.reviewCount++;
            this.saveProgress();
        }
    }

    markAsReview(questionId: number) {
        const card = this.progress.get(questionId);
        if (card) {
            card.status = 'learning';
            card.nextReview = Date.now() + 10 * 60 * 1000; // 10 Minuten
            card.reviewCount++;
            this.saveProgress();
        }
    }

    markAsWrong(questionId: number) {
        const card = this.progress.get(questionId);
        if (card) {
            card.status = 'learning';
            card.nextReview = Date.now() + 2 * 60 * 1000; // 2 Minuten
            card.reviewCount++;
            this.saveProgress();
        }
    }

    getNextQuestion(): number | null {
        const now = Date.now();
        const dueCards: CardProgress[] = [];

        for (const card of Array.from(this.progress.values())) {
            if (card.nextReview <= now && card.status !== 'known') {
                dueCards.push(card);
            }
        }

        if (dueCards.length === 0) return null;

        // Prioritize: new > learning, dann nach nextReview
        dueCards.sort((a, b) => {
            if (a.status !== b.status) {
                if (a.status === 'new') return -1;
                if (b.status === 'new') return 1;
            }
            return a.nextReview - b.nextReview;
        });

        return dueCards[0].questionId;
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
