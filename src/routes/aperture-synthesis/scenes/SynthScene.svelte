<script lang="ts">
	/**
	 * Aperture synthesis in four panels, left to right. step.hints.mode:
	 *   dish  — one filled dish of params.diameter: the dish, its uv disc, its Airy beam, the image
	 *   pair  — two dishes (params.pair, draggable); hints.hours = 0 for a snapshot, otherwise
	 *           params.hours, which params.play sweeps from 0 to 12 h
	 *   array — the array (params.dishes, from params.layout, draggable), uv, beam, dirty image
	 *   build — the same, plus a click on the map adds a dish; params.add / params.remove
	 *   dirty — uv, beam, the dirty image and the true sky
	 *   clean — the dirty image, the residual after ITERATIONS[params.cleanStep] CLEAN iterations
	 *           (params.cleanPlay runs them), the restored image and the true sky
	 *   size  — the 12-dish VLA Y scaled by params[hints.sizeParam], on hints.sky: map, uv, dirty, sky
	 *   area  — the array beside a filled dish as wide as it: map, uv, beam, dirty image
	 * Tracks use params.hours (6) and params.dec (+40°) wherever the step has no control for them.
	 */
	import { untrack } from 'svelte';
	import { Label, VectorHandle, toSvg, type Point } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		ARCMIN,
		ARCSEC,
		DISH,
		DU,
		LAMBDA,
		N,
		PIX,
		cleanBeam,
		cleanRun,
		cleanStart,
		convolve,
		dirtyBeam,
		dirtyImage,
		dishBeam,
		dishImage,
		dishSampling,
		gaussianImage,
		grid,
		hourAngles,
		pairs,
		peak,
		pixel,
		restore,
		total,
		tracks,
		type Clean,
		type Dish
	} from '../model';
	import {
		DISC_CENTRE,
		DOUBLE_SEPARATION,
		MAP_RADIUS,
		MIN_SPACING,
		PAIR,
		SKY_NAMES,
		layout,
		parse,
		scaled,
		serialize,
		sky,
		skyVisibilities,
		spacings,
		type Layout,
		type SkyKind
	} from '../sky';
	import { ITERATIONS, duration, paint, uvGrey } from './shared';

	let { step, t, params, setParam, reduced, dark }: StageProps = $props();
	const mode = $derived(String(step.hints?.mode ?? 'array'));
	const tt = $derived(reduced ? 2.5 : t);

	// ---- layout --------------------------------------------------------------------------
	const P = 216;
	const XS = [18, 254, 490, 726];
	const Y0 = 136;
	const MAP_HALF = 800; // metres from the centre to the map's edge
	const mk = P / (2 * MAP_HALF);
	const UV_HALF = (N / 2) * DU; // wavelengths from the centre to the uv panel's edge

	type Panel = 'map' | 'uv' | 'beam' | 'dirty' | 'truth' | 'residual' | 'restored';
	const PANELS: Record<string, Panel[]> = {
		dish: ['map', 'uv', 'beam', 'dirty'],
		pair: ['map', 'uv', 'beam', 'dirty'],
		array: ['map', 'uv', 'beam', 'dirty'],
		build: ['map', 'uv', 'beam', 'dirty'],
		dirty: ['uv', 'beam', 'dirty', 'truth'],
		clean: ['dirty', 'residual', 'restored', 'truth'],
		size: ['map', 'uv', 'dirty', 'truth'],
		area: ['map', 'uv', 'beam', 'dirty']
	};
	const panels = $derived(PANELS[mode] ?? PANELS.array);
	const xOf = (p: Panel) => XS[panels.indexOf(p)];

	// ---- the array ---------------------------------------------------------------------
	const layoutName = $derived(String(params.layout ?? 'vla12') as Layout);
	const pairDishes = $derived(parse(params.pair, PAIR));
	const mainDishes = $derived(parse(params.dishes, layout(layoutName)));
	const sizeParam = $derived(String(step.hints?.sizeParam ?? 'shrink'));
	const sizeF = $derived(Number(params[sizeParam] ?? (sizeParam === 'spread' ? 1.25 : 0.3)));
	const dishes = $derived.by((): Dish[] => {
		if (mode === 'dish') return [];
		if (mode === 'pair') return pairDishes;
		if (mode === 'size') return scaled(layout('vla12'), sizeF);
		return mainDishes;
	});
	const editable = $derived(['pair', 'array', 'build', 'area'].includes(mode));
	const dishParam = $derived(mode === 'pair' ? 'pair' : 'dishes');

	// "Start from": only a new choice after this scene appeared replaces the array
	let seenLayout = untrack(() => String(params.layout ?? 'vla12'));
	$effect(() => {
		const name = layoutName;
		untrack(() => {
			if (name !== seenLayout) setParam('dishes', serialize(layout(name)));
			seenLayout = name;
		});
	});
	// add / remove: react to new presses only
	let seenAdd = untrack(() => Number(params.add ?? 0));
	let seenRemove = untrack(() => Number(params.remove ?? 0));
	$effect(() => {
		const a = Number(params.add ?? 0);
		const r = Number(params.remove ?? 0);
		untrack(() => {
			if (a > seenAdd) {
				const spot = freeSpot(mainDishes);
				if (spot) setParam('dishes', serialize([...mainDishes, spot]));
			}
			if (r > seenRemove && mainDishes.length > 2)
				setParam('dishes', serialize(mainDishes.slice(0, -1)));
			seenAdd = a;
			seenRemove = r;
		});
	});
	const MAX_DISHES = 30;
	/** The first free spot along a golden-angle spiral from the centre, at least 60 m from any dish. */
	function freeSpot(ds: readonly Dish[]): Dish | null {
		if (ds.length >= MAX_DISHES) return null;
		for (let i = 1; i < 2000; i++) {
			const r = 18 * Math.sqrt(i);
			if (r > MAP_RADIUS) break;
			const a = i * 2.39996;
			const e = Math.round(r * Math.sin(a));
			const n = Math.round(r * Math.cos(a));
			if (ds.every((d) => Math.hypot(d.e - e, d.n - n) >= 60)) return { e, n };
		}
		return null;
	}
	function fits(ds: readonly Dish[], i: number, e: number, n: number): boolean {
		return ds.every((d, j) => j === i || Math.hypot(d.e - e, d.n - n) >= MIN_SPACING);
	}
	function clampToMap(e: number, n: number): [number, number] {
		const r = Math.hypot(e, n);
		const f = r > MAP_RADIUS ? MAP_RADIUS / r : 1;
		return [Math.round(e * f), Math.round(n * f)];
	}
	function moveDish(i: number, e: number, n: number) {
		const ds = dishes.slice();
		const [ce, cn] = clampToMap(e, n);
		if (!fits(ds, i, ce, cn)) return;
		ds[i] = { e: ce, n: cn };
		setParam(dishParam, serialize(ds));
	}
	function onMapDown(ev: PointerEvent) {
		if (mode !== 'build') return;
		const svg = (ev.currentTarget as Element).closest('svg');
		if (!svg) return;
		const p = toSvg(ev, svg);
		const x0 = xOf('map');
		const e = (p.x - (x0 + P / 2)) / mk;
		const n = -(p.y - (Y0 + P / 2)) / mk;
		if (Math.hypot(e, n) > MAP_RADIUS || mainDishes.length >= MAX_DISHES) return;
		const [ce, cn] = clampToMap(e, n);
		if (!fits(mainDishes, -1, ce, cn)) return;
		setParam('dishes', serialize([...mainDishes, { e: ce, n: cn }]));
	}

	// ---- the observation -------------------------------------------------------------------
	const decDeg = $derived(Number(params.dec ?? 40));
	const decRad = $derived((decDeg * Math.PI) / 180);
	const playing = $derived(mode === 'pair' && step.hints?.hours !== 0 && params.play === true);
	/** While the Earth turns: one hour a second, held for two seconds at 12 h; quarter hours. */
	const played = $derived(playing ? Math.floor(Math.min(12, tt % 14) * 4) / 4 : null);
	const playedShown = $derived(played === null ? null : Math.round(played * 2) / 2);
	$effect(() => {
		const v = playedShown;
		if (v !== null) untrack(() => setParam('hours', v));
	});
	const hours = $derived(
		mode === 'pair' && step.hints?.hours === 0 ? 0 : (played ?? Number(params.hours ?? 6))
	);
	const H = $derived(hourAngles(hours, decRad));
	const diameter = $derived(Number(params.diameter ?? 25));

	const ts = $derived(mode === 'dish' ? [] : tracks(dishes, decRad, H));
	const S = $derived(mode === 'dish' ? dishSampling(diameter) : grid(ts));
	const beam = $derived(mode === 'dish' ? dishBeam(diameter) : dirtyBeam(S));
	const cb = $derived(cleanBeam(S));

	// ---- the sky ---------------------------------------------------------------------------
	const skyKind = $derived(String(step.hints?.sky ?? params.sky ?? 'galaxy') as SkyKind);
	const truth = $derived(sky(skyKind));
	const dirty = $derived(
		mode === 'dish' ? dishImage(truth, diameter) : dirtyImage(skyVisibilities(skyKind), S)
	);
	const dirtyPeak = $derived(Math.abs(peak(dirty).value));

	// ---- CLEAN -------------------------------------------------------------------------------
	const cleanPlaying = $derived(mode === 'clean' && params.cleanPlay === true);
	const kPlayed = $derived(
		cleanPlaying ? Math.min(3000, Math.max(0, Math.round(10 ** (tt / 3)) - 1)) : null
	);
	const kIndexShown = $derived(
		kPlayed === null ? null : ITERATIONS.findLastIndex((v) => v <= kPlayed)
	);
	$effect(() => {
		const v = kIndexShown;
		if (v !== null) untrack(() => setParam('cleanStep', v));
	});
	const kWanted = $derived(kPlayed ?? ITERATIONS[Math.round(Number(params.cleanStep ?? 0))] ?? 0);
	let cache: { key: string; c: Clean } | null = null;
	const cleanKey = $derived(`${serialize(dishes)}|${hours}|${decDeg}|${skyKind}`);
	const cleaned = $derived.by(() => {
		if (mode !== 'clean') return null;
		if (!cache || cache.key !== cleanKey || cache.c.iterations > kWanted)
			cache = { key: cleanKey, c: cleanStart(dirty) };
		cleanRun(cache.c, beam, kWanted, 0.1);
		const c = cache.c;
		return {
			c,
			iterations: c.iterations,
			residualPeak: Math.abs(peak(c.residual).value),
			flux: total(c.model),
			restored: restore(c, cb),
			last: c.where.length ? c.where[c.where.length - 1] : -1
		};
	});

	// ---- what the readouts quote -------------------------------------------------------------
	const sp = $derived(spacings(dishes));
	const beamMajor = $derived(cb.major / ARCSEC);
	const beamMinor = $derived(cb.minor / ARCSEC);
	const pixArc = PIX / ARCMIN;
	const discCentre = pixel(Math.round(DISC_CENTRE.x / pixArc), Math.round(DISC_CENTRE.y / pixArc));
	const discKept = $derived.by(() => {
		if (mode !== 'size' || skyKind !== 'disc') return null;
		const ideal = convolve(truth, gaussianImage(cb));
		return dirty[discCentre] / ideal[discCentre];
	});
	const area = $derived(dishes.length * Math.PI * (DISH / 2) ** 2);
	const bigArea = $derived(Math.PI * (sp.max / 2) ** 2);

	/** Stretch of the images (and the true sky): nearly linear below a fifth of the peak, or a
	 * twenty-fifth for the faint disc beside its bright point. */
	const SOFT = $derived(skyKind === 'disc' ? 0.04 : 0.2);
	// ---- pictures ------------------------------------------------------------------------------
	const beamUrl = $derived(
		panels.includes('beam') ? paint(beam, 1, 0.5, mode === 'dish' ? 1 : 2) : ''
	);
	const dirtyUrl = $derived(paint(dirty, dirtyPeak || 1, SOFT));
	/** The true sky drawn at 30″ (two pixels), so that its points show at this size. */
	const truthShown = $derived(
		panels.includes('truth')
			? convolve(truth, gaussianImage({ a: 0.69, b: 0, c: 0.69, major: 0, minor: 0 }))
			: truth
	);
	const truthUrl = $derived(
		panels.includes('truth') ? paint(truthShown, peak(truthShown).value, SOFT) : ''
	);
	const residualUrl = $derived(cleaned ? paint(cleaned.c.residual, dirtyPeak || 1, SOFT) : '');
	const restoredUrl = $derived(cleaned ? paint(cleaned.restored, dirtyPeak || 1, SOFT) : '');
	const dishUvUrl = $derived(
		mode === 'dish' ? uvGrey(S.w, dark ? [255, 169, 77] : [232, 89, 12]) : ''
	);
	const urls = $derived<Record<Panel, string>>({
		map: '',
		uv: dishUvUrl,
		beam: beamUrl,
		dirty: dirtyUrl,
		truth: truthUrl,
		residual: residualUrl,
		restored: restoredUrl
	});

	// ---- uv tracks as one path per colour --------------------------------------------------------
	const uvk = P / 2 / UV_HALF;
	const uvPaths = $derived.by(() => {
		if (mode === 'dish') return { main: '', mirror: '' };
		const x0 = xOf('uv') + P / 2;
		const y0 = Y0 + P / 2;
		let main = '';
		let mirror = '';
		const f = (v: number) => v.toFixed(1);
		for (const tr of ts) {
			const n = tr.u.length;
			if (n === 0) continue;
			if (n === 1) {
				main += `M${f(x0 + tr.u[0] * uvk)} ${f(y0 - tr.v[0] * uvk)}h0.01`;
				mirror += `M${f(x0 - tr.u[0] * uvk)} ${f(y0 + tr.v[0] * uvk)}h0.01`;
				continue;
			}
			for (let i = 0; i < n; i++) {
				main += `${i ? 'L' : 'M'}${f(x0 + tr.u[i] * uvk)} ${f(y0 - tr.v[i] * uvk)}`;
				mirror += `${i ? 'L' : 'M'}${f(x0 - tr.u[i] * uvk)} ${f(y0 + tr.v[i] * uvk)}`;
			}
		}
		return { main, mirror };
	});
	const snapshot = $derived(H.length <= 1);
	/** For the two-dish steps: each pair's whole 24-hour ellipse (ignoring the horizon), dashed. */
	const fullDay = $derived.by(() => {
		if (mode !== 'pair') return '';
		const x0 = xOf('uv') + P / 2;
		const y0 = Y0 + P / 2;
		const Hs = Array.from({ length: 97 }, (_, i) => ((-12 + i / 4) * Math.PI) / 12);
		let d = '';
		for (const tr of tracks(dishes, decRad, Hs))
			for (const sgn of [1, -1])
				for (let i = 0; i < tr.u.length; i++)
					d += `${i ? 'L' : 'M'}${(x0 + sgn * tr.u[i] * uvk).toFixed(1)} ${(y0 - sgn * tr.v[i] * uvk).toFixed(1)}`;
		return d;
	});

	// ---- titles ----------------------------------------------------------------------------------
	const TITLES: Record<Panel, string> = {
		map: 'the dishes',
		uv: 'what they sample: the uv plane',
		beam: 'the dirty beam (central 16′)',
		dirty: 'the dirty image',
		truth: 'the true sky',
		residual: 'the residual',
		restored: 'the restored image'
	};
	const title = (p: Panel) =>
		mode === 'dish'
			? ((
					{ map: 'one dish', uv: 'its uv plane', beam: 'its beam', dirty: 'what it sees' } as const
				)[p as 'map'] ?? TITLES[p])
			: p === 'uv'
				? 'the uv plane'
				: TITLES[p];

	const fmtAngle = (arcsec: number) =>
		!Number.isFinite(arcsec)
			? 'unresolved'
			: arcsec >= 90
				? `${(arcsec / 60).toFixed(1)}′`
				: `${Math.round(arcsec)}″`;
	/** The central peak's size, or its one sharp direction when the samples lie on a line. */
	const beamText = $derived(
		Number.isFinite(cb.major)
			? `${fmtAngle(beamMajor)} × ${fmtAngle(beamMinor)}`
			: `${fmtAngle(beamMinor)} one way, unresolved the other`
	);
	/** The beam is sharp in both directions (not a line of samples). */
	const twoD = $derived(Number.isFinite(cb.major) && cb.minor / cb.major > 0.4);
	const fmtInt = (v: number) => Math.round(v).toLocaleString('en-US');
	const count = (n: number, word: string) =>
		`${fmtInt(n)} ${n === 1 ? word : word.endsWith('sh') ? `${word}es` : `${word}s`}`;
	const decText = $derived(`${decDeg > 0 ? '+' : decDeg < 0 ? '−' : ''}${Math.abs(decDeg)}°`);
	const trackText = $derived(
		H.length === 0
			? `never above 8° at δ = ${decText}`
			: hours === 0
				? `a snapshot at transit · δ = ${decText}`
				: `${hours} h · δ = ${decText}${H.length < Math.round(hours * 12) + 1 ? ' (part below 8°)' : ''}`
	);
	/** The double counts as two points when the dirty image dips by 15% between them. */
	const resolved = $derived.by(() => {
		if (skyKind !== 'double') return false;
		const half = Math.round(DOUBLE_SEPARATION / 2 / PIX);
		const a = dirty[pixel(half, 0)];
		const b = dirty[pixel(-half, 0)];
		return dirty[pixel(0, 0)] < 0.85 * Math.min(a, b);
	});
	const dirtyMin = $derived(dirty.reduce((m, v) => Math.min(m, v), 0));
	const dirtySum = $derived(total(dirty));
	const truthSum = $derived(total(truth));
	const sinDec = $derived(Math.sin(decRad));

	interface Line {
		text: string;
		label?: string;
		value?: string;
	}
	const headline = $derived.by(() => {
		const h = (
			text: string,
			label: string,
			value: string,
			sub = '',
			subLabel?: string,
			subValue?: string
		) => ({ text, label, value, sub, subLabel, subValue });
		const sharp = twoD
			? `about as sharp as one dish ${fmtInt(sp.max)} m across`
			: 'sharp in one direction only';
		switch (mode) {
			case 'dish': {
				const blur = fmtAngle((1.22 * LAMBDA) / diameter / ARCSEC);
				return h(
					`a ${fmtInt(diameter)} m dish blurs every point: its first dark ring lies 1.22 λ/D = ${blur} out`,
					'First dark ring, 1.22 λ/D',
					blur,
					`21 cm waves · collecting area π D²/4 = ${fmtInt(Math.PI * (diameter / 2) ** 2)} m² · sky: ${SKY_NAMES[skyKind]}`,
					'Collecting area',
					`${fmtInt(Math.PI * (diameter / 2) ** 2)} m²`
				);
			}
			case 'pair': {
				const len = sp.max;
				if (H.length === 0)
					return h(
						`at δ = ${decText} the source never climbs 8° above the VLA’s horizon: nothing to measure`,
						'Source',
						'never up'
					);
				if (hours === 0)
					return h(
						'one pair, one moment: one point of the uv plane, and its mirror image',
						'One pair',
						'one point and its mirror',
						`baseline ${fmtInt(len)} m, ${fmtInt(S.uvMax)} wavelengths as seen from the source · stripes ${(1 / (S.uvMax || 1) / ARCMIN).toFixed(1)}′ apart`,
						'Baseline',
						`${fmtInt(len)} m`
					);
				return h(
					`${hours} h of the Earth’s turn: each pair traces an ellipse ${Math.abs(sinDec).toFixed(2)} times as tall as wide (|sin δ|)`,
					'Axis ratio |sin δ|',
					Math.abs(sinDec).toFixed(2),
					`baseline ${fmtInt(len)} m · ${trackText}`,
					'Track',
					trackText
				);
			}
			case 'area':
				return h(
					`${sharp}, with ${((100 * area) / bigArea).toFixed(1)}% of its collecting area`,
					'Share of the big dish’s area',
					`${((100 * area) / bigArea).toFixed(1)}%`,
					`${dishes.length} × 491 m² = ${fmtInt(area)} m², against ${fmtInt(bigArea)} m²: by area alone, the dish’s minute on a faint point takes the array ${duration((bigArea / area) ** 2)}`,
					'Same signal-to-noise (area only)',
					`a minute for the dish, ${duration((bigArea / area) ** 2)} for the array`
				);
			case 'dirty':
				return h(
					`the dirty image adds up to ${Math.abs(dirtySum) < 5e-4 ? '0.000' : dirtySum.toFixed(3)}: the total flux, at the centre of the uv plane, is never measured`,
					'Sum of the dirty image',
					Math.abs(dirtySum) < 5e-4 ? '0.000' : dirtySum.toFixed(3),
					`it dips to ${dirtyMin.toFixed(2)} Jy/beam (blue) where the sky holds nothing; the true sky holds ${truthSum.toFixed(1)} Jy`,
					'Deepest dip',
					`${dirtyMin.toFixed(2)} Jy/beam`
				);
			case 'clean': {
				const c = cleaned;
				if (!c) return h('', '', '');
				return h(
					`${fmtInt(c.iterations)} CLEAN iterations: the components hold ${c.flux.toFixed(2)} of the sky’s ${truthSum.toFixed(2)} Jy`,
					'Flux in components',
					`${c.flux.toFixed(2)} of ${truthSum.toFixed(2)} Jy`,
					`loop gain 0.1 · brightest residual ${c.residualPeak.toFixed(3)} Jy/beam · clean beam ${beamText}`,
					'Brightest residual',
					`${c.residualPeak.toFixed(3)} Jy/beam`
				);
			}
			case 'size':
				if (skyKind === 'double')
					return h(
						`beam ${fmtAngle(beamMajor)}, double 1.5′ apart: ${resolved ? 'two points' : 'one blob'}`,
						'Double',
						resolved ? 'two points' : 'one blob',
						`longest baseline ${fmtInt(sp.max)} m · λ/B = ${fmtAngle(LAMBDA / sp.max / ARCSEC)}`,
						'Longest baseline',
						`${fmtInt(sp.max)} m`
					);
				return h(
					`shortest spacing ${fmtInt(sp.min)} m: structure much larger than λ/b ≈ ${(LAMBDA / sp.min / ARCMIN).toFixed(1)}′ fades, and the disc is 6′`,
					'Ground-spacing scale λ/b_min',
					`${(LAMBDA / sp.min / ARCMIN).toFixed(1)}′`,
					`the dirty image keeps ${Math.round(Math.max(0, discKept ?? 0) * 100)}% of the brightness at the disc’s centre (against the true sky at this resolution)`,
					'Disc’s centre kept',
					`${Math.round(Math.max(0, discKept ?? 0) * 100)}%`
				);
			default:
				return h(
					`${count(dishes.length, 'dish')}, ${count(pairs(dishes.length), 'pair')}: ${S.cells > 2 ? sharp : S.cells ? 'only stripes' : 'nothing measured'}`,
					'Array',
					`${count(dishes.length, 'dish')}, ${count(pairs(dishes.length), 'pair')}`,
					S.cells > 2
						? `central peak ${beamText}; λ/B for the longest spacing = ${fmtAngle(LAMBDA / sp.max / ARCSEC)}`
						: '',
					'Resolution',
					`${beamText}`
				);
		}
	});

	const FLOW: Record<string, string[]> = {
		dish: ['every pair of points on the dish', 'inverse Fourier transform', 'the sky ⊛ the beam'],
		pair: ['each pair: a point and its mirror', 'inverse Fourier transform', 'the sky ⊛ the beam'],
		array: ['each pair: a point and its mirror', 'inverse Fourier transform', 'the sky ⊛ the beam'],
		build: ['each pair: a point and its mirror', 'inverse Fourier transform', 'the sky ⊛ the beam'],
		area: ['each pair: a point and its mirror', 'inverse Fourier transform', 'the sky ⊛ the beam'],
		dirty: ['inverse Fourier transform', 'the sky ⊛ the beam', 'compare'],
		clean: [
			'subtract the beam at the peak, repeat',
			'components ⊛ clean beam + residual',
			'compare'
		],
		size: ['each pair: a point and its mirror', 'the sampled sky, transformed back', 'compare']
	};
	const flow = $derived(FLOW[mode] ?? FLOW.array);

	function caption(p: Panel): Line & { more?: string } {
		switch (p) {
			case 'map':
				if (mode === 'dish') return { text: `${fmtInt(diameter)} m across, to scale` };
				if (mode === 'size')
					return {
						text: `the 12-dish Y × ${sizeF.toFixed(2)}`,
						more: `spacings ${fmtInt(sp.min)}–${fmtInt(sp.max)} m`,
						label: 'Array',
						value: `× ${sizeF.toFixed(2)}`
					};
				return {
					text: `${count(dishes.length, 'dish')} · ${count(pairs(dishes.length), 'pair')}`,
					more:
						dishes.length === 2
							? `${fmtInt(sp.max)} m apart`
							: dishes.length > 2
								? `spacings ${fmtInt(sp.min)}–${fmtInt(sp.max)} m`
								: ''
				};
			case 'uv':
				if (mode === 'dish')
					return { text: `filled out to D/λ = ${fmtInt(diameter / LAMBDA)} wavelengths` };
				return {
					text: trackText,
					more: `${fmtInt(S.cells)} of ${fmtInt(N * N)} cells${S.outside ? ` · ${fmtInt(S.outside)} off the grid` : ''}${S.shadowed ? ` · ${fmtInt(S.shadowed)} shadowed` : ''}`,
					label: mode === 'pair' ? undefined : 'Track',
					value: mode === 'pair' ? undefined : trackText
				};
			case 'beam':
				if (mode === 'dish')
					return {
						text: `half-power width 1.03 λ/D = ${fmtAngle((1.03 * LAMBDA) / diameter / ARCSEC)}`
					};
				if (S.cells === 0) return { text: 'nothing sampled' };
				if (S.cells <= 2)
					return { text: `stripes ${(1 / (S.uvMax || 1) / ARCMIN).toFixed(1)}′ apart` };
				return {
					text: `central peak ${beamText}`,
					more: twoD ? '' : 'long and thin: the samples lie along one direction'
				};
			case 'dirty':
				if (mode === 'dish') return { text: SKY_NAMES[skyKind] };
				if (['array', 'build', 'pair', 'area'].includes(mode))
					return { text: `${count(S.samples, 'sample')}, and their mirrors` };
				return { text: `peak ${dirtyPeak.toFixed(2)} Jy/beam` };
			case 'residual':
				return {
					text: `after ${fmtInt(cleaned?.iterations ?? 0)} iterations`,
					more: cleaned && cleaned.last >= 0 ? 'ring: the latest component' : ''
				};
			case 'restored':
				return { text: 'components ⊛ clean beam + residual' };
			case 'truth':
				return {
					text: `${SKY_NAMES[skyKind]}, ${truthSum.toFixed(1)} Jy`,
					more: 'drawn at 30″'
				};
		}
	}

	// pixels → screen (east left, north up)
	const scr = (x0: number, index: number) => {
		const y = Math.floor(index / N) - N / 2;
		const x = (index % N) - N / 2;
		return { x: x0 + ((N / 2 - x + 0.5) / N) * P, y: Y0 + ((N / 2 - y + 0.5) / N) * P };
	};
