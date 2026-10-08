<script lang="ts">
	/**
	 * A text message sent through a noisy channel (each bit flips with chance
	 * `params.noise` %), without coding and with the (7, 4) Hamming code.
	 *
	 * Left: the message sent; for each lane, a strip of every bit sent with a
	 * tick at each flipped bit (coded lane: amber if its block was repaired,
	 * red if the block took two or more hits), the text as received with wrong
	 * letters marked, and the count of intact letters. Right: the chance a
	 * letter arrives intact against the noise, from the formulas, with this
	 * message's actual results as dots.
	 *
	 * Phases (`step.hints.phase`): `intro` shows only the uncoded lane and
	 * curve; `compare` both; `cost` adds the bits each lane sent.
	 *
	 * The flips come from fixed random numbers per bit (`dice` in the model):
	 * raising the noise only adds flips. "Send again" (`params.resend`) changes
	 * the seed and replays the arrival: the letters arrive left to right over
	 * ARRIVE_S seconds after the step starts or the button is pressed (restart
	 * pattern of logic-gates' RippleScene). Reduced motion, or a paused stage,
	 * shows everything arrived.
	 */
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { untrack } from 'svelte';
	import { Axes, clamp, linePath, scale } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { charOkCoded, charOkPlain, sendCoded, sendPlain, type Transmission } from '../hamming';

	let { step, t, params, reduced, playing }: StageProps = $props();

	const MESSAGE = 'GREETINGS FROM SATURN. ALL INSTRUMENTS WORKING.';
	const BREAK = 23;
	const ARRIVE_S = 2.2;

	const phase = $derived(String(step.hints?.phase ?? 'compare'));
	const p = $derived(clamp(Number(params.noise ?? 5), 0, 25) / 100);
	const sends = $derived(Number(params.resend ?? 0));

	const plain = $derived(sendPlain(MESSAGE, p, 1000 + sends * 2));
	const coded = $derived(sendCoded(MESSAGE, p, 1001 + sends * 2));

	const showCoded = new Tween(0, { duration: 700, easing: cubicInOut });
	const showCost = new Tween(0, { duration: 700, easing: cubicInOut });
	$effect(() => {
		const c = phase === 'intro' ? 0 : 1;
		const k = phase === 'cost' ? 1 : 0;
		untrack(() => {
			showCoded.set(c, { duration: reduced ? 0 : 700 });
			showCost.set(k, { duration: reduced ? 0 : 700 });
		});
	});

	// ---- arrival timeline -------------------------------------------------------------
	let lastKey = '';
	let t0 = 0;
	let lastT = 0;
	const arrived = $derived.by(() => {
		const key = `${step.id}|${sends}`;
		if (key !== lastKey) {
			t0 = lastKey === '' || lastKey.split('|')[0] !== step.id ? 0 : t;
			lastKey = key;
		}
		if (t < lastT || t < t0) t0 = Math.min(t0, t, 0);
		lastT = t;
		return reduced || !playing ? 1 : clamp((t - t0 - 0.3) / ARRIVE_S);
	});
	const nArrived = $derived(Math.floor(arrived * MESSAGE.length + 1e-9));

	// ---- layout -----------------------------------------------------------------------
	const LX = 24;
	const CW = 19;
	const STRIP_W = 528;
	const lanes = [
		{ id: 'plain', title: 'Without coding', y: 128, color: 'var(--ec-plain)' },
		{ id: 'coded', title: 'With the Hamming (7, 4) code', y: 300, color: 'var(--ec-coded)' }
	] as const;

	const shown = (c: string) => {
		const v = c.charCodeAt(0);
		return v > 32 && v < 127 ? c : v === 32 ? '' : '·';
	};
	const charX = (i: number) => LX + 12 + (i < BREAK ? i : i - BREAK) * CW;
	const lineOf = (i: number) => (i < BREAK ? 0 : 1);

	/** Vertical ticks at the given bit indices, along a strip of `sent` bits. */
	const ticks = (idx: number[], sent: number, y: number) =>
		idx
			.filter((i) => i / sent <= arrived)
			.map((i) => `M${(LX + ((i + 0.5) / sent) * STRIP_W).toFixed(1)} ${y}v14`)
			.join('');

	const intactCount = (tx: Transmission) => tx.intact.filter(Boolean).length;
	const pct = (v: number) => `${Math.round(v * 100)}%`;
	const pctFine = (v: number) => (v > 0.99 && v < 1 ? `${(v * 100).toFixed(1)}%` : pct(v));

	// ---- the plot -----------------------------------------------------------------------
	const sx = scale([0, 25], [650, 930]);
	const sy = scale([0, 1], [372, 92]);
	const grid = Array.from({ length: 101 }, (_, i) => i * 0.25);
	const plainCurve = linePath(
		grid,
		(x) => x,
		(x) => charOkPlain(x / 100),
		sx,
		sy
	);
	const codedCurve = linePath(
		grid,
		(x) => x,
		(x) => charOkCoded(x / 100),
		sx,
		sy
	);
