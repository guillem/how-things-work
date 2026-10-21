<script lang="ts">
	/**
	 * The code wheel: the ordinary alphabet on the outer ring, the same letters on an inner ring
	 * that turns (by the step's slider, or by dragging the ring). The reader's message is coded
	 * one letter at a time, every letter stepping the same number of places along (`turnLetters`
	 * in the model).
	 *
	 * Phases (`step.hints.phase`):
	 * - `wheel`: the inner ring turned by `params.turn`; a curved arrow outside the ring counts
	 *   the places from each letter of the message to its secret letter.
	 * - `message`: the same, with a text box for the reader's message (`params.msg`).
	 * - `friend`: the friend's wheel, turned by `params.back`, reading the secret message back;
	 *   it reads only when the friend's turn is the reader's.
	 * - `next`: X, Y and Z going round to A, B and C, as a clock goes round past 12.
	 */
	import { onDestroy } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { clamp, Label, polar, startDrag, TAU, type Point } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { ALPHABET, letterIndex, turnBack, turnLetters } from '../model';
	import { messageOf, turnOf, wrap } from '../state';
	import Letters from './Letters.svelte';
	import MessageInput from './MessageInput.svelte';

	let { step, t, params, setParam }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'wheel'));
	const friend = $derived(phase === 'friend');
	const msg = $derived(phase === 'next' ? 'XYZ' : messageOf(params));
	const turn = $derived(phase === 'next' ? 3 : turnOf(params));
	const back = $derived(Math.min(25, Math.max(0, Math.round(Number(params.back ?? 0)) || 0)));
	const ringAt = $derived(friend ? back : turn);
	const ring = Tween.of(() => ringAt, { duration: 700, easing: cubicInOut });

	const secret = $derived(turnLetters(msg, turn));
	const reading = $derived(turnBack(secret, back));
	const right = $derived(back === turn);

	// ---- the letter being coded (or read) now: a new one every PACE seconds -------------------
	const PACE = 1.1;
	const letterAt = $derived([...msg].flatMap((ch, i) => (letterIndex(ch) >= 0 ? [i] : [])));
	const cursor = $derived(letterAt.length ? letterAt[Math.floor(t / PACE) % letterAt.length] : -1);
	/** How far the curved arrow has grown for the current letter (0 → 1). */
	const hop = $derived(clamp((t % PACE) / (PACE * 0.5)));
	const mod26 = (n: number) => ((n % 26) + 26) % 26;
	/** Outer-ring letter, inner-ring letter of the pair being looked at. */
	const pair = $derived.by(() => {
		if (cursor < 0) return null;
		if (friend) {
			const s = letterIndex(secret[cursor]);
			return { outer: mod26(s - back), inner: s };
		}
		const p = letterIndex(msg[cursor]);
		return { outer: p, inner: mod26(p + turn) };
	});

	// ---- geometry ------------------------------------------------------------------------------
	const C = { x: 282, y: 300 };
	const R_OUT = 250;
	const R_MID = 194;
	const R_IN = 126;
	const R_PLAIN = 222;
	const R_SECRET = 160;
	const R_ARC = 264;
	const STEP = TAU / 26;
	const outerAngle = (i: number) => -Math.PI / 2 + i * STEP;
	const innerAngle = (j: number) => -Math.PI / 2 + (j - ring.current) * STEP;
	const at = (r: number, a: number) => polar(C.x, C.y, r, a);
	const fmt = (p: Point) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
	function arc(r: number, a0: number, a1: number) {
		const large = a1 - a0 > Math.PI ? 1 : 0;
		return `M${fmt(at(r, a0))} A${r},${r} 0 ${large} 1 ${fmt(at(r, a1))}`;
	}
	const ringPath = `M${C.x - R_MID},${C.y} a${R_MID},${R_MID} 0 1 0 ${2 * R_MID},0 a${R_MID},${R_MID} 0 1 0 ${-2 * R_MID},0 Z M${C.x - R_IN},${C.y} a${R_IN},${R_IN} 0 1 1 ${2 * R_IN},0 a${R_IN},${R_IN} 0 1 1 ${-2 * R_IN},0 Z`;

	// the curved arrow: from the message letter, `turn` places along the outer ring
	const showArc = $derived((phase === 'wheel' || phase === 'next') && pair !== null);
	const arcFrom = $derived(pair ? outerAngle(pair.outer) - STEP * 0.32 : 0);
	const arcTo = $derived(pair ? outerAngle(pair.outer) + STEP * (turn * hop - 0.32) : 0);

	const tab = $derived(at(R_MID - 4, innerAngle(0)));
	const tabIn = $derived(at(R_MID - 18, innerAngle(0)));

	// ---- turning the ring by hand ----------------------------------------------------------------
	const draggable = $derived(phase === 'wheel' || friend);
	const ringParam = $derived(friend ? 'back' : 'turn');
	function setRing(v: number) {
		const n = mod26(v);
		if (!friend && n === 0) return; // the reader's turn is 1 to 25
		setParam(ringParam, n);
	}
	let stop: (() => void) | null = null;
	onDestroy(() => stop?.());
	function onDown(e: PointerEvent) {
		const start = ringAt;
		let last: number | null = null;
		let total = 0;
		stop = startDrag(
			e,
			(p) => {
				const a = Math.atan2(p.y - C.y, p.x - C.x);
				if (last !== null) {
					const d = a - last;
					total += Math.atan2(Math.sin(d), Math.cos(d));
				}
				last = a;
				// turning the ring clockwise brings earlier letters under the outer ones
				setRing(start - Math.round(total / STEP));
			},
			() => (stop = null)
		);
	}
	function onKey(e: KeyboardEvent) {
		const d = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
		if (d === undefined) return;
		e.preventDefault();
		let v = ringAt + d;
		if (!friend && mod26(v) === 0) v += d;
		setRing(v);
	}

	// ---- the panel on the right -------------------------------------------------------------------
	const PX = 586;
	const SIZE = 30;
	const LH = 39;
	const shown = $derived(friend ? secret : msg);
	const lines = $derived(Math.max(1, wrap(shown, 18).length));
	const topY = $derived(phase === 'message' ? 150 : 74);
	const secondY = $derived(topY + 42 + (lines - 1) * LH + 56);
	const pairY = $derived(secondY + 42 + (lines - 1) * LH + 112);
	const firstLabel = $derived(friend ? 'Secret message' : 'Your message');
	const secondLabel = $derived(friend ? 'Your friend reads' : 'Secret message');
	const second = $derived(friend ? reading : secret);
	const pairFrom = $derived(pair ? (friend ? ALPHABET[pair.inner] : ALPHABET[pair.outer]) : '');
	const pairTo = $derived(pair ? (friend ? ALPHABET[pair.outer] : ALPHABET[pair.inner]) : '');
	const places = (n: number) => `${n} ${n === 1 ? 'place' : 'places'}`;
	const caption = $derived(
		phase === 'next'
			? 'round from Z back to A'
			: friend
				? back === 0
					? 'ring not turned'
					: `${places(back)} back`
				: `${places(turn)} along the alphabet`
	);
