<script lang="ts">
	/**
	 * A sample of air above warm ground. Infrared photons rise from the ground;
	 * nitrogen and oxygen let them through, while H₂O, CO₂ and CH₄ absorb them,
	 * vibrate, and a moment later give off a new photon in a random direction.
	 * The photon ends at the molecule: nothing bounces. Not to scale: the
	 * greenhouse gases are drawn far more common than they are.
	 */
	import { Label, Photon, colors, hash, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';

	let { t, reduced }: StageProps = $props();

	const tt = $derived(reduced ? 2.5 : t);
	const X0 = 40;
	const X1 = 590;
	const TOP = 40;
	const GROUND = 520;

	type Gas = 'N2' | 'O2' | 'H2O' | 'CO2' | 'CH4';
	interface Mol {
		id: number;
		gas: Gas;
		x: number;
		y: number;
		rot: number;
	}
	// Greenhouse molecules at fixed places, so the photons can aim at them.
	const GHG: Mol[] = [
		{ id: 100, gas: 'CO2', x: 120, y: 300, rot: 10 },
		{ id: 101, gas: 'H2O', x: 250, y: 200, rot: 0 },
		{ id: 102, gas: 'CO2', x: 380, y: 340, rot: -20 },
		{ id: 103, gas: 'CH4', x: 500, y: 230, rot: 0 },
		{ id: 104, gas: 'H2O', x: 170, y: 140, rot: 20 },
		{ id: 105, gas: 'CO2', x: 440, y: 120, rot: 30 }
	];
	// Nitrogen and oxygen everywhere else (78 : 21).
	const AIR: Mol[] = (() => {
		const out: Mol[] = [];
		let k = 0;
		for (let i = 0; out.length < 34 && i < 400; i++) {
			const x = X0 + 20 + hash(i, 1) * (X1 - X0 - 40);
			const y = TOP + 30 + hash(i, 2) * (GROUND - TOP - 70);
			const clear = [...GHG, ...out].every((m) => Math.hypot(m.x - x, m.y - y) > 46);
			if (!clear) continue;
			out.push({ id: k++, gas: hash(i, 3) < 0.79 ? 'N2' : 'O2', x, y, rot: hash(i, 4) * 180 });
		}
		return out;
	})();

	// ---- photons: even ones aim at a greenhouse molecule, odd ones pass between molecules
	const N = 12;
	const PERIOD = 3.6;
	const lanes = [70, 210, 330, 460, 560, 300];
	const photons = $derived(
		Array.from({ length: N }, (_, i) => {
			const s = tt / PERIOD + i / N;
			const k = Math.floor(s);
			const u = s - k;
			const fade = (a: number, b: number) =>
				smoothstep(a, a + 0.05, u) * (1 - smoothstep(b - 0.05, b, u));
			if (i % 2 === 1) {
				const x = lanes[(i + k) % lanes.length];
				const y = GROUND - 8 + (TOP - GROUND) * u;
				return { key: i, x, y, angle: -90, opacity: fade(0, 1), target: -1, glow: 0 };
			}
			const m = GHG[(i / 2 + k) % GHG.length];
			if (u < 0.42) {
				const y = GROUND - 8 + (m.y + 14 - (GROUND - 8)) * (u / 0.42);
				return { key: i, x: m.x, y, angle: -90, opacity: fade(0, 0.42), target: m.id, glow: 0 };
			}
			const glow = smoothstep(0.38, 0.44, u) * (1 - smoothstep(0.52, 0.62, u));
			if (u < 0.52) return { key: i, x: m.x, y: m.y, angle: -90, opacity: 0, target: m.id, glow };
			// re-emitted in a random direction: any angle
			const angle = hash(i * 3.7 + 1, k) * 360;
			const r = (angle * Math.PI) / 180;
			const d = 16 + (u - 0.52) * 520;
			return {
				key: i,
				x: m.x + Math.cos(r) * d,
				y: m.y + Math.sin(r) * d,
				angle,
				opacity: fade(0.52, 1) * (d < 320 ? 1 : 0),
				target: m.id,
				glow
			};
		})
	);
	const excited = $derived(
		new Map(photons.filter((p) => p.glow > 0.01).map((p) => [p.target, p.glow]))
	);
	const inside = (p: { x: number; y: number }) =>
		p.x > X0 - 4 && p.x < X1 + 4 && p.y > TOP - 4 && p.y < GROUND + 4;

	const jiggle = (m: Mol, a: number) => ({
		x: m.x + Math.sin(tt * 1.3 + m.id * 1.7) * a,
		y: m.y + Math.cos(tt * 1.1 + m.id * 2.3) * a
	});

	const KEY: { gas: Gas; name: string; share: string; absorbs: boolean }[] = [
		{ gas: 'N2', name: 'N₂ nitrogen', share: '78%', absorbs: false },
		{ gas: 'O2', name: 'O₂ oxygen', share: '21%', absorbs: false },
		{ gas: 'H2O', name: 'H₂O water vapour', share: 'about 0.4%', absorbs: true },
		{ gas: 'CO2', name: 'CO₂ carbon dioxide', share: '0.04%', absorbs: true },
		{ gas: 'CH4', name: 'CH₄ methane', share: '0.0002%', absorbs: true }
	];
</script>

{#snippet atom(x: number, y: number, r: number, fill: string, edge: string)}
	<circle cx={x} cy={y} {r} {fill} stroke={edge} stroke-width="1" />
{/snippet}

{#snippet molecule(gas: Gas, x: number, y: number, rot: number, buzz: number)}
	{@const b = Math.sin(tt * 40) * 3 * buzz}
	<g transform="translate({x} {y}) rotate({rot})">
		{#if buzz > 0}
			<circle r={22} fill="var(--gh-ir)" opacity={buzz * 0.35} />
		{/if}
		{#if gas === 'N2'}
			{@render atom(-5, 0, 7, colors.nitrogen, '#1d4ed8')}
			{@render atom(5, 0, 7, colors.nitrogen, '#1d4ed8')}
		{:else if gas === 'O2'}
			{@render atom(-5, 0, 7, colors.oxygen, colors.oxygenEdge)}
			{@render atom(5, 0, 7, colors.oxygen, colors.oxygenEdge)}
		{:else if gas === 'CO2'}
			{@render atom(-11 - b * 0.3, b * 0.5, 7, colors.oxygen, colors.oxygenEdge)}
			{@render atom(11 + b * 0.3, b * 0.5, 7, colors.oxygen, colors.oxygenEdge)}
			{@render atom(0, -b, 7.5, 'var(--carbon)', colors.carbonEdge)}
		{:else if gas === 'H2O'}
			{@render atom(-9, 7 + b * 0.5, 5, colors.hydrogen, colors.hydrogenEdge)}
			{@render atom(9, 7 + b * 0.5, 5, colors.hydrogen, colors.hydrogenEdge)}
			{@render atom(0, 0, 8, colors.oxygen, colors.oxygenEdge)}
		{:else}
			{@render atom(-9, -6 - b * 0.4, 4.5, colors.hydrogen, colors.hydrogenEdge)}
			{@render atom(9, -6 + b * 0.4, 4.5, colors.hydrogen, colors.hydrogenEdge)}
			{@render atom(-6, 9, 4.5, colors.hydrogen, colors.hydrogenEdge)}
			{@render atom(7, 9, 4.5, colors.hydrogen, colors.hydrogenEdge)}
			{@render atom(0, 0, 7.5, 'var(--carbon)', colors.carbonEdge)}
		{/if}
	</g>
{/snippet}

<g>
	<rect
		x={X0 - 20}
		y={TOP - 20}
		width={X1 - X0 + 40}
		height={GROUND - TOP + 20}
		rx="10"
		fill="var(--gh-air)"
	/>
	<rect x={X0 - 20} y={GROUND} width={X1 - X0 + 40} height="56" rx="4" fill="var(--gh-ground)" />
	<Readout id="ground">
		<Label x={X0} y={GROUND + 34} text="warm ground: gives off infrared" anchor="start" size={12} />
	</Readout>

	{#each AIR as m (m.id)}
		{@const p = jiggle(m, 4)}
		{@render molecule(m.gas, p.x, p.y, m.rot, 0)}
	{/each}
	{#each GHG as m (m.id)}
		{@const p = jiggle(m, 2)}
		<circle
			cx={p.x}
			cy={p.y}
			r="19"
			fill="none"
			stroke="var(--gh-ir)"
			stroke-dasharray="3 3"
			opacity="0.6"
		/>
		{@render molecule(m.gas, p.x, p.y, m.rot, excited.get(m.id) ?? 0)}
	{/each}
	{#each photons as p (p.key)}
		{#if inside(p) && p.opacity > 0.01}
			<Photon
				x={p.x}
				y={p.y}
				angle={p.angle}
				length={28}
				amplitude={3}
				color="var(--gh-ir)"
				opacity={p.opacity}
			/>
		{/if}
	{/each}

	<!-- key -->
	<Readout id="title">
		<Label
			x={636}
			y={56}
			text="The air, molecule by molecule"
			anchor="start"
			size={15}
			weight={700}
		/>
	</Readout>
	{#each KEY as k, i (k.gas)}
		{@const y = 100 + i * 52}
		{@render molecule(k.gas, 656, y, 0, 0)}
		<Readout
			id="k-{k.gas}"
			order={i}
			label={k.name}
			value="{k.share} of the air · {k.absorbs ? 'absorbs infrared' : 'lets it through'}"
			color={k.absorbs ? 'var(--gh-ir)' : undefined}
		>
			<Label x={684} y={y - 2} text={k.name} anchor="start" size={13} weight={600} />
			<Label
				x={684}
				y={y + 15}
				text="{k.share} · {k.absorbs ? 'absorbs infrared' : 'lets infrared through'}"
				anchor="start"
				size={11}
				color={k.absorbs ? 'var(--gh-ir)' : undefined}
				muted={!k.absorbs}
			/>
		</Readout>
	{/each}
	<Readout
		id="rule"
		order={10}
		label="Absorbed, not reflected"
		value="each absorbed photon is given off again in a random direction"
	>
		<Label
			x={636}
			y={392}
			text="Absorbed, then given off again"
			anchor="start"
			size={13}
			weight={700}
		/>
		<Label x={636} y={410} text="in a random direction: up, down" anchor="start" size={12} />
		<Label x={636} y={427} text="or sideways. Not reflected." anchor="start" size={12} />
	</Readout>
	<Readout id="scale">
		<Label
			x={636}
			y={468}
			text="Not to scale: for every CO₂ molecule"
			anchor="start"
			size={11}
			muted
		/>
		<Label x={636} y={484} text="the air has about 2,400 others." anchor="start" size={11} muted />
	</Readout>
</g>
