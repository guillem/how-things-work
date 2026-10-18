<script lang="ts">
	/**
	 * Air over a column of surface seawater. CO₂ molecules drift in the air (as many as the air's
	 * ppm says) and cross the surface both ways; in the water, 100 dots stand for 100 atoms of
	 * dissolved carbon, coloured by their form. On the right, the three forms per kilogram of
	 * water, each bar with a mark at its pre-industrial value, and a card for the step's point:
	 * Henry's law (`focus` 'dissolve'), the two reactions and their sum ('react'), or the pH and
	 * the few free hydrogen ions ('buffer').
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Label, Molecule, cycle, hash, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { fromAir, PPM_PREINDUSTRIAL } from '../model';
	import { C, change, fmtPpm, fmtT, fmtUmol, ppmOf, tempOf, waterAt } from './shared';

	let { step, t, params, reduced }: StageProps = $props();

	const focus = $derived(String(step.hints?.focus ?? 'dissolve'));
	const ppm = $derived(ppmOf(params));
	const T = $derived(tempOf(params));
	const water = $derived(waterAt(T));
	const s = $derived(fromAir(ppm, water));
	const s0 = $derived(fromAir(PPM_PREINDUSTRIAL, water));

	// the step's emphasis, smoothed between steps
	const o = new Tween({ co2: 1, ions: 0.5, waffle: 0.5 }, { duration: 700, easing: cubicInOut });
	const target = $derived(
		focus === 'dissolve'
			? { co2: 1, ions: 0.45, waffle: 0.5 }
			: focus === 'react'
				? { co2: 1, ions: 1, waffle: 1 }
				: { co2: 0.5, ions: 0.5, waffle: 0.6 }
	);
	$effect(() => {
		const v = target;
		const duration = reduced ? 0 : 700;
		untrack(() => o.set(v, { duration }));
	});

	// ---------------------------------------------------------------- the air and the surface
	const AIR_TOP = 40;
	const SURF = 196;
	const LEFT = 24;
	const RIGHT = 470;
	const BOTTOM = 572;

	/** Molecules in the air: one per 40 ppm. */
	const nAir = $derived(Math.round(ppm / 40));
	const airMols = $derived.by(() => {
		const out: { id: number; x: number; y: number; r: number }[] = [];
		for (let i = 0; i < nAir; i++) {
			const speed = 6 + 10 * hash(i, 3);
			const x0 = hash(i, 1) * (RIGHT - LEFT - 40);
			const x = LEFT + 20 + ((x0 + t * speed) % (RIGHT - LEFT - 40));
			const y = 92 + hash(i, 2) * 76 + 5 * Math.sin(t * 0.9 + 6 * hash(i, 4));
			out.push({ id: i, x, y, r: 360 * hash(i, 5) + t * 30 * (hash(i, 6) - 0.5) });
		}
		return out;
	});

	/** Molecules crossing the surface: as many down as up (equilibrium), more when the air holds more. */
	const nCross = $derived(reduced ? 0 : Math.max(2, Math.round(ppm / 140)));
	const crossing = $derived.by(() => {
		const out: { id: string; x: number; y: number; op: number }[] = [];
		for (let i = 0; i < nCross; i++) {
			for (const dir of [1, -1]) {
				const u = cycle(t, 5.5, hash(i, dir > 0 ? 7 : 8));
				const x = LEFT + 50 + hash(i, dir > 0 ? 9 : 10) * (RIGHT - LEFT - 100);
				const y = dir > 0 ? 150 + u * 90 : 240 - u * 90;
				const op = smoothstep(0, 0.15, u) * (1 - smoothstep(0.85, 1, u));
				out.push({ id: `${i}${dir}`, x, y, op });
			}
		}
		return out;
	});

	const surfacePath = $derived.by(() => {
		let d = `M${LEFT} ${SURF}`;
		for (let x = LEFT; x <= RIGHT; x += 12) {
			const y = SURF + 3 * Math.sin(x / 26 + t * 1.2);
			d += `L${x} ${y.toFixed(1)}`;
		}
		return d;
	});

	// ---------------------------------------------------------------- the waffle of 100 carbons
	/** Largest-remainder rounding of the three shares to 100 dots. */
	const counts = $derived.by(() => {
		const shares = [s.co2 / s.dic, s.co3 / s.dic, s.hco3 / s.dic].map((f) => f * 100);
		const base = shares.map(Math.floor);
		let left = 100 - base.reduce((a, b) => a + b, 0);
		const order = shares.map((v, i) => [v - Math.floor(v), i] as const).sort((a, b) => b[0] - a[0]);
		for (const [, i] of order) {
			if (left <= 0) break;
			base[i]++;
			left--;
		}
		return { co2: base[0], co3: base[1], hco3: base[2] };
	});
	const WX = 74;
	const WY = 312;
	const DX = 36;
	const DY = 26;
	const dots = $derived.by(() => {
		const out: { id: number; x: number; y: number; fill: string }[] = [];
		for (let i = 0; i < 100; i++) {
			const fill = i < counts.co2 ? C.co2 : i < counts.co2 + counts.co3 ? C.co3 : C.hco3;
			const col = i % 10;
			const row = Math.floor(i / 10);
			const jx = 2.2 * Math.sin(t * 1.3 + 7 * hash(i, 11));
			const jy = 2.2 * Math.cos(t * 1.1 + 7 * hash(i, 12));
			out.push({ id: i, x: WX + col * DX + jx, y: WY + row * DY + jy, fill });
		}
		return out;
	});

	// ---------------------------------------------------------------- bars
	const BX = 504;
	const BW = 300;
	const rows = $derived([
		{
			id: 'co2',
			name: 'dissolved CO₂',
			max: 100,
			now: s.co2,
			then: s0.co2,
			fill: C.co2,
			text: C.co2Text,
			op: o.current.co2
		},
		{
			id: 'hco3',
			name: 'bicarbonate HCO₃⁻',
			max: 2500,
			now: s.hco3,
			then: s0.hco3,
			fill: C.hco3,
			text: C.hco3Text,
			op: o.current.ions
		},
		{
			id: 'co3',
			name: 'carbonate CO₃²⁻',
			max: 350,
			now: s.co3,
			then: s0.co3,
			fill: C.co3,
			text: C.co3Text,
			op: o.current.ions
		}
	]);
	/** Which bars are listed under the stage on phones (the step's own, to keep the panel short). */
	const listed = (id: string) =>
		focus === 'react' || (focus === 'dissolve' ? id === 'co2' : id === 'co3');
	const rowY = (i: number) => 104 + i * 64;

	// ---------------------------------------------------------------- the cards
	const CX = 500;
	const CY = 290;
	const CW = 436;
	const CH = 282;
	const dHCO3 = $derived(s.hco3 - s0.hco3);
	const dCO3 = $derived(s.co3 - s0.co3);
	const signed = (v: number) => (v >= 0 ? `+${Math.round(v)}` : `−${Math.round(-v)}`);
	interface Part {
		t: string;
		c?: string;
	}
	const r1: Part[] = [
		{ t: 'CO₂', c: C.co2Text },
		{ t: ' + H₂O → ' },
		{ t: 'H⁺', c: C.hText },
		{ t: ' + ' },
		{ t: 'HCO₃⁻', c: C.hco3Text }
	];
	const r2: Part[] = [
		{ t: 'H⁺', c: C.hText },
		{ t: ' + ' },
		{ t: 'CO₃²⁻', c: C.co3Text },
		{ t: ' → ' },
		{ t: 'HCO₃⁻', c: C.hco3Text }
	];
	const rNet: Part[] = [
		{ t: 'net:  ' },
		{ t: 'CO₂', c: C.co2Text },
		{ t: ' + ' },
		{ t: 'CO₃²⁻', c: C.co3Text },
		{ t: ' + H₂O → 2 ' },
		{ t: 'HCO₃⁻', c: C.hco3Text }
	];
	/** The H⁺ that hops from the first reaction to the second. */
	const hop = $derived(reduced ? 0.5 : cycle(t, 3.2));
	const hopX = $derived(CX + 236 + (CX + 40 - (CX + 236)) * smoothstep(0.2, 0.8, hop));
	const hopY = $derived(CY + 64 + 60 * smoothstep(0.2, 0.8, hop) - 26 * Math.sin(Math.PI * hop));
