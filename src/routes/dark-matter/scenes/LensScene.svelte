<script lang="ts">
	/**
	 * The Bullet Cluster weighed by lensing (steps lensing, bullet). Left: a
	 * schematic map (north up, west to the right, 1 px ≈ 2.4 kpc) of the two
	 * groups of galaxies and their X-ray gas at the published positions, with
	 * faint background galaxies whose images are sheared by the model lens
	 * (`lensing.ts`: gas + stars + the reader's dark matter) and contours of the
	 * model's surface density κ. The crosses mark where the measured lensing
	 * mass peaks. Right: the mass in the Hubble field, model against the
	 * measured 91 ± 10 × 10¹³ Suns, and where the model's mass peaks.
	 *
	 * Motion: at the start of a step the background images relax from their
	 * true shapes into the lensed ones (one-shot, INTRO s); the slider and the
	 * toggle are tweened.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Label, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		BRADAC,
		FIELD_STARS,
		POSITIONS,
		blobs,
		contour,
		kappaGrid,
		lensAt,
		lensedShape,
		peak,
		rng,
		sigmaCrit
	} from '../lensing';
	import Card from './Card.svelte';

	let { step, t, params, reduced }: StageProps = $props();

	const bullet = $derived(step.hints?.phase === 'bullet');
	const darkTarget = $derived(typeof params.dark === 'number' ? params.dark : 0);
	const trueTarget = $derived(!bullet && Boolean(params.trueShapes));

	const tw = new Tween({ dark: 0, lensed: 1 }, { duration: 700, easing: cubicInOut });
	$effect(() => {
		const v = { dark: darkTarget, lensed: trueTarget ? 0 : 1 };
		untrack(() => tw.set(v, { duration: reduced ? 0 : 700 }));
	});
	const dark13 = $derived(tw.current.dark);

	// ---- map ----------------------------------------------------------------------
	const BOX = { x0: -750, x1: 750, y0: -450, y1: 450 };
	const MX0 = 24;
	const MY0 = 74;
	const K = 616 / (BOX.x1 - BOX.x0); // px per kpc
	const MW = (BOX.x1 - BOX.x0) * K;
	const MH = (BOX.y1 - BOX.y0) * K;
	const px = (x: number) => MX0 + (x - BOX.x0) * K;
	const py = (y: number) => MY0 + (BOX.y1 - y) * K;

	const SC = sigmaCrit();
	const model = $derived(blobs(dark13 * 1e13));
	const grid = $derived(kappaGrid(model, BOX, 62, 38));
	const top = $derived(peak(grid));
	const LEVELS = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7];
	const contours = $derived(
		LEVELS.map((lv) => ({
			lv,
			d: contour(grid, lv)
				.map(
					([a, b]) =>
						`M${px(a.x).toFixed(1)} ${py(a.y).toFixed(1)}L${px(b.x).toFixed(1)} ${py(b.y).toFixed(1)}`
				)
				.join('')
		}))
	);

	// Background galaxies: random positions and true shapes (deterministic).
	const sources = (() => {
		const rand = rng(657);
		return Array.from({ length: 150 }, (_, i) => {
			const e = 0.28 * Math.sqrt(rand());
			const th = rand() * Math.PI;
			return {
				id: i,
				x: BOX.x0 + 20 + rand() * (BOX.x1 - BOX.x0 - 40),
				y: BOX.y0 + 20 + rand() * (BOX.y1 - BOX.y0 - 40),
				es: { x: e * Math.cos(2 * th), y: e * Math.sin(2 * th) },
				size: 3.2 + rand() * 2.6
			};
		});
	})();
	const INTRO = 1.8;
	const tt = $derived(reduced ? 2.5 : t);
	const mix = $derived(tw.current.lensed * (reduced ? 1 : smoothstep(0.3, INTRO, tt)));
	const images = $derived(
		sources.map((s) => {
			const l = lensAt(model, s.x, s.y, SC);
			const ls = lensedShape(s.es, l);
			// Lensed complex ellipticity, then blend with the true one.
			const m = (1 - ls.q) / (1 + ls.q);
			const el = { x: m * Math.cos(2 * ls.angle), y: m * Math.sin(2 * ls.angle) };
			const ex = s.es.x + (el.x - s.es.x) * mix;
			const ey = s.es.y + (el.y - s.es.y) * mix;
			const mm = Math.min(0.9, Math.hypot(ex, ey));
			const q = (1 - mm) / (1 + mm);
			// Model angles run anticlockwise with y north; SVG's run clockwise.
			const deg = (-0.5 * Math.atan2(ey, ex) * 180) / Math.PI;
			return {
				id: s.id,
				cx: px(s.x),
				cy: py(s.y),
				a: s.size / Math.sqrt(q),
				b: s.size * Math.sqrt(q),
				deg
			};
		})
	);

	// Cluster member galaxies round the two brightest ones.
	const members = (() => {
		const rand = rng(558);
		const gauss = () =>
			Math.sqrt(-2 * Math.log(Math.max(1e-9, rand()))) * Math.cos(2 * Math.PI * rand());
		const p = POSITIONS;
		return [p.mainBCG, p.subBCG].flatMap((c, j) =>
			Array.from({ length: j ? 22 : 30 }, (_, i) => ({
				id: `${j}-${i}`,
				x: c.x + gauss() * (j ? 70 : 100),
				y: c.y + gauss() * (j ? 60 : 85),
				r: 1.4 + rand() * 1.8
			}))
		);
	})();

	// ---- the readouts ---------------------------------------------------------------
	const visible = BRADAC.fieldGas + FIELD_STARS;
	const total = $derived(visible + dark13 * 1e13);
	const p = POSITIONS;
	const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
		Math.hypot(a.x - b.x, a.y - b.y);
	const peakOn = $derived(
		Math.min(dist(top, p.mainBCG), dist(top, p.subBCG)) < 90
			? 'on the galaxies'
			: Math.min(dist(top, p.mainGas), dist(top, p.subGas)) < 150
				? 'on the gas'
				: 'between gas and galaxies'
	);
	const fmt13 = (m: number) => (m / 1e13).toFixed(m < 1e14 ? 1 : 0);
	const matches = $derived(Math.abs(total - BRADAC.fieldTotal) <= BRADAC.fieldTotalErr);

	const CX = 664;
	const CW = 280;
	const BX = CX + 16;
	const BW = CW - 32;
	const bsx = (m: number) => BX + (BW * Math.min(m, 140e13)) / 140e13;
	const [fw, fh] = BRADAC.fieldKpc;
</script>

<g>
	<defs>
		<radialGradient id="lens-gas">
			<stop offset="0" stop-color="var(--dm-xgas)" stop-opacity="0.55" />
			<stop offset="0.55" stop-color="var(--dm-xgas)" stop-opacity="0.2" />
			<stop offset="1" stop-color="var(--dm-xgas)" stop-opacity="0" />
		</radialGradient>
		<clipPath id="lens-map">
			<rect x={MX0} y={MY0} width={MW} height={MH} rx="10" />
		</clipPath>
	</defs>

	<Readout
		id="title"
		order={1}
		label="The Bullet Cluster"
		value="1E 0657−558, light from 3.4 billion years ago"
	>
		<Label
			anchor="start"
			x={24}
			y={36}
			text="The Bullet Cluster (1E 0657−558)"
			size={16}
			weight={700}
		/>
		<Label
			anchor="start"
			x={24}
			y={56}
			text="schematic map · north up · west to the right"
			size={12}
			muted
		/>
	</Readout>

	<rect
		x={MX0}
		y={MY0}
		width={MW}
		height={MH}
		rx="10"
		fill="var(--dm-sky)"
		stroke="var(--border)"
	/>
	<g clip-path="url(#lens-map)">
		<!-- the X-ray gas -->
		<circle cx={px(p.mainGas.x)} cy={py(p.mainGas.y)} r={150 * K} fill="url(#lens-gas)" />
		<ellipse
			cx={px(p.subGas.x)}
			cy={py(p.subGas.y)}
			rx={95 * K}
			ry={75 * K}
			fill="url(#lens-gas)"
		/>
		<path
			d="M{px(p.subGas.x + 105)} {py(p.subGas.y + 130)} Q{px(p.subGas.x + 175)} {py(
				p.subGas.y
			)} {px(p.subGas.x + 105)} {py(p.subGas.y - 130)}"
			fill="none"
			stroke="var(--dm-xgas)"
			stroke-width="1.5"
			stroke-dasharray="4 3"
			opacity="0.8"
		/>
		<!-- background galaxies -->
		{#each images as im (im.id)}
			<ellipse
				cx={im.cx}
				cy={im.cy}
				rx={im.a}
				ry={im.b}
				transform="rotate({im.deg} {im.cx} {im.cy})"
				fill="var(--stage-ink-muted)"
				opacity="0.55"
			/>
		{/each}
		<!-- the model's mass contours -->
		{#each contours as c (c.lv)}
			<path
				d={c.d}
				fill="none"
				stroke="var(--dm-mass)"
				stroke-width={c.lv === 0.1 ? 1.2 : 1.6}
				opacity="0.85"
			/>
		{/each}
		<!-- cluster galaxies -->
		{#each members as m (m.id)}
			<circle cx={px(m.x)} cy={py(m.y)} r={m.r} fill="var(--dm-galaxies)" opacity="0.9" />
		{/each}
		<circle cx={px(p.mainBCG.x)} cy={py(p.mainBCG.y)} r="5" fill="var(--dm-galaxies)" />
		<circle cx={px(p.subBCG.x)} cy={py(p.subBCG.y)} r="5" fill="var(--dm-galaxies)" />
		<!-- the Hubble field -->
		<rect
			x={px(-fw / 2)}
			y={py(fh / 2)}
			width={fw * K}
			height={fh * K}
			fill="none"
			stroke="var(--stage-ink-muted)"
			stroke-dasharray="5 4"
		/>
	</g>
	<!-- measured lensing peaks -->
	{#each [p.mainBCG, p.subBCG] as c, i (i)}
		<g stroke="var(--stage-ink)" stroke-width="2.2">
			<line x1={px(c.x) - 9} x2={px(c.x) + 9} y1={py(c.y) - 9} y2={py(c.y) + 9} />
			<line x1={px(c.x) - 9} x2={px(c.x) + 9} y1={py(c.y) + 9} y2={py(c.y) - 9} />
		</g>
	{/each}
	<!-- the model's peak -->
	<circle
		cx={px(top.x)}
		cy={py(top.y)}
		r="8"
		fill="none"
		stroke="var(--dm-mass)"
		stroke-width="2.5"
	/>

	<Readout id="map-labels">
		<Label
			x={px(p.mainBCG.x)}
			y={py(p.mainBCG.y) + 30}
			text="main cluster"
			size={12}
			anchor="middle"
			weight={650}
		/>
		<Label
			x={px(p.subBCG.x)}
			y={py(p.subBCG.y) + 30}
			text="the bullet’s galaxies"
			size={12}
			anchor="middle"
			weight={650}
		/>
		<Label
			x={px(p.mainGas.x)}
			y={py(p.mainGas.y) - 70}
			text="hot gas (X-rays)"
			size={12}
			anchor="middle"
			color="var(--dm-xgas)"
			weight={650}
		/>
		<Label
			x={px(fw / 2) - 6}
			y={py(fh / 2) + 16}
			text="Hubble field"
			size={11}
			anchor="end"
			muted
		/>
	</Readout>
	{#if bullet}
		<Readout id="bullet-labels">
			<Label
				x={px(p.subGas.x)}
				y={py(p.subGas.y) - 44}
				text="the bullet: gas left behind"
				size={12}
				anchor="middle"
				color="var(--dm-xgas)"
				weight={650}
			/>
			<line
				x1={px(p.subGas.x)}
				x2={px(p.subBCG.x)}
				y1={py(p.subBCG.y) + 46}
				y2={py(p.subBCG.y) + 46}
				stroke="var(--stage-ink)"
				stroke-width="1.5"
			/>
			<Label
				x={(px(p.subGas.x) + px(p.subBCG.x)) / 2}
				y={py(p.subBCG.y) + 62}
				text="gas {Math.round(dist(p.subGas, p.subBCG) / 10) * 10} kpc behind"
				size={12}
				anchor="middle"
			/>
			<Label
				x={px(p.mainBCG.x - 130)}
				y={py(p.mainBCG.y) + 4}
				text="← moving"
				size={11.5}
				anchor="end"
				muted
			/>
			<Label
				x={px(p.subBCG.x + 130)}
				y={py(p.subBCG.y) + 4}
				text="moving →"
				size={11.5}
				anchor="start"
				muted
			/>
		</Readout>
	{/if}

	<!-- legend -->
	<Readout id="legend">
		<line x1={30} x2={52} y1={480} y2={480} stroke="var(--dm-mass)" stroke-width="2" />
		<Label
			anchor="start"
			x={58}
			y={484}
			text="mass contours of your model (κ = 0.1, 0.2, …)"
			size={12}
			muted
		/>
		<circle cx={41} cy={505} r="8" fill="none" stroke="var(--dm-mass)" stroke-width="2.5" />
		<Label anchor="start" x={58} y={509} text="your model’s mass peak" size={12} muted />
		<g stroke="var(--stage-ink)" stroke-width="2">
			<line x1={262} x2={276} y1={498} y2={512} />
			<line x1={262} x2={276} y1={512} y2={498} />
		</g>
		<Label
			anchor="start"
			x={284}
			y={509}
			text="where the measured lensing mass peaks"
			size={12}
			muted
		/>
		<ellipse cx={41} cy={531} rx="7" ry="3" fill="var(--stage-ink-muted)" opacity="0.6" />
		<Label
			anchor="start"
			x={58}
			y={535}
			text="faint galaxies far behind, stretched by the cluster’s mass"
			size={12}
			muted
		/>
		<Label
			anchor="start"
			x={30}
			y={562}
			text="Schematic: round blobs with the published masses; background galaxies at random."
			size={11}
			muted
		/>
	</Readout>

	<!-- ---- card ---- -->
	<Card x={CX} y={16} w={CW} h={568} />
	<Label anchor="start" x={CX + 16} y={44} text="Mass in the Hubble field" size={14} weight={700} />
	<Label anchor="start" x={CX + 16} y={62} text="× 10¹³ Suns" size={11.5} muted />
	<!-- measured: band with its error -->
	<Label anchor="start" x={BX} y={88} text="measured by lensing" size={12} muted />
	<rect
		x={bsx(BRADAC.fieldTotal - BRADAC.fieldTotalErr)}
		y={96}
		width={bsx(BRADAC.fieldTotal + BRADAC.fieldTotalErr) -
			bsx(BRADAC.fieldTotal - BRADAC.fieldTotalErr)}
		height="22"
		fill="var(--stage-ink)"
		opacity="0.12"
	/>
	<rect
		x={BX}
		y={96}
		width={bsx(BRADAC.fieldTotal) - BX}
		height="22"
		rx="4"
		fill="none"
		stroke="var(--stage-ink)"
		stroke-width="1.5"
	/>
	<Label x={BX + BW} y={134} text="91 ± 10" size={12.5} weight={700} anchor="end" />
	<!-- model: stacked -->
	<Label anchor="start" x={BX} y={160} text="your model" size={12} muted />
	<rect x={BX} y={168} width={bsx(BRADAC.fieldGas) - BX} height="22" fill="var(--dm-xgas)" />
	<rect
		x={bsx(BRADAC.fieldGas)}
		y={168}
		width={bsx(visible) - bsx(BRADAC.fieldGas)}
		height="22"
		fill="var(--dm-galaxies)"
	/>
	<rect
		x={bsx(visible)}
		y={168}
		width={Math.max(0, bsx(total) - bsx(visible))}
		height="22"
		fill="var(--dm-halo)"
		opacity="0.85"
	/>
	<line
		x1={bsx(BRADAC.fieldTotal)}
		x2={bsx(BRADAC.fieldTotal)}
		y1={92}
		y2={194}
		stroke="var(--stage-ink)"
		stroke-dasharray="3 3"
	/>

	<Readout id="r-gas">
		<Label
			anchor="start"
			x={BX}
			y={220}
			text="hot gas (X-rays)"
			size={12.5}
			color="var(--dm-xgas)"
			weight={650}
		/>
		<Label x={BX + BW} y={220} text={fmt13(BRADAC.fieldGas)} size={12.5} anchor="end" />
	</Readout>
	<Readout id="r-stars">
		<Label
			anchor="start"
			x={BX}
			y={240}
			text="stars in the galaxies"
			size={12.5}
			color="var(--dm-galaxies)"
			weight={650}
		/>
		<Label x={BX + BW} y={240} text={fmt13(FIELD_STARS)} size={12.5} anchor="end" />
	</Readout>
	<Readout
		id="r-dark"
		order={4}
		label="Dark matter added"
		value="{fmt13(dark13 * 1e13)} × 10¹³ Suns (gas + stars: {fmt13(visible)})"
		color="var(--dm-halo)"
	>
		<Label
			anchor="start"
			x={BX}
			y={260}
			text="dark matter (your slider)"
			size={12.5}
			color="var(--dm-halo)"
			weight={650}
		/>
		<Label x={BX + BW} y={260} text={fmt13(dark13 * 1e13)} size={12.5} anchor="end" />
	</Readout>
	<line x1={BX} x2={BX + BW} y1={272} y2={272} stroke="var(--border)" />
	<Readout
		id="r-total"
		order={5}
		label="Model total"
		value="{fmt13(total)} (measured 91 ± 10)"
		color={matches ? 'var(--dm-model)' : undefined}
	>
		<Label anchor="start" x={BX} y={292} text="total" size={13} weight={700} />
		<Label
			x={BX + BW}
			y={292}
			text={fmt13(total)}
			size={13}
			weight={700}
			anchor="end"
			color={matches ? 'var(--dm-model)' : undefined}
		/>
		<Label
			x={BX + BW}
			y={310}
			text={matches
				? 'matches the lensing'
				: total < BRADAC.fieldTotal
					? 'too light for the lensing'
					: 'too heavy'}
			size={12}
			anchor="end"
			muted
		/>
	</Readout>
	<Readout
		id="r-ratio"
		order={6}
		label="Dark ÷ visible"
		value="{(dark13 / (visible / 1e13)).toFixed(1)} ×"
		color="var(--dm-halo)"
	>
		<Label anchor="start" x={BX} y={350} text="dark ÷ visible" size={13} muted />
		<Label
			x={BX + BW}
			y={352}
			text="{(dark13 / (visible / 1e13)).toFixed(1)} ×"
			size={24}
			weight={700}
			anchor="end"
			color="var(--dm-halo)"
		/>
	</Readout>
	<line x1={BX} x2={BX + BW} y1={376} y2={376} stroke="var(--border)" />
	<Readout
		id="r-peak"
		order={7}
		label="Model’s mass peaks"
		value={peakOn}
		note="measured: on the galaxies"
		color="var(--dm-mass)"
	>
		<Label anchor="start" x={BX} y={400} text="your model’s mass peaks" size={12.5} muted />
		<Label
			x={BX + BW}
			y={424}
			text={peakOn}
			size={15}
			weight={700}
			anchor="end"
			color="var(--dm-mass)"
		/>
	</Readout>
	<Readout id="r-meas-peak">
		<Label anchor="start" x={BX} y={452} text="the measured mass peaks" size={12.5} muted />
		<Label x={BX + BW} y={476} text="on the galaxies" size={15} weight={700} anchor="end" />
	</Readout>
	<Readout id="r-src">
		<Label anchor="start" x={BX} y={534} text="Masses: Bradač et al. 2006;" size={11} muted />
		<Label anchor="start" x={BX} y={550} text="positions: Clowe et al. 2006." size={11} muted />
	</Readout>
</g>
