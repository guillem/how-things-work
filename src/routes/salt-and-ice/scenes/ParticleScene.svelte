<script lang="ts">
	/**
	 * Ice zoomed in: water particles in a neat stack (ten rows), with loose particles tumbling in
	 * a water layer on top. The edge between them moves as particles join or break off.
	 *
	 * Stack step: plain water at the slider's temperature. Below 0 °C the water layer freezes onto
	 * the stack, above it the top rows melt, at 0 °C the edge stays put.
	 * Salt step: −5 °C. Plain, everything is ice. With salt, grains fall on top and dissolve; the
	 * top rows melt into salty water until the water is as dilute as the model's balance at −5 °C
	 * (the readouts show its saltiness and freezing point as it melts).
	 */
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Label, hash, clamp } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { EUTECTIC, freezingPoint, saltinessAt } from '../model';
	import { degrees } from '../format';
	import Thermometer from './Thermometer.svelte';

	let { step, t, params, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'stack'));
	const salted = $derived(phase === 'salt' && params.salted === true);
	const temp = $derived(phase === 'stack' ? Number(params.water ?? 0) : -5);

	// ---- the lattice ------------------------------------------------------------------------------
	const COLS = 16;
	const ROWS = 10;
	const DX = 38;
	const DY = 33;
	const R = 16;
	const X0 = 76;
	const Y0 = 536;
	const N = COLS * ROWS;
	const site = (k: number) => {
		const row = Math.floor(k / COLS);
		const col = k % COLS;
		return { x: X0 + col * DX + (row % 2 ? DX / 2 : 0), y: Y0 - row * DY };
	};
	/** Top of the water layer: the particles take as much room loose as stacked. */
	const TOP = Y0 - (ROWS - 1) * DY - R;

	// ---- how many particles are stacked -------------------------------------------------------------
	// Stack step: 7 rows at 0 °C; freezing fills all 10, melting leaves 4. Salt step: plain, all
	// 10 rows are ice; salted, it melts down to the balance (3 rows' worth of water).
	const SALT_ROWS = 3;
	const levelTarget = $derived(
		phase === 'stack' ? (temp < 0 ? ROWS : temp > 0 ? 4 : 7) : salted ? ROWS - SALT_ROWS : ROWS
	);
	// The edge moves slowly, like real melting and freezing.
	const level = Tween.of(() => levelTarget, { duration: 5000, easing: cubicInOut });
	const rows = $derived(reduced ? levelTarget : level.current);
	const stacked = $derived(rows * COLS);
	/** How far the salted melting has gone, 0–1. */
	const meltDone = $derived(salted ? clamp((ROWS - rows) / SALT_ROWS) : 0);
	// The salty water: it starts as strong as salty water can be (the salt dissolving into the
	// first melt) and is diluted by each particle that breaks off, down to the balance at −5 °C.
	const balance = saltinessAt(-5) ?? 0;
	// Water per gram of salt, from the first melt to the balance.
	const w0 = (100 - EUTECTIC.salt) / EUTECTIC.salt;
	const w1 = (100 - balance) / balance;
	const saltiness = $derived(100 / (1 + w0 + (w1 - w0) * meltDone));
	const freezesAt = $derived(freezingPoint(saltiness));

	// ---- particles ------------------------------------------------------------------------------------
	/** A loose particle tumbles about near its own place: as much room loose as stacked. */
	function loose(k: number) {
		const s = site(k);
		const sp = reduced ? 0 : 1;
		return {
			x: s.x + (hash(k, 1) - 0.5) * 18 + Math.sin(t * (1.2 + hash(k, 3)) * sp + k) * 7,
			y: s.y + (hash(k, 2) - 0.5) * 10 + Math.cos(t * (1 + hash(k, 4)) * sp + k * 1.3) * 5
		};
	}
	const particles = $derived(
		Array.from({ length: N }, (_, k) => {
			const s = site(k);
			// Particles near the edge blend between their place and the water.
			const u = clamp(stacked - k + 0.5, 0, 1);
			const l = loose(k);
			const jig = reduced ? 0 : Math.sin(t * 6 + k * 2.1) * 1.2;
			return {
				k,
				x: l.x + (s.x + jig - l.x) * u,
				y: l.y + (s.y - l.y) * u,
				fixed: u > 0.5
			};
		})
	);

	// Salt: grains fall onto the ice, then their particles spread through the salty water.
	const SALT = 16;
	const fall = Tween.of(() => (salted ? 1 : 0), { duration: 1200, easing: cubicInOut });
	const fallen = $derived(reduced ? (salted ? 1 : 0) : fall.current);
	const salt = $derived(
		Array.from({ length: SALT }, (_, i) => {
			// Before the melt: grains on the ice. Then each spreads to a spot in the salty water.
			const gx = X0 + (0.1 + 0.8 * hash(i, 8)) * COLS * DX;
			const gy = TOP - 60 + fallen * 50;
			const firstLoose = Math.ceil(rows - 0.01);
			const row = Math.min(ROWS - 1, firstLoose + Math.floor(hash(i, 5) * (ROWS - firstLoose)));
			const wob = reduced ? 0 : 1;
			const lx = X0 + (hash(i, 9) * (COLS - 1) + 0.5) * DX + Math.sin(t * 1.4 * wob + i) * 6;
			const ly = Y0 - row * DY - DY / 2 + Math.cos(t * 1.1 * wob + i * 2) * 4;
			const spread = clamp((meltDone - 0.05) / 0.4);
			return { i, x: gx + (lx - gx) * spread, y: gy + (ly - gy) * spread };
		})
	);

	const verdict = $derived.by(() => {
		if (phase === 'stack') {
			if (temp < 0) return 'joining wins: the water freezes';
			if (temp > 0) return 'breaking off wins: the ice melts';
			return 'just as many join as break off';
		}
		if (!salted) return 'plain water: at −5 °C it all stays ice';
		if (meltDone < 0.999) return 'salt in the way: breaking off wins';
		return 'balanced again: the melting stops';
	});
