<script lang="ts">
	/**
	 * A wing section in a stream of air, from the ideal-flow model (`field.ts`): optional
	 * pressure map, streamlines, parcels of air carried along them (positions are a pure
	 * function of t: a parcel released at time −τ sits at the point the streamline reaches
	 * after τ), timelines joining parcels released together, pressure arrows on the surface,
	 * and, past the stall, a schematic separated wake. Wind coordinates (x along the
	 * stream, y up) are drawn at (cx + s·x, cy − s·y), clipped to `clip`.
	 */
	import { at, timeToReach, toWind, type Cx } from '../aero.ts';
	import { pressureBands, type Field } from './field.ts';

	interface Props {
		fld: Field;
		id: string;
		cx: number;
		cy: number;
		s: number;
		clip: { x: number; y: number; w: number; h: number };
		/** Animation time (s) and how many model time units pass per second. */
		t: number;
		rate: number;
		/** Time between parcels released on the same streamline (model units). */
		period?: number;
		pressure?: boolean;
		arrows?: boolean;
		timelines?: boolean;
		parcels?: boolean;
		streamOpacity?: number;
		parcelR?: number;
	}
	let {
		fld,
		id,
		cx,
		cy,
		s,
		clip,
		t,
		rate,
		period = 1,
		pressure = false,
		arrows = false,
		timelines = false,
		parcels = true,
		streamOpacity = 0.75,
		parcelR = 3
	}: Props = $props();

	const X = (p: Cx) => cx + s * p[0];
	const Y = (p: Cx) => cy - s * p[1];
	const xl = $derived((clip.x - cx) / s - 0.2);
	const xr = $derived((clip.x + clip.w - cx) / s + 0.2);

	const bands = $derived(pressure ? pressureBands(fld.f, (p) => [X(p), Y(p)]) : []);

	/** Lines that hug the top surface: hidden by the wake when the wing stalls. */
	const hugs = (dpsi: number) => dpsi > 0 && dpsi < 1.6;

	const lines = $derived(
		fld.streams.map((st, i) => {
			let d = '';
			for (let k = 0; k < st.pts.length; k += 3) {
				const p = st.pts[k];
				if (p[0] < xl - 0.5 || p[0] > xr + 0.5) continue;
				d += `${d ? 'L' : 'M'}${X(p).toFixed(1)} ${Y(p).toFixed(1)}`;
			}
			return {
				i,
				d,
				dpsi: st.dpsi,
				tin: timeToReach(st, xl),
				tout: Math.min(timeToReach(st, xr), st.pts.length * st.dt),
				opacity: hugs(st.dpsi) ? 1 - 0.85 * fld.stall : 1
			};
		})
	);

	const phase = $derived((((t * rate) % period) + period) % period);

	// parcels: on each line, those released k periods ago that are in view
	const dots = $derived.by(() => {
		if (!parcels) return [];
		const out: { key: string; x: number; y: number; top: boolean; inner: boolean }[] = [];
		for (const ln of lines) {
			if (hugs(ln.dpsi) && fld.stall > 0.5) continue;
			const st = fld.streams[ln.i];
			const k0 = Math.ceil((ln.tin - phase) / period);
			for (let k = k0; phase + k * period <= ln.tout; k++) {
				const p = at(st, phase + k * period);
				out.push({
					key: `${ln.i}:${k}`,
					x: X(p),
					y: Y(p),
					top: ln.dpsi > 0,
					inner: Math.abs(ln.dpsi) < 0.2
				});
			}
		}
		return out;
	});

	// timelines: parcels released together, joined across the lines above and below
	const order = $derived(
		fld.streams.map((st, i) => ({ i, dpsi: st.dpsi })).sort((a, b) => b.dpsi - a.dpsi)
	);
	const lineSets = $derived.by(() => {
		if (!timelines) return [];
		const kMin = Math.ceil((Math.min(...lines.map((l) => l.tin)) - phase) / period);
		const kMax = Math.floor((Math.max(...lines.map((l) => l.tout)) - phase) / period);
		const out: { key: string; d: string; top: boolean; pair?: boolean }[] = [];
		for (let k = kMin; k <= kMax; k++) {
			const tau = phase + k * period;
			// the close pair either side of the dividing streamline (the first two offsets)
			const a = at(fld.streams[0], tau);
			const b = at(fld.streams[1], tau);
			out.push({
				key: `${k}:pair`,
				d: `M${X(a).toFixed(1)} ${Y(a).toFixed(1)}L${X(b).toFixed(1)} ${Y(b).toFixed(1)}`,
				top: true,
				pair: true
			});
			for (const top of [true, false]) {
				let d = '';
				for (const o of order) {
					if (o.dpsi > 0 !== top) continue;
					if (top && hugs(o.dpsi) && fld.stall > 0.5) continue;
					const p = at(fld.streams[o.i], tau);
					d += `${d ? 'L' : 'M'}${X(p).toFixed(1)} ${Y(p).toFixed(1)}`;
				}
				out.push({ key: `${k}:${top}`, d, top });
			}
		}
		return out;
	});

	const wingPath = $derived(
		fld.outline.map((p, i) => `${i ? 'L' : 'M'}${X(p).toFixed(1)} ${Y(p).toFixed(1)}`).join(' ') +
			'Z'
	);

	const surfaceArrows = $derived(
		arrows
			? fld.surface
					.filter((p) => Math.abs(p.cp) > 0.08)
					.map((p, i) => {
						const L = Math.min(58, 15 * Math.abs(p.cp));
						const a: Cx = p.p;
						const b: Cx = [p.p[0] + (p.n[0] * L) / s, p.p[1] + (p.n[1] * L) / s];
						const [from, to] = p.cp < 0 ? [a, b] : [b, a];
						return { i, x1: X(from), y1: Y(from), x2: X(to), y2: Y(to), low: p.cp < 0 };
					})
			: []
	);

	// the separated wake, schematic: from just behind the nose on top, back past the tail
	const wake = $derived.by(() => {
		if (fld.stall <= 0.01) return null;
		const le = toWind(fld.f, fld.sec.le);
		const te = toWind(fld.f, fld.sec.te);
		const n = fld.outline.length - 1;
		// the outline runs from the trailing edge over the top to the nose: the top half
		const top = fld.outline.slice(0, Math.round(n / 2) + 1);
		const len = te[0] - le[0];
		let iStart = 0;
		for (let i = 0; i < top.length; i++)
			if (
				Math.abs(top[i][0] - (le[0] + 0.06 * len)) < Math.abs(top[iStart][0] - (le[0] + 0.06 * len))
			)
				iStart = i;
		const start = top[iStart];
		// the free shear layer leaves the nose roughly along the stream, the wake widens
		const end = te[0] + 0.75 * len;
		const up: Cx = [end, start[1] + 0.12 * len];
		const down: Cx = [end, te[1] - 0.04 * len];
		const pts: Cx[] = [
			start,
			[le[0] + 0.5 * len, start[1] + 0.1 * len],
			up,
			down,
			...top.slice(0, iStart + 1)
		];
		const d = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p).toFixed(1)} ${Y(p).toFixed(1)}`).join(' ');
		const eddies = [0.35, 0.68, 1.0, 1.35].map((u, k) => {
			const ex = le[0] + u * len;
			const yTop = start[1] + 0.11 * len;
			const yBot = ex < te[0] ? le[1] + ((te[1] - le[1]) * (ex - le[0])) / len : te[1] - 0.04 * len;
			const r = Math.max(6, Math.min(0.38 * (yTop - yBot) * s, (0.07 + 0.015 * k) * len * s));
			return { k, x: X([ex, 0]), y: Y([0, (yTop + yBot) / 2]), r };
		});
		return { d, eddies };
	});
</script>

<defs>
	<clipPath id="{id}-clip">
		<rect x={clip.x} y={clip.y} width={clip.w} height={clip.h} rx="14" />
	</clipPath>
</defs>
<g clip-path="url(#{id}-clip)">
	<g opacity={1 - 0.75 * fld.stall}>
		{#each bands as b (b.key)}
			<path
				d={b.d}
				fill={b.low ? 'var(--fl-low)' : 'var(--fl-high)'}
				fill-opacity={b.opacity}
				stroke="none"
			/>
		{/each}
	</g>

	{#each lines as ln (ln.i)}
		<path
			d={ln.d}
			fill="none"
			stroke="var(--fl-stream)"
			stroke-width="1.2"
			opacity={streamOpacity * ln.opacity}
		/>
	{/each}

	{#each lineSets as ls (ls.key)}
		<path
			d={ls.d}
			fill="none"
			stroke={ls.pair ? 'var(--stage-ink-muted)' : ls.top ? 'var(--fl-top)' : 'var(--fl-bottom)'}
			stroke-width={ls.pair ? 1.2 : 1.6}
			stroke-dasharray={ls.pair ? '3 4' : undefined}
			opacity="0.8"
		/>
	{/each}

	{#each dots as p (p.key)}
		<circle
			cx={p.x}
			cy={p.y}
			r={timelines && p.inner ? parcelR + 1.6 : parcelR}
			fill={timelines ? (p.top ? 'var(--fl-top)' : 'var(--fl-bottom)') : 'var(--fl-parcel)'}
			opacity={timelines ? 1 : 0.8}
		/>
	{/each}

	{#if wake}
		<g opacity={fld.stall}>
			<path d={wake.d} fill="var(--fl-wake)" fill-opacity="0.45" stroke="none" />
			{#each wake.eddies as e (e.k)}
				<path
					d="M{e.x + e.r} {e.y} A{e.r} {e.r} 0 1 1 {e.x} {e.y - e.r}"
					fill="none"
					stroke="var(--fl-wing)"
					stroke-width="1.4"
					opacity="0.6"
					marker-end="url(#arrowhead)"
					transform="rotate({((-t * (140 - 15 * e.k)) % 360).toFixed(1)} {e.x} {e.y})"
				/>
			{/each}
		</g>
	{/if}
</g>

<path d={wingPath} fill="var(--fl-wing)" stroke="var(--fl-wing-edge)" stroke-width="1.2" />

{#each surfaceArrows as a (a.i)}
	<line
		x1={a.x1}
		y1={a.y1}
		x2={a.x2}
		y2={a.y2}
		stroke={a.low ? 'var(--fl-low)' : 'var(--fl-high)'}
		stroke-width="1.8"
		marker-end="url(#arrowhead)"
	/>
{/each}
