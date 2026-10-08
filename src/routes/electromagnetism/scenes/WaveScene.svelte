<script lang="ts">
	/**
	 * An electromagnetic wave leaving a shaken charge (`waveAt` of the model,
	 * drawn slowed down and stretched: one wavelength is 260 px and one period
	 * 2.2 s, whatever the band).
	 *
	 * The charge on the antenna at the left moves up and down; the electric
	 * field it sends out (vertical, in the page) and the magnetic field (drawn
	 * in perspective, out of and into the page) travel to the right, in phase, at right
	 * angles to each other and to the direction of travel. Ahead of the front
	 * there is no field yet. `params.shake` off stops the charge: the wave
	 * already sent keeps going on its own. `params.band` sets the frequency and
	 * wavelength shown, and the marker on the spectrum.
	 *
	 * The field at x is the charge's displacement at the retarded time
	 * t − x/v (for a shaken charge the radiated E points along its displacement).
	 * The on/off history is a memo of the last change, like the clock memo in
	 * the oscillations scenes. Reduced motion: the frame at t = 12 s (wave
	 * across the whole stage).
	 */
	import { smoothstep, wavelengthToColor } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { C, wavelength } from '../em';

	let { t, params, reduced }: StageProps = $props();

	const X0 = 110; // antenna
	const X1 = 930;
	const AXY = 250;
	const LAMBDA = 260; // px
	const PERIOD = 2.2; // s
	const V = LAMBDA / PERIOD;
	const AMP = 78;
	// Perspective direction for "out of the page" (towards the viewer): with E up
	// and travel to the right, B points out of the page (E × B along the travel).
	const BX = -0.62;
	const BY = 0.36;

	const BANDS: Record<string, { name: string; f: number }> = {
		fm: { name: 'FM radio', f: 100e6 },
		micro: { name: 'microwave oven', f: 2.45e9 },
		green: { name: 'green light', f: 540e12 }
	};
	const band = $derived(BANDS[String(params.band ?? 'fm')] ?? BANDS.fm);
	const lam = $derived(wavelength(band.f));

	const tau = $derived(reduced ? 12 : t);
	const shaking = $derived(params.shake !== false);
	// Last on/off change: before `since` the opposite of `on`.
	let memo = { on: true, since: -Infinity };
	const hist = $derived.by(() => {
		const now = t;
		if (shaking !== memo.on) memo = { on: shaking, since: now };
		if (now < memo.since) memo = { on: shaking, since: -Infinity };
		return memo;
	});
	// Starting or stopping, the shaking eases in or out over EASE seconds instead of
	// jumping (a jump in the charge's position would send a jump in the field).
	const EASE = PERIOD * 0.75;
	/** How strongly the charge is shaking (0…1) at time s. */
	const level = (s: number) => {
		if (s < 0) return 0;
		if (s < hist.since) return hist.on ? 0 : 1;
		const k = smoothstep(0, EASE, s - hist.since);
		return hist.on ? k : 1 - k;
	};
	/** Displacement of the charge (−1…1) at time s. */
	const disp = (s: number) => level(s) * Math.sin((2 * Math.PI * s) / PERIOD);
	const fieldAt = (x: number) => disp(tau - (x - X0) / V);

	const N = 160;
	const xs = Array.from({ length: N + 1 }, (_, i) => X0 + ((X1 - X0) * i) / N);
	const eVals = $derived(xs.map(fieldAt));
	const ePath = $derived(
		'M' + xs.map((x, i) => `${x.toFixed(1)} ${(AXY - AMP * eVals[i]).toFixed(1)}`).join('L')
	);
	const bPath = $derived(
		'M' +
			xs
				.map(
					(x, i) =>
						`${(x + BX * AMP * eVals[i]).toFixed(1)} ${(AXY + BY * AMP * eVals[i]).toFixed(1)}`
				)
				.join('L')
	);
	const arrows = $derived(
		xs.map((x, i) => ({ x, v: eVals[i], i })).filter((a) => a.i % 4 === 0 && Math.abs(a.v) > 0.08)
	);
	const front = $derived(Math.min(X1, X0 + V * tau));
	const chargeY = $derived(AXY - 46 * disp(tau));

	// ---- spectrum -------------------------------------------------------------------------------
	const SP = { x0: 110, x1: 900, y: 512, h: 20 };
	const LOG0 = 3; // 1 km
	const LOG1 = -12; // 1 pm
	const spx = (m: number) => SP.x0 + ((LOG0 - Math.log10(m)) / (LOG0 - LOG1)) * (SP.x1 - SP.x0);
	const mx = $derived(spx(lam));
	const regions = [
		{ id: 'radio', from: 1e3, to: 1, label: 'radio' },
		{ id: 'micro', from: 1, to: 1e-3, label: 'microwave' },
		{ id: 'ir', from: 1e-3, to: 700e-9, label: 'infrared' },
		{ id: 'uv', from: 400e-9, to: 10e-9, label: 'UV' },
		{ id: 'x', from: 10e-9, to: 10e-12, label: 'X-ray' },
		{ id: 'g', from: 10e-12, to: 1e-12, label: 'gamma' }
	];
	const rainbow = Array.from({ length: 7 }, (_, i) => ({
		i,
		nm: 700 - i * 50,
		x: spx((700 - i * 50) * 1e-9)
	}));

	const fmtLen = (m: number) =>
		m >= 1
			? `${m.toFixed(2)} m`
			: m >= 0.01
				? `${(m * 100).toFixed(1)} cm`
				: `${(m * 1e9).toFixed(0)} nm`;
	const fmtF = (f: number) =>
		f >= 1e12
			? `${(f / 1e12).toFixed(0)} THz`
			: f >= 1e9
				? `${(f / 1e9).toFixed(2)} GHz`
				: `${(f / 1e6).toFixed(0)} MHz`;
	const cards = $derived([
		{ id: 'f', label: band.name, value: fmtF(band.f) },
		{ id: 'l', label: 'wavelength', value: fmtLen(lam), color: 'var(--em-field)' },
		{ id: 'c', label: 'speed', value: `${Math.round(C / 1000).toLocaleString('en-US')} km/s` }
	]);
	const CARD = { x: 16, y: 16, w: 560, h: 66 };
	// The wavelength bracket: between two crests fully behind the front.
	const crest = $derived.by(() => {
		// crests where t − (x − X0)/V ≡ PERIOD/4 (mod PERIOD)
		const k = Math.floor((tau - PERIOD / 4) / PERIOD);
		const x = X0 + V * (tau - PERIOD / 4 - k * PERIOD);
		let c = x;
		while (c + LAMBDA > Math.min(front, X1) - 10 && c > X0) c -= LAMBDA;
		while (c < X0 + 150) c += LAMBDA;
		return c + LAMBDA <= Math.min(front, X1) && hasWave(c) ? c : null;
	});
	function hasWave(c: number) {
		return Math.abs(fieldAt(c)) > 0.9 && Math.abs(fieldAt(c + LAMBDA)) > 0.9;
	}
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
		text-anchor={opts.anchor ?? 'start'}
		font-weight={opts.weight ?? 500}
		style:font-size="{size}px"
		style:fill={opts.color}>{text}</text
	>
{/snippet}

