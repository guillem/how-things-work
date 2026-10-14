<script lang="ts">
	/**
	 * Two ways to keep warm. Left: a glass greenhouse, where the glass is a lid
	 * that stops the sun-warmed air from rising away; the warm air circulates
	 * inside. Right: the atmosphere, with no lid: warm air rises freely, and the
	 * surface is kept warm by greenhouse gases that absorb the ground's infrared
	 * and give it off again in random directions.
	 */
	import { Label, Photon, along, cycle, smooth, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { irPhoton, sunPhoton } from './ir';

	let { t, reduced }: StageProps = $props();
	const tt = $derived(reduced ? 2.5 : t);
	const GROUND = 500;

	// ---- left: greenhouse box
	const BX0 = 70;
	const BX1 = 420;
	const BY = 250;
	const loop = smooth([
		{ x: 245, y: GROUND - 20 },
		{ x: 245, y: BY + 40 },
		{ x: 330, y: BY + 34 },
		{ x: 395, y: BY + 90 },
		{ x: 380, y: GROUND - 30 },
		{ x: 300, y: GROUND - 18 },
		{ x: 245, y: GROUND - 20 }
	]);
	const loop2 = smooth([
		{ x: 245, y: GROUND - 20 },
		{ x: 245, y: BY + 40 },
		{ x: 160, y: BY + 34 },
		{ x: 95, y: BY + 90 },
		{ x: 110, y: GROUND - 30 },
		{ x: 190, y: GROUND - 18 },
		{ x: 245, y: GROUND - 20 }
	]);
	const parcelsIn = $derived(
		Array.from({ length: 10 }, (_, i) => {
			const p = along(i % 2 ? loop : loop2, cycle(tt, 7, i / 10));
			return { key: i, x: p.x, y: p.y };
		})
	);
	const sunL = $derived(
		Array.from({ length: 5 }, (_, i) => ({
			...sunPhoton(i, 5, tt, 40, GROUND - 6, 2.6),
			x: 130 + i * 50
		}))
	);

	// ---- right: open atmosphere
	const RX0 = 520;
	const RX1 = 920;
	const parcelsOut = $derived(
		Array.from({ length: 8 }, (_, i) => {
			const u = cycle(tt, 6, i / 8);
			const x = RX0 + 40 + ((i * 53) % 330) + Math.sin(u * 6 + i) * 8;
			const y = GROUND - 14 - u * 380;
			return { key: i, x, y, opacity: smoothstep(0, 0.1, u) * (1 - smoothstep(0.75, 1, u)) };
		})
	);
	const MOLS = [
		{ x: 580, y: 300 },
		{ x: 690, y: 220 },
		{ x: 800, y: 330 },
		{ x: 880, y: 190 },
		{ x: 640, y: 150 },
		{ x: 760, y: 120 }
	];
	const irR = $derived(
		Array.from({ length: 10 }, (_, i) =>
			irPhoton(i, 10, tt, {
				x0: RX0 + 30,
				x1: RX1 - 30,
				ground: GROUND - 6,
				top: 40,
				airTop: 120,
				airBottom: 340,
				absorb: 0.8,
				salt: 9
			})
		)
	);
	const inRight = (p: { x: number; y: number }) =>
		p.x > RX0 && p.x < RX1 && p.y > 30 && p.y < GROUND;
</script>

<g>
	<!-- left panel -->
	<rect x="16" y="16" width="454" height={GROUND - 16} rx="10" fill="var(--gh-space)" />
	<rect x="16" y={GROUND} width="454" height="40" fill="var(--gh-ground)" />
	<Readout
		id="l-title"
		order={0}
		label="A glass greenhouse"
		value="the glass is a lid: it stops warm air rising away"
	>
		<Label x={243} y={48} text="A glass greenhouse" size={15} weight={700} />
		<Label
			x={243}
			y={572}
			text="the glass is a lid: warm air cannot rise away"
			size={12}
			weight={600}
		/>
	</Readout>
	{#each sunL as p (p.key)}
		<Photon x={p.x} y={p.y} angle={90} length={26} opacity={p.opacity * 0.9} />
	{/each}
	<path
		d="M{BX0} {GROUND} L{BX0} {BY + 40} L{(BX0 + BX1) / 2} {BY - 10} L{BX1} {BY +
			40} L{BX1} {GROUND}"
		fill="var(--gh-glass)"
		fill-opacity="0.18"
		stroke="var(--gh-glass)"
		stroke-width="3"
		stroke-linejoin="round"
	/>
	{#each parcelsIn as p (p.key)}
		<circle cx={p.x} cy={p.y} r="9" fill="var(--gh-warm)" opacity="0.45" />
	{/each}
	<Readout id="l-glass">
		<Label x={BX1 - 4} y={BY + 22} text="glass" anchor="start" size={12} muted />
		<Label x={160} y={GROUND - 50} text="warm air" size={12} weight={600} color="var(--gh-warm)" />
	</Readout>

	<!-- right panel -->
	<rect x="490" y="16" width="454" height={GROUND - 16} rx="10" fill="var(--gh-space)" />
	<rect x="490" y="80" width="454" height={GROUND - 80} fill="var(--gh-air)" opacity="0.8" />
	<rect x="490" y={GROUND} width="454" height="40" fill="var(--gh-ground)" />
	<Readout
		id="r-title"
		order={1}
		label="The atmosphere"
		value="no lid: gases absorb and give off infrared, partly back down"
	>
		<Label x={717} y={48} text="The atmosphere: no lid" size={15} weight={700} />
		<Label
			x={717}
			y={572}
			text="gases absorb infrared and give it off again, partly down"
			size={12}
			weight={600}
		/>
	</Readout>
	{#each parcelsOut as p (p.key)}
		<circle cx={p.x} cy={p.y} r="9" fill="var(--gh-warm)" opacity={0.4 * p.opacity} />
	{/each}
	{#each MOLS as m, i (i)}
		<circle cx={m.x} cy={m.y} r="6" fill="var(--carbon)" />
		<circle cx={m.x - 10} cy={m.y} r="5.5" fill="#e5484d" />
		<circle cx={m.x + 10} cy={m.y} r="5.5" fill="#e5484d" />
	{/each}
	{#each irR as p (p.key)}
		{#if p.flash}
			<circle
				cx={p.flash.x}
				cy={p.flash.y}
				r="8"
				fill="var(--gh-ir)"
				opacity={p.flash.opacity * 0.6}
			/>
		{/if}
		{#if inRight(p)}
			<Photon
				x={p.x}
				y={p.y}
				angle={p.angle}
				length={24}
				amplitude={3}
				color="var(--gh-ir)"
				opacity={p.opacity}
			/>
		{/if}
	{/each}
	<Readout id="r-air">
		<Label
			x={RX1 + 14}
			y={GROUND - 120}
			text="warm air rises freely"
			anchor="end"
			size={12}
			weight={600}
			color="var(--gh-warm)"
		/>
	</Readout>
</g>
