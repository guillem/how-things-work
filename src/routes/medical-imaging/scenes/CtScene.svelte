<script lang="ts">
	/**
	 * The CT scanner. Left: the slice in the scanner, a parallel X-ray beam at
	 * angle θ (source bar and detector bar on opposite sides) and the shadow it
	 * casts, p(s) = line integral of μ, drawn outward from the detector. Middle:
	 * the sinogram, one row per angle (0° at the top, 180° at the bottom). Right:
	 * the slice computed by (filtered) back-projection from the rows recorded so
	 * far, with a readout of how far it is from the true slice.
	 *
	 * Everything is computed by the model (`imaging.ts`): exact analytic shadows
	 * of the ellipse phantoms, the Ram–Lak filter and back-projection on a
	 * 128 × 128 grid. The progressive reconstruction is a cache: rows are added
	 * as the scan reaches them, and it restarts when the settings change or the
	 * scan starts again, so the picture is still a pure function of t.
	 *
	 * Phases (step.hints.phase):
	 *   rotate     — θ = params.angle, the source draggable; the sinogram faint
	 *                with the current row marked; no slice yet
	 *   sinogram   — the source turns once in 12 s; rows appear as recorded
	 *   smear      — and each row is back-projected, unfiltered
	 *   filter     — the same, filtered if params.filter; the current shadow
	 *                raw and filtered in a chart
	 *   angles     — params.angles directions, the complete reconstruction
	 *   hounsfield — complete, filtered; a draggable probe reads HU
	 *   dose       — complete, filtered, with photon noise; doses in mSv
	 */
	import { Handle, Label, VectorHandle, type Point } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		BODY,
		BODY_FOV,
		CT_KEV,
		DOSES_MSV,
		POINT,
		SHEPP_LOGAN,
		backProject,
		binOffset,
		bodyPartAt,
		bodySlice,
		discMean,
		filterProjection,
		filterSinogram,
		fittedError,
		imageAt,
		hounsfield,
		mu,
		partScale,
		phantomAt,
		projection,
		reconstruct,
		relativeError,
		scan,
		truth,
		CT_N,
		type Phantom
	} from '../imaging';
	import { greyImage, range } from './raster';

	let { step, t, params, setParam, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'rotate'));
	const key = $derived(
		phase === 'hounsfield' || phase === 'dose' ? 'chest' : String(params.phantom ?? 'chest')
	);
	const ph: Phantom = $derived(
		key === 'head' ? SHEPP_LOGAN : key === 'point' ? POINT : bodySlice(0)
	);
	const muW = mu('water', CT_KEV);

	// ---- layout -------------------------------------------------------------------------
	const C = { x: 226, y: 318 };
	const R_FOV = 117;
	const R_SRC = 152;
	const R_DET = 140;
	const R_BASE = 150; // baseline of the shadow, outside the detector
	const H_SHADOW = 48;
	/** Phantom units → px. */
	const scale = $derived(R_FOV / ph.fov);
	const SX = 456; // sinogram panel
	const SW = 170;
	const RX = 656; // reconstruction panel
	const PY = 64;
	const PH = 280;

	// ---- the scan's timing --------------------------------------------------------------
	const SCAN = 12; // s for half a turn
	const CYCLE = 18;
	const scanning = $derived(phase === 'sinogram' || phase === 'smear' || phase === 'filter');
	const K = $derived(
		phase === 'angles' ? Math.max(1, Math.round(Number(params.angles ?? 6))) : 180
	);
	/** Fraction of the half turn done. */
	const u = $derived(scanning && !reduced ? Math.min(1, (t % CYCLE) / SCAN) : 1);
	const rows = $derived(scanning ? Math.floor(u * K + 1e-9) : K);
	const photons = $derived(phase === 'dose' ? 1e5 * Number(params.dose ?? 1) : 0);
	const filtered = $derived(
		phase === 'smear'
			? false
			: phase === 'filter' || phase === 'angles'
				? Boolean(params.filter ?? true)
				: true
	);

	/** The beam direction, radians. */
	const theta = $derived.by(() => {
		if (phase === 'rotate') return (Number(params.angle ?? 30) * Math.PI) / 180;
		if (scanning) return u * Math.PI;
		if (phase === 'angles') {
			// step through the recorded directions, about 6 s for all of them
			const i = reduced ? 0 : Math.floor(t / Math.max(0.05, Math.min(0.8, 6 / K))) % K;
			return (i * Math.PI) / K;
		}
		return reduced ? Math.PI / 6 : ((t * 20) % 360) * (Math.PI / 180);
	});
	const showSlice = $derived(phase !== 'rotate' && phase !== 'sinogram');

	// ---- measurements ---------------------------------------------------------------------
	const sino = $derived(scan(ph, K, photons || undefined));
	const fsino = $derived(filterSinogram(sino));
	const ref = $derived(truth(ph));

	// Progressive back-projection cache (not state: rebuilt from the same rows).
	let cache = { id: '', done: 0, img: new Float64Array(CT_N * CT_N) };
	const recon = $derived.by(() => {
		const id = `${key}|${K}|${filtered}|${photons}`;
		const s = filtered ? fsino : sino;
		if (cache.id !== id || rows < cache.done)
			cache = { id, done: 0, img: new Float64Array(CT_N * CT_N) };
		if (rows > cache.done) {
			backProject(s, cache.img, CT_N, cache.done, rows);
			cache.done = rows;
		}
		return { img: cache.img.slice(), rows };
	});

	// ---- display windows ------------------------------------------------------------------
	const huToMu = (h: number) => muW * (1 + h / 1000);
	const window_ = $derived.by((): [number, number] => {
		// a lone dot: stretch the grey scale so its faint 1/r halo shows
		if (!filtered) return [0, (range(recon.img)[1] || 1) * (key === 'point' ? 0.15 : 1)];
		if (key === 'head') return [1.0, 1.05];
		if (key === 'point') return [0, 1];
		return [huToMu(-1000), huToMu(400)];
	});
	const reconUrl = $derived.by(() => {
		void recon.rows;
		const [lo, hi] = window_;
		return showSlice && recon.rows > 0 ? greyImage(recon.img, CT_N, CT_N, lo, hi) : '';
	});

	const sinoMax = $derived(range(sino.data)[1] || 1);
	const sinoUrl = $derived.by(() => {
		const shown = phase === 'rotate' ? sino.data : sino.data.slice(0, rows * sino.bins);
		const data =
			shown.length === sino.data.length
				? shown
				: (() => {
						const d = new Float64Array(sino.data.length);
						d.set(shown);
						return d;
					})();
		return greyImage(data, sino.bins, K, 0, sinoMax);
	});

	const error = $derived(
		recon.rows === K
			? filtered
				? relativeError(recon.img, ref)
				: fittedError(recon.img, ref)
			: NaN
	);

	// ---- the current shadow ---------------------------------------------------------------
	const NB = CT_N;
	const tau = $derived((2 * ph.fov) / NB);
	const shadow = $derived(
		Array.from({ length: NB }, (_, j) => projection(ph, theta, binOffset(j, NB, tau)))
	);
	const shadowMax = $derived(Math.max(...shadow, 1e-9));
	// The scale is fixed per object (the largest value over all angles), so a shadow's height can be compared.
	const fixedMax = $derived(sinoMax);
	const fShadow = $derived(phase === 'filter' ? Array.from(filterProjection(shadow, tau)) : null);

	const uDir = $derived({ x: Math.cos(theta), y: Math.sin(theta) }); // along the detector
	const vDir = $derived({ x: -Math.sin(theta), y: Math.cos(theta) }); // along the rays (source → detector)
	const at = (s: number, r: number): Point => ({
		x: C.x + uDir.x * s + vDir.x * r,
		y: C.y + uDir.y * s + vDir.y * r
	});
	const pts = (a: Point[]) => a.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

	const shadowPath = $derived.by(() => {
		const line: Point[] = [];
		for (let j = 0; j < NB; j++) {
			const s = binOffset(j, NB, tau) * scale;
			line.push(at(s, R_BASE + (H_SHADOW * shadow[j]) / fixedMax));
		}
		return pts([at(-R_FOV, R_BASE), ...line, at(R_FOV, R_BASE)]);
	});

	/** A few rays of the beam with photons marching along them. */
	const rays = $derived(
		Array.from({ length: 9 }, (_, i) => -R_FOV * 0.92 + (i * 2 * R_FOV * 0.92) / 8)
	);
	const march = $derived(reduced ? 0 : (t * 60) % 24);

	// ---- the source handle (rotate phase) ---------------------------------------------------
	const src = $derived(at(0, -R_SRC - 6));
	function moveSource(p: Point) {
		const deg = (Math.atan2(p.x - C.x, -(p.y - C.y)) * 180) / Math.PI;
		setParam('angle', Math.round((deg + 360) % 360));
	}
	function keySource(stepv: number | 'start' | 'end') {
		const a = Number(params.angle ?? 30);
		const next = stepv === 'start' ? 0 : stepv === 'end' ? 359 : (a + stepv + 360) % 360;
		setParam('angle', next);
	}
	const angleDeg = $derived(Math.round((theta * 180) / Math.PI) % 360);
	const rowNow = $derived(
		Math.min(K - 1, Math.floor((((theta % Math.PI) + Math.PI) % Math.PI) / (Math.PI / K) + 1e-9))
	);

	// ---- the probe (hounsfield) -------------------------------------------------------------
	const probe = $derived.by<Point>(() => {
		const raw = params.probe;
		if (typeof raw === 'string') {
			const [x, y] = raw.split(',').map(Number);
			if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };
		}
		return { x: 0.8, y: -3.4 };
	});
	const pxPerUnitRecon = PH / (2 * BODY_FOV);
	const probeScreen = $derived({
		x: RX + PH / 2 + probe.x * pxPerUnitRecon,
		y: PY + PH / 2 + probe.y * pxPerUnitRecon
	});
	function moveProbe(p: Point) {
		const x = Math.max(-16, Math.min(16, (p.x - RX - PH / 2) / pxPerUnitRecon));
		const y = Math.max(-12, Math.min(12, (p.y - PY - PH / 2) / pxPerUnitRecon));
		setParam('probe', `${x.toFixed(1)},${y.toFixed(1)}`);
	}
	function keyProbe(dx: number, dy: number) {
		// ↑ is +dy (towards the front, up the picture); steps of 0.5 cm, 2.5 cm with Shift
		const x = Math.max(-16, Math.min(16, probe.x + dx * 0.5));
		const y = Math.max(-12, Math.min(12, probe.y - dy * 0.5));
		setParam('probe', `${x.toFixed(1)},${y.toFixed(1)}`);
	}
	const probeHU = $derived(
		key === 'chest'
			? Math.round(hounsfield(discMean(recon.img, BODY_FOV, probe.x, probe.y, 0.4), muW))
			: 0
	);
	const probePart = $derived(key === 'chest' ? bodyPartAt(probe.x, probe.y, 0) : null);
	const probeName = $derived(probePart ? probePart.name : 'air outside the body');
	const fmtHU = (h: number) => `${h > 0 ? '+' : h < 0 ? '−' : ''}${Math.abs(h)} HU`;

	// HU scale bar
	const HU_LO = -1000;
	const HU_HI = 2000;
	const BAR_X = 470;
	const BAR_W = 460;
	const huX = (h: number) => BAR_X + ((h - HU_LO) / (HU_HI - HU_LO)) * BAR_W;
	const huMarks = [
		{ id: 'air', name: 'air', h: hounsfield(mu('air', CT_KEV), muW) },
		{ id: 'lung', name: 'lung', h: hounsfield(mu('lung', CT_KEV), muW) },
		{ id: 'fat', name: 'fat', h: hounsfield(mu('fat', CT_KEV), muW) },
		{ id: 'water', name: 'water', h: 0 },
		{ id: 'soft', name: 'muscle', h: hounsfield(mu('soft', CT_KEV), muW) },
		{ id: 'bone', name: 'bone', h: hounsfield(mu('bone', CT_KEV), muW) }
	];

	// ---- dose ---------------------------------------------------------------------------------
	/** The same slice reconstructed without photon noise, to measure the noise against. */
	const cleanImg = $derived(phase === 'dose' ? reconstruct(scan(ph, K), true) : null);
	/**
	 * Noise: spread of the CT number inside the heart, HU, measured against the noise-free
	 * reconstruction so that the small ripples of reconstruction itself don't count.
	 */
	const noiseHU = $derived.by(() => {
		if (!cleanImg) return 0;
		const vals: number[] = [];
		for (let dy = -2; dy <= 2; dy += 0.28)
			for (let dx = -2; dx <= 2; dx += 0.28)
				if (dx * dx + dy * dy <= 4) {
					const x = 0.8 + dx;
					const y = -3.4 + dy;
					const d = imageAt(recon.img, BODY_FOV, x, y) - imageAt(cleanImg, BODY_FOV, x, y);
					vals.push((1000 * d) / muW);
				}
		const m = vals.reduce((a, b) => a + b, 0) / vals.length;
		return Math.sqrt(vals.reduce((a, b) => a + (b - m) ** 2, 0) / vals.length);
	});
	const doseBars = [
		{ id: 'xr', name: 'Chest X-ray', v: DOSES_MSV.chestXray },
		{ id: 'head', name: 'CT head', v: DOSES_MSV.ctHead },
		{ id: 'screen', name: 'CT lung screening', v: DOSES_MSV.ctLungScreening },
		{ id: 'bg', name: 'Background, 1 year', v: DOSES_MSV.backgroundPerYear },
		{ id: 'chest', name: 'CT chest', v: DOSES_MSV.ctChest },
		{ id: 'abd', name: 'CT abdomen & pelvis', v: DOSES_MSV.ctAbdomenPelvis }
	];

	// ---- drawing the object -------------------------------------------------------------------
	const MAT_FILL: Record<string, string> = {
		fat: 'var(--mi-fat)',
		soft: 'var(--mi-soft)',
		lung: 'var(--mi-lung)',
		bone: 'var(--mi-bone)',
		water: 'var(--mi-water)'
	};
	const bodyShapes = BODY.filter((p) => partScale(p, 0) > 0).map((p) => ({
		id: p.id,
		cx: p.x0,
		cy: p.y0,
		rx: p.a * partScale(p, 0),
		ry: p.b * partScale(p, 0),
		fill: p.id === 'heart' ? 'var(--mi-muscle)' : MAT_FILL[p.material],
		bone: p.material === 'bone'
	}));
	const headShapes = SHEPP_LOGAN.ellipses.map((e, i) => ({
		id: `e${i}`,
		e,
		v: phantomAt(SHEPP_LOGAN, e.x0, e.y0)
	}));
	const headOpacity = (v: number) =>
		v >= 1.5 ? 0.85 : 0.18 + Math.max(0, Math.min(1, (v - 1.0) / 0.05)) * 0.5;

	// ---- focus ---------------------------------------------------------------------------------
	const oScanner = $derived(phase === 'hounsfield' || phase === 'dose' ? 0.45 : 1);
	const oSino = $derived(
		phase === 'hounsfield' || phase === 'dose' ? 0.4 : phase === 'rotate' ? 0.75 : 1
	);
	const fmtPct = (e: number) =>
		Number.isFinite(e) ? `${(e * 100).toFixed(e < 0.1 ? 1 : 0)}%` : '…';
