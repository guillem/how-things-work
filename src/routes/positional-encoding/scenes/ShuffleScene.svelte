<script lang="ts">
	/**
	 * One attention head over "the dog bit the man", as written (top) and in the current order
	 * (bottom, after the reader's shuffles). Under each word, its output vector as six bars; a line
	 * links each word to its new place, and a mark under it says whether its output stayed the same.
	 * Without the mask every output only moves; with the causal mask (`step.hints.mask` and the
	 * `mask` toggle) a word whose set of predecessors changed gets a different output.
	 *
	 * The words light up one after another (a function of t): the lit word's link is drawn bold and,
	 * with the mask, the words it cannot see are dimmed in both rows. Under reduced motion, dog.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { cycle, Label } from '#lib/draw/index.ts';
	import { attention, embed, HEAD, order, WORDS } from '../position';
	import { fix, num } from './shared';

	let { step, t, params, reduced }: StageProps = $props();

	const masked = $derived(
		(step.controls ?? []).some((c) => c.id === 'mask')
			? params.mask !== false
			: step.hints?.mask === true
	);
	const presses = $derived(Math.max(0, Math.round(num(params.shuffle, 0))));
	const perm = $derived(order(presses));

	const xs = WORDS.map(embed);
	const original = $derived(attention(xs, HEAD, masked).out);
	const now = $derived(
		attention(
			perm.map((i) => xs[i]),
			HEAD,
			masked
		).out
	);
	/** For each word (index in WORDS): its place now, and how far its output moved. */
	const placeOf = $derived(WORDS.map((_, i) => perm.indexOf(i)));
	const change = $derived(
		WORDS.map((_, i) => Math.max(...now[placeOf[i]].map((v, c) => Math.abs(v - original[i][c]))))
	);
	const largest = $derived(Math.max(...change));
	const same = (c: number) => c < 5e-13;

	// ---- layout
	const X0 = 210;
	const DX = 150;
	const CW = 96;
	const CH = 30;
	const A = { chip: 72, mid: 170 };
	const B = { chip: 318, mid: 416 };
	const BW = 13;
	const GAP = 3;
	// The bars' scale: the largest output, with and without the mask, over the first shuffles.
	const ALL = [false, true].flatMap((m) =>
		[0, 1, 2, 3, 4, 5].flatMap((n) =>
			attention(
				order(n).map((i) => xs[i]),
				HEAD,
				m
			).out.flat()
		)
	);
	const SCALE = 44 / Math.max(...ALL.map(Math.abs));
	const cx = (place: number) => X0 + place * DX;

	function bars(v: readonly number[], x: number, mid: number) {
		let d = '';
		const left = x - (v.length * (BW + GAP) - GAP) / 2;
		v.forEach((val, c) => {
			const h = val * SCALE;
			if (Math.abs(h) < 0.4) return;
			const x0 = left + c * (BW + GAP);
			d += `M${x0.toFixed(1)} ${(h > 0 ? mid - h : mid).toFixed(1)}h${BW}v${Math.abs(h).toFixed(1)}h${-BW}Z`;
		});
		return d;
	}

	// Each word glides to its new place in the bottom row.
	const placeTweens = WORDS.map((_, i) => new Tween(i, { duration: 800, easing: cubicInOut }));
	$effect(() => {
		const places = placeOf;
		untrack(() => {
			for (const [i, p] of places.entries())
				void placeTweens[i].set(p, { duration: reduced ? 0 : 800 });
		});
	});
	const bx = $derived(placeTweens.map((tw) => cx(tw.current)));

	// ---- the lit word
	const lit = $derived(reduced ? 1 : Math.floor(cycle(t, 12.5) * WORDS.length));
	/** Can the lit word see word i, in the row as written (A) or now (B)? */
	const seesA = (i: number) => !masked || i <= lit;
	const seesB = (i: number) => !masked || placeOf[i] <= placeOf[lit];

	const link = (i: number) => {
		const x1 = cx(i);
		const y1 = A.mid + 54;
		const x2 = bx[i];
		const y2 = B.chip - 6;
		const my = (y1 + y2) / 2;
		return `M${x1.toFixed(1)} ${y1}C${x1.toFixed(1)} ${my} ${x2.toFixed(1)} ${my} ${x2.toFixed(1)} ${y2}`;
	};
	const sentence = $derived(perm.map((i) => WORDS[i]).join(' '));
	const kept = $derived(change.filter(same).length);
