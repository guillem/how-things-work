<script lang="ts">
	/**
	 * Radiocarbon dating.
	 *
	 * Views (`step.hints.view`):
	 *   life — a tree takes in carbon-14 made in the sky while it lives, so its
	 *          level stays at 100 %; after it dies the level falls by half every
	 *          5,700 years. Plays once over ~16 s and holds; reduced motion shows
	 *          the moment two half-lives after death.
	 *   date — the decay curve of carbon-14 with the `fraction` control: the
	 *          share left is read across to the curve and down to the age.
	 *
	 * The dots are a picture of the share left (each one stands for a great
	 * many atoms): they disappear in a fixed shuffled order, as many as the
	 * curve says, so the drawing always matches the number shown.
	 */
	import { Axes, Label, clamp, cycle, linePath, rng, scale, smoothstep } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { C14, ageUncertainty, radiocarbonAge, surviving } from '../model';

	let { step, t, params, reduced }: StageProps = $props();

	const view = $derived(String(step.hints?.view ?? 'life'));
	const T = C14.halfLife;
	const fmt = (v: number) => Math.round(v).toLocaleString('en-US');
	const pctText = (f: number) => `${Number((100 * f).toFixed(1)).toLocaleString('en-US')}%`;

	// 100 dots in a 10 × 10 block, removed in a fixed random order.
	const DOTS = 100;
	const rank = (() => {
		const random = rng(14);
		const o = Array.from({ length: DOTS }, (_, i) => i);
		for (let i = DOTS - 1; i > 0; i--) {
			const j = Math.floor(random() * (i + 1));
			[o[i], o[j]] = [o[j], o[i]];
		}
		const r = new Array<number>(DOTS);
		o.forEach((k, i) => (r[k] = i));
		return r;
	})();
	/** Dots left for a share `f`. */
	const keep = (f: number) => Math.round(DOTS * f);

	// ---- life ------------------------------------------------------------------------
	const ALIVE_S = 4; // seconds of animation while alive
	const PRE = 6000; // years shown before death
	const POST = 4 * T; // years shown after death
	const POST_S = 12;
	/** Years since death (negative while alive). */
	const years = $derived.by(() => {
		if (reduced) return 2 * T;
		const s = Math.max(0, t - 0.6);
		if (s < ALIVE_S) return -PRE + (s / ALIVE_S) * PRE;
		return Math.min(POST, ((s - ALIVE_S) / POST_S) * POST);
	});
	const alive = $derived(years < 0);
	const level = $derived(alive ? 1 : surviving(years, T));

	const LX = 540;
	const LX1 = 916;
	const LY0 = 140;
	const LY1 = 400;
	const lsx = scale([-PRE, POST], [LX, LX1]);
	const lsy = scale([0, 100], [LY1, LY0]);
	const lifeCurve = $derived.by(() => {
		const pts: { y: number; v: number }[] = [{ y: -PRE, v: 100 }];
		if (years <= 0) {
			pts.push({ y: years, v: 100 });
			return pts;
		}
		pts.push({ y: 0, v: 100 });
		for (let i = 1; i <= 80; i++) {
			const y = (i / 80) * years;
			pts.push({ y, v: 100 * surviving(y, T) });
		}
		return pts;
	});

	// The tree and the sky (left panel).
	const TREE = { x: 250, y: 420 };
	/** CO₂ carrying carbon-14 drifting down from the sky into the crown while alive. */
	const inflow = $derived(
		Array.from({ length: 6 }, (_, k) => {
			const u = reduced ? 0 : cycle(t, 2.4, k / 6);
			const x0 = 90 + k * 48;
			return {
				k,
				x: x0 + (TREE.x - x0) * 0.6 * u,
				y: 160 + 70 * u,
				o: alive ? smoothstep(0, 0.1, u) * (1 - smoothstep(0.75, 1, u)) : 0
			};
		})
	);
	/** Dots inside the crown (alive) or the fallen trunk (dead). */
	const lifeDots = $derived.by(() => {
		const n = keep(level);
		return Array.from({ length: DOTS }, (_, k) => {
			const col = k % 10;
			const row = Math.floor(k / 10);
			return {
				k,
				x: TREE.x - 67 + col * 15,
				y: alive ? TREE.y - 206 + row * 13 : TREE.y - 18 + row * 7.4,
				on: rank[k] < n
			};
		});
	});

	const lifeStatus = $derived(
		alive
			? 'Alive: the level stays at 100%'
			: `${fmt(years)} years after death: ${pctText(level)} left`
	);

	// ---- date ------------------------------------------------------------------------
	const f = $derived(clamp(Number(params.fraction ?? 25), 0.1, 100) / 100);
	const age = $derived(radiocarbonAge(f));
	const err = $derived(ageUncertainty(f));
	const AGE_MAX = 60_000;
	const LIMIT = 50_000;
	const DX0 = 380;
	const DX1 = 916;
	const DY0 = 120;
	const DY1 = 420;
	const dsx = scale([0, AGE_MAX], [DX0, DX1]);
	const dsy = scale([0, 100], [DY1, DY0]);
	const curve = Array.from({ length: 121 }, (_, i) => {
		const y = (i / 120) * AGE_MAX;
		return { y, v: 100 * surviving(y, T) };
	});
	const curvePath = linePath(
		curve,
		(c) => c.y,
		(c) => c.v,
		dsx,
		dsy
	);
	const halvings = $derived(age / T);
	// A gentle pulse on the reading point (none under reduced motion).
	const pulse = $derived(reduced ? 0 : 0.5 + 0.5 * Math.sin(t * 3));
	const dateDots = $derived.by(() => {
		const n = keep(f);
		return Array.from({ length: DOTS }, (_, k) => ({
			k,
			x: 62 + (k % 10) * 26,
			y: 180 + Math.floor(k / 10) * 26,
			on: rank[k] < n
		}));
	});
	const fade = $derived(reduced ? 1 : smoothstep(0, 0.5, t));
