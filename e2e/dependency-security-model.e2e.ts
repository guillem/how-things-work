import { expect, test } from '@playwright/test';
import deepmerge from 'deepmerge';

type Payload = { securityMarker?: string; __proto__?: { securityMarker?: string } };
const payload = (): Payload => JSON.parse('{"__proto__":{"securityMarker":"poisoned"}}') as Payload;

function expectUnpoisoned(result: Payload) {
	expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
	expect(result.securityMarker).toBeUndefined();
	expect(Object.prototype).not.toHaveProperty('securityMarker');
}

test('deepmerge does not invoke __proto__ while copying target properties', () => {
	const result = deepmerge(payload(), {});
	expectUnpoisoned(result);
	expect(Object.getOwnPropertyDescriptor(result, '__proto__')?.value).toEqual({
		securityMarker: 'poisoned'
	});
});

test('deepmerge does not invoke __proto__ when merging into a null-prototype target', () => {
	const target = Object.create(null) as Payload;
	const result = deepmerge(target, payload());
	expectUnpoisoned(result);
	expect(Object.hasOwn(result, '__proto__')).toBe(true);
});

test('deepmerge recursive merging of own __proto__ properties creates data properties', () => {
	const result = deepmerge(payload(), payload());
	expectUnpoisoned(result);
	expect(Object.getOwnPropertyDescriptor(result, '__proto__')?.value).toEqual({
		securityMarker: 'poisoned'
	});
});

test('deepmerge rejects inherited __proto__ and handles nested attack data safely', () => {
	expectUnpoisoned(deepmerge({}, payload()));
	const result = deepmerge({ nested: payload() }, { nested: payload() });
	expectUnpoisoned(result.nested);
});

test('deepmerge preserves Svelte configuration merge behavior', () => {
	const preprocess = () => 'preprocessed';
	const result = deepmerge(
		{ compilerOptions: { dev: true }, extensions: ['.old'], preprocess },
		{ compilerOptions: { css: 'external' }, extensions: ['.svelte'] },
		{ arrayMerge: (_target: unknown[], source: unknown[]) => source }
	);
	expect(result.compilerOptions).toEqual({ dev: true, css: 'external' });
	expect(result.extensions).toEqual(['.svelte']);
	expect(result.preprocess).toBe(preprocess);
});

test('deepmerge retains symbols, cloning, special values and custom merges', () => {
	const symbol = Symbol('configuration');
	const date = new Date('2026-11-03');
	const source = { [symbol]: { enabled: true }, date, list: [1] };
	const result = deepmerge({}, source);
	expect(result[symbol]).toEqual(source[symbol]);
	expect(result[symbol]).not.toBe(source[symbol]);
	expect(result.date).toBe(date);
	expect(deepmerge({ list: [0] }, source).list).toEqual([0, 1]);
	expect(
		deepmerge(
			{ settings: { x: 1 } },
			{ settings: { x: 2 } },
			{
				customMerge: (key) => (key === 'settings' ? () => ({ x: 3 }) : undefined)
			}
		).settings
	).toEqual({ x: 3 });
});
