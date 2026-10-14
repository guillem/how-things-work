/** Fixed colours of the respiratory chain's complexes (white text reads on all of them, in both themes). */
export const CHAIN = {
	I: '#4c6ef5',
	II: '#0ca678',
	III: '#ae3ec9',
	IV: '#e8590c',
	cytc: '#e03131',
	q: '#e67700',
	synthase: '#ef7a5a'
} as const;

/** Electron carriers and GTP: fixed colours that read on both stage backgrounds, with white text. */
export const CARRIER = {
	nadh: '#1c7ed6',
	fadh2: '#2f9e44',
	gtp: '#f97316',
	grey: '#6c757d'
} as const;
