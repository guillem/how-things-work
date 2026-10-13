<script lang="ts">
	/**
	 * A 4-bit ripple-carry adder: four full adders in a row (as boxes), the bits
	 * of `params.a4` (A) and `params.b4` (B) above them, most significant on the
	 * left as on paper, the sum bits below, and the carry out as the fifth bit.
	 *
	 * The carry ripples right to left: stage i (bit i) works out its sum and
	 * carry during [LEAD + i·STAGE_S, LEAD + (i+1)·STAGE_S]. Time is measured from
	 * the last change of the numbers, kept in plain locals updated inside a
	 * `$derived` (the restart pattern of pagerank's IterateScene). Reduced motion,
	 * or a paused stage, shows the finished sum.
	 *
	 * `params.carryLinks === 'build'` takes the three carry wires between the
	 * adders out: the reader clicks each gap to wire it (`params['links:four']`,
	 * a string of 0/1 for bits 1→2, 2→3, 3→4), an unwired carry in reads 0, and a
	 * checker counts how many of the 256 pairs the chain then adds right.
	 *
	 * Text sizes and colours use `style:` because the stage CSS overrides SVG
	 * presentation attributes.
	 */
	import { clamp } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { pairsRight, ripple4 } from '../logic';

	let { t, params, setParam, reduced, playing }: StageProps = $props();

	const STAGE_S = 0.6;
	const LEAD = 0.5;

	const a = $derived(clamp(Math.round(Number(params.a4 ?? 11)), 0, 15));
	const b = $derived(clamp(Math.round(Number(params.b4 ?? 6)), 0, 15));
	const building = $derived(params.carryLinks === 'build');
	const linkStr = $derived(typeof params['links:four'] === 'string' ? params['links:four'] : '');
	const links = $derived(building ? [0, 1, 2].map((k) => linkStr[k] === '1') : [true, true, true]);
	const r = $derived(ripple4(a, b, false, links));
	const right = $derived(building ? pairsRight(links) : 256);
	function toggleLink(k: number) {
		setParam('links:four', links.map((on, j) => ((j === k ? !on : on) ? '1' : '0')).join(''));
	}
	function onLinkKey(e: KeyboardEvent, k: number) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			toggleLink(k);
		}
	}
	const bit = (v: number, i: number) => ((v >> i) & 1) === 1;

	// ---- time since the numbers last changed (restart pattern) ------------------------
	let lastKey = '';
	let t0 = 0;
	let lastT = 0;
	const tr = $derived.by(() => {
		const key = `${a},${b},${links.join()}`;
		if (key !== lastKey) {
			t0 = lastKey === '' ? 0 : t;
			lastKey = key;
		}
		if (t < lastT || t < t0) t0 = Math.min(t0, t, 0);
		lastT = t;
		return reduced || !playing ? Infinity : t - t0 - LEAD;
	});
	/** 0…1 progress of stage i (bit i). */
	const prog = (i: number) => clamp((tr - i * STAGE_S) / STAGE_S, 0, 1);
	const done = (i: number) => tr >= (i + 1) * STAGE_S;
	const allDone = $derived(done(3));
	const active = $derived(allDone ? -1 : clamp(Math.floor(tr / STAGE_S), 0, 3));
	const rippleText = $derived(
		allDone
			? r.carryOut
				? 'Too big for 4 bits: the last carry becomes a fifth bit, worth 16. A 4-bit register would drop it: an overflow.'
				: building && right < 256
					? 'An adder with no carry wire into it reads its carry in as 0.'
					: 'Each column had to wait for the carry from the column on its right.'
			: `The carry ripples right to left: bit ${active + 1} of 4 (counting from the right) is adding.`
	);

	// ---- layout -------------------------------------------------------------------------
	/** Column centre of bit i (bit 0 on the right); column 4 is the carry out. */
	const colX = (i: number) => (i === 4 ? 128 : 806 - i * 188);
	const BOX_W = 132;
	const BOX_H = 96;
	const BOX_Y = 196;
	const MID = BOX_Y + BOX_H / 2;
	const ROW_A = 118;
	const ROW_B = 164;
	const ROW_S = 356;
	const SQ = 34;
	const COLS = [0, 1, 2, 3];

	const bin = (v: number, n: number) => v.toString(2).padStart(n, '0');
	const onCol = (on: boolean) => (on ? 'var(--lg-on)' : 'var(--lg-off)');
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