</script>

<g class="sa-particles">
	<!-- the water layer's extent and the stack's -->
	<rect
		x={X0 - R - 8}
		y={TOP - 16}
		width={COLS * DX + DX / 2 + 2 * R}
		height={Y0 - TOP + R + 24}
		rx="12"
		fill="var(--sa-zoom)"
		stroke="var(--border)"
		stroke-width="1.5"
	/>
	{#each particles as p (p.k)}
		<circle
			cx={p.x}
			cy={p.y}
			r={R}
			fill={p.fixed ? 'var(--sa-ice-particle)' : 'var(--sa-water-particle)'}
			stroke="var(--sa-particle-edge)"
			stroke-width="1.5"
		/>
	{/each}
	{#if phase === 'salt'}
		{#each salt as s (s.i)}
			<circle
				cx={s.x}
				cy={s.y}
				r={salted ? 9 : 0}
				fill="var(--sa-salt-particle)"
				stroke="var(--sa-salt-edge)"
				stroke-width="1.5"
				opacity={fallen}
			/>
		{/each}
	{/if}

	<!-- key -->
	<Readout id="sa-key-ice" order={10} label="water in the ice" color="var(--sa-ice-particle)">
		<circle
			cx={X0}
			cy={40}
			r="11"
			fill="var(--sa-ice-particle)"
			stroke="var(--sa-particle-edge)"
			stroke-width="1.5"
		/>
		<Label x={X0 + 20} y={45} text="water in the ice" anchor="start" size={15} />
	</Readout>
	<Readout id="sa-key-loose" order={11} label="loose water" color="var(--sa-water-particle)">
		<circle
			cx={X0 + 190}
			cy={40}
			r="11"
			fill="var(--sa-water-particle)"
			stroke="var(--sa-particle-edge)"
			stroke-width="1.5"
		/>
		<Label x={X0 + 210} y={45} text="loose water" anchor="start" size={15} />
	</Readout>
	{#if phase === 'salt'}
		<Readout id="sa-key-salt" order={12} label="salt" color="var(--sa-salt-particle)">
			<circle
				cx={X0 + 350}
				cy={40}
				r="8"
				fill="var(--sa-salt-particle)"
				stroke="var(--sa-salt-edge)"
				stroke-width="1.5"
			/>
			<Label x={X0 + 366} y={45} text="salt" anchor="start" size={15} />
		</Readout>
	{/if}
	<Readout id="sa-zoom">
		<Label
			x={X0 - 10}
			y={84}
			text="ice, zoomed in tens of millions of times"
			anchor="start"
			size={14}
			muted
		/>
	</Readout>

	<!-- the thermometer and the readouts -->
	<Thermometer x={800} y={70} height={250} {temp} />
	<Readout id="sa-ptemp" order={1} label="Thermometer" value={degrees(temp)}>
		<Label x={812} y={440} text={degrees(temp)} size={24} weight={700} tabular />
	</Readout>
	<Readout id="sa-pverdict" order={2} label="At the edge" value={verdict}>
		<Label
			x={X0 + (COLS * DX) / 2}
			y={TOP - 34}
			text={verdict}
			size={19}
			weight={700}
			color={phase === 'stack' && temp === 0
				? undefined
				: (phase === 'stack' ? temp > 0 : salted && meltDone < 0.999)
					? 'var(--sa-melt)'
					: 'var(--sa-freeze)'}
		/>
	</Readout>
	{#if salted}
		<Readout
			id="sa-saltiness"
			order={3}
			label="Salt in the water"
			value="{Math.round(saltiness)} g in 100 g"
		>
			<Label x={812} y={490} text="salty water:" size={14} muted />
			<Label
				x={812}
				y={512}
				text="{Math.round(saltiness)} g of salt in 100 g"
				size={16}
				weight={700}
				tabular
			/>
		</Readout>
		<Readout id="sa-freezes" order={4} label="That water freezes at" value={degrees(freezesAt)}>
			<Label
				x={812}
				y={544}
				text="freezes at {degrees(freezesAt)}"
				size={16}
				weight={700}
				tabular
			/>
		</Readout>
	{/if}
</g>
