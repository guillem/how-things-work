<script lang="ts">
	/**
	 * How the water moves under a wave (`step.hints.mode`):
	 *   - `column`: a strip of ocean 4 km deep drawn to scale with a tsunami 200 km long on it,
	 *     and below, a window one wavelength wide with bits of water tracing their paths (Airy's
	 *     small-wave theory): flat ellipses down to the floor under the tsunami, circles that die
	 *     out within half a wavelength under a wind wave (`params.wave`);
	 *   - `ship`: the model's crest mid-ocean (scenario.ts, three hours after the earthquake)
	 *     sliding under a ship, drawn to scale and exaggerated, with a DART sensor on the floor.
	 */
	import { Label } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { G, kmh, shallowSpeed, waveSpeed } from '../model';
	import { DEFAULTS, midOceanCrest } from '../scenario';

	let { step, t, params, reduced }: StageProps = $props();

	const mode = $derived(String(step.hints?.mode ?? 'column'));
	const time = $derived(reduced ? 2.5 : t);
	const nf = (v: number, d = 0) => v.toLocaleString('en-GB', { maximumFractionDigits: d });

	// ---- column ---------------------------------------------------------------------------------
	const tsunami = $derived(params.wave !== 'wind');
	/** Depth, wavelength (m) and the drawn window. */
	const DEPTH = 4000;
	const WIND_L = 2 * Math.PI * G * (10 / (2 * Math.PI)) ** 2; // 10 s period in deep water: 156 m
	const W = $derived(tsunami ? 200_000 : WIND_L);
	/** The window's depth: the whole column for the tsunami, two wavelengths for the wind wave. */
	const windowDepth = $derived(tsunami ? DEPTH : 2 * WIND_L);
	const BX0 = 70;
	const BX1 = 890;
	const BY0 = 230;
	const BY1 = 540;
	const k = $derived((2 * Math.PI) / W);
	/** Period shown: the animation's own (one cycle every 4 s), not the real one. */
	const phase = $derived(((2 * Math.PI) / 4) * time);
	const px = (x: number) => BX0 + (x / W) * (BX1 - BX0);
	const pz = (z: number) => BY0 + (z / windowDepth) * (BY1 - BY0);
	/** Drawn half-width of the paths at the surface, px. */
	const A = 26;
	/** The surface: one wavelength, height drawn 16 px. */
	const surf = $derived.by(() => {
		let d = '';
		for (let j = 0; j <= 80; j++) {
			const x = (j / 80) * W;
			d += `${j ? 'L' : 'M'}${px(x).toFixed(1)} ${(BY0 - 16 * Math.cos(k * x - phase)).toFixed(1)}`;
		}
		return d;
	});
	/** Horizontal and vertical half-axes of a path at depth z, relative to the surface's. */
	function axes(z: number): [number, number] {
		const h = DEPTH;
		if (tsunami) {
			// long wave: cosh/sinh with k h small: width nearly constant, height falls to 0 at the floor
			const kh = k * h;
			return [Math.cosh(k * (h - z)) / Math.cosh(kh), Math.sinh(k * (h - z)) / Math.sinh(kh)];
		}
		const e = Math.exp(-k * z);
		return [e, e];
	}
	const rows = $derived(
		tsunami ? [0.04, 0.2, 0.4, 0.6, 0.8, 0.96].map((f) => f * DEPTH) : [4, 20, 40, 78, 150, 290]
	);
	const cols = [0.06, 0.19, 0.31, 0.44, 0.56, 0.69, 0.81, 0.94];
	const tsunamiWidth = $derived(axes(0.96 * DEPTH)[0] / axes(0)[0]);

	// ---- ship ---------------------------------------------------------------------------------------
	const uplift = $derived(Number(params.uplift ?? DEFAULTS.uplift));
	const crest = $derived(mode === 'ship' ? midOceanCrest(uplift) : null);
	const speed = $derived(crest ? shallowSpeed(crest.depth) : 0);
	const SX0 = 60;
	const SX1 = 900;
	const SPAN = 150; // km either side of the ship
	const sxk = (km: number) => SX0 + ((km + SPAN) / (2 * SPAN)) * (SX1 - SX0);
	const SEA = 300;
	const SHIP_PX_PER_M = 40;
	/** Model seconds per animation second: the crest crosses the window in about 26 s. */
	const RATE = 50;
	/** Where the crest is relative to the ship, km (it comes from the left). */
	const offset = $derived.by(() => {
		if (!crest) return 0;
		const kmPerS = (speed * RATE) / 1000;
		// reduced motion: the crest right under the ship; otherwise it comes round every pass
		if (reduced) return 0;
		return -170 + ((time * kmPerS) % 340);
	});
	function etaAt(km: number): number {
		if (!crest) return 0;
		const x = km - offset;
		const f = (x - crest.km[0]) / (crest.km[1] - crest.km[0]);
		const i = Math.floor(f);
		if (i < 0 || i >= crest.km.length - 1) return 0;
		return crest.eta[i] + (crest.eta[i + 1] - crest.eta[i]) * (f - i);
	}
	const shipPath = $derived.by(() => {
		if (!crest) return '';
		let d = '';
		for (let j = 0; j <= 200; j++) {
			const km = -SPAN + (j / 200) * 2 * SPAN;
			d += `${j ? 'L' : 'M'}${sxk(km).toFixed(1)} ${(SEA - etaAt(km) * SHIP_PX_PER_M).toFixed(1)}`;
		}
		return d;
	});
	const under = $derived(etaAt(0));
	const crestHeight = $derived(crest ? Math.max(...crest.eta) : 0);
	/** Steepest slope of the crest, as "1 in N". */
	const slope = $derived.by(() => {
		if (!crest) return 0;
		let m = 0;
		for (let i = 1; i < crest.eta.length; i++)
			m = Math.max(
				m,
				Math.abs(crest.eta[i] - crest.eta[i - 1]) / ((crest.km[i] - crest.km[i - 1]) * 1000)
			);
		return 1 / m;
	});
	/** How long the sea rises under the ship, minutes: from the foot of the crest to its top. */
	const riseMinutes = $derived.by(() => {
		if (!crest) return 0;
		const top = crest.eta.indexOf(crestHeight);
		let i = top;
		while (i > 0 && crest.eta[i - 1] < crest.eta[i] && crest.eta[i - 1] > 0.05 * crestHeight) i--;
		return ((crest.km[top] - crest.km[i]) * 1000) / speed / 60;
	});
	const rounded = (v: number) => {
		const p = 10 ** Math.floor(Math.log10(v));
		return Math.round(v / p) * p;
	};
	const shipY = $derived(SEA - under * SHIP_PX_PER_M);
	/** The ship's tilt: the slope under it, exaggerated like the heights. */
	const tilt = $derived(
		(Math.atan(((etaAt(2) - etaAt(-2)) * SHIP_PX_PER_M) / (sxk(2) - sxk(-2))) * 180) / Math.PI
	);