</script>

<g class="wheel">
	<!-- the outer ring: the ordinary alphabet -->
	<circle cx={C.x} cy={C.y} r={R_OUT} fill="var(--sc-ring-outer)" stroke="var(--stage-line)" />
	<!-- the inner ring: the same letters, turned -->
	{#if draggable}
		<path
			d={ringPath}
			fill="var(--sc-ring-inner)"
			fill-rule="evenodd"
			stroke="var(--stage-line)"
			class="sc-grab"
			role="slider"
			tabindex="0"
			aria-label={friend ? 'Your friend’s inner ring' : 'The inner ring'}
			aria-valuemin={friend ? 0 : 1}
			aria-valuemax={25}
			aria-valuenow={ringAt}
			onpointerdown={onDown}
			onkeydown={onKey}
		/>
	{:else}
		<path d={ringPath} fill="var(--sc-ring-inner)" fill-rule="evenodd" stroke="var(--stage-line)" />
	{/if}
	<circle cx={C.x} cy={C.y} r={R_IN} fill="var(--stage-bg)" stroke="var(--stage-line)" />

	<!-- the pair being looked at -->
	{#if pair}
		{@const po = at(R_PLAIN, outerAngle(pair.outer))}
		{@const pi = at(R_SECRET, innerAngle(pair.inner))}
		<circle cx={po.x} cy={po.y} r="23" fill="var(--sc-hi)" opacity="0.75" />
		<circle cx={pi.x} cy={pi.y} r="20" fill="none" stroke="var(--sc-secret)" stroke-width="3.5" />
	{/if}

	<!-- the letters -->
	{#each ALPHABET as ch, i (ch)}
		{@const p = at(R_PLAIN, outerAngle(i))}
		<text
			x={p.x}
			y={p.y + 10}
			text-anchor="middle"
			font-size="29"
			font-weight="700"
			fill="var(--stage-ink)"
			style:pointer-events="none">{ch}</text
		>
	{/each}
	{#each ALPHABET as ch, j (ch)}
		{@const p = at(R_SECRET, innerAngle(j))}
		<text
			x={p.x}
			y={p.y + 9}
			text-anchor="middle"
			font-size="26"
			font-weight="700"
			fill="var(--sc-secret)"
			style:pointer-events="none">{ch}</text
		>
	{/each}
	<!-- a tab on the inner ring, so its turning shows -->
	<line
		x1={tab.x}
		y1={tab.y}
		x2={tabIn.x}
		y2={tabIn.y}
		stroke="var(--sc-secret)"
		stroke-width="5"
		stroke-linecap="round"
		opacity="0.6"
		style:pointer-events="none"
	/>

	<!-- the hub: how far the ring is turned -->
	<text x={C.x} y={C.y - 24} text-anchor="middle" font-size="16" fill="var(--stage-ink-muted)"
		>{friend ? 'friend’s turn' : 'turn'}</text
	>
	<text
		x={C.x}
		y={C.y + 30}
		text-anchor="middle"
		font-size="54"
		font-weight="800"
		fill="var(--sc-secret)"
		style:font-variant-numeric="tabular-nums">{ringAt}</text
	>

	<!-- the curved arrow: so many places along the alphabet -->
	{#if showArc && turn * hop > 0.15}
		<path
			d={arc(R_ARC, arcFrom, arcTo)}
			fill="none"
			stroke="var(--sc-hi-ink)"
			stroke-width="3.5"
			stroke-linecap="round"
			marker-end="url(#arrowhead)"
		/>
	{/if}

	<!-- the panel: the message, the secret message, the letter being coded -->
	{#if phase === 'message'}
		<MessageInput
			x={PX - 6}
			y={46}
			w={352}
			value={typeof params.msg === 'string' ? params.msg : msg}
			label="Your message"
			placeholder="Type a message"
			oninput={(v: string) => setParam('msg', v)}
		/>
		<Readout id="sc-secret" order={2} label="Secret message" value={secret || '–'}>
			<Label
				x={PX}
				y={topY - 14}
				text="Secret message"
				anchor="start"
				size={16}
				muted
				halo={false}
			/>
			<Letters
				x={PX}
				y={topY + 28}
				text={secret}
				width={18}
				size={SIZE}
				lineHeight={LH}
				color="var(--sc-secret)"
				mark={cursor}
			/>
		</Readout>
	{:else}
		<Readout id="sc-first" order={1} label={firstLabel} value={shown || '–'}>
			<Label x={PX} y={topY - 14} text={firstLabel} anchor="start" size={16} muted halo={false} />
			<Letters
				x={PX}
				y={topY + 28}
				text={shown}
				width={18}
				size={SIZE}
				lineHeight={LH}
				color={friend ? 'var(--sc-secret)' : 'var(--stage-ink)'}
				mark={cursor}
			/>
		</Readout>
		<Readout
			id="sc-second"
			order={2}
			label={secondLabel}
			value={(second || '–') + (friend ? (right ? ' (it reads!)' : ' (nonsense)') : '')}
			color={friend && right ? 'var(--sc-good)' : undefined}
		>
			<Label
				x={PX}
				y={secondY - 14}
				text={secondLabel}
				anchor="start"
				size={16}
				muted
				halo={false}
			/>
			<Letters
				x={PX}
				y={secondY + 28}
				text={second}
				width={18}
				size={SIZE}
				lineHeight={LH}
				color={friend ? (right ? 'var(--sc-good)' : 'var(--stage-ink-muted)') : 'var(--sc-secret)'}
				mark={cursor}
			/>
		</Readout>
	{/if}

	{#if pair}
		{@const py = phase === 'message' ? topY + 42 + (lines - 1) * LH + 120 : pairY}
		<Readout id="sc-pair" order={3} label="Now" value="{pairFrom} becomes {pairTo}: {caption}">
			<text
				x={PX + 52}
				y={py}
				text-anchor="middle"
				font-size="68"
				font-weight="800"
				fill={friend ? 'var(--sc-secret)' : 'var(--stage-ink)'}
				style:font-family="var(--font-mono)">{pairFrom}</text
			>
			<line
				x1={PX + 104}
				y1={py - 24}
				x2={PX + 176}
				y2={py - 24}
				stroke="var(--stage-ink-muted)"
				stroke-width="3.5"
				marker-end="url(#arrowhead)"
			/>
			<text
				x={PX + 230}
				y={py}
				text-anchor="middle"
				font-size="68"
				font-weight="800"
				fill={friend ? 'var(--stage-ink)' : 'var(--sc-secret)'}
				style:font-family="var(--font-mono)">{pairTo}</text
			>
			<Label x={PX} y={py + 42} text={caption} anchor="start" size={18} muted halo={false} />
		</Readout>
	{/if}

	{#if friend}
		<Readout id="sc-status" order={4}>
			<Label
				x={PX}
				y={pairY + 96}
				text={right ? '✓ It reads!' : 'Still nonsense: try another turn'}
				anchor="start"
				size={right ? 22 : 17}
				weight={700}
				color={right ? 'var(--sc-good)' : 'var(--stage-ink-muted)'}
				halo={false}
			/>
		</Readout>
	{/if}
</g>

<style>
	.sc-grab {
		cursor: grab;
		outline: none;
	}
	.sc-grab:focus-visible {
		stroke: var(--focus);
		stroke-width: 3;
	}
</style>