</script>

<g>
	<!-- panels -->
	{#each panels as p, i (p)}
		{@const x = XS[i]}
		<Readout id="title-{p}" order={20 + i} label={title(p)} marker={i + 1} at={[x + 12, Y0 + 14]}>
			<Label anchor="start" {x} y={Y0 - 12} text={title(p)} size={14} weight={600} />
		</Readout>
		{#if p === 'map'}
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<rect
				{x}
				y={Y0}
				width={P}
				height={P}
				rx="4"
				fill="var(--as-ground)"
				stroke="var(--as-ground-edge)"
				onpointerdown={onMapDown}
				style:cursor={mode === 'build' ? 'crosshair' : 'default'}
				data-testid="map"
			/>
			<circle
				cx={x + P / 2}
				cy={Y0 + P / 2}
				r={MAP_RADIUS * mk}
				fill="none"
				stroke="var(--as-ground-edge)"
				stroke-dasharray="3 4"
				pointer-events="none"
			/>
			<!-- scale bar and north -->
			<line
				x1={x + 10}
				y1={Y0 + P - 12}
				x2={x + 10 + 200 * mk}
				y2={Y0 + P - 12}
				stroke="var(--stage-ink)"
				stroke-width="2"
			/>
			<Readout id="scalebar">
				<Label x={x + 10 + 100 * mk} y={Y0 + P - 18} text="200 m" anchor="middle" size={11} />
				<Label x={x + P - 12} y={Y0 + 18} text="N ↑" anchor="end" size={11} muted />
			</Readout>
			{#if mode === 'dish'}
				<circle
					cx={x + P / 2}
					cy={Y0 + P / 2}
					r={Math.max(2, (diameter / 2) * mk)}
					fill="var(--as-dish)"
					fill-opacity="0.35"
					stroke="var(--as-dish)"
					stroke-width="1.5"
				/>
			{:else}
				{#if mode === 'area' && dishes.length > 1}
					<circle
						cx={x + P / 2}
						cy={Y0 + P / 2}
						r={(sp.max / 2) * mk}
						fill="none"
						stroke="var(--as-track)"
						stroke-width="1.5"
						stroke-dasharray="6 4"
					/>
				{/if}
				{#each dishes as d, j (j)}
					<circle
						cx={x + P / 2 + d.e * mk}
						cy={Y0 + P / 2 - d.n * mk}
						r="4.5"
						fill="var(--as-dish)"
						stroke="var(--stage-bg)"
						stroke-width="1"
						pointer-events="none"
					/>
					{#if editable}
						<VectorHandle
							x={x + P / 2 + d.e * mk}
							y={Y0 + P / 2 - d.n * mk}
							r={6}
							color="var(--as-dish)"
							label="Dish {j + 1}"
							value={Math.round((Math.atan2(d.e, d.n) * 180) / Math.PI)}
							valuetext="{Math.round(d.e)} m east, {Math.round(d.n)} m north"
							onmove={(pt: Point) =>
								moveDish(j, (pt.x - x - P / 2) / mk, -(pt.y - Y0 - P / 2) / mk)}
							onkey={(dx, dy) => moveDish(j, d.e + 10 * dx, d.n + 10 * dy)}
						/>
					{/if}
				{/each}
			{/if}
		{:else if p === 'uv'}
			<rect {x} y={Y0} width={P} height={P} rx="4" fill="var(--surface)" stroke="var(--border)" />
			<line x1={x + P / 2} y1={Y0 + 6} x2={x + P / 2} y2={Y0 + P - 6} stroke="var(--stage-grid)" />
			<line x1={x + 6} y1={Y0 + P / 2} x2={x + P - 6} y2={Y0 + P / 2} stroke="var(--stage-grid)" />
			{#if mode === 'dish'}
				<image
					href={urls.uv}
					{x}
					y={Y0}
					width={P}
					height={P}
					preserveAspectRatio="none"
					style:image-rendering="pixelated"
				/>
				<circle
					cx={x + P / 2}
					cy={Y0 + P / 2}
					r={Math.min(P / 2, (diameter / LAMBDA) * uvk)}
					fill="none"
					stroke="var(--as-track)"
					stroke-width="1"
				/>
			{:else}
				{#if mode === 'area' && sp.max > 0}
					<circle
						cx={x + P / 2}
						cy={Y0 + P / 2}
						r={Math.min(P / 2 - 1, (sp.max / LAMBDA) * uvk)}
						fill="none"
						stroke="var(--as-track)"
						stroke-width="1.5"
						stroke-dasharray="6 4"
					/>
				{/if}
				<clipPath id="as-synth-uv">
					<rect {x} y={Y0} width={P} height={P} />
				</clipPath>
				<g clip-path="url(#as-synth-uv)">
					{#if fullDay}
						<path
							d={fullDay}
							fill="none"
							stroke="var(--stage-ink-muted)"
							stroke-width="1"
							stroke-dasharray="3 4"
							opacity="0.6"
						/>
					{/if}
					<path
						d={uvPaths.mirror}
						fill="none"
						stroke="var(--as-mirror)"
						stroke-width={snapshot ? 6 : 1.4}
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
					<path
						d={uvPaths.main}
						fill="none"
						stroke="var(--as-track)"
						stroke-width={snapshot ? 6 : 1.4}
						stroke-linecap="round"
						stroke-linejoin="round"
						data-testid="uv-tracks"
					/>
				</g>
			{/if}
			<Readout id="uv-axes">
				<Label x={x + P - 8} y={Y0 + P / 2 - 6} text="u" anchor="end" size={11} muted italic />
				<Label x={x + P / 2 + 6} y={Y0 + 16} text="v" size={11} muted italic />
			</Readout>
		{:else}
			<rect x={x - 1} y={Y0 - 1} width={P + 2} height={P + 2} rx="3" fill="#000" />
			<image
				href={urls[p]}
				{x}
				y={Y0}
				width={P}
				height={P}
				preserveAspectRatio="none"
				data-testid="img-{p}"
			/>
			{#if p !== 'beam'}
				<Readout id="compass-{p}">
					<Label
						x={x + P - 6}
						y={Y0 + 14}
						text="N ↑  E ←"
						anchor="end"
						size={10}
						color="#ced4da"
						halo={false}
					/>
				</Readout>
			{/if}
		{/if}
	{/each}

	<!-- CLEAN: the latest component, on the residual -->
	{#if cleaned && cleaned.last >= 0}
		{@const at = scr(xOf('residual'), cleaned.last)}
		<circle cx={at.x} cy={at.y} r="7" fill="none" stroke="#4dabf7" stroke-width="1.5" />
	{/if}

	<!-- the headline of the step -->
	<Readout id="headline" order={0} label={headline.label} value={headline.value}>
		<Label anchor="start" x={XS[0]} y={58} text={headline.text} size={16} weight={600} tabular />
	</Readout>
	{#if headline.sub}
		<Readout id="subline" order={1} label={headline.subLabel} value={headline.subValue}>
			<Label anchor="start" x={XS[0]} y={82} text={headline.sub} size={12} muted tabular />
		</Readout>
	{/if}

	<!-- captions under the panels -->
	{#each panels as p, i (p)}
		{@const c = caption(p)}
		<Readout id="cap-{p}" order={10 + i} label={c.label} value={c.value}>
			<Label anchor="start" x={XS[i]} y={Y0 + P + 20} text={c.text} size={13} tabular />
		</Readout>
		{#if c.more}
			<Readout id="more-{p}">
				<Label anchor="start" x={XS[i]} y={Y0 + P + 38} text={c.more} size={11} muted tabular />
			</Readout>
		{/if}
	{/each}

	<!-- how each panel follows from the one before -->
	{#each flow as f, i (i)}
		{@const x1 = XS[i] + P / 2 + 24}
		{@const x2 = XS[i + 1] + P / 2 - 24}
		{@const y = Y0 + P + 86}
		<Readout id="flow-{i}">
			<path
				d="M{x1} {y - 14} Q {(x1 + x2) / 2} {y + 12} {x2} {y - 14}"
				fill="none"
				stroke="var(--stage-ink-muted)"
				stroke-width="1.5"
				marker-end="url(#arrowhead)"
			/>
			<Label x={(x1 + x2) / 2} y={y + 18} text={f} anchor="middle" size={11} muted />
		</Readout>
	{/each}

	{#if mode === 'build'}
		<Readout id="hint">
			<Label
				anchor="start"
				x={XS[0]}
				y={Y0 + P + 136}
				text="click the map to add a dish (up to {MAX_DISHES}) · drag a dish to move it · arrow keys move a focused dish 10 m"
				size={12}
				muted
			/>
		</Readout>
	{/if}
</g>
