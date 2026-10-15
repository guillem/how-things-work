<script lang="ts">
	/**
	 * The HP chain folding itself: a Metropolis Monte Carlo run (`hp.ts` `run`) at the
	 * temperature `params.temp`, starting from a straight chain, shown at FPS recorded
	 * frames a second (50 tried moves each), with its energy trace.
	 *
	 * The run is a pure function of t: it is computed once per (chain, temperature, "run
	 * again" presses) and indexed by the time since that setting began. When only the
	 * temperature changes, the new run starts from the shape on screen at that moment, so
	 * the chain carries on instead of jumping (the time-since-a-change memo of
	 * black-holes/RaysScene). Under reduced motion the last frame of the run is shown, with
	 * its whole energy trace.
	 */
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { Label, lerp, smoothstep } from '#lib/draw/index.ts';
	import { run, type Frame } from '../hp';
	import { chainById, landscapeOf } from '../folding';
	import Beads from './Beads.svelte';

	let { t, params, reduced }: StageProps = $props();

	const FPS = 8;
	const FRAMES = 1200; // 150 s
	const MOVES = 50;

	const chain = $derived(chainById(String(params.chain ?? 'a')));
	const T = $derived(Number(params.temp ?? 0.3));
	const presses = $derived(Number(params.rerun ?? 0));

	const best = $derived(landscapeOf(chain.seq).best);

	interface Sim {
		key: string;
		chain: string;
		presses: number;
		start: number;
		frames: Frame[];
		/** Energies of earlier stretches of the same run (before a temperature change). */
		past: number[];
		pastBest: number;
	}
	let memo: Sim | null = null;
	const sim = $derived.by((): Sim => {
		const key = `${chain.id}|${T}|${presses}`;
		if (memo && memo.key === key && t >= memo.start) return memo;
		const seed = 1 + 7919 * presses; // the first run folds chain A in a typical time (about 16 s)
		const carryOn = memo && memo.chain === chain.id && memo.presses === presses && t >= memo.start;
		if (memo && carryOn) {
			const k = Math.min(FRAMES - 1, Math.floor((t - memo.start) * FPS));
			const now = memo.frames[k];
			const past = memo.past.concat(memo.frames.slice(0, k + 1).map((f) => f.energy));
			memo = {
				key,
				chain: chain.id,
				presses,
				start: t,
				frames: run(chain.seq, {
					T,
					movesPerFrame: MOVES,
					frames: FRAMES,
					seed: seed + past.length,
					start: now.fold
				}),
				past,
				pastBest: Math.min(memo.pastBest, now.best)
			};
		} else {
			memo = {
				key,
				chain: chain.id,
				presses,
				start: memo ? t : 0,
				frames: run(chain.seq, { T, movesPerFrame: MOVES, frames: FRAMES, seed }),
				past: [],
				pastBest: 0
			};
		}
		return memo;
	});

	const pos = $derived(reduced ? FRAMES - 1 : Math.min(FRAMES - 1, (t - sim.start) * FPS));
	const k = $derived(Math.floor(pos));
	const frame = $derived(sim.frames[k]);
	const nextFrame = $derived(sim.frames[Math.min(FRAMES - 1, k + 1)]);
	// hold each frame, then move to the next one in the last part of its slot
	const u = $derived(smoothstep(0.55, 1, pos - k));

	const CELL = 40;
	const pts = $derived.by(() => {
		const raw = frame.fold.map(([x, y], i) => ({
			x: lerp(x, nextFrame.fold[i][0], u),
			y: lerp(y, nextFrame.fold[i][1], u)
		}));
		const mx = raw.reduce((s, p) => s + p.x, 0) / raw.length;
		const my = raw.reduce((s, p) => s + p.y, 0) / raw.length;
		return raw.map((p) => ({
			x: 322 + (p.x - mx) * CELL,
			y: 300 - (p.y - my) * CELL,
			gx: p.x,
			gy: p.y,
			mx,
			my
		}));
	});
	const touching = $derived.by(() => {
		const f = u < 0.5 ? frame : nextFrame;
		const at = new Map(f.fold.map(([x, y], i) => [`${x},${y}`, i]));
		const out: [number, number][] = [];
		f.fold.forEach(([x, y], i) => {
			if (chain.seq[i] !== 'H') return;
			for (const [dx, dy] of [
				[1, 0],
				[0, 1]
			]) {
				const j = at.get(`${x + dx},${y + dy}`);
				if (j !== undefined && chain.seq[j] === 'H' && Math.abs(i - j) > 1) out.push([i, j]);
			}
		});
		return out;
	});
	const E = $derived(u < 0.5 ? frame.energy : nextFrame.energy);
	const bestSoFar = $derived(Math.min(sim.pastBest, frame.best));
	const history = $derived(sim.past.concat(sim.frames.slice(0, k + 1).map((f) => f.energy)));
	const inBest = $derived(history.filter((e) => e === best).length / history.length);

	// grid lines that move with the chain
	const grid = $derived.by(() => {
		const { mx, my } = pts[0];
		const ox = 322 - mx * CELL;
		const oy = 300 + my * CELL;
		const xs: number[] = [];
		const ys: number[] = [];
		for (let x = ((ox % CELL) + CELL) % CELL; x < 620; x += CELL) if (x > 28) xs.push(x);
		for (let y = ((oy % CELL) + CELL) % CELL; y < 572; y += CELL) if (y > 28) ys.push(y);
		return { xs, ys };
	});

	// energy trace: the last WINDOW frames
	const WINDOW = 480;
	const PX0 = 660;
	const PX1 = 930;
	const PY0 = 360;
	const PY1 = 520;
	const trace = $derived.by(() => {
		const from = Math.max(0, history.length - WINDOW);
		// the plot fills as the run goes, then scrolls once it holds WINDOW frames
		const span = Math.max(80, Math.min(WINDOW, history.length)) - 1;
		let d = '';
		for (let i = from; i < history.length; i++) {
			const x = PX0 + ((i - from) / span) * (PX1 - PX0);
			const y = PY0 + (history[i] / best) * (PY1 - PY0);
			d += `${i === from ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
		}
		return d;
	});
	const fmt = (e: number) => (e === 0 ? '0' : `−${-e}`);
	const moves = $derived(history.length * MOVES);
</script>

<g style:font-variant-numeric="tabular-nums">
	<rect x="24" y="24" width="600" height="552" rx="16" fill="var(--pf-water)" opacity="0.6" />
	<g stroke="var(--pf-grid)" stroke-width="1">
		{#each grid.xs as x (x)}
			<line x1={x} x2={x} y1="28" y2="572" />
		{/each}
		{#each grid.ys as y (y)}
			<line x1="28" x2="620" y1={y} y2={y} />
		{/each}
	</g>
	<Beads seq={chain.seq} {pts} r={14} contacts={touching} />

	<Readout id="temp" order={1} label="Temperature" value="{T.toFixed(2)} ε/k">
		<Label
			x={660}
			y={56}
			text="{chain.label} · temperature {T.toFixed(2)}"
			size={13}
			anchor="start"
			muted
		/>
	</Readout>
	<Readout id="energy" order={2} label="Energy now" value={fmt(E)} note="best possible {fmt(best)}">
		<Label x={660} y={88} text="Energy now" size={12} anchor="start" muted />
		<Label
			x={660}
			y={122}
			text={fmt(E)}
			size={32}
			weight={700}
			anchor="start"
			color={E === best ? 'var(--pf-contact)' : undefined}
		/>
		<Label x={740} y={104} text="best possible {fmt(best)}" size={12} anchor="start" muted />
		<Label x={740} y={122} text="lowest so far {fmt(bestSoFar)}" size={12} anchor="start" muted />
	</Readout>
	<Readout
		id="status"
		order={3}
		label={bestSoFar === best ? 'Folded' : 'Searching'}
		value={bestSoFar === best
			? `in its best fold ${Math.round(inBest * 100)}% of the time`
			: `${moves.toLocaleString('en-US')} moves tried`}
	>
		{#if bestSoFar === best}
			<Label
				x={660}
				y={172}
				text="Found its one best fold."
				size={13}
				weight={600}
				anchor="start"
			/>
			<Label
				x={660}
				y={192}
				text="In it {Math.round(inBest * 100)}% of the time so far"
				size={13}
				anchor="start"
			/>
		{:else}
			<Label
				x={660}
				y={172}
				text="Not yet in its best fold"
				size={13}
				weight={600}
				anchor="start"
			/>
		{/if}
		<Label
			x={660}
			y={212}
			text="{moves.toLocaleString('en-US')} small moves tried"
			size={12}
			anchor="start"
			muted
		/>
	</Readout>

	<!-- energy trace -->
	<Readout id="trace">
		<Label x={PX0} y={PY0 - 22} text="energy over time" size={12} anchor="start" muted />
		{#each [0, -2, -4, -6].filter((e) => e >= best) as e (e)}
			<line
				x1={PX0}
				x2={PX1}
				y1={PY0 + (e / best) * (PY1 - PY0)}
				y2={PY0 + (e / best) * (PY1 - PY0)}
				stroke="var(--stage-grid)"
			/>
			<Label
				x={PX0 - 6}
				y={PY0 + (e / best) * (PY1 - PY0) + 4}
				text={fmt(e)}
				size={11}
				anchor="end"
				muted
			/>
		{/each}
		<path d={trace} fill="none" stroke="var(--pf-bar)" stroke-width="1.8" stroke-linejoin="round" />
		<Label x={PX1} y={PY1 + 20} text="now" size={11} anchor="end" muted />
	</Readout>
</g>