<g>
	<!-- direction of travel -->
	<line x1={X0} x2={X1} y1={AXY} y2={AXY} stroke="var(--stage-line)" stroke-width="1.2" />
	<path d="M{X1 + 10} {AXY} L{X1 - 2} {AXY - 6} L{X1 - 2} {AXY + 6} Z" fill="var(--stage-line)" />

	<!-- magnetic field (into the page, in perspective) -->
	{#each arrows as a (a.i)}
		<line
			x1={a.x}
			y1={AXY}
			x2={a.x + BX * AMP * a.v}
			y2={AXY + BY * AMP * a.v}
			stroke="var(--em-bfield)"
			stroke-width="1.3"
			opacity="0.7"
		/>
	{/each}
	<path
		d={bPath}
		fill="none"
		stroke="var(--em-bfield)"
		stroke-width="2.4"
		stroke-linejoin="round"
	/>

	<!-- electric field (in the page) -->
	{#each arrows as a (a.i)}
		<line
			x1={a.x}
			y1={AXY}
			x2={a.x}
			y2={AXY - AMP * a.v}
			stroke="var(--em-field)"
			stroke-width="1.3"
			opacity="0.7"
		/>
	{/each}
	<path d={ePath} fill="none" stroke="var(--em-field)" stroke-width="2.6" stroke-linejoin="round" />

	<!-- the front -->
	{#if front < X1 - 130}
		<line
			x1={front}
			x2={front}
			y1={AXY - AMP - 20}
			y2={AXY + AMP + 10}
			stroke="var(--stage-ink-muted)"
			stroke-dasharray="3 5"
		/>
		{@render txt(front + 8, AXY - AMP - 8, 'no field here yet', 11, { muted: true })}
	{/if}

	<!-- the antenna and its charge -->
	<line
		x1={X0 - 30}
		x2={X0 - 30}
		y1={AXY - 70}
		y2={AXY + 70}
		stroke="var(--em-copper)"
		stroke-width="5"
		stroke-linecap="round"
	/>
	<circle
		cx={X0 - 30}
		cy={chargeY}
		r="11"
		fill="var(--em-plus)"
		stroke="var(--stage-bg)"
		stroke-width="2"
	/>
	<text
		x={X0 - 30}
		y={chargeY + 5}
		text-anchor="middle"
		font-weight="700"
		style:font-size="15px"
		style:fill="#fff">+</text
	>
	{@render txt(X0 - 30, AXY + 94, shaking ? 'shaken charge' : 'charge at rest', 12, {
		anchor: 'middle',
		weight: 600
	})}

	<!-- labels -->
	{@render txt(X0 + 8, AXY - AMP - 22, 'electric field E', 13, {
		weight: 700,
		color: 'var(--em-field)'
	})}
	{@render txt(X0 + 70, AXY + AMP + 22, 'magnetic field B (out of and into the page)', 13, {
		weight: 700,
		color: 'var(--em-bfield)'
	})}
	{@render txt(X1, AXY + AMP + 22, 'travels at the speed of light →', 12, {
		anchor: 'end',
		muted: true
	})}
	{#if crest !== null}
		{@const y = AXY - AMP - 34}
		<path
			d="M{crest} {y + 6} V{y} H{crest + LAMBDA} V{y + 6}"
			fill="none"
			stroke="var(--stage-ink)"
			stroke-width="1.2"
		/>
		{@render txt(crest + LAMBDA / 2, y - 6, `one wavelength: ${fmtLen(lam)}`, 12, {
			anchor: 'middle',
			weight: 600
		})}
	{/if}
	{@render txt(
		480,
		388,
		'A changing E makes B; a changing B makes E. They rise and fall together.',
		13,
		{
			anchor: 'middle',
			muted: true
		}
	)}

	<!-- spectrum -->
	<g style:pointer-events="none">
		{@render txt(SP.x0, SP.y - 26, 'the electromagnetic spectrum: longer waves to the left', 12, {
			muted: true
		})}
		{#each regions as r, i (r.id)}
			<rect
				x={spx(r.from)}
				y={SP.y}
				width={spx(r.to) - spx(r.from)}
				height={SP.h}
				fill="var(--em-field)"
				opacity={0.12 + 0.06 * (i % 2)}
			/>
			{@render txt((spx(r.from) + spx(r.to)) / 2, SP.y + SP.h + 16, r.label, 11, {
				anchor: 'middle',
				muted: true
			})}
		{/each}
		{#each rainbow.slice(0, -1) as c (c.i)}
			<rect
				x={c.x}
				y={SP.y}
				width={rainbow[c.i + 1].x - c.x + 0.5}
				height={SP.h}
				fill={wavelengthToColor(c.nm - 25)}
			/>
		{/each}
		{@render txt(spx(550e-9), SP.y + SP.h + 30, 'visible', 11, { anchor: 'middle', muted: true })}
		<path
			d="M{mx} {SP.y - 2} L{mx - 7} {SP.y - 12} L{mx + 7} {SP.y - 12} Z"
			fill="var(--stage-ink)"
		/>
		<line x1={mx} x2={mx} y1={SP.y} y2={SP.y + SP.h} stroke="var(--stage-ink)" stroke-width="2" />
	</g>

	<!-- readout card -->
	<g style:pointer-events="none">
		<rect
			x={CARD.x}
			y={CARD.y}
			width={CARD.w}
			height={CARD.h}
			rx="12"
			fill="var(--surface)"
			stroke="var(--border)"
		/>
		{#each cards as c, i (c.id)}
			{@const w = CARD.w / cards.length}
			{@const x = CARD.x + 16 + i * w}
			{#if i > 0}
				<line
					x1={CARD.x + i * w}
					x2={CARD.x + i * w}
					y1={CARD.y + 14}
					y2={CARD.y + CARD.h - 14}
					stroke="var(--border)"
				/>
			{/if}
			<text {x} y={CARD.y + 25} class="muted" style:font-size="12px">{c.label}</text>
			<text {x} y={CARD.y + 51} font-weight="700" style:font-size="19px" style:fill={c.color}
				>{c.value}</text
			>
		{/each}
	</g>
</g>