</script>

<g>
	<Label
		x={24}
		y={36}
		anchor="start"
		size={15}
		weight={650}
		text={masked
			? 'One attention head, with the causal mask'
			: 'One attention head, no mask: every word sees every word'}
	/>

	<!-- row A: as written -->
	<Label x={24} y={A.chip + 20} anchor="start" size={13} weight={600} text="As written" />
	<Label x={24} y={A.mid + 4} anchor="start" size={11} muted text="output" />
	<line
		x1={X0 - 60}
		y1={A.mid}
		x2={cx(4) + 60}
		y2={A.mid}
		stroke="var(--stage-line)"
		stroke-width="1"
	/>
	{#each WORDS as w, i (i)}
		<g opacity={seesA(i) ? 1 : 0.35}>
			<rect
				x={cx(i) - CW / 2}
				y={A.chip}
				width={CW}
				height={CH}
				rx="6"
				fill="var(--surface)"
				stroke={i === lit ? 'var(--pe-out)' : 'var(--border)'}
				stroke-width={i === lit ? 2.5 : 1.2}
			/>
			<Label x={cx(i)} y={A.chip + 20} size={14} halo={false} text={w} />
			<path d={bars(original[i], cx(i), A.mid)} fill="var(--pe-out)" opacity="0.85" />
		</g>
	{/each}

	<!-- links: each word to its place now -->
	{#each WORDS.keys() as i (i)}
		<path
			d={link(i)}
			fill="none"
			stroke={i === lit ? 'var(--pe-out)' : 'var(--stage-line)'}
			stroke-width={i === lit ? 2.5 : 1.2}
			stroke-dasharray={i === lit ? undefined : '4 4'}
			opacity={i === lit ? 0.9 : 0.6}
		/>
	{/each}

	<!-- row B: now -->
	<Label
		x={24}
		y={B.chip + 20}
		anchor="start"
		size={13}
		weight={600}
		text={presses === 0 ? 'Now (shuffle!)' : 'Now'}
	/>
	<Label x={24} y={B.mid + 4} anchor="start" size={11} muted text="output" />
	<line
		x1={X0 - 60}
		y1={B.mid}
		x2={cx(4) + 60}
		y2={B.mid}
		stroke="var(--stage-line)"
		stroke-width="1"
	/>
	{#each WORDS as w, i (i)}
		<g opacity={seesB(i) ? 1 : 0.35}>
			<rect
				x={bx[i] - CW / 2}
				y={B.chip}
				width={CW}
				height={CH}
				rx="6"
				fill="var(--surface)"
				stroke={i === lit ? 'var(--pe-out)' : 'var(--border)'}
				stroke-width={i === lit ? 2.5 : 1.2}
			/>
			<Label x={bx[i]} y={B.chip + 20} size={14} halo={false} text={w} />
			<path d={bars(now[placeOf[i]], bx[i], B.mid)} fill="var(--pe-out)" opacity="0.85" />
		</g>
	{/each}
	{#each WORDS.keys() as i (i)}
		<Label
			x={bx[i]}
			y={B.mid + 72}
			size={12}
			weight={600}
			color={same(change[i]) ? 'var(--pe-same)' : 'var(--pe-changed)'}
			text={same(change[i]) ? '✓ same output' : `changed by ${fix(change[i])}`}
		/>
	{/each}

	<!-- readouts -->
	<Readout id="sentence" order={1} label="Now" value={sentence}>
		<Label x={24} y={548} anchor="start" size={14} text="Now: “{sentence}”" weight={600} />
	</Readout>
	<Readout
		id="largest"
		order={2}
		label="Outputs that stayed the same"
		value="{kept} of 5"
		note={same(largest) ? 'each one only moved with its word' : `largest change ${fix(largest)}`}
	>
		<Label
			x={24}
			y={574}
			anchor="start"
			size={13}
			muted={same(largest)}
			color={same(largest) ? undefined : 'var(--pe-changed)'}
			text={same(largest)
				? `${kept} of 5 outputs the same: each one only moved with its word`
				: `${kept} of 5 outputs the same; the largest change is ${fix(largest)}`}
		/>
	</Readout>
	{#if masked}
		<Readout id="mask-key">
			<Label
				x={936}
				y={36}
				anchor="end"
				size={12}
				muted
				text="dimmed: words the lit word cannot see"
			/>
		</Readout>
	{/if}
</g>