</script>

{#snippet formula(y: number, weight: number, parts: Part[])}
	<text x={CX + 20} {y} font-size="16" font-weight={weight} style:white-space="pre">
		{#each parts as p, i (i)}<tspan fill={p.c}>{p.t}</tspan>{/each}
	</text>
{/snippet}

<g>
	<!-- the air and the sea -->
	<rect x={LEFT} y={AIR_TOP} width={RIGHT - LEFT} height={SURF - AIR_TOP} rx="12" fill={C.air} />
	<rect x={LEFT} y={SURF} width={RIGHT - LEFT} height={BOTTOM - SURF} rx="6" fill={C.water} />
	<rect x={LEFT} y={SURF} width={RIGHT - LEFT} height="14" fill={C.water} />
	<path d={surfacePath} fill="none" stroke={C.waterEdge} stroke-width="1.5" />
	<Readout id="air" order={1} label="Air" value="{fmtPpm(ppm)} CO₂">
		<Label
			x={LEFT + 16}
			y={AIR_TOP + 24}
			anchor="start"
			text="air · {fmtPpm(ppm)} CO₂"
			size={14}
			weight={600}
		/>
	</Readout>
	<Readout id="sea">
		<Label
			x={LEFT + 16}
			y={SURF + 58}
			anchor="start"
			text="surface seawater · {fmtT(T)} · salinity 35"
			size={13}
			weight={600}
		/>
	</Readout>

	<g opacity={o.current.co2}>
		{#each airMols as m (m.id)}
			<Molecule kind="CO2" x={m.x} y={m.y} scale={0.5} rotate={m.r} />
		{/each}
		{#each crossing as m (m.id)}
			<Molecule kind="CO2" x={m.x} y={m.y} scale={0.45} opacity={m.op} />
		{/each}
		<!-- both ways across the surface -->
		<g stroke={C.co2} stroke-width="2" fill="none" marker-end="url(#arrowhead)" opacity="0.8">
			<line x1={RIGHT - 70} y1={SURF - 34} x2={RIGHT - 70} y2={SURF + 22} />
			<line x1={RIGHT - 46} y1={SURF + 26} x2={RIGHT - 46} y2={SURF - 30} />
		</g>
		<Readout id="cross">
			<Label x={RIGHT - 82} y={SURF - 16} anchor="end" text="in" size={11} muted />
			<Label x={RIGHT - 34} y={SURF + 18} anchor="start" text="out" size={11} muted />
		</Readout>
	</g>

	<g opacity={o.current.waffle}>
		<Readout id="waffle-title">
			<Label
				x={LEFT + 16}
				y={WY - 26}
				anchor="start"
				text="100 atoms of dissolved carbon, by form"
				size={12}
				muted
			/>
		</Readout>
		{#each dots as d (d.id)}
			<circle cx={d.x} cy={d.y} r="8.5" fill={d.fill} stroke="var(--stage-bg)" stroke-width="1" />
		{/each}
	</g>

	<!-- the three forms per kilogram -->
	<Readout id="per-kg">
		<Label
			x={BX - 4}
			y={58}
			anchor="start"
			text="in each kilogram of water (µmol); marks: at 280 ppm"
			size={12}
			muted
		/>
	</Readout>
	{#each rows as r, i (r.id)}
		{@const y = rowY(i)}
		<g opacity={r.op}>
			<Readout
				id="bar-{r.id}"
				order={2 + i}
				label={listed(r.id) ? r.name : undefined}
				value="{fmtUmol(r.now)} µmol/kg ({change(r.now, r.then)})"
				color={r.fill}
			>
				<Label
					x={BX - 4}
					y={y - 12}
					anchor="start"
					text={r.name}
					size={13}
					weight={600}
					color={r.text}
				/>
				<Label
					x={CX + CW}
					y={y - 12}
					anchor="end"
					text="{change(r.now, r.then)} since 280 ppm"
					size={12}
					tabular
					color={r.text}
				/>
				<rect x={BX} {y} width={BW} height="18" rx="4" fill="var(--stage-grid)" />
				<rect
					x={BX}
					{y}
					width={(BW * Math.min(r.now, r.max)) / r.max}
					height="18"
					rx="4"
					fill={r.fill}
				/>
				<line
					x1={BX + (BW * r.then) / r.max}
					x2={BX + (BW * r.then) / r.max}
					y1={y - 4}
					y2={y + 22}
					stroke="var(--stage-ink)"
					stroke-width="2"
				/>
				<Label
					x={BX + BW + 10}
					y={y + 14}
					anchor="start"
					text={fmtUmol(r.now)}
					size={14}
					weight={600}
					tabular
				/>
				<Label
					x={BX}
					y={y + 36}
					anchor="start"
					text="bar: 0 to {r.max.toLocaleString('en-US')}"
					size={11}
					muted
				/>
			</Readout>
		</g>
	{/each}

	<!-- the card for this step -->
	<rect x={CX} y={CY} width={CW} height={CH} rx="10" fill="var(--surface)" stroke="var(--border)" />
	{#if focus === 'dissolve'}
		<Label x={CX + 20} y={CY + 34} anchor="start" text="Henry's law" size={15} weight={700} />
		<Label
			x={CX + 20}
			y={CY + 72}
			anchor="start"
			text="dissolved CO₂ = K₀ × pCO₂"
			size={14}
			weight={600}
			color={C.co2Text}
		/>
		<Readout
			id="henry"
			order={6}
			label="Henry's law"
			value="{fmtUmol(s.co2)} µmol/kg = K₀ {(s.k.K0 * 1000).toFixed(1)} mmol/(kg·atm) × {Math.round(
				s.pCO2
			)} µatm"
		>
			<Label
				x={CX + 20}
				y={CY + 108}
				anchor="start"
				text="K₀ = {(s.k.K0 * 1000).toFixed(1)} mmol per kg per atm at {fmtT(T)}"
				size={13}
				tabular
			/>
			<Label
				x={CX + 20}
				y={CY + 136}
				anchor="start"
				text="pCO₂ = {Math.round(s.pCO2)} µatm (the air's {fmtPpm(ppm)}, over wet air)"
				size={13}
				tabular
			/>
			<Label
				x={CX + 20}
				y={CY + 172}
				anchor="start"
				text="→ {fmtUmol(s.co2)} µmol of CO₂ per kg of water"
				size={15}
				weight={700}
				tabular
				color={C.co2Text}
			/>
		</Readout>
		<Readout id="henry-note">
			<Label
				x={CX + 20}
				y={CY + 218}
				anchor="start"
				text="Molecules cross both ways; at equilibrium as many"
				size={12}
				muted
			/>
			<Label
				x={CX + 20}
				y={CY + 236}
				anchor="start"
				text="leave as arrive. Colder water holds more."
				size={12}
				muted
			/>
		</Readout>
	{:else if focus === 'react'}
		<Label
			x={CX + 20}
			y={CY + 34}
			anchor="start"
			text="Two reactions, one net change"
			size={15}
			weight={700}
		/>
		{@render formula(CY + 74, 600, r1)}
		{@render formula(CY + 134, 600, r2)}
		<circle
			cx={hopX}
			cy={hopY}
			r="6"
			fill={C.h}
			stroke="var(--surface)"
			stroke-width="1.5"
			opacity={reduced ? 0 : 1}
		/>
		<line x1={CX + 20} x2={CX + CW - 20} y1={CY + 160} y2={CY + 160} stroke="var(--border)" />
		{@render formula(CY + 194, 700, rNet)}
		<Readout
			id="net"
			order={6}
			label="Since 280 ppm"
			value="HCO₃⁻ {signed(dHCO3)}, CO₃²⁻ {signed(dCO3)} µmol/kg"
		>
			<Label
				x={CX + 20}
				y={CY + 236}
				anchor="start"
				text="since 280 ppm: HCO₃⁻ {signed(dHCO3)}, CO₃²⁻ {signed(dCO3)} µmol/kg"
				size={13}
				tabular
			/>
		</Readout>
		<Readout id="net-note">
			<Label
				x={CX + 20}
				y={CY + 260}
				anchor="start"
				text="added CO₂ turns carbonate ion into bicarbonate"
				size={12}
				muted
			/>
		</Readout>
	{:else}
		<Label
			x={CX + 20}
			y={CY + 34}
			anchor="start"
			text="A buffer: most H⁺ is taken up"
			size={15}
			weight={700}
		/>
		<Readout
			id="ph"
			order={1}
			label="pH"
			value="{s.pH.toFixed(2)} (at 280 ppm {s0.pH.toFixed(2)})"
			color={C.ph}
		>
			<Label
				x={CX + 20}
				y={CY + 84}
				anchor="start"
				text="pH {s.pH.toFixed(2)}"
				size={30}
				weight={700}
				tabular
				color={C.phText}
			/>
			<Label
				x={CX + 200}
				y={CY + 84}
				anchor="start"
				text="at 280 ppm: {s0.pH.toFixed(2)}"
				size={13}
				muted
				tabular
			/>
		</Readout>
		<Readout
			id="hplus"
			order={6}
			label="Hydrogen ions"
			value="{change(s.h, s0.h)} since 280 ppm; free H⁺ {s.hFree.toFixed(4)} µmol/kg"
		>
			<Label
				x={CX + 20}
				y={CY + 128}
				anchor="start"
				text="hydrogen ions: {change(s.h, s0.h)} since 280 ppm"
				size={14}
				weight={600}
				tabular
				color={C.hText}
			/>
			<Label
				x={CX + 20}
				y={CY + 160}
				anchor="start"
				text="free H⁺: {s.hFree.toFixed(4)} µmol in each kg"
				size={13}
				tabular
			/>
			<Label
				x={CX + 20}
				y={CY + 186}
				anchor="start"
				text="dissolved carbon: {Math.round(s.dic).toLocaleString('en-US')} µmol in each kg"
				size={13}
				tabular
			/>
		</Readout>
		<Readout id="buffer-note">
			<Label
				x={CX + 20}
				y={CY + 226}
				anchor="start"
				text="Carbonate and borate took up the rest of the"
				size={12}
				muted
			/>
			<Label
				x={CX + 20}
				y={CY + 244}
				anchor="start"
				text="new acid's H⁺: the pH moves, but only a little."
				size={12}
				muted
			/>
		</Readout>
	{/if}
</g>
