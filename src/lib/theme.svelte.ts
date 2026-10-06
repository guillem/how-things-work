import { browser } from '$app/env';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'theme';

/**
 * Site-wide colour theme. The initial value is applied by an inline script in
 * `app.html` (before the first paint); this class keeps the `data-theme`
 * attribute, `localStorage` and the OS preference in sync afterwards.
 */
class ThemeState {
	current = $state<Theme>('light');
	/** true once the visitor has chosen a theme explicitly */
	explicit = $state(false);

	constructor() {
		if (!browser) return;
		this.current = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
		try {
			const saved = localStorage.getItem(STORAGE_KEY);
			this.explicit = saved === 'light' || saved === 'dark';
		} catch {
			/* storage unavailable */
		}
		const query = window.matchMedia('(prefers-color-scheme: dark)');
		query.addEventListener('change', (event) => {
			if (!this.explicit) this.apply(event.matches ? 'dark' : 'light');
		});
	}

	private apply(theme: Theme) {
		this.current = theme;
		document.documentElement.dataset.theme = theme;
	}

	set(theme: Theme) {
		this.apply(theme);
		this.explicit = true;
		try {
			localStorage.setItem(STORAGE_KEY, theme);
		} catch {
			/* storage unavailable */
		}
	}

	/** Go back to following the operating system preference. */
	reset() {
		this.explicit = false;
		try {
			localStorage.removeItem(STORAGE_KEY);
		} catch {
			/* storage unavailable */
		}
		this.apply(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
	}

	toggle() {
		this.set(this.current === 'dark' ? 'light' : 'dark');
	}
}

export const theme = new ThemeState();
