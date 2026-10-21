/**
 * The books the machine reads (in the order "read more books" adds them) and the story of the
 * guessing game, which it never reads. Text from Project Gutenberg (public domain); built by
 * scripts/data/next-word-guessing-game/build.mjs.
 */
import books from './books.json';
import type { Book } from './model';

const all: Book[] = books;
/** The shelf: four Beatrix Potter tales, then Aesop’s fables in three parts. */
export const LIBRARY: Book[] = all.slice(0, 7);
/** The Tale of Jemima Puddle-Duck: the story the reader and the machine both guess in. */
export const STORY: Book = all[7];

export { STOPS, type Stop } from './stops';
