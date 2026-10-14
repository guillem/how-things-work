<script lang="ts">
	/**
	 * One nMOS transistor through the factory, in cross-section (`step.hints.phase`). Each
	 * phase plays its sub-steps over the step's time and then holds the result; under
	 * reduced motion it shows the finished result. A timeline along the bottom marks the
	 * current sub-step and the "repeat" loop.
	 * - films: thermal oxidation (oxide grows), then polysilicon deposited over everything.
	 * - litho: spin-coat resist; UV light through the clear parts of the mask exposes the
	 *   resist (the lens, which shrinks the mask 4×, is not drawn); the developer dissolves
	 *   the exposed resist (positive resist), leaving a strip over the future gate.
	 * - etch: ions from a plasma remove the polysilicon and then the oxide wherever the
	 *   resist does not cover them; the resist is stripped.
	 * - dope: arsenic ions stop in the gate and in the isolation, and enter the bare
	 *   silicon on either side: source and drain, self-aligned to the gate. Then an anneal.
	 * - wiring: insulator, tungsten contacts, copper wires, a second level, and more.
	 * Thicknesses are not to scale. The isolation trenches at both ends (shallow-trench
	 * isolation, made before these steps) are drawn from the start.
	 */
	import { cycle, hash, lerp, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';

	let { step, t, reduced }: StageProps = $props();
	const phase = $derived(String(step.hints?.phase ?? 'films'));
	const time = $derived(reduced ? 99 : t);
	const ramp = (a: number, b: number) => smoothstep(a, b, time);

	// ---- geometry ----
	const XL = 120;
	const XR = 840;
	const SURF = 400;
	const BOT = 496;
	const GX0 = 420;
	const GX1 = 540;
	const STI = 80; // isolation width at each end
	const OX = 8;
	const POLY = 48;
	const RES = 30;

	// ---- state of each layer, from the phase and time ----
	const order = ['films', 'litho', 'etch', 'dope', 'wiring'];
	const pi = $derived(order.indexOf(phase));
	const ox = $derived(pi > 0 ? 1 : ramp(1, 4.5));
	const poly = $derived(pi > 0 ? 1 : ramp(5.5, 9.5));
	const resistCoat = $derived(pi === 1 ? ramp(0.5, 3) : pi === 2 ? 1 : 0);
	const exposure = $derived(pi === 1 ? ramp(4, 7.5) : pi === 2 ? 1 : 0);
	const develop = $derived(pi === 1 ? ramp(8.5, 11) : pi === 2 ? 1 : 0);
	const etchPoly = $derived(pi === 2 ? ramp(1.5, 5.5) : pi > 2 ? 1 : 0);
	const etchOx = $derived(pi === 2 ? ramp(5.5, 7) : pi > 2 ? 1 : 0);
	const strip = $derived(pi === 2 ? ramp(8, 10) : pi > 2 ? 1 : 0);
	const implant = $derived(pi === 3 ? ramp(1, 7) : pi > 3 ? 1 : 0);
	const anneal = $derived(pi === 3 ? ramp(7.5, 9) * (1 - ramp(10.5, 12)) : 0);
	const annealed = $derived(pi === 3 ? ramp(7.5, 10.5) : pi > 3 ? 1 : 0);
	const ild1 = $derived(pi === 4 ? ramp(0.5, 3) : 0);
	const contacts = $derived(pi === 4 ? ramp(3.5, 6) : 0);
	const metal1 = $derived(pi === 4 ? ramp(6.5, 9) : 0);
	const upper = $derived(pi === 4 ? ramp(9.5, 12.5) : 0);

	const ionsOn = $derived(
		(pi === 2 && time > 1.2 && time < 7.2) || (pi === 3 && time > 0.8 && time < 7.2)
	);
	const uvOn = $derived(pi === 1 && time > 3.6 && time < 7.8);

	// ---- the sub-step being shown ----
	const STEPS = [
		'oxidise',
		'deposit',
		'coat',
		'expose',
		'develop',
		'etch',
		'strip',
		'implant',
		'anneal',
		'wire'
	];
	const current = $derived.by(() => {
		if (pi === 0) return time < 5 ? 0 : 1;
		if (pi === 1) return time < 3.5 ? 2 : time < 8 ? 3 : 4;
		if (pi === 2) return time < 7.6 ? 5 : 6;
		if (pi === 3) return time < 7.3 ? 7 : 8;
		return 9;
	});
	const caption = $derived(
		[
			'Oxidise: at about 1000 °C in oxygen, the surface turns into glass (SiO₂)',
			'Deposit: polysilicon settles out of silane gas onto the whole wafer',
			'Coat: a film of photoresist is spun on',
			'Expose: UV light through the clear parts of the mask changes the resist',
			'Develop: the exposed resist dissolves, leaving a stencil',
			'Etch: plasma ions cut away the films the resist does not cover',
			'Strip: the resist is removed; the gate stack is left',
			'Implant: arsenic ions enter the bare silicon; the gate blocks them',
			'Anneal: a flash of heat repairs the crystal and activates the dopant',
			'Repeat: insulator, holes, metal: layer after layer of wiring'
		][current]
	);

	// ---- layer outlines ----
	/** Thickness outside the gate region shrinks as it is etched; under the resist it stays. */
	const polyOut = $derived(POLY * poly * (1 - etchPoly));
	const oxOut = $derived(OX * ox * (1 - etchOx));
	const resistIn = $derived(RES * resistCoat * (1 - strip));
	const resistOut = $derived(RES * resistCoat * (1 - develop));

	// ---- particles ----
	const uv = Array.from({ length: 14 }, (_, i) => ({
		i,
		x: lerp(XL + 20, XR - 20, (i + 0.5) / 14)
	}));
	const ions = Array.from({ length: 26 }, (_, i) => ({
		i,
		x: lerp(XL + 6, XR - 6, hash(i, 2)),
		off: hash(i, 3)
	}));
	/** Height of the top surface at x, where a falling ion stops (etch) or enters (implant). */
	const topAt = (x: number) => {
		const inGate = x > GX0 && x < GX1;
		if (pi === 2) return inGate ? SURF - OX - POLY - resistIn : SURF - oxOut - polyOut;
		if (inGate) return SURF - OX - POLY;
		return SURF;
	};
	const isSti = (x: number) => x < XL + STI || x > XR - STI;
	const ionDots = $derived(
		ionsOn
			? ions.map((p) => {
					const u = cycle(time, 1.1, p.off);
					const stop = topAt(p.x);
					const enters = pi === 3 && !(p.x > GX0 && p.x < GX1) && !isSti(p.x);
					const yEnd = enters ? stop + 14 + 10 * hash(p.i, 5) : stop - 3;
					const y = lerp(150, yEnd, Math.min(1, u * 1.25));
					const o = smoothstep(0, 0.08, u) * (1 - smoothstep(0.85, 1, u));
					return { i: p.i, x: p.x, y, o };
				})
			: []
	);

	/** Gas molecules raining onto the wafer while a film grows: O₂, then SiH₄. */
	const gas = Array.from({ length: 18 }, (_, i) => ({
		i,
		x: lerp(XL + 20, XR - 20, hash(i, 11)),
		off: hash(i, 12)
	}));
	const gasOn = $derived(pi === 0 && ((time > 0.8 && time < 4.6) || (time > 5.3 && time < 9.6)));
	const gasName = $derived(time < 5 ? 'O₂' : 'SiH₄');
	const gasDots = $derived(
		gasOn
			? gas.map((g) => {
					const u = cycle(time, 2.2, g.off);
					const yEnd = SURF - OX * ox - POLY * poly - 6;
					return {
						i: g.i,
						x: g.x + 10 * Math.sin(time * 1.3 + g.i),
						y: lerp(110, yEnd, u),
						o: smoothstep(0, 0.1, u) * (1 - smoothstep(0.85, 1, u))
					};
				})
			: []
	);

	const sdDepth = 34;
	const sd = [
		{ x0: XL + STI, x1: GX0, name: 'source' },
		{ x0: GX1, x1: XR - STI, name: 'drain' }
	];
	const tcX = [300, (GX0 + GX1) / 2, 660];
	const ILD_TOP = SURF - 130;
</script>

{#snippet txt(
	x: number,
	y: number,
	text: string,
	size: number,
	opts: { anchor?: string; color?: string; weight?: number; muted?: boolean } = {}
)}
	<text
		{x}
		{y}
		class="halo"
		class:muted={opts.muted}
		text-anchor={opts.anchor ?? 'middle'}
		font-weight={opts.weight ?? 500}
		style:font-size="{size}px"
		style:fill={opts.color}>{text}</text
	>
{/snippet}