{#snippet square(x: number, y: number, on: boolean | null, opacity = 1)}
	<g {opacity}>
		<rect
			x={x - SQ / 2}
			y={y - SQ / 2}
			width={SQ}
			height={SQ}
			rx="7"
			fill={on ? 'var(--lg-on)' : 'var(--surface)'}
			stroke={on ? 'var(--lg-on)' : 'var(--lg-off)'}
			stroke-width="1.5"
			stroke-dasharray={on === null ? '4 3' : undefined}
		/>
		{@render txt(x, y + 6, on === null ? '?' : on ? '1' : '0', 17, {
			anchor: 'middle',
			weight: 700,
			color: on ? 'var(--stage-bg)' : undefined,
			muted: on === null,
			halo: false
		})}
	</g>
{/snippet}

<g>
	<!-- column bands, place values -->
	{#each [4, ...COLS] as i (i)}
		<rect
			x={colX(i) - (i === 4 ? 28 : BOX_W / 2 + 8)}
			y="58"
			width={i === 4 ? 56 : BOX_W + 16}
			height={ROW_S + SQ / 2 + 14 - 58}
			rx="12"
			fill="var(--stage-grid)"
			opacity="0.35"
		/>
		{@render txt(colX(i), 80, String(2 ** i), 12, { anchor: 'middle', muted: true, weight: 600 })}
	{/each}
	<Readout id="rip-place">
		{@render txt(24, 80, 'place value', 12, { muted: true })}
	</Readout>

	<!-- the numbers -->
	<Readout id="rip-name-a">
		{@render txt(24, ROW_A + 6, `A = ${a}`, 16, { weight: 700 })}
		{#snippet narrow()}
			{@render txt(24, ROW_A + 11, 'A', 30, { weight: 700 })}
		{/snippet}
	</Readout>
	<Readout id="rip-name-b">
		{@render txt(24, ROW_B + 6, `B = ${b}`, 16, { weight: 700 })}
		{#snippet narrow()}
			{@render txt(24, ROW_B + 11, 'B', 30, { weight: 700 })}
		{/snippet}
	</Readout>
	<Readout id="rip-name-s">
		{@render txt(24, ROW_S + 6, allDone ? `Sum = ${r.value}` : 'Sum = …', 16, { weight: 700 })}
		{#snippet narrow()}
			{@render txt(24, ROW_S + 11, 'Sum', 30, { weight: 700 })}
		{/snippet}
	</Readout>
	{#each COLS as i (i)}
		{@render square(colX(i), ROW_A, bit(a, i))}
		{@render square(colX(i), ROW_B, bit(b, i))}
		<!-- A and B into the box -->
		<line
			x1={colX(i)}
			y1={ROW_B + SQ / 2 + 2}
			x2={colX(i)}
			y2={BOX_Y - 4}
			stroke="var(--stage-line)"
			stroke-width="1.5"
			marker-end="url(#arrowhead)"
		/>
		<!-- box to its sum bit -->
		<line
			x1={colX(i)}
			y1={BOX_Y + BOX_H}
			x2={colX(i)}
			y2={ROW_S - SQ / 2 - 4}
			stroke={done(i) ? onCol(r.sum[i]) : 'var(--stage-line)'}
			stroke-width={done(i) && r.sum[i] ? 2.5 : 1.5}
		/>
		{@render square(colX(i), ROW_S, done(i) ? r.sum[i] : null, done(i) ? 1 : 0.6)}
	{/each}

	<!-- carry chain: into bit 0 from the right, between boxes, out of bit 3 -->
	{#each [0, 1, 2, 3, 4] as i (i)}
		{@const x1 = i === 0 ? 940 : colX(i - 1) - BOX_W / 2}
		{@const x2 = i === 4 ? colX(4) : colX(i) + BOX_W / 2}
		{@const linked = i === 0 || i === 4 || links[i - 1]}
		{@const on = i === 0 ? r.carries[0] : r.couts[i - 1]}
		{@const u = i === 0 ? 1 : prog(i - 1)}
		{@const len = x1 - x2}
		{@const path =
			i === 4
				? `M${x1} ${MID} H${x2} V${ROW_S - SQ / 2 - 2}`
				: linked
					? `M${x1} ${MID} H${x2}`
					: `M${x1} ${MID} H${x1 - 14} M${x2 + 14} ${MID} H${x2}`}
		<path d={path} fill="none" stroke="var(--lg-off)" stroke-width="2.5" opacity="0.55" />
		{#if u > 0 && linked}
			<path
				d={path}
				pathLength="1"
				stroke-dasharray="{u} 2"
				fill="none"
				stroke={onCol(on)}
				stroke-width={on ? 3.5 : 2.5}
				stroke-linecap="round"
			/>
		{/if}
		{#if i < 4 && linked}
			<path
				d="M{x2 + 1} {MID} l9 -5 v10 Z"
				fill={u >= 1 ? onCol(on) : 'var(--lg-off)'}
				opacity={u >= 1 ? 1 : 0.55}
			/>
		{/if}
		{#if i === 0}
			{@render txt(x1 - len / 2, MID - 10, '0', 13, { anchor: 'middle', weight: 700 })}
			<Readout id="rip-carry-0-{i}">
				{@render txt(x1 - len / 2, MID + 22, 'carry in', 11, { anchor: 'middle', muted: true })}
			</Readout>
		{:else if i < 4 && !linked}
			<Readout id="rip-carry-1-{i}">
				{@render txt(x1 - len / 2, MID + 22, 'no wire', 11, { anchor: 'middle', muted: true })}
			</Readout>
		{:else if i < 4}
			{@render txt(x1 - len / 2, MID - 10, u >= 1 ? (on ? '1' : '0') : '', 13, {
				anchor: 'middle',
				weight: 700,
				color: on ? 'var(--lg-on)' : undefined
			})}
			<Readout id="rip-carry-2-{i}">
				{@render txt(x1 - len / 2, MID + 22, 'carry', 11, { anchor: 'middle', muted: true })}
			</Readout>
		{/if}
	{/each}
	<!-- the carry wires the reader connects ("Connect them yourself") -->
	{#if building}
		{#each [1, 2, 3] as i (i)}
			{@const x1 = colX(i - 1) - BOX_W / 2}
			{@const x2 = colX(i) + BOX_W / 2}
			{@const linked = links[i - 1]}
			<g
				class="focusable"
				role="switch"
				tabindex="0"
				aria-checked={linked}
				aria-label="Carry wire from bit {i} to bit {i + 1}"
				style:cursor="pointer"
				onclick={() => toggleLink(i - 1)}
				onkeydown={(e) => onLinkKey(e, i - 1)}
			>
				<rect x={x2 + 4} y={MID - 22} width={x1 - x2 - 8} height="44" fill="transparent" />
				{#if !linked}
					<rect
						x={x2 + 16}
						y={MID - 9}
						width={x1 - x2 - 32}
						height="18"
						rx="5"
						fill="none"
						stroke="var(--lg-gate-edge)"
						stroke-dasharray="3 3"
						stroke-opacity="0.7"
					/>
				{/if}
				<rect
					class="ring"
					x={x2 + 1}
					y={MID - 25}
					width={x1 - x2 - 2}
					height="50"
					rx="12"
					fill="none"
					stroke="var(--focus)"
					stroke-width="2"
				/>
			</g>
		{/each}
	{/if}
	{@render square(colX(4), ROW_S, allDone ? r.carryOut : null, allDone ? 1 : 0.6)}
	<Readout id="rip-cout">
		{@render txt(colX(4), ROW_S + 36, 'carry out', 11, { anchor: 'middle', muted: true })}
	</Readout>

	<!-- the four full adders -->
	{#each COLS as i (i)}
		{@const x = colX(i)}
		{@const isActive = active === i}
		{@const cin = r.carries[i] ? 1 : 0}
		{@const total = (bit(a, i) ? 1 : 0) + (bit(b, i) ? 1 : 0) + cin}
		<rect
			x={x - BOX_W / 2}
			y={BOX_Y}
			width={BOX_W}
			height={BOX_H}
			rx="12"
			fill="var(--lg-gate)"
			stroke={isActive ? 'var(--lg-on)' : 'var(--lg-gate-edge)'}
			stroke-width={isActive ? 3 : 1.5}
		/>
		<Readout id="rip-fa-{i}">
			{@render txt(x, BOX_Y + 26, 'full adder', 13, {
				anchor: 'middle',
				weight: 700,
				color: 'var(--lg-gate-edge)',
				halo: false
			})}
		</Readout>
		{#if done(i)}
			{@render txt(
				x,
				BOX_Y + 56,
				`${bit(a, i) ? 1 : 0} + ${bit(b, i) ? 1 : 0} + ${cin} = ${bin(total, 2)}`,
				14,
				{ anchor: 'middle', weight: 600, halo: false }
			)}
			<Readout id="rip-sc-{i}">
				{@render txt(x, BOX_Y + 78, `sum ${total & 1}, carry ${total >> 1}`, 11, {
					anchor: 'middle',
					muted: true,
					halo: false
				})}
			</Readout>
		{:else}
			<Readout id="rip-wait-{i}">
				{@render txt(x, BOX_Y + 60, isActive ? 'adding…' : 'waiting for carry', 12, {
					anchor: 'middle',
					muted: true,
					halo: false,
					opacity: isActive ? 0.6 + 0.4 * Math.sin(prog(i) * Math.PI) : 1
				})}
			</Readout>
		{/if}
	{/each}

	<!-- result -->
	<Readout
		id="rip-sum"
		order={1}
		label="Sum"
		value={allDone ? `${a} + ${b} = ${r.value}` : `${a} + ${b} = …`}
		note="{bin(a, 4)} + {bin(b, 4)} = {allDone ? bin(r.value, 5) : '·····'} in binary"
	/>
	<Readout id="rip-now" order={2} label="Now" value={rippleText} />
	<Readout id="rip-result">
		{@render txt(480, 452, allDone ? `${a} + ${b} = ${r.value}` : `${a} + ${b} = …`, 26, {
			anchor: 'middle',
			weight: 700
		})}
		{@render txt(
			480,
			482,
			`${bin(a, 4)} + ${bin(b, 4)} = ${allDone ? bin(r.value, 5) : '·····'} in binary`,
			15,
			{ anchor: 'middle', muted: true }
		)}
		{@render txt(480, 530, rippleText, 13, { anchor: 'middle' })}
	</Readout>
	{#if building}
		<Readout
			id="rip-wiring"
			order={3}
			label="Your wiring"
			value={right === 256 ? '✓ adds all 256 pairs' : `right for ${right} of 256 pairs`}
			note={right === 256 ? undefined : 'tap a gap to wire a carry'}
			color={right === 256 ? 'var(--lg-ok)' : undefined}
		>
			{@render txt(
				480,
				562,
				right === 256
					? '✓ Right: it adds all 256 pairs of 4-bit numbers'
					: `Right for ${right} of the 256 pairs of 4-bit numbers · click a gap to wire a carry`,
				13,
				{
					anchor: 'middle',
					weight: 700,
					color: right === 256 ? 'var(--lg-ok)' : undefined,
					muted: right !== 256
				}
			)}
		</Readout>
	{/if}
</g>

<style>
	.focusable {
		outline: none;
	}
	.focusable .ring {
		opacity: 0;
	}
	.focusable:focus-visible .ring {
		opacity: 1;
	}
</style>
