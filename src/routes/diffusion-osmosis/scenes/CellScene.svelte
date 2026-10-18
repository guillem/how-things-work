<script lang="ts">
	/**
	 * One cell in a beaker of salt or sugar water (../model.ts): a red blood cell (`kind`
	 * 'blood', control `salt`: Boyle–van 't Hoff with no wall, bursting when it would need more
	 * volume than a sphere of its membrane holds) or a potato cell (`kind` 'potato', control
	 * `sucrose`: the same plus a wall that presses back, so it firms up instead of bursting and
	 * pulls away from the wall in strong solutions). Beside it, the settled volume (blood) or the
	 * potato's change of mass against the outside concentration, with the reader's point.
	 *
	 * The cell's volume moves to its new balance with a Tween (1.6 s, a smooth reaction to the
	 * control); while it moves, small arrows show water crossing the membrane. Dissolved
	 * particles outside bounce in straight lines, as a pure function of `t`.
	 */
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { untrack } from 'svelte';
	import { Axes, Label, hash, linePath, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		POTATO_TOUCH,
		RBC,
		RBC_MAX,
		potatoCell,
		rbcBursts,
		rbcVolume,
		saltOsm,
		sugarOsm
	} from '../model';

	let { step, t, params, reduced }: StageProps = $props();

	const blood = $derived(step.hints?.kind !== 'potato');
	const salt = $derived(Number(params.salt ?? 0.9));
	const sucrose = $derived(Number(params.sucrose ?? 0));
	const VMAX = RBC_MAX / RBC.v0;

	const bursts = $derived(blood && rbcBursts(saltOsm(salt)));
	const plant = $derived(potatoCell(sugarOsm(sucrose)));
	const target = $derived(blood ? Math.min(VMAX, rbcVolume(saltOsm(salt))) : plant.v);

	const vol = new Tween(1, { duration: 1600, easing: cubicInOut });
	$effect(() => {
		const v = target;
		untrack(() => vol.set(v, reduced ? { duration: 0 } : undefined));
	});
	const v = $derived(reduced ? target : vol.current);
	const moving = $derived(Math.abs(target - v) > 0.01);
	const inward = $derived(target > v);
	const burst = $derived(bursts && v > VMAX - 0.01);

	// ---- the beaker and its dissolved particles ------------------------------------------------
	const BX0 = 40;
	const BX1 = 520;
	const BY0 = 70;
	const BY1 = 500;
	const CX = 280;
	const CY = 285;
	const tri = (u: number) => 1 - Math.abs(2 * (u - Math.floor(u)) - 1);
	/** Outside particles: as many as the concentration, never drawn inside the cell. */
	const outsideN = $derived(blood ? Math.round(salt * 30) : Math.round(sucrose * 80));
	const outside = $derived.by(() => {
		const out: { x: number; y: number }[] = [];
		for (let i = 0; i < outsideN; i++) {
			const x = BX0 + 10 + tri(0.05 + 0.08 * hash(i, 3) * t + hash(i, 4)) * (BX1 - BX0 - 20);
			const y = BY0 + 10 + tri(0.04 + 0.07 * hash(i, 5) * t + hash(i, 6)) * (BY1 - BY0 - 20);
			const clear = blood
				? Math.hypot(x - CX, y - CY) > rbcR * 1.7 + 8
				: Math.abs(x - CX) > ww / 2 + 10 || Math.abs(y - CY) > wh / 2 + 10;
			if (clear) out.push({ x, y });
		}
		return out;
	});
	const dissolved = $derived(blood ? 'var(--do-salt)' : 'var(--do-sugar)');

	// ---- red blood cell ------------------------------------------------------------------------
	const UM = 22; // px per µm
	/** Face-on radius: a 3.9 µm disc that rounds into a 3.34 µm ball as it swells. */
	const R_DISC = 3.9;
	const R_BALL = Math.cbrt((3 * RBC_MAX) / (4 * Math.PI));
	const swell = $derived(Math.max(0, Math.min(1, (v - 1) / (VMAX - 1))));
	const rbcR = $derived(
		(v >= 1 ? R_DISC + (R_BALL - R_DISC) * swell : R_DISC * Math.sqrt(0.55 + 0.45 * v)) * UM
	);
	/** Crinkles (spikes) when shrunk. */
	const rbcPath = $derived.by(() => {
		const spikes = v < 0.97 ? Math.min(1, (1 - v) / 0.4) : 0;
		let d = '';
		for (let i = 0; i <= 96; i++) {
			const a = (i / 96) * 2 * Math.PI;
			const r = rbcR * (1 + 0.07 * spikes * Math.max(0, Math.cos(14 * a)) ** 3);
			d += `${i ? 'L' : 'M'}${(CX + r * Math.cos(a)).toFixed(1)} ${(CY + r * Math.sin(a)).toFixed(1)}`;
		}
		return `${d}Z`;
	});
	/** The dimple fades as the disc becomes a ball. */
	const dimple = $derived(v >= 1 ? 1 - swell : 1);

	// ---- potato cell -------------------------------------------------------------------------
	const WALL_W = 250;
	const WALL_H = 180;
	/** The wall grows a little with the cell once it is pressed; below that it stays put. */
	const wallScale = $derived(Math.cbrt(Math.max(v, POTATO_TOUCH) / POTATO_TOUCH));
	const ww = $derived(WALL_W * wallScale);
	const wh = $derived(WALL_H * wallScale);
	/** The protoplast fills the wall when pressed, and shrinks inside it when plasmolysed. */
	const proto = $derived(Math.sqrt(Math.min(1, v / POTATO_TOUCH)));
	const pw = $derived((ww - 18) * proto);
	const ph = $derived((wh - 18) * proto);
	const pr = $derived(14 + (1 - proto) * 60);

	// ---- water arrows across the membrane -----------------------------------------------------
	const arrows = $derived.by(() => {
		if (!moving || burst) return [];
		const rr = blood ? rbcR : Math.min(pw, ph) / 2;
		return [0, 1, 2, 3, 4, 5].map((i) => {
			const a = (i / 6) * 2 * Math.PI + 0.4;
			const r0 = blood ? rr : rr;
			const ex = blood ? 1 : pw / Math.min(pw, ph);
			const ey = blood ? 1 : ph / Math.min(pw, ph);
			const out = { x: CX + (r0 + 34) * Math.cos(a) * ex, y: CY + (r0 + 34) * Math.sin(a) * ey };
			const inn = { x: CX + (r0 - 6) * Math.cos(a) * ex, y: CY + (r0 - 6) * Math.sin(a) * ey };
			return inward ? { k: i, a: out, b: inn } : { k: i, a: inn, b: out };
		});
	});

	// ---- chart -----------------------------------------------------------------------------------
	const GX0 = 620;
	const GX1 = 920;
	const gx = $derived(scale(blood ? [0, 3] : [0, 1], [GX0, GX1]));
	const gy = $derived(blood ? scale([0, 2], [470, 180]) : scale([-40, 20], [470, 180]));
	const xs = $derived(Array.from({ length: 121 }, (_, i) => (i / 120) * (blood ? 3 : 1)));
	const curve = $derived(
		blood
			? linePath(
					xs.filter((p) => !rbcBursts(saltOsm(p))),
					(p) => p,
					(p) => rbcVolume(saltOsm(p)),
					gx,
					gy
				)
			: linePath(
					xs,
					(p) => p,
					(p) => (potatoCell(sugarOsm(p)).v - 1) * 100,
					gx,
					gy
				)
	);
	const pointY = $derived(
		blood ? gy(Math.min(VMAX, rbcVolume(saltOsm(salt)))) : gy((plant.v - 1) * 100)
	);
	const pointX = $derived(gx(blood ? salt : sucrose));

	// ---- words -------------------------------------------------------------------------------
	const pct = (x: number) => `${Math.round(x * 100)} %`;
	const signed = (x: number) => `${x >= 0 ? '+' : '−'}${Math.abs(x * 100).toFixed(0)} %`;
	const solution = $derived(
		blood
			? salt === 0
				? 'pure water'
				: `${salt.toFixed(2)} % salt water`
			: sucrose === 0
				? 'pure water'
				: `${sucrose.toFixed(2)} mol/L sugar water`
	);
	const state = $derived.by(() => {
		const settledV = target;
		if (blood) {
			if (bursts) return 'swells into a ball and bursts';
			if (settledV > 1.03) return 'swells';
			if (settledV < 0.97) return 'shrinks and crinkles';
			return 'holds its shape';
		}
		if (plant.turgor === 0) return 'loses water: pulls away from the wall';
		if (settledV > 1.02) return `firm: wall presses back with ${plant.turgor.toFixed(2)} MPa`;
		if (settledV < 0.98) return 'loses a little water';
		return 'holds: no change';
	});