</script>

<g class="column-scene">
	{#if mode === 'column'}
		<!-- to scale -->
		<Label
			x={BX0}
			y={44}
			text="To scale: 400 km of ocean, 4 km deep"
			size={13}
			weight={600}
			halo={false}
			anchor="start"
		/>
		{@const scaleK = (BX1 - BX0) / 400}
		<rect
			x={BX0}
			y={58}
			width={BX1 - BX0}
			height={4 * scaleK}
			fill="var(--tsu-sea)"
			stroke="var(--tsu-wave)"
			stroke-width="0.8"
		/>
		<rect x={BX0} y={58 + 4 * scaleK} width={BX1 - BX0} height="3" fill="var(--tsu-floor)" />
		{#if tsunami}
			<line
				x1={BX0}
				x2={BX0 + 200 * scaleK}
				y1={86}
				y2={86}
				stroke="var(--tsu-wave)"
				stroke-width="1.5"
			/>
			<line x1={BX0} x2={BX0} y1={81} y2={91} stroke="var(--tsu-wave)" stroke-width="1.5" />
			<line
				x1={BX0 + 200 * scaleK}
				x2={BX0 + 200 * scaleK}
				y1={81}
				y2={91}
				stroke="var(--tsu-wave)"
				stroke-width="1.5"
			/>
			<Label
				x={BX0 + 100 * scaleK}
				y={106}
				text="one wavelength of the tsunami: 200 km"
				anchor="middle"
				size={12}
				color="var(--tsu-wave-text)"
			/>
			<Readout id="depth-note">
				<Label x={BX1} y={106} text="the depth: 4 km" anchor="end" size={12} muted />
			</Readout>
		{:else}
			<Label
				x={BX0}
				y={92}
				text="a wind wave 150 m long would be far too small to see at this scale"
				size={12}
				color="var(--tsu-wind-text)"
				anchor="start"
			/>
		{/if}

		<!-- the water's paths -->
		<Label
			x={BX0}
			y={152}
			text={tsunami
				? 'One wavelength, 200 km, and the whole 4 km of water under it (heights exaggerated)'
				: 'One wavelength, 150 m, and the top 300 m of water under it'}
			size={13}
			weight={600}
			anchor="start"
		/>
		<rect x={BX0} y={BY0} width={BX1 - BX0} height={BY1 - BY0} fill="var(--tsu-sea)" />
		<path d={surf + `L${BX1} ${BY1}L${BX0} ${BY1}Z`} fill="var(--tsu-sea)" />
		<path
			d={surf}
			fill="none"
			stroke={tsunami ? 'var(--tsu-wave)' : 'var(--tsu-wind)'}
			stroke-width="2.2"
		/>
		{#if tsunami}
			<rect
				x={BX0}
				y={BY1}
				width={BX1 - BX0}
				height="14"
				fill="var(--tsu-floor)"
				stroke="var(--tsu-floor-edge)"
			/>
			<Label x={BX1 - 6} y={BY1 + 30} text="sea floor, 4,000 m down" anchor="end" size={12} />
		{:else}
			<Readout id="floor-far">
				<Label
					x={BX1 - 6}
					y={BY1 + 20}
					text="the sea floor is 4,000 m down, far below"
					anchor="end"
					size={12}
					muted
				/>
			</Readout>
		{/if}
		{#each rows as z (z)}
			{@const [ax, az] = axes(z)}
			{#each cols as c (c)}
				{@const x0 = px(c * W)}
				{@const y0 = pz(z)}
				{@const th = k * c * W - phase}
				<ellipse
					cx={x0}
					cy={y0}
					rx={Math.max(0.3, A * ax)}
					ry={Math.max(0.3, (tsunami ? 8 : A) * az)}
					fill="none"
					stroke="var(--stage-ink-muted)"
					stroke-width="0.8"
					opacity="0.6"
				/>
				<circle
					cx={x0 + A * ax * Math.cos(th)}
					cy={y0 - (tsunami ? 8 : A) * az * Math.sin(th)}
					r="3.4"
					fill={tsunami ? 'var(--tsu-wave)' : 'var(--tsu-wind)'}
				/>
			{/each}
			<Readout id="z-{z}">
				<Label x={BX0 - 8} y={pz(z) + 4} text="{nf(z)} m" anchor="end" size={11} muted />
			</Readout>
		{/each}
		<Readout
			id="motion"
			order={2}
			label="The water's motion"
			value={tsunami
				? `as wide at the floor as at the surface (${Math.round(tsunamiWidth * 100)} %)`
				: 'gone half a wavelength down'}
		>
			<Label
				x={480}
				y={BY0 - 30}
				text={tsunami
					? 'the whole column slides back and forth: as far at the floor as at the surface'
					: 'circles that shrink with depth: half a wavelength down (75 m) almost nothing moves'}
				size={13}
				anchor="middle"
				color={tsunami ? 'var(--tsu-wave-text)' : 'var(--tsu-wind-text)'}
				weight={600}
			/>
		</Readout>
		<Readout
			id="speed-note"
			order={3}
			label="Speed"
			value={tsunami
				? `${nf(kmh(shallowSpeed(DEPTH)))} km/h, set by the depth`
				: `${nf(kmh(waveSpeed(10, DEPTH)))} km/h, set by its wavelength`}
		>
			<Label
				x={480}
				y={588}
				text={tsunami
					? `it feels the floor: speed ${nf(kmh(shallowSpeed(DEPTH)))} km/h, set by the depth`
					: `it never feels the floor: speed ${nf(kmh(waveSpeed(10, DEPTH)))} km/h, set by its wavelength`}
				size={12}
				anchor="middle"
				muted
			/>
		</Readout>
	{:else if crest}
		<!-- to scale -->
		<Label
			x={SX0}
			y={44}
			text="To scale: 300 km of sea surface with the wave on it"
			size={13}
			weight={600}
			halo={false}
			anchor="start"
		/>
		<line x1={SX0} x2={SX1} y1={70} y2={70} stroke="var(--tsu-wave)" stroke-width="1.5" />
		<Label
			x={SX1}
			y={92}
			text="at this scale a wave a couple of metres high is far thinner than this line"
			size={12}
			muted
			anchor="end"
		/>

		<!-- exaggerated -->
		<Label
			x={SX0}
			y={150}
			text="The same sea, heights drawn {nf(
				rounded(((2 * SPAN * 1000) / (SX1 - SX0)) * SHIP_PX_PER_M)
			)} times taller"
			size={13}
			weight={600}
			anchor="start"
		/>
		<rect x={SX0} y={SEA} width={SX1 - SX0} height={250} fill="var(--tsu-sea)" />
		<path d={shipPath + `L${SX1} ${SEA + 250}L${SX0} ${SEA + 250}Z`} fill="var(--tsu-sea)" />
		<line
			x1={SX0}
			x2={SX1}
			y1={SEA}
			y2={SEA}
			stroke="var(--tsu-wave)"
			stroke-dasharray="3 4"
			opacity="0.45"
		/>
		<path d={shipPath} fill="none" stroke="var(--tsu-wave)" stroke-width="2.2" />
		<!-- the ship -->
		<g transform="translate({sxk(0)} {shipY}) rotate({tilt})">
			<path d="M-26 -2 L26 -2 L20 7 L-20 7 Z" fill="var(--tsu-ship)" />
			<rect x="-12" y="-12" width="18" height="10" rx="1.5" fill="var(--tsu-ship)" />
			<rect x="-4" y="-20" width="5" height="8" fill="var(--tsu-ship)" />
		</g>
		<Readout id="ship" order={1} label="Under the ship" value="{nf(under, 1)} m above normal">
			<Label
				x={sxk(0)}
				y={SEA - 120}
				text="sea under the ship: {nf(under, 1)} m above normal"
				anchor="middle"
				size={13}
				weight={600}
				color="var(--tsu-wave-text)"
				tabular
			/>
		</Readout>
		<Readout id="slope" order={2} label="Steepest slope" value="1 in {nf(rounded(slope))}">
			<Label
				x={SX0}
				y={SEA - 90}
				text="steepest slope: 1 in {nf(rounded(slope))}"
				size={12}
				anchor="start"
			/>
		</Readout>
		<Readout id="rise" order={3} label="The sea rises for" value="{nf(riseMinutes)} minutes">
			<Label
				x={SX1}
				y={SEA - 90}
				text="the sea rises for about {nf(riseMinutes)} minutes"
				anchor="end"
				size={12}
			/>
		</Readout>
		<Readout
			id="crest-h"
			order={4}
			label="Crest"
			value="{nf(crestHeight, 1)} m, at {nf(kmh(speed))} km/h"
		>
			<Label
				x={SX1}
				y={SEA - 70}
				text="crest {nf(crestHeight, 1)} m, moving at {nf(kmh(speed))} km/h →"
				anchor="end"
				size={12}
				muted
			/>
		</Readout>

		<!-- the floor and a DART sensor -->
		<rect
			x={SX0}
			y={SEA + 250}
			width={SX1 - SX0}
			height="12"
			fill="var(--tsu-floor)"
			stroke="var(--tsu-floor-edge)"
		/>
		<Label
			x={SX1}
			y={SEA + 280}
			text="sea floor, {nf(crest.depth)} m down (depth not to scale)"
			anchor="end"
			size={12}
		/>
		{@const dx = 220}
		<rect x={dx - 9} y={SEA + 240} width="18" height="10" rx="2" fill="var(--tsu-buoy)" />
		<line
			x1={dx}
			x2={dx}
			y1={SEA + 240}
			y2={SEA - etaAt(((dx - SX0) / (SX1 - SX0)) * 2 * SPAN - SPAN) * SHIP_PX_PER_M + 4}
			stroke="var(--stage-ink-muted)"
			stroke-width="0.8"
			stroke-dasharray="2 3"
		/>
		<Readout
			id="dart"
			order={5}
			label="DART sensor on the floor"
			value="weighs {nf(
				crest.depth + etaAt(((dx - SX0) / (SX1 - SX0)) * 2 * SPAN - SPAN),
				1
			)} m of water"
		>
			<Label
				x={dx + 16}
				y={SEA + 236}
				text="DART sensor: weighs {nf(
					crest.depth + etaAt(((dx - SX0) / (SX1 - SX0)) * 2 * SPAN - SPAN),
					1
				)} m of water above it"
				size={12}
				tabular
				anchor="start"
			/>
		</Readout>
	{/if}
</g>
