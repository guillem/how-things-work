// Conway's Game of Life: the still lifes, oscillators and the glider, and why squares must all
// change together.
import { expect, test } from '@playwright/test';
import {
	at,
	decode,
	encode,
	neighbours,
	place,
	population,
	same,
	step,
	stepInPlace
} from '../src/routes/life-on-a-grid/model';

test('a block and a beehive never change', () => {
	const g = place(12, 10, [
		['block', 1, 1],
		['beehive', 5, 5]
	]);
	expect(same(step(g), g)).toBe(true);
});

test('a blinker turns from a row into a column and back, every generation', () => {
	const g = place(9, 9, [['blinker', 3, 4]]);
	const one = step(g);
	expect(same(one, g)).toBe(false);
	expect([at(one, 4, 3), at(one, 4, 4), at(one, 4, 5)]).toEqual([1, 1, 1]);
	expect(same(step(one), g)).toBe(true);
});

test('a glider walks one square across and one down every four generations', () => {
	const g = place(20, 20, [['glider', 2, 2]]);
	let h = g;
	for (let i = 0; i < 4; i++) h = step(h);
	expect(same(h, place(20, 20, [['glider', 3, 3]]))).toBe(true);
	expect(population(h)).toBe(5);
});

test('every square counts its eight neighbours, wrapping round the edges', () => {
	const g = place(5, 5, [['block', 4, 4]]);
	// The block straddles all four corners; the square at (0, 0) sees its three partners.
	expect(neighbours(g, 0, 0)).toBe(3);
});

test('updating one square at a time gives the wrong answer', () => {
	const g = place(9, 9, [['blinker', 3, 4]]);
	expect(same(stepInPlace(g), step(g))).toBe(false);
});

test('the same seed always gives the same future', () => {
	let a = place(30, 30, [['rpentomino', 14, 14]]);
	let b = place(30, 30, [['rpentomino', 14, 14]]);
	for (let i = 0; i < 50; i++) {
		a = step(a);
		b = step(b);
	}
	expect(same(a, b)).toBe(true);
});

test('changing the birth number changes everything: with birth on 2, a block bursts', () => {
	const g = place(16, 16, [['block', 7, 7]]);
	const b2 = step(g, { birth: [2], survive: [2, 3] });
	expect(same(b2, g)).toBe(false);
	expect(population(b2)).toBeGreaterThan(4);
});

test('a painted grid survives being stored and read back', () => {
	const g = place(10, 8, [['glider', 1, 1]]);
	expect(same(decode(encode(g), 10, 8), g)).toBe(true);
});