</script>

<g>
	<!-- beaker -->
	<rect x={BX0} y={BY0} width={BX1 - BX0} height={BY1 - BY0} rx="10" fill="var(--do-water)" />
	{#each outside as p, i (i)}
		<circle cx={p.x} cy={p.y} r="3.2" fill={dissolved} opacity="0.85" />
	{/each}

	{#if blood}
		{#if burst}
			<circle cx={CX} cy={CY} r={rbcR * 1.6} fill="var(--do-rbc)" opacity="0.12" />
			<circle
				cx={CX}
				cy={CY}
				r={rbcR}
				fill="none"
				stroke="var(--do-rbc)"
				stroke-width="1.5"
				stroke-dasharray="10 7"
				opacity="0.7"
			/>
			<Label x={CX} y={CY + 5} text="burst" size={15} weight={600} color="var(--do-rbc-text)" />
		{:else}
			<path d={rbcPath} fill="var(--do-rbc)" stroke="var(--do-rbc-edge)" stroke-width="1.5" />
			<circle cx={CX} cy={CY} r={rbcR * 0.45} fill="var(--do-rbc-pale)" opacity={0.75 * dimple} />
		{/if}
	{:else}
		<!-- wall -->
		<rect
			x={CX - ww / 2}
			y={CY - wh / 2}
			width={ww}
			height={wh}
			rx="16"
			fill="var(--do-wall-fill)"
			stroke="var(--do-wall)"
			stroke-width="7"
		/>
		<!-- protoplast: membrane, cytoplasm and vacuole -->
		<rect
			x={CX - pw / 2}
			y={CY - ph / 2}
			width={pw}
			height={ph}
			rx={pr}
			fill="var(--do-cyto)"
			stroke="var(--do-membrane)"
			stroke-width="1.5"
		/>
		<rect
			x={CX - pw / 2 + 16}
			y={CY - ph / 2 + 14}
			width={Math.max(10, pw - 32)}
			height={Math.max(10, ph - 28)}
			rx={Math.max(6, pr - 8)}
			fill="var(--do-sap)"
			opacity="0.9"
		/>
		<Readout id="vacuole">
			<Label x={CX} y={CY + 4} text="vacuole (sap)" size={11} muted />
		</Readout>
		{#each Array.from({ length: 6 }, (_, i) => i) as i (i)}
			<circle
				cx={CX - pw / 2 + 9}
				cy={CY - ph / 2 + 22 + (i * (ph - 44)) / 5}
				r="3.5"
				fill="var(--do-starch)"
			/>
		{/each}
	{/if}

	{#each arrows as a (a.k)}
		<line
			x1={a.a.x}
			y1={a.a.y}
			x2={a.b.x}
			y2={a.b.y}
			stroke="var(--do-flow)"
			stroke-width="2.5"
			marker-end="url(#arrowhead)"
			style:color="var(--do-flow)"
		/>
	{/each}

	<rect
		x={BX0}
		y={BY0}
		width={BX1 - BX0}
		height={BY1 - BY0}
		rx="10"
		fill="none"
		stroke="var(--stage-line)"
		stroke-width="1.5"
	/>
	<Readout id="outside" order={1} label="Outside" value={solution}>
		<Label x={BX0} y={BY0 - 14} text="outside: {solution}" size={14} weight={600} anchor="start" />
	</Readout>
	<Readout id="key">
		<Label
			x={BX1}
			y={BY0 - 14}
			text={blood ? 'dots: salt ions' : 'dots: sugar molecules'}
			size={11}
			anchor="end"
			muted
		/>
	</Readout>
	<Readout id="cell" order={2} label={blood ? 'Red blood cell' : 'Potato cell'} value={state}>
		<Label
			x={(BX0 + BX1) / 2}
			y={BY1 + 30}
			text="{blood ? 'red blood cell' : 'potato cell'}: {state}"
			size={14}
			weight={600}
		/>
	</Readout>
	<Readout id="volume" order={3} label="Volume" value={burst ? 'burst' : `${pct(v)} of normal`}>
		<Label
			x={(BX0 + BX1) / 2}
			y={BY1 + 52}
			text={burst
				? `it needed more than ${pct(VMAX)} of its normal volume`
				: `volume: ${pct(v)} of ${blood ? 'normal' : 'fresh'}`}
			size={12}
			tabular
		/>
	</Readout>

	<!-- chart -->
	{#if blood}
		<Axes
			sx={gx}
			sy={gy}
			xTicks={[0, 0.5, 0.9, 1.5, 2, 3]}
			yTicks={[0, 0.5, 1, 1.5, 2]}
			yFormat={(p) => `${Math.round(p * 100)}%`}
			xFormat={(p) => `${p}`}
			xLabel="salt (%)"
		/>
		<line
			x1={GX0}
			x2={GX1}
			y1={gy(VMAX)}
			y2={gy(VMAX)}
			stroke="var(--do-rbc)"
			stroke-dasharray="5 4"
			stroke-width="1.2"
		/>
		<Readout id="burst-line">
			<Label
				x={GX1}
				y={gy(VMAX) - 8}
				text="bursts above this volume"
				size={11}
				anchor="end"
				color="var(--do-rbc-text)"
			/>
		</Readout>
	{:else}
		<Axes
			sx={gx}
			sy={gy}
			xTicks={[0, 0.2, 0.4, 0.6, 0.8, 1]}
			yTicks={[-40, -20, 0, 20]}
			yFormat={(p) => `${p > 0 ? '+' : ''}${p}%`}
			xLabel="sugar (mol/L)"
		/>
		<line
			x1={GX0}
			x2={GX1}
			y1={gy(0)}
			y2={gy(0)}
			stroke="var(--stage-ink-muted)"
			stroke-width="1"
		/>
	{/if}
	<path d={curve} fill="none" stroke="var(--do-curve)" stroke-width="2.2" />
	<circle
		cx={pointX}
		cy={pointY}
		r="7"
		fill={blood ? 'var(--do-rbc)' : 'var(--do-wall)'}
		stroke="var(--stage-bg)"
		stroke-width="2"
	/>
	<Readout id="chart-title">
		<Label
			x={GX0}
			y={120}
			text={blood ? 'settled volume of the cell' : 'change in mass of potato pieces'}
			size={13}
			weight={600}
			anchor="start"
		/>
	</Readout>
	{#if !blood}
		<Readout id="mass" order={4} label="Mass change" value={signed(plant.v - 1)}>
			<Label
				x={GX0}
				y={140}
				text="{signed(plant.v - 1)} at {sucrose.toFixed(2)} mol/L"
				size={12}
				anchor="start"
				tabular
			/>
		</Readout>
	{/if}
</g>
