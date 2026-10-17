<script lang="ts">
	/**
	 * A guitar string, 65 cm between the nut (left) and the bridge (right),
	 * tuned to A₂ = 110 Hz, with a readout card above and a chart below. The
	 * motion is slowed down enormously (the fundamental swings at 0.3 Hz on the
	 * stage); every harmonic keeps its true ratio n to it.
	 *
	 * Phases (`step.hints.phase`):
	 *   standing  — harmonic `params.harmonic` as a standing wave, with the two
	 *               travelling waves that add up to it (faint, with arrows), the
	 *               nodes and antinodes marked, and the half-wavelength of one loop
	 *   harmonics — the same mode with its envelope; the chart is the ladder of
	 *               allowed frequencies n × 110 Hz, the chosen one highlighted.
	 *               `params.hear` (an action) plays the note.
	 *   pluck     — the string pulled into a triangle at `params.pluckAt` % of the
	 *               length from the bridge, held for 0.8 s, then let go: the sum of
	 *               60 harmonics (`pluckedString`). The chart shows the size of
	 *               each harmonic. `params.pluck` re-plucks (the clock restarts, the
	 *               clock memo of oscillations-resonance/SpringScene) and sounds it.
	 *
	 * Sounds start only from those presses (see `sound.ts`); a press already
	 * counted when the scene appears does not play.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { A2, GUITAR_SCALE, nodes, pluckAmplitude, standing, travellingHalves } from '../waves';
	import Card from './Card.svelte';
	import { playNote, stopAll } from './sound';
	import { fmt, pathOf, type Cell } from './ui';

	let { step, t, params, reduced }: StageProps = $props();

	const X0 = 120; // nut
	const X1 = 840; // bridge
	const Y = 262; // string at rest
	const AMP = 62; // px, the largest swing drawn
	const F_VIS = 0.3; // Hz: the fundamental as drawn
	const HOLD = 0.8; // s held before a pluck is let go
	const TERMS = 60;
	const NX = 241;
	const us = Array.from({ length: NX }, (_, i) => i / (NX - 1));
	const xOf = (u: number) => X0 + u * (X1 - X0);
	// the chart
	const CX0 = 120;
	const CX1 = 900;
	const CY = 548; // baseline
	const CH = 118; // height of the tallest bar

	const phase = $derived(String(step.hints?.phase ?? 'standing'));
	const n = $derived(Math.max(1, Math.min(8, Math.round(Number(params.harmonic ?? 3)))));
	const pluckFrac = $derived(Math.max(0.02, Math.min(0.5, Number(params.pluckAt ?? 20) / 100)));
	/** Pluck point measured from the nut (the drawing's left end). */
	const p = $derived(1 - pluckFrac);

	const wPluck = new Tween(0, { duration: 700, easing: cubicInOut });
	const wHalves = new Tween(0, { duration: 700, easing: cubicInOut });
	$effect(() => {
		const a = phase === 'pluck' ? 1 : 0;
		const b = phase === 'standing' ? 1 : 0;
		untrack(() => {
			wPluck.set(a, { duration: reduced ? 0 : 700 });
			wHalves.set(b, { duration: reduced ? 0 : 700 });
		});
	});

	// ---- sound ------------------------------------------------------------------------
	let lastHear: number | undefined;
	$effect(() => {
		const c = Number(params.hear ?? 0);
		untrack(() => {
			if (lastHear !== undefined && c !== lastHear && phase === 'harmonics')
				playNote([{ f: n * A2, a: 1 }], 1.6);
			lastHear = c;
		});
	});
	let lastPluck: number | undefined;
	$effect(() => {
		const c = Number(params.pluck ?? 0);
		untrack(() => {
			if (lastPluck !== undefined && c !== lastPluck && phase === 'pluck')
				playNote(
					Array.from({ length: 24 }, (_, i) => ({
						f: (i + 1) * A2,
						a: pluckAmplitude(i + 1, pluckFrac)
					})),
					2.6,
					{ pluck: true }
				);
			lastPluck = c;
		});
	});
	// silence on a step change and when the scene goes away
	$effect(() => {
		void step.id;
		return () => stopAll();
	});

	// ---- standing waves ------------------------------------------------------------------
	// reduced motion: a frame near full swing, with the two travelling waves apart
	const ph = $derived(reduced ? 0.6 : 2 * Math.PI * F_VIS * n * t);
	const modePath = $derived(
		pathOf(us.map((u) => ({ x: xOf(u), y: Y - AMP * standing(n, u, ph) })))
	);
	const envelope = $derived(
		pathOf(us.map((u) => ({ x: xOf(u), y: Y - AMP * Math.abs(Math.sin(n * Math.PI * u)) }))) +
			' ' +
			pathOf(
				[...us]
					.reverse()
					.map((u) => ({ x: xOf(u), y: Y + AMP * Math.abs(Math.sin(n * Math.PI * u)) }))
			).replace('M', 'L') +
			' Z'
	);
	const halves = $derived.by(() => {
		const r = us.map((u) => ({ x: xOf(u), y: Y - AMP * travellingHalves(n, u, ph).right }));
		const l = us.map((u) => ({ x: xOf(u), y: Y - AMP * travellingHalves(n, u, ph).left }));
		return { right: pathOf(r), left: pathOf(l) };
	});
	const nodeXs = $derived(nodes(n).map(xOf));
	const antinodeXs = $derived(Array.from({ length: n }, (_, k) => xOf((k + 0.5) / n)));
	const lamCm = $derived((2 * GUITAR_SCALE * 100) / n);

	// ---- the pluck ----------------------------------------------------------------------
	let memo = { key: '', start: 0 };
	const since = $derived.by(() => {
		const key = `${phase}|${pluckFrac}|${params.pluck ?? 0}`;
		if (key !== memo.key || t < memo.start) memo = { key, start: memo.key === '' ? 0 : t };
		return reduced ? 2.5 : t - memo.start;
	});
	const amps = $derived(Array.from({ length: TERMS }, (_, i) => pluckAmplitude(i + 1, p)));
	/** sin(nπu) for every drawn point and harmonic, per pluck point (fixed table). */
	const sines = Array.from({ length: NX }, (_, j) =>
		Float64Array.from({ length: TERMS }, (_, i) => Math.sin((i + 1) * Math.PI * us[j]))
	);
	const held = $derived(since < HOLD);
	const pluckPath = $derived.by(() => {
		const cycles = Math.max(0, since - HOLD) * F_VIS;
		const cs = amps.map((b, i) => b * Math.cos(2 * Math.PI * (i + 1) * cycles));
		const pts = us.map((u, j) => {
			let y = 0;
			if (held) y = u <= p ? u / p : (1 - u) / (1 - p);
			else for (let i = 0; i < TERMS; i++) y += cs[i] * sines[j][i];
			return { x: xOf(u), y: Y - AMP * y };
		});
		return pathOf(pts);
	});
	const pluckX = $derived(xOf(p));
	const missing = $derived(
		Array.from({ length: 12 }, (_, i) => i + 1).filter(
			(k) => Math.abs(pluckAmplitude(k, pluckFrac)) < 1e-9
		)
	);

	// ---- chart ----------------------------------------------------------------------------
	const NB = 12;
	const barX = (k: number) => CX0 + 30 + ((k - 1) * (CX1 - CX0 - 50)) / (NB - 1);
	const relAmps = $derived.by(() => {
		const top = Math.max(...amps.slice(0, NB).map(Math.abs));
		return amps.slice(0, NB).map((a) => Math.abs(a) / top);
	});
	const ladderX = (f: number) => CX0 + ((f - 0) / 1000) * (CX1 - CX0);

	const o = $derived(1 - wPluck.current);
	const oPl = $derived(wPluck.current);
	const oHalves = $derived(wHalves.current);

	const ordinal = (k: number) => `${k}${k === 1 ? 'st' : k === 2 ? 'nd' : k === 3 ? 'rd' : 'th'}`;
	const cells = $derived<Cell[]>(
		phase === 'pluck'
			? [
					{
						id: 'at',
						label: 'Plucked at',
						value: `${Math.round(pluckFrac * 100)}% from the bridge`,
						sub: `${fmt(pluckFrac * GUITAR_SCALE * 100, 1)} cm`
					},
					{ id: 'f', label: 'Note you hear', value: '110 Hz (A)', sub: 'the fundamental' },
					{
						id: 'm',
						label: 'Missing harmonics',
						value: missing.length ? missing.map(ordinal).join(', ') : 'none up to the 12th',
						sub: missing.length ? 'they have a node at the pluck point' : ''
					}
				]
			: [
					{ id: 'n', label: 'Harmonic', value: `n = ${n}`, sub: `${n} loop${n > 1 ? 's' : ''}` },
					{
						id: 'f',
						label: 'Frequency',
						value: `${n * A2} Hz`,
						sub: `${n} × 110 Hz`,
						color: 'var(--wav-a)'
					},
					{
						id: 'l',
						label: 'Wavelength λ = 2L ÷ n',
						value: `${fmt(lamCm, 1)} cm`,
						sub: `2 × 65 cm ÷ ${n}`
					}
				]
	);
