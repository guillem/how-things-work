<script lang="ts">
	/**
	 * P and S waves through a strip of material, side by side on the same scale: grains of the
	 * material (dots) pushed along the direction of travel by the P pulse and across it by the S
	 * pulse. Speeds are ak135's at the chosen depth (`params.medium`): crust (10 km), mantle
	 * (1,500 km) or the liquid outer core (3,000 km), where there is no S wave.
	 *
	 * One pulse leaves the source each cycle; the cycle lasts until the slower wave has crossed.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Label } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { speed } from '../earth';

	let { t, params, reduced }: StageProps = $props();

	const DEPTHS = { crust: 10, mantle: 1500, core: 3000 } as const;
	const NAMES = {
		crust: 'rock of the crust, 10 km down',
		mantle: 'rock of the mantle, 1,500 km down',
		core: 'liquid iron of the outer core, 3,000 km down'
	} as const;
	type Medium = keyof typeof DEPTHS;
	const medium = $derived<Medium>(
		params.medium === 'mantle' || params.medium === 'core' ? params.medium : 'crust'
	);
	const vp = $derived(speed('P', DEPTHS[medium], true));
	const vs = $derived(speed('S', DEPTHS[medium], true));

	const X0 = 110;
	const X1 = 920;
	const PX_PER_KMS = 26; // px per second of animation for each km/s
	const period = $derived(((X1 - X0) / (PX_PER_KMS * Math.min(vp, vs > 0 ? vs : vp))) * 1.15 + 0.6);
	const u = $derived(reduced ? 2.5 : t % period);

	/** The pulse: a smooth push and pull (derivative of a Gaussian), width ~40 px. */
	const pulse = (s: number) => -(s / 22) * Math.exp(-(s * s) / (2 * 22 * 22)) * 1.65;
	const AMP = 13;
	const COLS = Array.from({ length: Math.floor((X1 - X0) / 14) + 1 }, (_, i) => X0 + i * 14);
	const ROWS = [-30, -15, 0, 15, 30];

	const STRIP = { P: 190, S: 410 };
	const front = (v: number) => X0 + v * PX_PER_KMS * u;

	const sOn = new Tween(1, { duration: 700, easing: cubicInOut });
	$effect(() => {
		const v = vs > 0 ? 1 : 0;
		untrack(() => sOn.set(v, { duration: reduced ? 0 : 700 }));
	});

	const dots = (wave: 'P' | 'S') => {
		const v = wave === 'P' ? vp : vs;
		const f = front(v);
		const a = wave === 'S' ? sOn.current : 1;
		return ROWS.map((ry) => {
			let d = '';
			for (const x of COLS) {
				const g = v > 0 ? pulse(x - f) * AMP * a : 0;
				const px = wave === 'P' ? x + g : x;
				const py = STRIP[wave] + ry + (wave === 'S' ? g : 0);
				d += `M${px.toFixed(1)} ${py.toFixed(1)}h0`;
			}
			return { ry, d };
		});
	};
	const pDots = $derived(dots('P'));
	const sDots = $derived(dots('S'));
	/** One grain picked out in each strip, to follow its motion. */
	const TRACK = COLS[Math.floor(COLS.length * 0.55)];
	const pTrack = $derived(TRACK + pulse(TRACK - front(vp)) * AMP);
	const sTrack = $derived(STRIP.S + pulse(TRACK - front(vs)) * AMP * sOn.current);
	const fmt = (v: number) => v.toFixed(v < 10 ? 2 : 1).replace(/0$/, '');
	const liquid = $derived(vs === 0);
</script>

<g class="waves-scene">
	<Readout id="w-medium" order={1} label="Through" value={NAMES[medium]}>
		<text x={X0} y="58" font-size="15" style:font-weight="600">Through the {NAMES[medium]}</text>
	</Readout>

	<!-- the source -->
	{#each [STRIP.P, STRIP.S] as y (y)}
		<path
			d="M{X0 - 26} {y - 46}V{y + 46}"
			stroke="var(--eq-quake)"
			stroke-width="4"
			stroke-linecap="round"
		/>
	{/each}

	<!-- P -->
	<Readout
		id="w-p"
		order={2}
		label="P wave"
		value="{fmt(vp)} km/s · push and pull along the way it goes"
		color="var(--eq-p)"
	>
		<text x={X0} y={STRIP.P - 62} style:font-weight="600" style:fill="var(--eq-p)"
			>P wave · {fmt(vp)} km/s</text
		>
		<text x={X0 + 150} y={STRIP.P - 62} class="muted"
			>squeezes and stretches along the way it goes</text
		>
	</Readout>
	<g stroke="var(--stage-ink-muted)" stroke-width="5" stroke-linecap="round">
		{#each pDots as r (r.ry)}
			<path d={r.d} />
		{/each}
	</g>
	<circle cx={pTrack} cy={STRIP.P} r="4.5" fill="var(--eq-p)" />
	<path
		d="M{TRACK - 22} {STRIP.P + 50}h44"
		stroke="var(--eq-p)"
		stroke-width="1.6"
		marker-start="url(#arrowhead)"
		marker-end="url(#arrowhead)"
	/>

	<!-- S -->
	<Readout
		id="w-s"
		order={3}
		label="S wave"
		value={liquid
			? 'none: a liquid cannot be sheared'
			: `${fmt(vs)} km/s · shakes across the way it goes`}
		color="var(--eq-s)"
	>
		<text x={X0} y={STRIP.S - 62} style:font-weight="600" style:fill="var(--eq-s)"
			>S wave · {liquid ? 'none' : `${fmt(vs)} km/s`}</text
		>
		<text x={X0 + 150} y={STRIP.S - 62} class="muted"
			>{liquid
				? 'a liquid can’t spring back from a sideways push'
				: 'shakes from side to side, across the way it goes'}</text
		>
	</Readout>
	<g stroke="var(--stage-ink-muted)" stroke-width="5" stroke-linecap="round">
		{#each sDots as r (r.ry)}
			<path d={r.d} />
		{/each}
	</g>
	<circle cx={TRACK} cy={sTrack} r="4.5" fill="var(--eq-s)" opacity={0.3 + 0.7 * sOn.current} />
	<path
		d="M{TRACK + 60} {STRIP.S - 22}v44"
		stroke="var(--eq-s)"
		stroke-width="1.6"
		marker-start="url(#arrowhead)"
		marker-end="url(#arrowhead)"
		opacity={sOn.current}
	/>
	{#if liquid}
		<Readout id="w-none">
			<Label x={(X0 + X1) / 2} y={STRIP.S + 4} text="no S wave in a liquid" pill weight={600} />
		</Readout>
	{/if}

	<Readout
		id="w-note"
		order={4}
		label="Same scale"
		value="both pulses leave together; P always gets there first"
	>
		<text x={X0} y="560" class="muted" font-size="12"
			>Both pulses leave the source together and are drawn on the same scale: P always arrives
			first.</text
		>
	</Readout>
</g>
