import { browser } from '$app/env';

export type Status = 'new' | 'started' | 'done';

export interface TopicProgress {
	/** id of the step the reader was last on, to continue from */
	step: string;
	/** true once the reader has reached the last step (sticky) */
	done: boolean;
}

const STORAGE_KEY = 'progress';

function read(): Record<string, TopicProgress> {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		const parsed: unknown = raw ? JSON.parse(raw) : {};
		return parsed && typeof parsed === 'object' ? (parsed as Record<string, TopicProgress>) : {};
	} catch {
		return {}; // storage unavailable or corrupt
	}
}

/**
 * Reading progress, kept in this browser's `localStorage` only. Pages are
 * prerendered without it, so it is loaded after hydration (`load()` in
 * `onMount`) and every topic reads as new until then.
 */
class ProgressState {
	topics = $state<Record<string, TopicProgress>>({});
	loaded = $state(false);

	constructor() {
		if (!browser) return;
		// Keep several open tabs in agreement.
		window.addEventListener('storage', (event) => {
			if (event.key === STORAGE_KEY || event.key === null) this.topics = read();
		});
	}

	load() {
		if (!browser || this.loaded) return;
		this.topics = read();
		this.loaded = true;
	}

	status(slug: string): Status {
		const p = this.topics[slug];
		return !p ? 'new' : p.done ? 'done' : 'started';
	}

	/** Record that the reader is on `step`; `last` marks the explainer done. */
	visit(slug: string, step: string, last: boolean) {
		this.load();
		const done = (this.topics[slug]?.done ?? false) || last;
		this.topics[slug] = { step, done };
		this.save();
	}

	clear() {
		this.topics = {};
		try {
			localStorage.removeItem(STORAGE_KEY);
		} catch {
			/* storage unavailable */
		}
	}

	private save() {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(this.topics));
		} catch {
			/* storage unavailable */
		}
	}
}

export const progress = new ProgressState();
