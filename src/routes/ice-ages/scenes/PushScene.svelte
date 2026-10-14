<script lang="ts">
	/**
	 * How small the orbital push is, and what amplifies it.
	 * Right (both phases): the changes in Earth's energy balance at the last
	 * glacial maximum, 21,000 years ago, against pre-industrial: the orbit's
	 * global annual mean (computed from La2004) and IPCC AR4's assessment of the
	 * greenhouse gases, the ice sheets and lower sea level, and dust plus
	 * vegetation; the global cooling AR6 assesses.
	 * - small, left: the orbit shuffles sunlight. From 127,000 to 116,000 years
	 *   ago summer sunshine at 65° N fell by over 100 W/m², while the sunlight
	 *   of the whole Earth over the whole year hardly moved (both computed).
	 * - ice, left: the ice–albedo loop, with marching arrows.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Flow, Label, scale, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { TODAY, globalMean, orbitAt, summerSunshine } from '../milankovitch';

	let { step, t, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'small'));
	const ice = $derived(phase === 'ice');
	const loop = new Tween(
		untrack(() => (phase === 'ice' ? 1 : 0)),
		{
			duration: 700,
			easing: cubicInOut
		}
	);
	$effect(() => {
		const on = ice;
		untrack(() => loop.set(on ? 1 : 0));
	});
	const grow = $derived(reduced ? 1 : smoothstep(0.3, 2.5, t));
	const tt = $derived(reduced ? 2.5 : t);

	// ------------------------------------------------------------ the shuffle (computed)
	const A = orbitAt(-127);
	const B = orbitAt(-116);
	const summerA = summerSunshine(A);
	const summerB = summerSunshine(B);
	const globalA = globalMean(A);
	const globalB = globalMean(B);
	const lgmOrbit = globalMean(orbitAt(-21)) - globalMean(TODAY);
	const bx = scale([0, 600], [70, 430]);

	// ------------------------------------------------------------ the energy balance at the LGM
	const bars = [
		{
			id: 'orbit',
			name: 'orbit (whole Earth, year)',
			v: lgmOrbit,
			color: 'var(--ia-sun)',
			note: 'computed'
		},
		{ id: 'ghg', name: 'greenhouse gases', v: -2.8, color: 'var(--ia-co2)', note: 'AR4' },
		{ id: 'ice', name: 'ice sheets, lower sea', v: -3.2, color: 'var(--ia-ice-edge)', note: 'AR4' },
		{
			id: 'dust',
			name: 'dust and vegetation',
			v: -2,
			color: 'var(--stage-ink-muted)',
			note: 'AR4, roughly'
		}
	];
	const RX = 690; // zero line
	const rx = scale([-4, 0], [RX - 220, RX]);
	const ROW0 = 150;
	const ROWH = 62;
	const barOpacity = (id: string) => (ice ? (id === 'ice' ? 1 : 0.4) : id === 'orbit' ? 1 : 0.75);
	const fmt = (v: number, d = 1) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(d);

	// ------------------------------------------------------------ the ice–albedo loop
	const LX = 250;
	const LY = 330;
	const LR = 120;
	const nodes = [
		{ a: -90, text: 'cooler summers in the north' },
		{ a: 0, text: 'snow survives the summer' },
		{ a: 90, text: 'ice sheets spread, brighter ground' },
		{ a: 180, text: 'more sunlight reflected' }
	];
	const pos = (a: number, r = LR) => ({
		x: LX + r * Math.cos((a * Math.PI) / 180),
		y: LY + r * Math.sin((a * Math.PI) / 180)
	});
	const arc = (a0: number, a1: number) => {
		const p0 = pos(a0);
		const p1 = pos(a1);
		return `M${p0.x.toFixed(1)} ${p0.y.toFixed(1)} A${LR} ${LR} 0 0 1 ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
	};
</script>

<g>
	<!-- ===================== left: the shuffle ===================== -->
	<g opacity={1 - loop.current} style:pointer-events="none">
		{#if loop.current < 0.98}
			<Readout
				id="shuffle-title"
				order={0}
				label="The orbit shuffles sunlight"
				value="127,000 → 116,000 years ago"
			>
				<Label
					x={40}
					y={60}
					text="The orbit shuffles sunlight"
					anchor="start"
					size={15}
					weight={700}
				/>
				<Label
					x={40}
					y={82}
					text="from 127,000 years ago (warm) to 116,000 (a glacial begins)"
					anchor="start"
					size={12}
					muted
				/>
			</Readout>
			{#each [{ y: 160, name: '65° N in June', a: summerA, b: summerB }, { y: 330, name: 'whole Earth, whole year', a: globalA, b: globalB }] as row (row.y)}
				<Label x={40} y={row.y} text={row.name} anchor="start" size={13} weight={700} />
				{#each [{ dy: 22, v: row.a, k: '127,000 yr ago' }, { dy: 58, v: row.b, k: '116,000 yr ago' }] as b (b.dy)}
					<rect
						x={bx(0)}
						y={row.y + b.dy}
						width={(bx(b.v) - bx(0)) * grow}
						height="24"
						rx="4"
						fill="var(--ia-sun)"
						opacity={b.dy === 22 ? 0.9 : 0.55}
					/>
					<Label
						x={bx(0) + 8}
						y={row.y + b.dy + 17}
						text={b.k}
						anchor="start"
						size={11}
						weight={600}
					/>
					<Label
						x={Math.max(bx(0) + (bx(b.v) - bx(0)) * grow, bx(0) + 120) + 8}
						y={row.y + b.dy + 17}
						text="{b.v.toFixed(row.y === 160 ? 0 : 2)} W/m²"
						anchor="start"
						size={12}
						weight={700}
					/>
				{/each}
			{/each}
			<Readout
				id="shuffle"
				order={1}
				label="Change"
				value="65° N June {fmt(summerB - summerA, 0)} W/m²; whole Earth {fmt(
					globalB - globalA,
					2
				)} W/m²"
				color="var(--ia-sun)"
			>
				<Label
					x={40}
					y={276}
					text="change: {fmt(summerB - summerA, 0)} W/m² ({fmt(
						((summerB - summerA) / summerA) * 100,
						0
					)}%)"
					anchor="start"
					size={13}
					weight={700}
					color="var(--ia-now)"
				/>
				<Label
					x={40}
					y={446}
					text="change: {fmt(globalB - globalA, 2)} W/m² ({fmt(
						((globalB - globalA) / globalA) * 100,
						2
					)}%)"
					anchor="start"
					size={13}
					weight={700}
				/>
			</Readout>
		{/if}
	</g>

	<!-- ===================== left: the ice–albedo loop ===================== -->
	<g opacity={loop.current}>
		{#if loop.current > 0.02}
			<Readout
				id="loop-title"
				order={0}
				label="Ice–albedo feedback"
				value="a loop that amplifies cooling"
			>
				<Label
					x={40}
					y={60}
					text="Amplifier: the ice–albedo loop"
					anchor="start"
					size={15}
					weight={700}
				/>
			</Readout>
			{#each nodes as n, i (n.a)}
				<Flow
					d={arc(n.a + 14, nodes[(i + 1) % 4].a + (i === 3 ? 360 : 0) - 14)}
					color="var(--ia-ice-edge)"
					width={3}
					dash={8}
					t={tt}
					speed={30}
					arrow
				/>
			{/each}
			{#each nodes as n (n.a)}
				{@const p = pos(n.a)}
				<circle
					cx={p.x}
					cy={p.y}
					r="9"
					fill="var(--ia-ice)"
					stroke="var(--ia-ice-edge)"
					stroke-width="2"
				/>
				<Readout id="node-{n.a}">
					<Label
						x={p.x}
						y={p.y + (n.a === 90 ? 30 : -20)}
						text={n.text}
						anchor="middle"
						size={12}
						weight={600}
						pill
					/>
				</Readout>
			{/each}
			<Readout id="loop-note">
				<Label x={LX} y={LY + 4} text="each turn adds cooling" size={12} muted />
			</Readout>
		{/if}
	</g>

	<!-- ===================== right: the energy balance at the LGM ===================== -->
	<Readout
		id="lgm-title"
		order={2}
		label="21,000 years ago"
		value="changes in the energy balance vs pre-industrial"
	>
		<Label
			x={RX - 220}
			y={60}
			text="Energy balance 21,000 years ago"
			anchor="start"
			size={15}
			weight={700}
		/>
		<Label
			x={RX - 220}
			y={82}
			text="change from pre-industrial, W/m²"
			anchor="start"
			size={12}
			muted
		/>
	</Readout>
	<line x1={RX} x2={RX} y1={ROW0 - 30} y2={ROW0 + ROWH * 4 - 12} stroke="var(--stage-line)" />
	{#each [-4, -3, -2, -1, 0] as v (v)}
		<text x={rx(v)} y={ROW0 + ROWH * 4 + 4} text-anchor="middle" font-size="11" class="muted"
			>{v === 0 ? '0' : `−${-v}`}</text
		>
	{/each}
	{#each bars as b, i (b.id)}
		{@const y = ROW0 + i * ROWH}
		<g opacity={barOpacity(b.id)}>
			<rect
				x={b.v < 0 ? RX + (rx(b.v) - RX) * grow : RX}
				y={y - 12}
				width={Math.max(2, Math.abs(rx(b.v) - RX) * grow)}
				height="24"
				rx="4"
				fill={b.color}
				opacity="0.85"
			/>
			<Readout
				id="bar-{b.id}"
				order={3 + i}
				label={b.name}
				value="{fmt(b.v, b.id === 'orbit' ? 2 : 1)} W/m² ({b.note})"
				color={b.color}
			>
				<Label x={RX + 12} y={y - 2} text={b.name} anchor="start" size={12} weight={700} />
				<Label
					x={RX + 12}
					y={y + 14}
					text="{fmt(b.v, b.id === 'orbit' ? 2 : 1)} W/m² · {b.note}"
					anchor="start"
					size={11}
					muted
				/>
			</Readout>
		</g>
	{/each}
	<Readout
		id="total"
		order={7}
		label="In all"
		value="about −8 W/m²: the world 5–7 °C colder"
		color="var(--ia-temp)"
	>
		<Label
			x={RX - 220}
			y={ROW0 + ROWH * 4 + 40}
			text="in all about −8 W/m²"
			anchor="start"
			size={13}
			weight={700}
		/>
		<Label
			x={RX - 220}
			y={ROW0 + ROWH * 4 + 62}
			text="the world 5–7 °C colder, the sea 125–134 m lower"
			anchor="start"
			size={13}
			weight={700}
			color="var(--ia-temp)"
		/>
	</Readout>
</g>
