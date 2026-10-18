<script lang="ts">
	/**
	 * The octave drawn as a clock face (once round = a doubling; C at the top),
	 * with a panel on the right.
	 *
	 * Phases (`step.hints.phase`):
	 *   comma  — `params.stack` pure fifths stacked from C and folded into the
	 *            octave, joined in order (a moving dot walks the chain). The panel
	 *            shows how far each one lands from the nearest piano key: 1.96
	 *            cents more per fifth, 23.5 cents (the Pythagorean comma) after 12
	 *   divide — the octave cut into `params.divisions` equal steps; needles at the
	 *            pure fifth (702 cents) and major third (386); the panel zooms in
	 *            on each, ±50 cents, with the ladder's steps and the miss
	 *   twelve — the same circle; the panel charts the fifth's miss for every
	 *            ladder from 5 to 53 steps, with the 2-cent line
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Axes, Label, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		FIFTH_NAMES,
		KEY_NAMES,
		PURE_FIFTH,
		PURE_THIRD,
		fifthChain,
		fifthIn,
		thirdIn
	} from '../scales';
	import Card from './Card.svelte';
	import { fmt, onCircle, signed, type Cell } from './ui';

	let { step, t, params, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'comma'));
	const m = $derived(Math.max(0, Math.min(12, Math.round(Number(params.stack ?? 12)))));
	const n = $derived(Math.max(5, Math.min(53, Math.round(Number(params.divisions ?? 12)))));

	const wComma = new Tween(1, { duration: 700, easing: cubicInOut });
	const wDivide = new Tween(0, { duration: 700, easing: cubicInOut });
	const wTwelve = new Tween(0, { duration: 700, easing: cubicInOut });
	$effect(() => {
		const p = phase;
		untrack(() => {
			const d = reduced ? 0 : 700;
			wComma.set(p === 'comma' ? 1 : 0, { duration: d });
			wDivide.set(p === 'divide' ? 1 : 0, { duration: d });
			wTwelve.set(p === 'twelve' ? 1 : 0, { duration: d });
		});
	});
	const oComma = $derived(wComma.current);
	const oDivide = $derived(wDivide.current);
	const oTwelve = $derived(wTwelve.current);
	const oLadder = $derived(Math.max(oDivide, oTwelve));

	// ---- the circle ----------------------------------------------------------------------
	const CX = 238;
	const CY = 352;
	const R = 168;
	const at = (c: number, r = R) => onCircle(CX, CY, r, c / 1200);
	const keyNames = KEY_NAMES.slice(0, 12).map((k) => k.replace('4', ''));

	// chain of fifths
	const chain = $derived(
		Array.from({ length: m + 1 }, (_, k) => ({ k, c: fifthChain(k), name: FIFTH_NAMES[k] }))
	);
	const chainPath = $derived(
		chain.map((p, i) => `${i ? 'L' : 'M'}${at(p.c).x.toFixed(1)} ${at(p.c).y.toFixed(1)}`).join(' ')
	);
	/** A dot walking along the chain, one fifth every 0.9 s (still under reduced motion). */
	const walker = $derived.by(() => {
		if (m < 1) return null;
		const s = reduced ? m - 0.001 : (t / 0.9) % m;
		const i = Math.floor(s);
		const u = s - i;
		const a = at(chain[i].c);
		const b = at(chain[i + 1].c);
		return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
	});
	const offKey = (k: number) => {
		const c = fifthChain(k);
		return c - Math.round(c / 100) * 100;
	};

	// ladders
	const fifth = $derived(fifthIn(n));
	const third = $derived(thirdIn(n));
	const steps = $derived(Array.from({ length: n }, (_, k) => k));

	// ---- right panel: drift against the keys (comma) ----------------------------------------
	const bx = scale([0.4, 12.6], [530, 920]);
	const by = scale([0, 25], [500, 190]);

	// ---- right panel: zoom rulers (divide) ---------------------------------------------------
	const RX0 = 510;
	const RX1 = 920;
	const SPAN = 50; // cents either side of the pure interval
	const rx = (d: number) => (RX0 + RX1) / 2 + (d / SPAN) * ((RX1 - RX0) / 2);
	const rulers = $derived(
		[
			{ id: 'fifth', y: 250, target: PURE_FIFTH, a: fifth, name: 'fifth', ratio: '3 : 2' },
			{ id: 'third', y: 420, target: PURE_THIRD, a: third, name: 'major third', ratio: '5 : 4' }
		].map((r) => {
			const ticks: { k: number; d: number }[] = [];
			const size = 1200 / n;
			for (let k = Math.ceil((r.target - SPAN) / size); k * size <= r.target + SPAN; k++)
				ticks.push({ k, d: k * size - r.target });
			return { ...r, ticks };
		})
	);
	const rColor = (id: string) => (id === 'fifth' ? 'var(--ms-fifth)' : 'var(--ms-third)');

	// ---- right panel: every ladder (twelve) ------------------------------------------------
	const NS = Array.from({ length: 49 }, (_, i) => i + 5);
	// a square-root scale, so that misses of 100 cents and of 2 cents both show
	const cx = scale([4.5, 53.5], [520, 920]);
	const cyRoot = scale([0, 10], [500, 190]);
	const cy = (cents: number) => cyRoot(Math.sqrt(cents));
	const misses = NS.map((k) => ({ n: k, miss: Math.abs(fifthIn(k).err) }));

	const cells = $derived<Cell[]>(
		phase === 'comma'
			? [
					{
						id: 'm',
						label: 'Pure fifths stacked',
						value: `${m}`,
						sub: m ? `(3/2) to the power ${m}, folded into one octave` : 'start on C'
					},
					{
						id: 'lands',
						label: 'The last one lands on',
						value: m ? FIFTH_NAMES[m] : 'C',
						sub: `${fmt(fifthChain(m), 1)} cents above C`,
						color: 'var(--ms-fifth)'
					},
					{
						id: 'off',
						label: 'Off the nearest piano key',
						value: `${signed(offKey(m))} cents`,
						sub: m === 12 ? 'the Pythagorean comma' : `${fmt(1.955, 2)} cents more per fifth`,
						color: 'var(--ms-sum)'
					}
				]
			: [
					{
						id: 'n',
						label: 'Equal steps per octave',
						value: `${n}`,
						sub: `each ${fmt(1200 / n, 1)} cents`
					},
					{
						id: 'fifth',
						label: 'Best fifth',
						value: `${signed(fifth.err)} cents`,
						sub: `${fifth.k} steps = ${fmt(fifth.c, 1)} cents, pure is 702.0`,
						color: 'var(--ms-fifth)'
					},
					{
						id: 'third',
						label: 'Best major third',
						value: `${signed(third.err)} cents`,
						sub: `${third.k} steps = ${fmt(third.c, 1)} cents, pure is 386.3`,
						color: 'var(--ms-third)'
					}
				]
	);