</script>

<g>
	<!-- ================= the scanner ================= -->
	<g opacity={oScanner}>
		<text x={24} y={40} font-weight="600" style:font-size="15px">The scanner</text>
		<circle
			cx={C.x}
			cy={C.y}
			r={R_SRC + 6}
			fill="none"
			stroke="var(--stage-line)"
			stroke-width="1"
			stroke-dasharray="3 5"
		/>
		<circle cx={C.x} cy={C.y} r={R_FOV} fill="none" stroke="var(--stage-line)" stroke-width="1" />

		<!-- the object -->
		<g transform="translate({C.x} {C.y}) scale({scale})">
			{#if key === 'chest'}
				{#each bodyShapes as s (s.id)}
					<ellipse
						cx={s.cx}
						cy={s.cy}
						rx={s.rx}
						ry={s.ry}
						fill={s.fill}
						stroke={s.bone ? 'var(--mi-bone-edge)' : 'var(--stage-line)'}
						stroke-width={1 / scale}
					/>
				{/each}
			{:else if key === 'head'}
				{#each headShapes as s (s.id)}
					<ellipse
						cx={0}
						cy={0}
						rx={s.e.a}
						ry={s.e.b}
						transform="translate({s.e.x0} {s.e.y0}) rotate({(s.e.phi * 180) / Math.PI})"
						fill="var(--stage-ink)"
						fill-opacity={headOpacity(s.v)}
						stroke="var(--stage-line)"
						stroke-width={0.6 / scale}
					/>
				{/each}
			{:else}
				<circle
					cx={POINT.ellipses[0].x0}
					cy={POINT.ellipses[0].y0}
					r={0.6}
					fill="var(--stage-ink)"
				/>
			{/if}
		</g>

		<!-- the beam -->
		<polygon
			points={pts([at(-R_FOV, -R_SRC), at(R_FOV, -R_SRC), at(R_FOV, R_DET), at(-R_FOV, R_DET)])}
			fill="var(--mi-xray)"
			fill-opacity="0.1"
		/>
		{#each rays as s (s)}
			<line
				x1={at(s, -R_SRC).x}
				y1={at(s, -R_SRC).y}
				x2={at(s, R_DET).x}
				y2={at(s, R_DET).y}
				stroke="var(--mi-xray)"
				stroke-opacity="0.55"
				stroke-width="1.2"
				stroke-dasharray="3 21"
				stroke-dashoffset={-march}
			/>
		{/each}
		<!-- source and detector bars -->
		<line
			x1={at(-R_FOV, -R_SRC).x}
			y1={at(-R_FOV, -R_SRC).y}
			x2={at(R_FOV, -R_SRC).x}
			y2={at(R_FOV, -R_SRC).y}
			stroke="var(--mi-tube)"
			stroke-width="7"
			stroke-linecap="round"
		/>
		<line
			x1={at(-R_FOV, R_DET).x}
			y1={at(-R_FOV, R_DET).y}
			x2={at(R_FOV, R_DET).x}
			y2={at(R_FOV, R_DET).y}
			stroke="var(--mi-detector)"
			stroke-width="5"
		/>
		<!-- the shadow -->
		<polygon
			points={shadowPath}
			fill="var(--mi-shadow)"
			fill-opacity="0.25"
			stroke="var(--mi-shadow)"
			stroke-width="1.6"
			stroke-linejoin="round"
		/>

		<Readout id="dir" order={1} label="Beam direction" value="{angleDeg}°">
			<Label
				x={24}
				y={590}
				anchor="start"
				text="beam direction {angleDeg}°{phase === 'rotate' && angleDeg >= 180
					? ` (same as ${angleDeg - 180}°, mirrored)`
					: ''}"
			/>
		</Readout>
		{#if oScanner === 1}
			<Readout id="srclabel">
				<Label
					x={at(R_FOV + 4, -R_SRC - 14).x}
					y={at(R_FOV + 4, -R_SRC - 14).y}
					text="X-rays"
					muted
				/>
				<Label
					x={at(R_FOV + 4, R_BASE + 20).x}
					y={at(R_FOV + 4, R_BASE + 20).y}
					text="shadow"
					color="var(--mi-shadow)"
				/>
			</Readout>
		{/if}
	</g>
	{#if phase === 'rotate'}
		<Handle
			x={src.x}
			y={src.y}
			label="X-ray source"
			value={Number(params.angle ?? 30)}
			min={0}
			max={359}
			valuetext="{Number(params.angle ?? 30)} degrees"
			color="var(--mi-xray)"
			onmove={moveSource}
			onkey={keySource}
		/>
	{/if}

	<!-- ================= the sinogram ================= -->
	<g opacity={oSino}>
		<text x={SX} y={40} font-weight="600" style:font-size="15px">All the shadows</text>
		<rect
			x={SX - 1}
			y={PY - 1}
			width={SW + 2}
			height={PH + 2}
			fill="var(--mi-panel)"
			stroke="var(--border)"
		/>
		{#if sinoUrl}
			<image
				href={sinoUrl}
				x={SX}
				y={PY}
				width={SW}
				height={PH}
				preserveAspectRatio="none"
				opacity={phase === 'rotate' ? 0.5 : 1}
				style:image-rendering={K < 60 ? 'pixelated' : 'auto'}
			/>
		{/if}
		{#if phase === 'rotate' || (scanning && rows < K) || phase === 'angles'}
			{@const yRow = PY + ((rowNow + 0.5) * PH) / K}
			<line
				x1={SX - 8}
				y1={yRow}
				x2={SX + SW + 8}
				y2={yRow}
				stroke="var(--mi-shadow)"
				stroke-width="1.6"
			/>
		{/if}
		<Readout id="sinoaxes">
			<Label x={SX + SW / 2} y={PY + PH + 18} text="detector position" muted />
			<Label x={SX - 6} y={PY + 10} anchor="end" text="0°" muted />
			<Label x={SX - 6} y={PY + PH} anchor="end" text="180°" muted />
		</Readout>
	</g>

	<!-- ================= the computed slice ================= -->
	<g>
		<text x={RX} y={40} font-weight="600" style:font-size="15px" opacity={showSlice ? 1 : 0.5}
			>The computed slice</text
		>
		<rect
			x={RX - 1}
			y={PY - 1}
			width={PH + 2}
			height={PH + 2}
			fill="var(--mi-panel)"
			stroke="var(--border)"
			opacity={showSlice ? 1 : 0.4}
		/>
		{#if reconUrl}
			<image href={reconUrl} x={RX} y={PY} width={PH} height={PH} preserveAspectRatio="none" />
		{/if}
		{#if !showSlice}
			<Label x={RX + PH / 2} y={PY + PH / 2} text="not computed yet" muted />
		{/if}
	</g>

	<!-- ================= readouts per phase ================= -->
	{#if phase === 'rotate'}
		<Readout
			id="peak"
			order={2}
			label="Tallest point of the shadow"
			value="p = {shadowMax.toFixed(key === 'head' ? 2 : 1)}"
			note="only e^−p of the photons arrive"
		>
			<Label
				x={SX}
				y={398}
				anchor="start"
				text="tallest point of the shadow: p = {shadowMax.toFixed(key === 'head' ? 2 : 1)}"
			/>
			{#if key !== 'head'}
				<Label
					x={SX}
					y={420}
					anchor="start"
					muted
					text="there only e^−{shadowMax.toFixed(1)} = {(Math.exp(-shadowMax) * 100).toPrecision(
						2
					)}% of the photons get through"
				/>
			{/if}
		</Readout>
		<Readout id="hint">
			<Label x={SX} y={460} anchor="start" muted text="drag the X-ray source round the body" />
		</Readout>
	{:else if phase === 'sinogram'}
		<Readout id="rec" order={2} label="Shadows recorded" value="{rows} of 180">
			<Label x={SX} y={398} anchor="start" text="shadows recorded: {rows} of 180, one per degree" />
		</Readout>
		{#if key === 'point'}
			<Readout id="sine">
				<Label
					x={SX}
					y={420}
					anchor="start"
					muted
					text="the dot's shadow traces a sine wave down the sinogram"
				/>
			</Readout>
		{/if}
	{:else if phase === 'smear' || phase === 'filter' || phase === 'angles'}
		<Readout
			id="rec"
			order={2}
			label={phase === 'angles' ? 'Directions' : 'Shadows smeared back'}
			value={phase === 'angles'
				? `${K} (every ${(180 / K).toFixed(K > 60 ? 1 : 0)}°)`
				: `${rows} of ${K}`}
		>
			<Label
				x={SX}
				y={398}
				anchor="start"
				text={phase === 'angles'
					? `${K === 1 ? '1 direction' : `${K} directions, ${(180 / K).toFixed(K > 60 ? 1 : 0)}° apart`} · ${filtered ? 'filtered' : 'not filtered'}`
					: `shadows smeared back: ${rows} of ${K} · ${filtered ? 'filtered' : 'not filtered'}`}
			/>
		</Readout>
		<Readout
			id="err"
			order={3}
			label="Difference from the true slice"
			value={fmtPct(error)}
			note={filtered ? '' : 'after the best scaling'}
		>
			<text x={SX} y={424} style:font-size="15px" font-weight="600"
				>difference from the true slice: {fmtPct(error)}</text
			>
			{#if !filtered && Number.isFinite(error)}
				<Label
					x={SX}
					y={444}
					anchor="start"
					muted
					text="(blurred values are not to scale: compared after the best scaling)"
				/>
			{/if}
		</Readout>
		{#if fShadow}
			{@const fx = (j: number) => SX + 8 + (j / (NB - 1)) * 460}
			{@const fMax = Math.max(...fShadow.map(Math.abs), 1e-9)}
			<g>
				<line x1={SX + 8} y1={540} x2={SX + 468} y2={540} stroke="var(--stage-line)" />
				<polyline
					points={shadow
						.map((v, j) => `${fx(j).toFixed(1)},${(540 - (40 * v) / shadowMax).toFixed(1)}`)
						.join(' ')}
					fill="none"
					stroke="var(--mi-shadow)"
					stroke-width="1.5"
					opacity="0.7"
				/>
				{#if filtered}
					<polyline
						points={fShadow
							.map((v, j) => `${fx(j).toFixed(1)},${(540 - (40 * v) / fMax).toFixed(1)}`)
							.join(' ')}
						fill="none"
						stroke="var(--mi-filtered)"
						stroke-width="1.8"
					/>
				{/if}
				<Readout id="fkey">
					<Label x={SX + 8} y={590} anchor="start" text="shadow" color="var(--mi-shadow)" />
					{#if filtered}
						<Label
							x={SX + 80}
							y={590}
							anchor="start"
							text="filtered: dips below zero at the edges"
							color="var(--mi-filtered)"
						/>
					{/if}
				</Readout>
			</g>
		{/if}
	{:else if phase === 'hounsfield'}
		<VectorHandle
			x={probeScreen.x}
			y={probeScreen.y}
			label="CT number probe"
			value={0}
			valuetext="{fmtHU(probeHU)}, {probeName}"
			color="var(--mi-probe)"
			r={7}
			onmove={moveProbe}
			onkey={keyProbe}
		/>
		<Readout
			id="hu"
			order={2}
			label="CT number at the probe"
			value={fmtHU(probeHU)}
			note={probeName}
			color="var(--mi-probe)"
		>
			<text x={SX} y={398} style:font-size="15px" font-weight="600">probe: {fmtHU(probeHU)}</text>
			<Label x={SX + 150} y={398} anchor="start" muted text={probeName} />
		</Readout>
		<Readout id="huscale">
			<defs>
				<linearGradient id="ct-hu-grad" x1="0" x2="1">
					<stop offset="0" stop-color="#000" />
					<stop offset={1400 / 3000} stop-color="#fff" />
					<stop offset="1" stop-color="#fff" />
				</linearGradient>
			</defs>
			<rect
				x={BAR_X}
				y={470}
				width={BAR_W}
				height={14}
				fill="url(#ct-hu-grad)"
				stroke="var(--border)"
			/>
			{#each huMarks as m (m.id)}
				<line
					x1={huX(m.h)}
					y1={466}
					x2={huX(m.h)}
					y2={490}
					stroke="var(--stage-ink)"
					stroke-width="1"
				/>
				<Label
					x={huX(m.h) + (m.id === 'fat' ? -4 : m.id === 'soft' ? 4 : 0)}
					y={m.id === 'water' ? 522 : 506}
					anchor={m.id === 'fat' ? 'end' : m.id === 'soft' ? 'start' : 'middle'}
					text={m.name}
				/>
			{/each}
			<line
				x1={huX(probeHU)}
				y1={458}
				x2={huX(probeHU)}
				y2={492}
				stroke="var(--mi-probe)"
				stroke-width="3"
			/>
			<Label x={BAR_X} y={548} anchor="start" muted text="−1000" />
			<Label x={huX(0)} y={548} muted text="0" />
			<Label x={BAR_X + BAR_W} y={548} anchor="end" muted text="+2000 HU" />
			<Label
				x={BAR_X}
				y={578}
				anchor="start"
				muted
				text="grey scale of the slice: −1000 (black) to +400 HU (white)"
			/>
		</Readout>
	{:else if phase === 'dose'}
		<Readout
			id="dose"
			order={2}
			label="Dose"
			value="{Number(params.dose ?? 1)} × standard"
			note="{Math.round(photons).toLocaleString('en-US')} photons per reading"
		>
			<Label
				x={SX}
				y={392}
				anchor="start"
				text="dose: {Number(params.dose ?? 1)} × standard ({Math.round(photons).toLocaleString(
					'en-US'
				)} photons per reading)"
			/>
		</Readout>
		<Readout id="noise" order={3} label="Noise in the heart" value="± {noiseHU.toFixed(0)} HU">
			<text x={SX} y={416} style:font-size="15px" font-weight="600"
				>noise in the heart: ± {noiseHU.toFixed(0)} HU</text
			>
		</Readout>
		<Readout id="bars">
			<Label
				x={SX}
				y={446}
				anchor="start"
				muted
				text="typical effective doses (RadiologyInfo.org), mSv"
			/>
			{#each doseBars as b, i (b.id)}
				{@const y = 462 + i * 20}
				<Label x={SX + 150} y={y + 9} anchor="end" text={b.name} />
				<rect
					x={SX + 158}
					{y}
					width={Math.max(1.5, (b.v / 8) * 300)}
					height={12}
					rx="2"
					fill={b.id === 'bg' ? 'var(--stage-line)' : 'var(--mi-xray)'}
					opacity={b.id === 'bg' ? 1 : 0.75}
				/>
				<Label
					x={SX + 164 + Math.max(1.5, (b.v / 8) * 300)}
					y={y + 9}
					anchor="start"
					text="{b.v} mSv"
					muted
				/>
			{/each}
		</Readout>
	{/if}
</g>
