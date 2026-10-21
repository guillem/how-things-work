<script lang="ts">
	/**
	 * A hot-air balloon on a field. The dots are air: the same spacing inside and out at 15 °C,
	 * spreading out inside as the burner warms it (how many fit follows the air's density from the
	 * model). The balloon lifts off when it and its air weigh less than the air it pushes aside.
	 */
	import { untrack } from 'svelte';
	import { Label } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { BALLOON, airDensity, balloon } from '../model';

	let { t, params, reduced }: StageProps = $props();

	const heat = $derived(Number(params.heat ?? BALLOON.outside));
	const b = $derived(balloon(heat));

	let t0 = $state(0);
	let wasUp = $state(false);
	/** Height when the balloon last changed its mind, so it rises or settles from there. */
	let from = $state(0);
	$effect(() => {
		const up = b.rises;
		untrack(() => {
			if (up !== wasUp) {
				from = lift;
				wasUp = up;
				t0 = t;
			}
		});
	});
	const local = $derived(reduced ? 99 : t >= t0 ? t - t0 : t);
	const ease = (x: number) => 1 - (1 - Math.min(1, Math.max(0, x))) ** 3;
	const TOP = 105;
	const lift: number = $derived(
		b.rises ? from + (TOP - from) * ease(local / 4) : from * (1 - ease(local / 3))
	);

	// ---- the balloon -----------------------------------------------------------------------------
	const GROUND = 545;
	const R = 128;
	const CX = 400;
	const cy = $derived(GROUND - 70 - 60 - R - lift);
	const my = $derived(cy + R + 56);
	const envelope = $derived(
		`M${CX - 34},${my} C${CX - R - 18},${cy + R * 0.55} ${CX - R - 14},${cy - R} ${CX},${cy - R} ` +
			`C${CX + R + 14},${cy - R} ${CX + R + 18},${cy + R * 0.55} ${CX + 34},${my} Z`
	);

	// ---- the air, as dots ------------------------------------------------------------------------
	// Outside: a jittered grid. Inside: the same grid spread out, so the number of dots per area
	// follows the density of the warmer air.
	const GAP = 26;
	const spread = $derived(Math.sqrt(airDensity(BALLOON.outside) / airDensity(heat)));
	const jig = (i: number, j: number, k: number) =>
		Math.sin(i * 12.9898 + j * 78.233 + k) * 0.5 * 6 +
		(reduced ? 0 : Math.sin(t * (3 + spread) + i * 1.7 + j * 2.3 + k) * 2.5);
	function inBalloon(x: number, y: number, pad = 8) {
		const dx = (x - CX) / (R + pad);
		const dy = (y - cy) / (R + pad);
		if (y <= cy + R * 0.3) return dx * dx + dy * dy < 1;
		const half = 34 + ((R + pad - 34) * (my - y)) / (my - cy - R * 0.3);
		return y < my && Math.abs(x - CX) < half;
	}
	const outside = $derived.by(() => {
		const pts: { x: number; y: number }[] = [];
		for (let i = 0; i < 960 / GAP; i++)
			for (let j = 0; j < (GROUND - 20) / GAP; j++) {
				const x = 12 + i * GAP + jig(i, j, 0);
				const y = 20 + j * GAP + jig(i, j, 1);
				if (x > 640 && y < 260) continue;
				if (!inBalloon(x, y) && !(Math.abs(x - CX) < 50 && y > my - 4 && y < my + 80))
					pts.push({ x, y });
			}
		return pts;
	});
	const inside = $derived.by(() => {
		const g = GAP * spread;
		const pts: { x: number; y: number }[] = [];
		for (let i = -12; i <= 12; i++)
			for (let j = -12; j <= 12; j++) {
				const x = CX + i * g + jig(i, j, 2);
				const y = cy + j * g + jig(i, j, 3);
				if (inBalloon(x, y, -10)) pts.push({ x, y });
			}
		return pts;
	});
	const warm = $derived(Math.min(1, (heat - BALLOON.outside) / 90));
	const flame = $derived(warm);

	const kg = (v: number) => `${(Math.round(v / 10) * 10).toLocaleString('en-GB')} kg`;
</script>

<g class="fs">
	<!-- the ground -->
	<rect x="0" y={GROUND} width="960" height={600 - GROUND} fill="var(--fs-grass)" />

	<!-- the air outside -->
	{#each outside as p, k (k)}
		<circle cx={p.x} cy={p.y} r="3" fill="var(--fs-air)" />
	{/each}

	<!-- ropes and basket -->
	{#each [-1, 1] as s (s)}
		<line
			x1={CX + s * 34}
			y1={my}
			x2={CX + s * 26}
			y2={my + 42}
			stroke="var(--fs-string)"
			stroke-width="2"
		/>
	{/each}
	<rect x={CX - 30} y={my + 42} width="60" height="28" rx="4" fill="var(--fs-wood)" />
	{#if flame > 0.02}
		<path
			d="M{CX - 8},{my + 14} Q{CX},{my + 14 - 30 * flame} {CX + 8},{my + 14} Z"
			fill="var(--fs-flame)"
		/>
	{/if}

	<!-- the envelope and the air inside it -->
	<path d={envelope} fill="var(--fs-envelope)" fill-opacity="0.18" />
	{#each inside as p, k (k)}
		<circle
			cx={p.x}
			cy={p.y}
			r="3"
			style:fill="color-mix(in srgb, var(--fs-flame) {Math.round(warm * 100)}%, var(--fs-air))"
		/>
	{/each}
	<path d={envelope} fill="none" stroke="var(--fs-envelope)" stroke-width="5" />
	{#each [-0.55, 0, 0.55] as g (g)}
		<path
			d="M{CX + g * 34},{my} C{CX + g * (R + 10)},{cy + R * 0.5} {CX + g * (R + 6)},{cy -
				R} {CX},{cy - R}"
			fill="none"
			stroke="var(--fs-envelope)"
			stroke-width="2"
			opacity="0.6"
		/>
	{/each}

	<!-- the sums -->
	<Readout id="fs-load" order={1} label="Balloon, basket and people" value={kg(BALLOON.load)}>
		<Label x={800} y={60} text="balloon, basket, people: {kg(BALLOON.load)}" size={15} tabular />
	</Readout>
	<Readout id="fs-inside" order={2} label="Air inside" value={kg(b.insideAir)}>
		<Label x={800} y={88} text="air inside: {kg(b.insideAir)}" size={15} tabular />
	</Readout>
	<Readout id="fs-total" order={3} label="All together" value={kg(b.weight)}>
		<Label
			x={800}
			y={124}
			text="all together: {kg(b.weight)}"
			size={18}
			weight={700}
			color={b.rises ? 'var(--fs-yes)' : 'var(--fs-no)'}
			tabular
		/>
	</Readout>
	<Readout id="fs-pushed" order={4} label="Air it pushes aside" value={kg(b.pushed)}>
		<Label
			x={800}
			y={156}
			text="air it pushes aside: {kg(b.pushed)}"
			size={18}
			weight={700}
			tabular
		/>
	</Readout>
	<Readout
		id="fs-verdict"
		order={5}
		label="The balloon"
		value={b.rises ? 'rises' : 'stays on the ground'}
	>
		<Label
			x={800}
			y={196}
			text={b.rises ? 'lighter: it rises' : 'heavier: it stays down'}
			size={20}
			weight={700}
			color={b.rises ? 'var(--fs-yes)' : 'var(--fs-no)'}
		/>
	</Readout>
	<Readout id="fs-key">
		<Label x={800} y={240} text="each dot: some air" size={13} muted />
	</Readout>
</g>
