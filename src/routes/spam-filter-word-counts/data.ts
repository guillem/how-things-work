/**
 * The marked messages: a hand-checked subset of the SMS Spam Collection (Almeida and Gómez Hidalgo,
 * UCI Machine Learning Repository, CC BY 4.0), built by
 * scripts/data/spam-filter-word-counts/build.mjs.
 */
import raw from './messages.json';
import type { Message } from './model';

export const MESSAGES: Message[] = (raw as [number, number, string][]).map(([id, spam, text]) => ({
	id,
	spam: spam === 1,
	text
}));

export { MINE } from './mine';