</script>

<g opacity={fade}>
	{#if view === 'life'}
		<!-- sky -->
		<rect x={40} y={40} width={440} height={110} rx="14" fill="var(--sky)" />
		<text x={56} y={138} class="muted">upper atmosphere</text>
		<!-- a cosmic ray hits nitrogen-14 and makes carbon-14 -->
		<line
			x1={250}
			y1={50}
			x2={300}
			y2={96}
			stroke="var(--rad-gamma)"
			stroke-width="2"
			marker-end="url(#arrowhead)"
		/>
		<Label x={244} y={66} text="cosmic-ray neutron" anchor="end" />
		<circle cx={316} cy={108} r="10" fill="var(--rad-beta)" />
		<text x={316} y={112} text-anchor="middle" style:fill="var(--stage-bg)" style:font-size="10px"
			>N</text
		>
		<text x={336} y={113} class="muted">→</text>
		<circle cx={364} cy={108} r="10" fill="var(--rad-parent)" />
		<text x={364} y={112} text-anchor="middle" style:fill="var(--stage-bg)" style:font-size="10px"
			>C</text
		>
		<text x={340} y={138} text-anchor="middle" class="muted">nitrogen-14 → carbon-14</text>

		<!-- carbon-14 in CO₂, taken in by the tree while it lives -->
		{#each inflow as p (p.k)}
			<circle cx={p.x} cy={p.y} r="4" fill="var(--rad-parent)" opacity={p.o} />
		{/each}
		{#if alive}
			<Label x={472} y={214} text="CO₂ with carbon-14" anchor="end" muted />
		{/if}

		<!-- the tree, or its fallen trunk -->
		{#if alive}
			<rect x={TREE.x - 10} y={TREE.y - 70} width="20" height="96" rx="3" fill="var(--leaf-dark)" />
			<ellipse cx={TREE.x} cy={TREE.y - 148} rx="96" ry="84" fill="var(--leaf)" opacity="0.8" />
		{:else}
			<rect
				x={TREE.x - 90}
				y={TREE.y - 32}
				width="180"
				height="88"
				rx="30"
				fill="var(--membrane)"
				stroke="var(--membrane-edge)"
			/>
		{/if}
		{#each lifeDots as d (d.k)}
			<circle
				cx={d.x}
				cy={d.y}
				r={alive ? 3.2 : 2.6}
				fill={d.on ? 'var(--rad-parent)' : 'none'}
				stroke={d.on ? 'none' : 'var(--stage-ink-muted)'}
				stroke-width="0.8"
				opacity={d.on ? 1 : 0.4}
			/>
		{/each}
		<line x1={40} x2={480} y1={TREE.y + 58} y2={TREE.y + 58} stroke="var(--stage-line)" />
		<Label
			x={TREE.x}
			y={TREE.y + 88}
			text={alive ? 'alive: carbon-14 in, carbon-14 decaying' : 'dead: no new carbon-14 comes in'}
		/>

		<!-- the level over time -->
		<text x={LX} y={100} style:font-size="15px" font-weight="600"
			>Carbon-14 in the tree's newest growth</text
		>
		<text x={LX} y={120} class="muted">compared with living things</text>
		<Axes
			sx={lsx}
			sy={lsy}
			xLabel="years since death"
			xTicks={[0, 5700, 11400, 17100, 22800]}
			yFormat={(v) => `${v}%`}
			yTicks={[0, 25, 50, 75, 100]}
		/>
		<line
			x1={lsx(0)}
			x2={lsx(0)}
			y1={LY0}
			y2={LY1}
			stroke="var(--stage-ink-muted)"
			stroke-dasharray="3 3"
		/>
		<Label x={lsx(0) - 6} y={LY0 + 150} text="death" anchor="end" muted />
		<Label x={lsx(-PRE / 2)} y={lsy(100) + 20} text="alive" muted />
		<path
			d={linePath(
				lifeCurve,
				(c) => c.y,
				(c) => c.v,
				lsx,
				lsy
			)}
			fill="none"
			stroke="var(--rad-parent)"
			stroke-width="2.6"
		/>
		<circle cx={lsx(years)} cy={lsy(100 * level)} r="5" fill="var(--rad-parent)" />
		<text x={LX} y={470} font-weight="600" style:font-variant-numeric="tabular-nums"
			>{lifeStatus}</text
		>
		<text x={LX} y={492} class="muted">it halves every 5,700 years (± 30)</text>
	{:else}
		<!-- the sample -->
		<text x={50} y={100} style:font-size="15px" font-weight="600">The sample</text>
		<text x={50} y={124} class="muted">each dot: 1% of the carbon-14</text>
		<text x={50} y={144} class="muted">it had while alive</text>
		{#each dateDots as d (d.k)}
			<circle
				cx={d.x}
				cy={d.y}
				r="8"
				fill={d.on ? 'var(--rad-parent)' : 'none'}
				stroke={d.on ? 'none' : 'var(--stage-ink-muted)'}
				stroke-width="1"
				opacity={d.on ? 1 : 0.45}
			/>
		{/each}
		<text
			x={50}
			y={472}
			style:font-size="15px"
			font-weight="600"
			style:font-variant-numeric="tabular-nums">{pctText(f)} left</text
		>

		<!-- the decay curve and the reading -->
		<text x={DX0} y={92} style:font-size="15px" font-weight="600">Carbon-14 left</text>
		<rect
			x={dsx(LIMIT)}
			y={DY0}
			width={dsx(AGE_MAX) - dsx(LIMIT)}
			height={DY1 - DY0}
			fill="var(--stage-grid)"
		/>
		<Label x={dsx(55_000)} y={DY0 + 22} text="too little" muted />
		<Label x={dsx(55_000)} y={DY0 + 40} text="to measure" muted />
		<Axes
			sx={dsx}
			sy={dsy}
			xLabel="age (years)"
			xTicks={[0, 10_000, 20_000, 30_000, 40_000, 50_000, 60_000]}
			yFormat={(v) => `${v}%`}
			yTicks={[0, 25, 50, 75, 100]}
		/>
		{#each [1, 2, 3, 4] as h (h)}
			<circle cx={dsx(h * T)} cy={dsy(100 / 2 ** h)} r="3.5" fill="var(--rad-expected)" />
		{/each}
		<path d={curvePath} fill="none" stroke="var(--rad-expected)" stroke-width="2" />
		{#if f < 1}
			<!-- read across, then down -->
			<line
				x1={DX0}
				x2={dsx(age)}
				y1={dsy(100 * f)}
				y2={dsy(100 * f)}
				stroke="var(--rad-parent)"
				stroke-width="2"
				stroke-dasharray="5 4"
			/>
			<line
				x1={dsx(age)}
				x2={dsx(age)}
				y1={dsy(100 * f)}
				y2={DY1 - 4}
				stroke="var(--rad-parent)"
				stroke-width="2"
				stroke-dasharray="5 4"
				marker-end="url(#arrowhead)"
			/>
		{/if}
		<circle
			cx={dsx(age)}
			cy={dsy(100 * f)}
			r={6 + 2 * pulse}
			fill="var(--rad-parent)"
			stroke="var(--stage-bg)"
			stroke-width="2"
		/>

		<g style:font-variant-numeric="tabular-nums">
			<text x={DX0} y={490} style:font-size="24px" font-weight="600"
				>{f >= 1 ? 'Alive, or only just dead' : `≈ ${fmt(age)} years old`}</text
			>
			<text x={DX0} y={516} class="muted">
				{f >= 1
					? 'none of its carbon-14 has gone yet'
					: `± ${fmt(err)} years from the ± 30 years on the half-life`}
			</text>
			{#if f < 1}
				<text x={DX0} y={544}>
					{halvings.toFixed(2)} half-lives: 5,700 years × log₂(1 / {f < 0.01
						? f.toFixed(3)
						: f.toFixed(2)})
				</text>
			{/if}
		</g>
	{/if}
</g>