</script>

{#snippet txt(
	x: number,
	y: number,
	text: string,
	size: number,
	opts: {
		anchor?: string;
		color?: string;
		weight?: number;
		muted?: boolean;
		opacity?: number;
		halo?: boolean;
	} = {}
)}
	<text
		{x}
		{y}
		class:halo={opts.halo !== false}
		class:muted={opts.muted}
		text-anchor={opts.anchor ?? 'start'}
		font-weight={opts.weight ?? 500}
		opacity={opts.opacity ?? 1}
		style:font-size="{size}px"
		style:fill={opts.color}
		style:font-variant-numeric="tabular-nums">{text}</text
	>
{/snippet}

<g>
	<!-- the message sent -->
	{@render txt(LX, 34, 'Sent by the probe', 12, { muted: true, weight: 600 })}
	{#each [...MESSAGE] as c, i (i)}
		{@render txt(charX(i) + CW / 2, 62 + lineOf(i) * 26, c === ' ' ? '' : c, 17, {
			anchor: 'middle',
			weight: 700
		})}
	{/each}

	<!-- the two lanes -->
	{#each lanes as lane (lane.id)}
		{@const tx = lane.id === 'plain' ? plain : coded}
		{@const op = lane.id === 'plain' ? 1 : showCoded.current}
		{@const y = lane.y}
		{#if op > 0.01}
			<g opacity={op}>
				<rect
					x={LX - 8}
					y={y - 22}
					width={STRIP_W + 16}
					height="158"
					rx="12"
					fill="var(--stage-grid)"
					opacity="0.35"
				/>
				{@render txt(LX, y, lane.title, 15, { weight: 700, color: lane.color })}
				{@render txt(LX + STRIP_W, y, `${tx.sent} bits sent · ${tx.flips.length} flipped`, 12, {
					anchor: 'end',
					muted: true
				})}
				<!-- the bit strip: every bit sent, ticks at flips -->
				<rect
					x={LX}
					y={y + 12}
					width={STRIP_W}
					height="14"
					rx="3"
					fill={lane.color}
					opacity="0.18"
				/>
				<rect
					x={LX}
					y={y + 12}
					width={STRIP_W * arrived}
					height="14"
					rx="3"
					fill={lane.color}
					opacity="0.3"
				/>
				{#if lane.id === 'plain'}
					<path d={ticks(tx.flips, tx.sent, y + 12)} stroke="var(--ec-bad)" stroke-width="2" />
				{:else}
					<path d={ticks(tx.repaired, tx.sent, y + 12)} stroke="var(--ec-fix)" stroke-width="2" />
					<path d={ticks(tx.failed, tx.sent, y + 12)} stroke="var(--ec-bad)" stroke-width="2" />
				{/if}
				<!-- received text -->
				{#each [...tx.text] as c, i (i)}
					{@const ok = tx.intact[i]}
					{@const here = i < nArrived}
					{@const cy = y + 62 + lineOf(i) * 30}
					{#if here && !ok}
						<rect
							x={charX(i) + 1}
							y={cy - 19}
							width={CW - 2}
							height="26"
							rx="4"
							fill="var(--ec-bad)"
							opacity="0.16"
						/>
					{/if}
					{@render txt(charX(i) + CW / 2, cy, here ? shown(c) : '', 17, {
						anchor: 'middle',
						weight: 700,
						color: ok ? undefined : 'var(--ec-bad)'
					})}
				{/each}
				{@render txt(
					LX,
					y + 126,
					arrived < 1
						? 'arriving…'
						: `${intactCount(tx)} of ${MESSAGE.length} letters intact` +
								(lane.id === 'coded'
									? ` · ${tx.repaired.length} flips repaired, ${tx.failed.length} not`
									: ''),
					13,
					{ weight: 600, muted: arrived < 1 }
				)}
			</g>
		{/if}
	{/each}

	{#if showCoded.current < 0.99}
		<g opacity={1 - showCoded.current}>
			{@render txt(LX, 330, 'The receiver gets these letters and nothing else:', 13, {
				muted: true
			})}
			{@render txt(LX, 352, 'it cannot tell which ones are wrong, let alone fix them.', 13, {
				muted: true
			})}
		</g>
	{/if}

	<!-- the cost: bits sent -->
	{#if showCost.current > 0.01}
		{@const bw = (v: number) => (v / coded.sent) * 330}
		<g opacity={showCost.current}>
			{@render txt(LX, 486, 'Bits sent for the same message', 12, { muted: true, weight: 600 })}
			<rect x={LX + 110} y="498" width={bw(plain.sent)} height="18" rx="4" fill="var(--ec-plain)" />
			{@render txt(LX, 512, 'without code', 12)}
			{@render txt(LX + 118 + bw(plain.sent), 512, `${plain.sent}`, 12, { weight: 700 })}
			<rect x={LX + 110} y="526" width={bw(coded.sent)} height="18" rx="4" fill="var(--ec-coded)" />
			{@render txt(LX, 540, 'with code', 12)}
			{@render txt(LX + 118 + bw(coded.sent), 540, `${coded.sent}  (+75%)`, 12, { weight: 700 })}
		</g>
	{:else}
		<g opacity={showCoded.current}>
			<line
				x1={LX}
				x2={LX + 14}
				y1="488"
				y2="488"
				stroke="var(--ec-fix)"
				stroke-width="2"
				transform="rotate(90 {LX + 7} 488)"
			/>
			{@render txt(LX + 18, 493, 'flip in a block hit once: repaired', 12)}
			<line
				x1={LX + 270}
				x2={LX + 284}
				y1="488"
				y2="488"
				stroke="var(--ec-bad)"
				stroke-width="2"
				transform="rotate(90 {LX + 277} 488)"
			/>
			{@render txt(LX + 288, 493, 'flip the receiver can’t repair', 12)}
		</g>
	{/if}

	<!-- the plot -->
	{@render txt(650, 44, 'Chance a letter arrives intact', 14, { weight: 700 })}
	{@render txt(650, 64, 'curves: the formulas · dots: this message', 12, { muted: true })}
	<Axes
		{sx}
		{sy}
		xTicks={[0, 5, 10, 15, 20, 25]}
		yTicks={[0, 0.25, 0.5, 0.75, 1]}
		xFormat={(v) => `${v}%`}
		yFormat={(v) => `${v * 100}%`}
		xLabel="noise: chance each bit flips"
	/>
	<line
		x1={sx(p * 100)}
		x2={sx(p * 100)}
		y1={sy(1) - 6}
		y2={sy(0)}
		stroke="var(--stage-ink-muted)"
		stroke-dasharray="4 4"
	/>
	<path d={plainCurve} fill="none" stroke="var(--ec-plain)" stroke-width="2.5" />
	<g opacity={showCoded.current}>
		<path d={codedCurve} fill="none" stroke="var(--ec-coded)" stroke-width="2.5" />
	</g>
	{#if arrived >= 1}
		<circle
			cx={sx(p * 100)}
			cy={sy(intactCount(plain) / MESSAGE.length)}
			r="5"
			fill="var(--ec-plain)"
			stroke="var(--stage-bg)"
			stroke-width="1.5"
		/>
		<circle
			cx={sx(p * 100)}
			cy={sy(intactCount(coded) / MESSAGE.length)}
			r="5"
			fill="var(--ec-coded)"
			stroke="var(--stage-bg)"
			stroke-width="1.5"
			opacity={showCoded.current}
		/>
	{/if}
	<!-- readouts at the current noise -->
	{@render txt(650, 448, `At ${(p * 100).toFixed(1)}% noise, on average:`, 13, { weight: 600 })}
	{@render txt(650, 474, `without coding ${pctFine(charOkPlain(p))} of letters`, 13, {
		color: 'var(--ec-plain)',
		weight: 700
	})}
	{@render txt(650, 498, `with the code ${pctFine(charOkCoded(p))}`, 13, {
		color: 'var(--ec-coded)',
		weight: 700,
		opacity: showCoded.current
	})}
</g>