</script>

<g>
	<Card x={16} y={16} w={928} {cells} />

	<!-- nut and bridge -->
	<g style:pointer-events="none">
		<rect x={X0 - 14} y={Y - 40} width="12" height="80" rx="3" fill="var(--stage-line)" />
		<rect x={X1 + 2} y={Y - 40} width="12" height="80" rx="3" fill="var(--stage-line)" />
		<!-- <Readout>: on narrow screens listed as HTML under the stage -->
		<Readout id="string" order={20} label="string: L = 65 cm, drawn hugely slowed down">
			<text x={X0 - 8} y={Y + 60} text-anchor="middle" class="muted" font-size="12">nut</text>
			<text x={X1 + 8} y={Y + 60} text-anchor="middle" class="muted" font-size="12">bridge</text>
			<text x={(X0 + X1) / 2} y={Y + AMP + 52} text-anchor="middle" class="muted" font-size="11"
				>L = 65 cm · drawn hugely slowed down</text
			>
		</Readout>
		<line
			x1={X0}
			x2={X1}
			y1={Y}
			y2={Y}
			stroke="var(--stage-line)"
			stroke-dasharray="3 5"
			opacity="0.8"
		/>
	</g>

	<!-- standing wave (standing, harmonics) -->
	{#if o > 0}
		<g opacity={o} style:pointer-events="none">
			<path d={envelope} fill="var(--wav-a)" opacity="0.08" />
			{#if oHalves > 0}
				<g opacity={oHalves}>
					<path
						d={halves.right}
						fill="none"
						stroke="var(--wav-a)"
						stroke-width="1.8"
						stroke-dasharray="6 5"
						opacity="0.8"
					/>
					<path
						d={halves.left}
						fill="none"
						stroke="var(--wav-b)"
						stroke-width="1.8"
						stroke-dasharray="6 5"
						opacity="0.8"
					/>
				</g>
			{/if}
			<path
				d={modePath}
				fill="none"
				stroke="var(--wav-sum)"
				stroke-width="3"
				stroke-linecap="round"
			/>
			{#each nodeXs as x, k (k)}
				<circle
					cx={x}
					cy={Y}
					r="5"
					fill="var(--stage-bg)"
					stroke="var(--wav-sum)"
					stroke-width="2"
				/>
			{/each}
			<!-- node / antinode labels on the first loop -->
			{#if n > 1}
				<Readout id="node" order={10} label="node" marker={1} at={[nodeXs[1], Y + AMP + 26]}>
					<text
						x={nodeXs[1]}
						y={Y + AMP + 22}
						text-anchor="middle"
						class="halo"
						font-size="12"
						font-weight="600">node</text
					>
				</Readout>
				<line
					x1={nodeXs[1]}
					x2={nodeXs[1]}
					y1={Y + 9}
					y2={Y + AMP + 8}
					stroke="var(--stage-ink-muted)"
					stroke-dasharray="2 3"
				/>
			{/if}
			<Readout
				id="antinode"
				order={11}
				label="antinode"
				marker={2}
				at={[antinodeXs[0], Y - AMP - 26]}
			>
				<text
					x={antinodeXs[0]}
					y={Y - AMP - 14}
					text-anchor="middle"
					class="halo"
					font-size="12"
					font-weight="600">antinode</text
				>
			</Readout>
			<!-- one loop is half a wavelength -->
			<g transform="translate(0 {Y + AMP + 22})">
				{#if n > 1}
					<line
						x1={nodeXs[n - 1] + 2}
						x2={nodeXs[n] - 2}
						y1="0"
						y2="0"
						stroke="var(--wav-a)"
						stroke-width="1.5"
						marker-start="url(#arrowhead)"
						marker-end="url(#arrowhead)"
					/>
					<Readout id="half-lambda">
						<text
							x={(nodeXs[n - 1] + nodeXs[n]) / 2}
							y="-6"
							text-anchor="middle"
							class="halo"
							font-size="12"
							style:fill="var(--wav-a)"
							font-weight="600">½ λ = {fmt(lamCm / 2, 1)} cm</text
						>
					</Readout>
				{/if}
			</g>
			{#if oHalves > 0.3}
				<g opacity={oHalves}>
					<Readout id="right" order={12} label="wave going right →" color="var(--wav-a)">
						<text x={X0 + 6} y={Y - AMP - 28} class="halo" font-size="12" style:fill="var(--wav-a)"
							>wave going right →</text
						>
					</Readout>
					<Readout id="left" order={13} label="← its reflection going left" color="var(--wav-b)">
						<text
							x={X1 - 6}
							y={Y - AMP - 28}
							text-anchor="end"
							class="halo"
							font-size="12"
							style:fill="var(--wav-b)">← its reflection going left</text
						>
					</Readout>
				</g>
			{/if}
		</g>
	{/if}

	<!-- the pluck -->
	{#if oPl > 0}
		<g opacity={oPl} style:pointer-events="none">
			<path
				d={pluckPath}
				fill="none"
				stroke="var(--wav-sum)"
				stroke-width="3"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
			{#if held}
				<circle cx={pluckX} cy={Y - AMP} r="9" fill="var(--wav-bead)" opacity="0.85" />
				<Readout id="pluck" order={10} label="pulled here…" color="var(--wav-bead)">
					<text
						x={pluckX}
						y={Y - AMP - 18}
						text-anchor="middle"
						class="halo"
						font-size="12"
						font-weight="600">pulled here…</text
					>
				</Readout>
			{:else}
				<line
					x1={pluckX}
					x2={pluckX}
					y1={Y - AMP - 10}
					y2={Y + AMP + 10}
					stroke="var(--wav-bead)"
					stroke-dasharray="2 4"
					opacity="0.8"
				/>
				<Readout id="pluck" order={10} label="plucked here" color="var(--wav-bead)">
					<text
						x={pluckX}
						y={Y - AMP - 16}
						text-anchor="middle"
						class="halo"
						font-size="12"
						style:fill="var(--wav-bead)">plucked here</text
					>
				</Readout>
			{/if}
		</g>
	{/if}

	<!-- ---- chart ---- -->
	<g style:pointer-events="none">
		<line x1={CX0} x2={CX1} y1={CY} y2={CY} stroke="var(--stage-line)" />
		{#if phase === 'pluck'}
			<Readout
				id="chart"
				order={21}
				label="bars: how much of each harmonic the pluck contains (× none)"
				color="var(--wav-a)"
			>
				<text x={CX0} y={CY - CH - 18} font-size="13" font-weight="600"
					>How much of each harmonic the pluck contains</text
				>
			</Readout>
			{#each relAmps as a, i (i)}
				{@const x = barX(i + 1)}
				<rect
					x={x - 14}
					y={CY - Math.max(1, a * CH)}
					width="28"
					height={Math.max(1, a * CH)}
					rx="3"
					fill={a < 1e-6 ? 'var(--stage-line)' : 'var(--wav-a)'}
					opacity={a < 1e-6 ? 1 : 0.35 + 0.65 * Math.sqrt(a)}
				/>
				<text {x} y={CY + 16} text-anchor="middle" class="muted" font-size="11">{(i + 1) * A2}</text
				>
				{#if a < 1e-6}
					<text {x} y={CY - 8} text-anchor="middle" font-size="12" font-weight="700">×</text>
				{/if}
			{/each}
			<text x={CX1} y={CY + 32} text-anchor="end" class="muted" font-size="11"
				>harmonic frequency (Hz)</text
			>
		{:else}
			<Readout
				id="chart"
				order={21}
				label="below: the only frequencies that fit, n × 110 Hz"
				color="var(--wav-a)"
			>
				<text x={CX0} y={CY - CH + 30} font-size="13" font-weight="600"
					>The only frequencies that fit: n × 110 Hz</text
				>
			</Readout>
			{#each [0, 200, 400, 600, 800, 1000] as f (f)}
				<line x1={ladderX(f)} x2={ladderX(f)} y1={CY} y2={CY + 5} stroke="var(--stage-line)" />
				<text x={ladderX(f)} y={CY + 18} text-anchor="middle" class="muted" font-size="11">{f}</text
				>
			{/each}
			<text x={CX1} y={CY + 34} text-anchor="end" class="muted" font-size="11">frequency (Hz)</text>
			{#each Array.from({ length: 9 }, (_, k) => k + 1) as k (k)}
				{@const x = ladderX(k * A2)}
				{@const on = k === n}
				<line
					x1={x}
					x2={x}
					y1={CY}
					y2={CY - (on ? 66 : 44)}
					stroke={on ? 'var(--wav-a)' : 'var(--stage-ink-muted)'}
					stroke-width={on ? 4 : 2.5}
					stroke-linecap="round"
				/>
				<text
					{x}
					y={CY - (on ? 74 : 52)}
					text-anchor="middle"
					font-size={on ? 13 : 11}
					style:fill={on ? 'var(--wav-a)' : 'var(--stage-ink-muted)'}
					font-weight={on ? 700 : 500}>{k}</text
				>
			{/each}
		{/if}
	</g>
</g>