</script>

<g>
	<Card x={16} y={16} w={928} h={88} {cells} />

	<!-- the octave as a circle -->
	<g style:pointer-events="none">
		<circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--stage-line)" stroke-width="1.5" />
		<Readout id="circle-note">
			<text x={CX} y={CY - 18} opacity={oLadder} text-anchor="middle" font-size="11" class="muted"
				>once round = one octave</text
			>
		</Readout>
		<!-- the piano's keys, for reference -->
		{#each keyNames as name, k (name)}
			{@const p = at(k * 100, R + 22)}
			{@const q = at(k * 100, R - 6)}
			{@const q2 = at(k * 100, R + 6)}
			<line x1={q.x} y1={q.y} x2={q2.x} y2={q2.y} stroke="var(--stage-ink-muted)" opacity="0.6" />
			<Readout id="kn-{k}">
				<text
					x={p.x}
					y={p.y + 4}
					text-anchor="middle"
					font-size="12"
					class="muted"
					font-weight={k === 0 ? 700 : 500}>{name}</text
				>
			</Readout>
		{/each}

		<!-- comma: the chain of fifths -->
		{#if oComma > 0.01}
			<g opacity={oComma}>
				<path
					d={chainPath}
					fill="none"
					stroke="var(--ms-fifth)"
					stroke-width="1.6"
					opacity="0.55"
				/>
				{#each chain as p (p.k)}
					{@const d = at(p.c)}
					<circle
						cx={d.x}
						cy={d.y}
						r={p.k === 12 ? 6 : 5}
						fill={p.k === 12 ? 'var(--ms-sum)' : 'var(--ms-fifth)'}
					/>
					{#if p.k < 12}
						{@const l = at(p.c, R - 20)}
						<text
							x={l.x}
							y={l.y + 4}
							text-anchor="middle"
							font-size="11"
							font-weight="700"
							fill="var(--ms-fifth)">{p.k}</text
						>
					{/if}
				{/each}
				{#if walker}
					<circle
						cx={walker.x}
						cy={walker.y}
						r="5"
						fill="var(--stage-bg)"
						stroke="var(--ms-fifth)"
						stroke-width="2.5"
					/>
				{/if}
				{#if m === 12}
					{@const a = at(fifthChain(12), R + 8)}
					{@const b = at(fifthChain(12), R + 34)}
					<line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--ms-sum)" stroke-width="1.2" />
					<Readout id="comma-call" label="B♯ lands" value="23.5 cents past C">
						<Label
							x={b.x + 8}
							y={b.y - 4}
							text="B♯: 23.5 cents past C"
							anchor="start"
							size={12}
							weight={700}
							color="var(--ms-sum)"
							pill
						/>
					</Readout>
				{/if}
			</g>
		{/if}

		<!-- divide / twelve: the ladder -->
		{#if oLadder > 0.01}
			<g opacity={oLadder}>
				{#each steps as k (k)}
					{@const p = at((k * 1200) / n)}
					{@const hit = k === fifth.k || k === third.k}
					<circle
						cx={p.x}
						cy={p.y}
						r={hit ? 6 : n > 30 ? 2.5 : 4}
						fill={k === fifth.k
							? 'var(--ms-fifth)'
							: k === third.k
								? 'var(--ms-third)'
								: 'var(--stage-ink)'}
						opacity={hit ? 1 : 0.7}
					/>
				{/each}
				{#each [{ c: PURE_FIFTH, col: 'var(--ms-fifth)', id: 'f' }, { c: PURE_THIRD, col: 'var(--ms-third)', id: 't' }] as nd (nd.id)}
					{@const tip = at(nd.c, R + 8)}
					<line
						x1={CX}
						y1={CY}
						x2={tip.x}
						y2={tip.y}
						stroke={nd.col}
						stroke-width="2"
						stroke-dasharray="6 4"
					/>
				{/each}
				<Readout id="needles">
					<Label
						x={at(PURE_FIFTH, R * 0.55).x - 14}
						y={at(PURE_FIFTH, R * 0.55).y - 10}
						text="pure 3:2"
						size={12}
						weight={700}
						color="var(--ms-fifth)"
					/>
					<Label
						x={at(PURE_THIRD, R * 0.55).x + 16}
						y={at(PURE_THIRD, R * 0.55).y - 8}
						text="pure 5:4"
						size={12}
						weight={700}
						color="var(--ms-third)"
					/>
				</Readout>
			</g>
		{/if}
	</g>

	<!-- right panel: comma -->
	{#if oComma > 0.01}
		<g opacity={oComma} style:pointer-events="none">
			<Label
				x={530}
				y={150}
				text="How far each pure fifth lands from a piano key"
				anchor="start"
				size={14}
				weight={700}
			/>
			<Axes
				sx={bx}
				sy={by}
				xTicks={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]}
				yTicks={[0, 10, 20]}
				xFormat={(v: number) => FIFTH_NAMES[v]}
				yLabel="cents"
			/>
			{#each Array.from({ length: 12 }, (_, i) => i + 1) as k (k)}
				{@const v = offKey(k)}
				<rect
					x={bx(k) - 11}
					y={by(v)}
					width="22"
					height={by(0) - by(v)}
					rx="3"
					fill={k === 12 ? 'var(--ms-sum)' : 'var(--ms-fifth)'}
					opacity={k <= m ? 0.9 : 0.15}
				/>
			{/each}
			<Readout id="comma-note">
				<Label
					x={560}
					y={by(22)}
					text="each pure fifth adds 1.96 cents"
					anchor="start"
					size={12}
					muted
				/>
			</Readout>
		</g>
	{/if}

	<!-- right panel: zoom rulers -->
	{#if oDivide > 0.01}
		<g opacity={oDivide} style:pointer-events="none">
			{#each rulers as r (r.id)}
				{@const col = rColor(r.id)}
				{@const inRange = Math.abs(r.a.err) <= SPAN}
				<Label
					x={RX0}
					y={r.y - 62}
					text="Zoom on the {r.name} (±50 cents)"
					anchor="start"
					size={14}
					weight={700}
				/>
				<line x1={RX0} x2={RX1} y1={r.y} y2={r.y} stroke="var(--stage-line)" stroke-width="1.5" />
				{#each [-50, -25, 0, 25, 50] as d (d)}
					<line x1={rx(d)} x2={rx(d)} y1={r.y - 4} y2={r.y + 4} stroke="var(--stage-ink-muted)" />
					<Readout id="rt-{r.id}-{d}">
						<text x={rx(d)} y={r.y + 20} text-anchor="middle" font-size="11" class="muted"
							>{d > 0 ? `+${d}` : d === 0 ? '0' : `−${-d}`}</text
						>
					</Readout>
				{/each}
				<!-- the pure interval -->
				<line x1={rx(0)} x2={rx(0)} y1={r.y - 34} y2={r.y + 8} stroke={col} stroke-width="2.5" />
				<Label x={rx(0)} y={r.y - 40} text="pure {r.ratio}" size={12} weight={700} color={col} />
				<!-- the ladder's steps near it -->
				{#each r.ticks as tk (tk.k)}
					<circle
						cx={rx(tk.d)}
						cy={r.y}
						r={tk.k === r.a.k ? 7 : 4.5}
						fill={tk.k === r.a.k ? col : 'var(--stage-ink)'}
						opacity={tk.k === r.a.k ? 1 : 0.6}
					/>
				{/each}
				{#if inRange}
					<Readout id="miss-{r.id}" label="{r.name} misses by" value="{signed(r.a.err)} cents">
						<Label
							x={rx(r.a.err)}
							y={r.y + 44}
							text="{r.a.k} steps: {signed(r.a.err)} cents"
							size={13}
							weight={700}
							color={col}
						/>
					</Readout>
				{:else}
					<Readout id="miss-{r.id}" label="{r.name} misses by" value="{signed(r.a.err)} cents">
						<Label
							x={r.a.err > 0 ? RX1 : RX0}
							y={r.y + 44}
							anchor={r.a.err > 0 ? 'end' : 'start'}
							text={r.a.err > 0
								? `nearest step ${signed(r.a.err)} cents →`
								: `← nearest step ${signed(r.a.err)} cents`}
							size={13}
							weight={700}
							color={col}
						/>
					</Readout>
				{/if}
			{/each}
		</g>
	{/if}

	<!-- right panel: every ladder -->
	{#if oTwelve > 0.01}
		<g opacity={oTwelve} style:pointer-events="none">
			<Label
				x={520}
				y={150}
				text="How far the best fifth misses, for 5 to 53 steps"
				anchor="start"
				size={14}
				weight={700}
			/>
			<Axes
				sx={cx}
				sy={cyRoot}
				xTicks={[5, 12, 19, 29, 41, 53]}
				yTicks={[0, 2, 10, 25, 50, 100].map(Math.sqrt)}
				yFormat={(v: number) => String(Math.round(v * v))}
				xLabel="steps per octave"
				yLabel="cents (square-root scale)"
			/>
			{#each misses as b (b.n)}
				{@const v = b.miss}
				<rect
					x={cx(b.n) - 3.4}
					y={cy(v)}
					width="6.8"
					height={cy(0) - cy(v)}
					fill={b.miss < 2 ? 'var(--ms-fifth)' : 'var(--stage-ink-muted)'}
					opacity={b.n === n ? 1 : b.miss < 2 ? 0.85 : 0.4}
				/>
			{/each}
			<line
				x1={cx(4.5)}
				x2={cx(53.5)}
				y1={cy(2)}
				y2={cy(2)}
				stroke="var(--ms-fifth)"
				stroke-dasharray="5 4"
				stroke-width="1.5"
			/>
			<rect
				x={cx(n) - 6}
				y={cy(Math.abs(fifth.err)) - 6}
				width="12"
				height={cy(0) - cy(Math.abs(fifth.err)) + 6}
				fill="none"
				stroke="var(--ms-sum)"
				stroke-width="2"
				rx="3"
			/>
			<Readout id="ladder-note" label="within 2 cents" value="12, 24, 29, 36, 41, 48, 53">
				<line
					x1={cx(12)}
					y1={cy(2) - 4}
					x2={cx(30)}
					y2={cy(64) + 10}
					stroke="var(--ms-fifth)"
					stroke-width="1.2"
				/>
				<Label
					x={cx(30)}
					y={cy(64)}
					text="12: the first within 2 cents"
					anchor="start"
					size={12}
					weight={700}
					color="var(--ms-fifth)"
					pill
				/>
			</Readout>
		</g>
	{/if}
</g>
