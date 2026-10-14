<script lang="ts">
	/**
	 * A sky plot (overhead in the middle, the horizon at the edge, north up) and the spread of
	 * fixes that random range errors give for that geometry.
	 *
	 * Phases (`step.hints.phase`):
	 *   drag — four satellites the reader drags (directions kept in the hidden param `gps:sky`)
	 *   real — the satellites above 10° at `params.place` and `params.hour`, from the almanac
	 *
	 * Each of the 80 dots is the least-squares fix for one set of range errors (seeded normal
	 * numbers × `params.sigma` metres), mapped through the geometry's least-squares gain
	 * (`model.fixError`). The circle and the band show the expected spread: σ × HDOP across,
	 * σ × VDOP in height. The dots appear ten a second, then the set starts again; under reduced
	 * motion all 80 are drawn.
	 */
	import { Label, cycle, type Point } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { constellation, dop, fixError, gaussians, skyTracks, visible } from '../model';
	import { placeById } from '../places';
	import DragPoint from './DragPoint.svelte';
	import Sat from './Sat.svelte';

	let { step, t, params, setParam, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'drag'));
	const sigma = $derived(Number(params.sigma ?? 2));

	// ---- the sky plot -------------------------------------------------------------------------
	const CX = 258;
	const CY = 300;
	const R = 218;
	const toXY = (az: number, el: number): Point => {
		const r = (R * (90 - el)) / 90;
		const a = (az * Math.PI) / 180;
		return { x: CX + r * Math.sin(a), y: CY - r * Math.cos(a) };
	};
	const fromXY = (p: Point) => {
		const dx = p.x - CX;
		const dy = CY - p.y;
		const r = Math.min(R, Math.hypot(dx, dy));
		const az = ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
		return { az: Math.round(az), el: Math.round(90 - (90 * r) / R) };
	};

	const COLORS = ['var(--gps-s1)', 'var(--gps-s2)', 'var(--gps-s3)', 'var(--gps-s4)'];
	const DEFAULT = [
		{ az: 20, el: 75 },
		{ az: 110, el: 30 },
		{ az: 220, el: 20 },
		{ az: 310, el: 40 }
	];
	const dragged = $derived.by(() => {
		const raw = params['gps:sky'];
		if (typeof raw !== 'string') return DEFAULT;
		const pts = raw.split(';').map((s) => {
			const [az, el] = s.split(',').map(Number);
			return Number.isFinite(az) && Number.isFinite(el) ? { az, el } : null;
		});
		return pts.length === 4 && pts.every(Boolean) ? (pts as { az: number; el: number }[]) : DEFAULT;
	});
	function moveSat(i: number, p: Point) {
		const next = dragged.map((d, j) => (j === i ? fromXY(p) : d));
		setParam('gps:sky', next.map((d) => `${d.az},${d.el}`).join(';'));
	}
	function nudge(i: number, dx: number, dy: number) {
		const p = toXY(dragged[i].az, dragged[i].el);
		moveSat(i, { x: p.x + dx * 6, y: p.y + dy * 6 });
	}

	const where = $derived(placeById(params.place));
	const hour = $derived(Number(params.hour ?? 0));
	const real = $derived(
		phase === 'real' ? visible(constellation(hour * 3600), where.lat, where.lon) : []
	);
	const dirs = $derived(
		phase === 'real'
			? real.map((s) => ({ azimuth: s.azimuth, elevation: s.elevation }))
			: dragged.map((d) => ({ azimuth: d.az, elevation: d.el }))
	);
	const D = $derived(dop(dirs));

	/**
	 * Where each satellite crosses this sky over a whole day (every 15 minutes), so the gap
	 * the orbits' 55° tilt leaves shows up.
	 */
	const trails = $derived(
		phase === 'real'
			? skyTracks(where.lat, where.lon).map((tr) => ({
					prn: tr.prn,
					d: tr.points
						.map((v, i) => {
							const p = toXY(v.azimuth, v.elevation);
							return `${i === 0 || tr.breaks.includes(i) ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
						})
						.join('')
				}))
			: []
	);

	// ---- the fixes ------------------------------------------------------------------------------
	const N = 80;
	const noise = gaussians(N * 16, 2026);
	const errors = $derived(
		D
			? Array.from({ length: N }, (_, k) =>
					fixError(
						D,
						dirs.map((_, i) => sigma * noise[k * 16 + i])
					)
				)
			: []
	);
	const shown = $derived(reduced ? N : Math.min(N, Math.floor(cycle(t, 10) * 100) + 1));

	// The plan of the fixes (east, north) and a strip for height, both 4 units per metre.
	const BX = 548;
	const BY = 178;
	const BS = 248; // box size
	const PXM = 4; // units per metre
	const HALF = BS / 2 / PXM; // 31 m
	const SX = 846; // height strip
	const SW = 52;
	const inBox = (v: number) => Math.abs(v) <= HALF;
	const offChart = $derived(
		errors.slice(0, shown).filter((e) => !inBox(e[0]) || !inBox(e[1]) || !inBox(e[2])).length
	);

	const hR = $derived(D ? sigma * D.hdop : 0);
	const vR = $derived(D ? sigma * D.vdop : 0);
	const big = (v: number) => (v > 99 ? '> 99' : v.toFixed(1));
	const metres = (v: number) => (v > 999 ? '> 1 km' : `${v < 10 ? v.toFixed(1) : Math.round(v)} m`);
	const ok = $derived(Boolean(D));
	const geomText = $derived(
		!D ? 'no fix' : D.gdop < 3 ? 'good' : D.gdop < 6 ? 'fair' : D.gdop < 20 ? 'poor' : 'very poor'
	);
	const rimLabel = (az: number) => toXY(az, -7);
</script>

<g>
	<defs>
		<clipPath id="gps-sky-box">
			<rect x={BX} y={BY} width={BS} height={BS} />
		</clipPath>
		<clipPath id="gps-sky-strip">
			<rect x={SX} y={BY} width={SW} height={BS} />
		</clipPath>
	</defs>

	<!-- sky plot -->
	<circle
		cx={CX}
		cy={CY}
		r={R}
		fill="var(--gps-map)"
		stroke="var(--stage-line)"
		stroke-width="1.5"
	/>
	{#each [30, 60] as el (el)}
		<circle cx={CX} cy={CY} r={(R * (90 - el)) / 90} fill="none" stroke="var(--stage-grid)" />
		<Readout id="el-{el}">
			<Label
				x={CX + 6}
				y={CY - (R * (90 - el)) / 90 + 14}
				text="{el}°"
				size={11}
				muted
				anchor="start"
			/>
		</Readout>
	{/each}
	<path d="M{CX - R} {CY}H{CX + R}M{CX} {CY - R}V{CY + R}" stroke="var(--stage-grid)" />
	<circle cx={CX} cy={CY} r="3" fill="var(--stage-ink-muted)" />
	{#each [['N', 0], ['E', 90], ['S', 180], ['W', 270]] as [name, az] (name)}
		{@const p = rimLabel(Number(az))}
		<Label x={p.x} y={p.y + 5} text={String(name)} size={13} weight={600} />
	{/each}
	<Readout id="sky-note">
		<Label
			x={CX + R * 0.72 + 6}
			y={CY + R * 0.72 + 14}
			text="horizon"
			size={11}
			muted
			anchor="start"
		/>
		<Label x={CX} y={CY + 18} text="overhead" size={11} muted />
	</Readout>

	{#if phase === 'drag'}
		{#each dragged as d, i (i)}
			{@const p = toXY(d.az, d.el)}
			<Sat x={p.x} y={p.y} color={COLORS[i]} k={0.85} />
			<DragPoint
				x={p.x}
				y={p.y}
				label="Satellite {i + 1} in the sky"
				valuetext="elevation {d.el}°, azimuth {d.az}°"
				color={COLORS[i]}
				onmove={(q: Point) => moveSat(i, q)}
				onkey={(dx: number, dy: number) => nudge(i, dx, dy)}
			/>
		{/each}
	{:else}
		{#each trails as tr (tr.prn)}
			<path d={tr.d} fill="none" stroke="var(--gps-orbit)" stroke-width="1" opacity="0.7" />
		{/each}
		{#each real as s (s.prn)}
			{@const p = toXY(s.azimuth, s.elevation)}
			<circle
				cx={p.x}
				cy={p.y}
				r="7"
				fill="var(--gps-rx)"
				stroke="var(--stage-bg)"
				stroke-width="2"
			/>
			<Readout id="prn-{s.prn}">
				<Label x={p.x} y={p.y - 12} text="PRN {s.prn}" size={11} muted />
			</Readout>
		{/each}
	{/if}

	<!-- the fixes -->
	<Readout id="panel">
		<rect
			x={524}
			y={16}
			width={420}
			height={568}
			rx="10"
			fill="var(--surface)"
			stroke="var(--border)"
		/>
	</Readout>
	<Readout id="gdop" order={0} label="GDOP" value="{D ? big(D.gdop) : '—'} ({geomText})">
		<text x={544} y={52} class="muted" style:font-size="12px">Geometry: GDOP</text>
		<text x={544} y={80} style:font-size="22px" font-weight="700">{D ? big(D.gdop) : '—'}</text>
		<text x={610} y={80} class="muted" style:font-size="13px">{geomText}</text>
	</Readout>
	<Readout
		id="spread"
		order={1}
		label="Spread of the fixes"
		value={ok ? `${metres(hR)} across, ${metres(vR)} in height` : '—'}
	>
		<text x={544} y={116} class="muted" style:font-size="12px"
			>Spread of the fixes (range error × DOP)</text
		>
		<text x={544} y={140} style:font-size="14px" font-weight="600"
			>{ok ? `${metres(hR)} across · ${metres(vR)} in height` : '—'}</text
		>
	</Readout>

	<rect x={BX} y={BY} width={BS} height={BS} fill="var(--gps-map)" stroke="var(--stage-line)" />
	<rect x={SX} y={BY} width={SW} height={BS} fill="var(--gps-map)" stroke="var(--stage-line)" />
	{#each [-20, -10, 10, 20] as m (m)}
		<path
			d="M{BX + BS / 2 + m * PXM} {BY}v{BS}M{BX} {BY + BS / 2 + m * PXM}h{BS}"
			stroke="var(--stage-grid)"
		/>
		<path d="M{SX} {BY + BS / 2 + m * PXM}h{SW}" stroke="var(--stage-grid)" />
	{/each}
	<g clip-path="url(#gps-sky-box)">
		{#if ok}
			<circle
				cx={BX + BS / 2}
				cy={BY + BS / 2}
				r={hR * PXM}
				fill="var(--gps-fix)"
				opacity="0.12"
				stroke="var(--gps-fix)"
				stroke-dasharray="4 3"
			/>
		{/if}
		{#each errors.slice(0, shown) as e, k (k)}
			<circle
				cx={BX + BS / 2 + e[0] * PXM}
				cy={BY + BS / 2 - e[1] * PXM}
				r="2.6"
				fill="var(--gps-rx)"
				opacity={k === shown - 1 && !reduced ? 1 : 0.6}
			/>
		{/each}
	</g>
	<g clip-path="url(#gps-sky-strip)">
		{#if ok}
			<rect
				x={SX}
				y={BY + BS / 2 - vR * PXM}
				width={SW}
				height={2 * vR * PXM}
				fill="var(--gps-fix)"
				opacity="0.12"
			/>
		{/if}
		{#each errors.slice(0, shown) as e, k (k)}
			<path
				d="M{SX + 10} {BY + BS / 2 - e[2] * PXM}h{SW - 20}"
				stroke="var(--gps-rx)"
				stroke-width="1.5"
				opacity={k === shown - 1 && !reduced ? 1 : 0.45}
			/>
		{/each}
	</g>
	<path
		d="M{BX + BS / 2 - 6} {BY + BS / 2}h12M{BX + BS / 2} {BY + BS / 2 - 6}v12"
		stroke="var(--stage-ink)"
		stroke-width="1.5"
	/>
	<path d="M{SX + 4} {BY + BS / 2}h{SW - 8}" stroke="var(--stage-ink)" stroke-width="1.5" />
	<Readout id="box-labels">
		<Label x={BX + BS / 2} y={BY - 10} text="seen from above" size={12} />
		<Label x={SX + SW / 2} y={BY - 10} text="height" size={12} />
		<Label x={BX + BS / 2} y={BY + BS + 20} text="grid: 10 m · + true position" size={11} muted />
		{#if offChart > 0}
			<Label
				x={BX + BS / 2}
				y={BY + BS + 40}
				text="{offChart} of {shown} fixes off the chart"
				size={11}
				color="var(--gps-trust)"
			/>
		{/if}
	</Readout>
	<Readout id="hint">
		<text x={544} y={560} class="muted" style:font-size="12px"
			>{phase === 'drag'
				? 'Drag the satellites: spread them out, then bunch them up.'
				: `${real.length} above 10° now · grey: their paths over a day`}</text
		>
	</Readout>
	{#if phase === 'real' && D}
		<Readout
			id="dops"
			order={2}
			label="HDOP · VDOP"
			value="{D.hdop.toFixed(1)} · {D.vdop.toFixed(1)}"
		>
			<text x={544} y={530} style:font-size="13px"
				>HDOP {D.hdop.toFixed(1)} across · VDOP {D.vdop.toFixed(1)} in height</text
			>
		</Readout>
	{/if}
</g>