<g>
	<Readout id="caption" order={1} label="Now" value={caption}>
		{@render txt(480, 46, caption, 15, { weight: 700 })}
	</Readout>

	<!-- silicon, isolation, doped regions -->
	<rect
		x={XL}
		y={SURF}
		width={XR - XL}
		height={BOT - SURF}
		rx="6"
		fill="var(--semi-p)"
		stroke="var(--semi-band-edge)"
	/>
	<rect
		x={XL}
		y={SURF}
		width={STI}
		height="60"
		fill="var(--tc-oxide)"
		stroke="var(--tc-oxide-edge)"
	/>
	<rect
		x={XR - STI}
		y={SURF}
		width={STI}
		height="60"
		fill="var(--tc-oxide)"
		stroke="var(--tc-oxide-edge)"
	/>
	{#each sd as r (r.name)}
		{#if implant > 0.01}
			<path
				d="M{r.x0} {SURF} H{r.x1} V{SURF + sdDepth - 10} Q{r.x1} {SURF + sdDepth} {r.x1 -
					10} {SURF + sdDepth} H{r.x0 + 10} Q{r.x0} {SURF + sdDepth} {r.x0} {SURF + sdDepth - 10} Z"
				fill="var(--semi-n)"
				stroke="var(--semi-electron)"
				stroke-width="1.5"
				opacity={implant}
			/>
			{#if annealed > 0.5}
				<Readout id="sd-{r.name}">
					{@render txt((r.x0 + r.x1) / 2, SURF + 24, `n⁺ ${r.name}`, 13, { weight: 700 })}
				</Readout>
			{/if}
		{/if}
	{/each}

	<!-- oxide (over the whole wafer; thick under the gate once etched) -->
	{#if ox > 0.01}
		<path
			d={oxOut > 0.3
				? `M${XL} ${SURF} V${SURF - oxOut} H${GX0} V${SURF - OX * ox} H${GX1} V${SURF - oxOut} H${XR} V${SURF} Z`
				: `M${GX0} ${SURF} V${SURF - OX * ox} H${GX1} V${SURF} Z`}
			fill="var(--tc-oxide)"
			stroke="var(--tc-oxide-edge)"
			stroke-width="0.8"
		/>
	{/if}
	<!-- polysilicon -->
	{#if poly > 0.01}
		{@const yb = SURF - OX * ox}
		<path
			d={polyOut > 0.3
				? `M${XL} ${yb} V${yb - polyOut} H${GX0} V${yb - POLY * poly} H${GX1} V${yb - polyOut} H${XR} V${yb} Z`
				: `M${GX0} ${yb} V${yb - POLY * poly} H${GX1} V${yb} Z`}
			fill="var(--tc-poly)"
			stroke="var(--tc-poly-edge)"
			stroke-width="0.8"
		/>
	{/if}
	<!-- resist -->
	{#if resistCoat > 0.01 && strip < 0.99}
		{@const base = SURF - OX - POLY}
		{@const spread = resistCoat}
		<g opacity={1 - strip}>
			<rect
				x={GX0}
				y={base - resistIn}
				width={GX1 - GX0}
				height={resistIn}
				fill="var(--tc-resist)"
			/>
			{#if resistOut > 0.5}
				<rect
					x={lerp(GX0, XL, spread)}
					y={base - resistOut}
					width={GX0 - lerp(GX0, XL, spread)}
					height={resistOut}
					fill="var(--tc-resist)"
				/>
				<rect
					x={GX1}
					y={base - resistOut}
					width={lerp(GX1, XR, spread) - GX1}
					height={resistOut}
					fill="var(--tc-resist)"
				/>
				{#if exposure > 0.01}
					<rect
						x={XL}
						y={base - resistOut}
						width={GX0 - XL}
						height={resistOut}
						fill="var(--tc-resist-exposed)"
						opacity={exposure}
					/>
					<rect
						x={GX1}
						y={base - resistOut}
						width={XR - GX1}
						height={resistOut}
						fill="var(--tc-resist-exposed)"
						opacity={exposure}
					/>
				{/if}
			{/if}
		</g>
	{/if}

	<!-- litho: mask and light -->
	{#if pi === 1 && time > 3.2 && time < 8.6}
		{@const mo = smoothstep(3.2, 3.8, time) * (1 - smoothstep(8, 8.6, time))}
		<g opacity={mo}>
			<rect
				x={XL}
				y="120"
				width={XR - XL}
				height="16"
				rx="3"
				fill="var(--tc-glass)"
				stroke="var(--border)"
			/>
			<rect x={GX0} y="120" width={GX1 - GX0} height="16" fill="var(--tc-chrome)" />
			<Readout id="mask">
				{@render txt(
					XR,
					108,
					'mask: glass with an opaque chrome strip (the lens that shrinks it 4× is not drawn)',
					12,
					{ anchor: 'end', muted: true }
				)}
			</Readout>
			{#if uvOn}
				{#each uv as w (w.i)}
					{#if w.x < GX0 - 6 || w.x > GX1 + 6}
						{#each [0, 0.33, 0.66] as off (off)}
							{@const u = cycle(time, 1.2, off + w.i * 0.07)}
							{@const y = lerp(140, SURF - OX - POLY - RES - 8, u)}
							<path
								d="M{w.x} {y} q4 4 0 8 q-4 4 0 8 q4 4 0 8"
								fill="none"
								stroke="var(--tc-uv)"
								stroke-width="2"
								opacity={smoothstep(0, 0.1, u) * (1 - smoothstep(0.85, 1, u))}
							/>
						{/each}
					{/if}
				{/each}
				<Readout id="uv">
					{@render txt(XL, 84, 'ultraviolet light', 13, {
						anchor: 'start',
						weight: 700,
						color: 'var(--tc-uv)'
					})}
				</Readout>
			{/if}
		</g>
	{/if}
	<!-- furnace gases -->
	{#each gasDots as d (d.i)}
		<text
			x={d.x}
			y={d.y}
			text-anchor="middle"
			font-weight="700"
			style:font-size="12px"
			style:fill={gasName === 'O₂' ? 'var(--circ-low)' : 'var(--tc-poly-edge)'}
			opacity={d.o}>{gasName}</text
		>
	{/each}
	{#if gasOn}
		{@render txt(
			XL,
			92,
			gasName === 'O₂' ? 'oxygen gas, about 1000 °C' : 'silane gas, about 600 °C',
			13,
			{ anchor: 'start', weight: 700 }
		)}
	{/if}
	<!-- plasma / implant ions -->
	{#if ionsOn}
		{@render txt(XL, 150, pi === 2 ? 'ions from the plasma' : 'arsenic ions', 13, {
			anchor: 'start',
			weight: 700,
			color: pi === 2 ? 'var(--tc-plasma)' : 'var(--tc-ion)'
		})}
	{/if}
	{#each ionDots as d (d.i)}
		<circle
			cx={d.x}
			cy={d.y}
			r="3.5"
			fill={pi === 2 ? 'var(--tc-plasma)' : 'var(--tc-ion)'}
			opacity={d.o}
		/>
		<line
			x1={d.x}
			x2={d.x}
			y1={d.y - 14}
			y2={d.y - 4}
			stroke={pi === 2 ? 'var(--tc-plasma)' : 'var(--tc-ion)'}
			stroke-width="1.5"
			opacity={d.o * 0.5}
		/>
	{/each}
	<!-- anneal glow -->
	{#if anneal > 0.01}
		<rect
			x={XL}
			y={SURF - 70}
			width={XR - XL}
			height={BOT - SURF + 70}
			rx="8"
			fill="var(--circ-high)"
			opacity={0.18 * anneal}
		/>
	{/if}

	<!-- wiring -->
	{#if pi === 4}
		<rect
			x={XL}
			y={lerp(SURF, ILD_TOP, ild1)}
			width={XR - XL}
			height={SURF - lerp(SURF, ILD_TOP, ild1)}
			fill="var(--tc-ild)"
			stroke="var(--border)"
			opacity="0.92"
		/>
		<!-- redraw the gate over the insulator so it stays visible -->
		<rect
			x={GX0}
			y={SURF - OX - POLY}
			width={GX1 - GX0}
			height={POLY}
			fill="var(--tc-poly)"
			stroke="var(--tc-poly-edge)"
			stroke-width="0.8"
		/>
		<rect
			x={GX0}
			y={SURF - OX}
			width={GX1 - GX0}
			height={OX}
			fill="var(--tc-oxide)"
			stroke="var(--tc-oxide-edge)"
			stroke-width="0.8"
		/>
		{#each tcX as x, i (i)}
			{@const bottom = i === 1 ? SURF - OX - POLY : SURF}
			{#if contacts > 0.01}
				<rect
					x={x - 9}
					y={lerp(bottom, ILD_TOP, contacts)}
					width="18"
					height={bottom - lerp(bottom, ILD_TOP, contacts)}
					fill="var(--tc-tungsten)"
				/>
			{/if}
			{#if metal1 > 0.01}
				<rect
					x={x - 40 * metal1}
					y={ILD_TOP - 18}
					width={80 * metal1}
					height="18"
					rx="2"
					fill="var(--tc-metal)"
				/>
			{/if}
		{/each}
		{#if upper > 0.01}
			<g opacity={upper}>
				<rect
					x={XL}
					y={ILD_TOP - 18 - 70}
					width={XR - XL}
					height="70"
					fill="var(--tc-ild)"
					stroke="var(--border)"
					opacity="0.6"
				/>
				<rect x={tcX[0] - 7} y={ILD_TOP - 18 - 60} width="14" height="60" fill="var(--tc-metal)" />
				<rect x={tcX[2] - 7} y={ILD_TOP - 18 - 60} width="14" height="60" fill="var(--tc-metal)" />
				<rect
					x={tcX[0] - 40}
					y={ILD_TOP - 18 - 84}
					width={tcX[2] - tcX[0] + 80}
					height="24"
					rx="2"
					fill="var(--tc-metal)"
				/>
				<Readout id="more">
					{@render txt(
						480,
						ILD_TOP - 128,
						'…and ten or more wiring layers above, each coarser than the last',
						13,
						{ weight: 600 }
					)}
				</Readout>
			</g>
		{/if}
		<Readout id="wire-key">
			{#if contacts > 0.5}
				{@render txt(XR - 8, ILD_TOP + 40, 'tungsten contacts', 12, {
					anchor: 'end',
					weight: 600,
					color: 'var(--tc-tungsten)'
				})}
			{/if}
			{#if metal1 > 0.5}
				{@render txt(XR - 8, ILD_TOP - 26, 'copper wires', 12, {
					anchor: 'end',
					weight: 600,
					color: 'var(--tc-metal)'
				})}
			{/if}
			{#if ild1 > 0.5}
				{@render txt(XL + 8, ILD_TOP + 20, 'insulator', 12, { anchor: 'start', muted: true })}
			{/if}
		</Readout>
	{/if}

	<!-- layer labels -->
	<Readout id="layers">
		{#if pi < 4}
			{#if ox > 0.5 && pi === 0}
				{@render txt(XR + 8, SURF - 2, 'oxide', 12, { anchor: 'start', weight: 600 })}
			{/if}
			{#if poly > 0.5 && polyOut > 20}
				{@render txt(XR + 8, SURF - OX - 22, 'poly-Si', 12, { anchor: 'start', weight: 600 })}
			{/if}
			{#if pi === 1 && exposure > 0.5 && develop < 0.3}
				{@render txt((XL + GX0) / 2, SURF - OX - POLY - RES / 2 + 4, 'exposed', 12, {
					weight: 600
				})}
				{@render txt((GX0 + GX1) / 2, SURF - OX - POLY - RES / 2 + 4, 'in shadow', 12, {
					weight: 600
				})}
				{@render txt((GX1 + XR) / 2, SURF - OX - POLY - RES / 2 + 4, 'exposed', 12, {
					weight: 600
				})}
			{/if}
			{#if pi === 3 && annealed > 0.9}
				{@render txt(480, 200, 'A finished nMOS transistor: source, gate, drain', 15, {
					weight: 700,
					color: 'var(--tc-on)'
				})}
			{/if}
			{#if resistOut > 10 && pi === 1}
				{@render txt(XR + 8, SURF - OX - POLY - 12, 'resist', 12, { anchor: 'start', weight: 600 })}
			{/if}
			{#if etchOx > 0.9 && pi >= 2}
				{@render txt((GX0 + GX1) / 2, SURF - OX - POLY - (strip < 0.5 ? RES : 0) - 12, 'gate', 13, {
					weight: 700
				})}
			{/if}
			{@render txt(480, BOT - 14, 'p-type silicon', 13, { weight: 600 })}
			{@render txt(XL + STI / 2, SURF + 74, 'isolation', 11, { muted: true })}
			{@render txt(XR - STI / 2, SURF + 74, 'isolation', 11, { muted: true })}
		{/if}
	</Readout>

	<!-- timeline -->
	<Readout id="timeline">
		<g>
			{#each STEPS as s, i (s)}
				{@const x = 96 + i * 85}
				{@const on = i === current}
				<rect
					x={x - 38}
					y="512"
					width="76"
					height="28"
					rx="14"
					fill={on ? 'var(--explainer-accent, var(--accent))' : 'var(--surface)'}
					stroke={i < current ? 'var(--explainer-accent, var(--accent))' : 'var(--border)'}
				/>
				<text
					{x}
					y="531"
					text-anchor="middle"
					font-weight={on ? 700 : 500}
					style:font-size="12px"
					style:fill={on ? '#fff' : i < current ? 'var(--stage-ink)' : 'var(--stage-ink-muted)'}
					>{s}</text
				>
			{/each}
			<path
				d="M{96 + 9 * 85} 544 v12 H{96 + 2 * 85} v-8"
				fill="none"
				stroke="var(--stage-ink-muted)"
				stroke-width="1.5"
				stroke-dasharray="4 3"
				marker-end="url(#arrowhead)"
			/>
			{@render txt(96 + 5.5 * 85, 574, 'repeat for every layer', 11, { muted: true })}
		</g>
	</Readout>
</g>
