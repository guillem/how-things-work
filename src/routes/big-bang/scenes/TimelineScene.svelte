<script lang="ts">
	/**
	 * The history of the universe on a logarithmic timeline, 0.01 s to today. The scrubber of
	 * the current step (`scrubId`, log₁₀ of the time in seconds) sets the moment; everything
	 * shown is computed for it:
	 *  - the box (left): a schematic sample of what the universe contains. 32 nucleons, with
	 *    neutrons counted from `neutronsPerProton(t)` and paired into helium after the
	 *    deuterium bottleneck; e± pairs from `pairsLeft(T)`; photons that zigzag (scattering)
	 *    while the gas is ionized and fly straight once atoms form; the glow fades as the light
	 *    leaves the visible (the background's tint follows T between 700 and 3,000 K);
	 *    stars once the first stars light up, and atoms re-ionized following `reionized(z)`;
	 *  - the readouts (right): time, temperature, redshift, size, and per step the neutron
	 *    count, helium's share, or the ionized fraction; the light's spectrum (Planck's law at
	 *    T) on a log-wavelength axis.
	 * The atoms switch on across z* ± 100 (the width of the last-scattering shell). The box is
	 * not to scale: in reality there are 1.6 billion photons per nucleon.
	 */
	import { startDrag, wavelengthToColor, hash, type Point } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		AGE,
		GYR_S,
		PLANCK,
		T0,
		T_FREEZE_S,
		T_NUC_S,
		T_START_S,
		heliumMassFraction,
		neutronsPerProton,
		pairsLeft,
		peakWavelength,
		planckShape,
		reionized,
		scaleAt,
		temperature,
		timeAt
	} from '../cosmology';
	import { lambdaText, sci, tempText, timeText, zText } from '../format';
	import Card from './Card.svelte';
	import T from './T.svelte';

	let { step, t, params, setParam, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'second'));
	const scrubId = $derived(
		{ second: 'tSecond', helium: 'tHelium', cmb: 'tCmb', stars: 'tStars', today: 'tToday' }[
			phase
		] ?? 'tSecond'
	);
	const LOG0 = Math.log10(T_START_S);
	const LOGNOW = Math.log10(AGE * GYR_S);
	const logT = $derived(Math.min(LOGNOW, Math.max(LOG0, Number(params[scrubId] ?? 0))));
	const sec = $derived(10 ** logT);
	const gyr = $derived(sec / GYR_S);
	const a = $derived(logT >= LOGNOW - 1e-6 ? 1 : scaleAt(gyr));
	const z = $derived(1 / a - 1);
	const temp = $derived(temperature(a));
	const YEAR = GYR_S / 1e9;
	const yr = $derived(sec / YEAR);

	// ---- the timeline -------------------------------------------------------------------
	const TX0 = 40;
	const TX1 = 920;
	const TY = 520;
	const tx = (lg: number) => TX0 + ((lg - LOG0) / (LOGNOW - LOG0)) * (TX1 - TX0);
	const lgYr = (y: number) => Math.log10(y * YEAR);
	const TICKS = [
		{ lg: -2, text: '0.01 s' },
		{ lg: 0, text: '1 s' },
		{ lg: Math.log10(60), text: '1 min' },
		{ lg: Math.log10(3600), text: '1 h' },
		{ lg: lgYr(1), text: '1 yr' },
		{ lg: lgYr(1000), text: '1,000 yr' },
		{ lg: lgYr(1e6), text: '1 Myr' },
		{ lg: lgYr(1e9), text: '1 Gyr' }
	];
	const zStarT = timeAt(1 / (1 + PLANCK.zStar)) * GYR_S;
	const zEq = 3418; // Ω_m/Ω_r − 1 for this model
	const tEq = timeAt(1 / (1 + zEq)) * GYR_S;
	const tRe = timeAt(1 / (1 + PLANCK.zRe)) * GYR_S;
	const EVENTS = [
		{
			id: 'freeze',
			lg: Math.log10(T_FREEZE_S),
			text: 'neutrons freeze out',
			row: 0,
			anchor: 'middle'
		},
		{ id: 'he', lg: Math.log10(T_NUC_S), text: 'helium', row: 1, anchor: 'middle' },
		{ id: 'eq', lg: Math.log10(tEq), text: 'matter takes over', row: 0, anchor: 'end' },
		{ id: 'cmb', lg: Math.log10(zStarT), text: 'atoms: the CMB', row: 1, anchor: 'start' },
		{ id: 'stars', lg: lgYr(1.4e8), text: 'first stars', row: 0, anchor: 'end' },
		{ id: 're', lg: Math.log10(tRe), text: 'reionized', row: 1, anchor: 'start' }
	];
	/** Eras: radiation, then matter, then (from 10.3 Gyr) dark energy dominate. */
	const ERAS = [
		{ id: 'rad', from: LOG0, to: Math.log10(tEq), color: 'var(--bb-radiation)' },
		{ id: 'mat', from: Math.log10(tEq), to: Math.log10(10.3 * GYR_S), color: 'var(--bb-matter)' },
		{ id: 'de', from: Math.log10(10.3 * GYR_S), to: LOGNOW, color: 'var(--bb-de)' }
	];
	function moveTo(p: Point) {
		const lg = LOG0 + ((p.x - TX0) / (TX1 - TX0)) * (LOGNOW - LOG0);
		setParam(scrubId, Math.min(LOGNOW, Math.max(LOG0, lg)));
	}

	// ---- the state of the universe ------------------------------------------------------
	const nPerP = $derived(neutronsPerProton(sec));
	const N = 32;
	const neutrons = $derived(Math.round((N * nPerP) / (1 + nPerP)));
	const fused = $derived(sec >= T_NUC_S);
	const heliums = $derived(fused ? Math.floor(neutrons / 2) : 0);
	const pairs = $derived(Math.round(12 * pairsLeft(temp)));
	const neutral = $derived(smooth(PLANCK.zStar + 100, PLANCK.zStar - 100, z));
	const ionizedAgain = $derived(reionized(z));
	const glow = $derived(smooth(700, 3000, temp));
	const starsLit = $derived(Math.round(7 * smooth(lgYr(1e8), lgYr(1.5e9), logT)));
	function smooth(lo: number, hi: number, v: number) {
		const u = Math.min(1, Math.max(0, (v - lo) / (hi - lo)));
		return u * u * (3 - 2 * u);
	}

	// ---- the box --------------------------------------------------------------------------
	const BX = 32;
	const BY = 62;
	const BW = 472;
	const BH = 368;
	const wrap = (v: number, lo: number, span: number) => lo + ((((v - lo) % span) + span) % span);
	const tt = $derived(reduced ? 2.5 : t);
	/** A drifting particle k of a family, with speed `sp` px/s. */
	function drift(k: number, salt: number, sp: number) {
		const ang = hash(k, salt) * 2 * Math.PI;
		return {
			x: wrap(BX + 14 + hash(k, salt + 1) * (BW - 28) + Math.cos(ang) * sp * tt, BX + 10, BW - 20),
			y: wrap(BY + 14 + hash(k, salt + 2) * (BH - 28) + Math.sin(ang) * sp * tt, BY + 10, BH - 20),
			ang
		};
	}
	// the hotter, the faster (√T), within limits
	const heat = $derived(Math.min(1, Math.max(0.15, Math.log10(temp) / 10)));
	const nucleons = $derived.by(() => {
		const out: { k: number; x: number; y: number; n: boolean; he: number }[] = [];
		const freeN = neutrons - 2 * heliums;
		const OFF = [
			[-3.5, -3.5],
			[3.5, -3.5],
			[-3.5, 3.5],
			[3.5, 3.5]
		];
		for (let k = 0; k < N; k++) {
			// the nucleons of helium nucleus h are 4h…4h+3: 2 protons, 2 neutrons
			const h = Math.floor(k / 4);
			if (h < heliums) {
				const c = drift(h, 50, 8 * heat);
				const o = OFF[k % 4];
				out.push({ k, x: c.x + o[0], y: c.y + o[1], n: k % 4 === 1 || k % 4 === 2, he: h });
			} else {
				// the last free nucleons are the neutrons: a decay turns one into a proton
				const p = drift(k, 10, 16 * heat);
				out.push({ k, x: p.x, y: p.y, n: k >= N - freeN, he: -1 });
			}
		}
		return out;
	});
	const freeProtons = $derived(nucleons.filter((p) => p.he < 0 && !p.n));
	/** Electrons: one per proton (bound to it once atoms form), plus the e± pairs. */
	const electrons = $derived.by(() => {
		const out: { k: number; x: number; y: number; bound: boolean }[] = [];
		const protons = N - neutrons;
		for (let k = 0; k < protons; k++) {
			// atoms: an electron circles a free proton (or a helium nucleus)
			const host = freeProtons[k];
			const boundNow = hash(k, 77) < neutral && !(hash(k, 78) < ionizedAgain);
			if (host && boundNow) {
				const ph = tt * 2 + hash(k, 79) * 6.28;
				out.push({ k, x: host.x + 9 * Math.cos(ph), y: host.y + 9 * Math.sin(ph), bound: true });
			} else if (!host && boundNow) {
				const h = Math.floor((k - freeProtons.length) / 2);
				const c = drift(h, 50, 8 * heat);
				const ph = tt * 2 + k * 3.1;
				out.push({ k, x: c.x + 11 * Math.cos(ph), y: c.y + 11 * Math.sin(ph), bound: true });
			} else {
				const p = drift(k, 30, 40 * heat);
				out.push({ k, x: p.x, y: p.y, bound: false });
			}
		}
		return out;
	});
	const pairList = $derived(
		Array.from({ length: pairs }, (_, k) => ({
			k,
			e: drift(k + 100, 31, 45 * heat),
			p: drift(k, 41, 45 * heat)
		}))
	);
	const neutrinos = $derived(Array.from({ length: 8 }, (_, k) => ({ k, ...drift(k, 61, 70) })));
	/** Photons: straight dashes, zigzagging while they scatter off free electrons. */
	const photons = $derived.by(() => {
		const scatter = 1 - neutral + neutral * ionizedAgain * 0.15;
		return Array.from({ length: 18 }, (_, k) => {
			const p = drift(k, 21, 90);
			const zig = scatter * 10 * Math.sin(tt * 9 + k * 1.7);
			const ux = Math.cos(p.ang);
			const uy = Math.sin(p.ang);
			return { k, x: p.x - uy * zig, y: p.y + ux * zig, ux, uy };
		});
	});
	const lambdaPeak = $derived(peakWavelength(temp));
	const visiblePeak = $derived(lambdaPeak >= 380e-9 && lambdaPeak <= 750e-9);
	const photonColor = $derived(
		lambdaPeak < 380e-9
			? 'var(--bb-photon)'
			: visiblePeak
				? wavelengthToColor(lambdaPeak * 1e9)
				: 'var(--bb-red)'
	);
	const photonOpacity = $derived(lambdaPeak > 750e-9 ? 0.45 : 0.9);
	const stars = $derived(
		Array.from({ length: starsLit }, (_, k) => ({
			k,
			x: BX + 40 + hash(k, 91) * (BW - 80),
			y: BY + 40 + hash(k, 92) * (BH - 80)
		}))
	);
	const photonWave = (len: number, lam: number) => {
		let d = '';
		const n = 12;
		for (let i = 0; i <= n; i++) {
			const s = (len * i) / n - len / 2;
			d += `${i ? 'L' : 'M'}${s.toFixed(1)} ${(2.6 * Math.sin((s / lam) * 2 * Math.PI)).toFixed(1)}`;
		}
		return d;
	};
	const wavePath = $derived(photonWave(16, lambdaPeak > 750e-9 ? 8 : 4));

	// ---- headline -----------------------------------------------------------------------
	const headline = $derived.by(() => {
		if (sec < T_FREEZE_S) return 'Protons and neutrons keep turning into each other';
		if (sec < T_NUC_S) return 'Neutrons decaying; too hot for deuterium';
		if (sec < 3600) return 'The first nuclei: hydrogen and helium';
		if (z > PLANCK.zStar + 60) return 'A glowing, opaque plasma';
		if (z > PLANCK.zStar - 100) return 'Atoms form: the light breaks free';
		if (yr < 1e8) return 'The dark ages: neutral gas, no stars yet';
		if (ionizedAgain < 0.97) return 'The first stars and galaxies light up';
		if (gyr < 9.1) return 'Galaxies grow; gas ionized again';
		if (gyr < 9.6) return 'The Sun and its planets form';
		if (logT < LOGNOW - 1e-3) return 'Galaxies; expansion speeding up';
		return 'Today: 2.7 K, still expanding';
	});

	// ---- the spectrum inset -------------------------------------------------------------
	const SP = { x: 560, y: 290, w: 364, h: 84 };
	const L0 = -13;
	const L1 = -1;
	const lx = (l: number) => SP.x + ((Math.log10(l) - L0) / (L1 - L0)) * SP.w;
	const BANDS = [
		{ id: 'g', from: 1e-13, to: 1e-11, text: 'γ rays' },
		{ id: 'x', from: 1e-11, to: 1e-8, text: 'X-rays' },
		{ id: 'uv', from: 1e-8, to: 3.8e-7, text: 'UV' },
		{ id: 'v', from: 3.8e-7, to: 7.5e-7, text: '' },
		{ id: 'ir', from: 7.5e-7, to: 1e-3, text: 'infrared' },
		{ id: 'mw', from: 1e-3, to: 1e-1, text: 'microwaves' }
	];
	function curve(T: number) {
		const pk = peakWavelength(T);
		let d = '';
		for (let i = 0; i <= 80; i++) {
			const l = pk * 10 ** (-0.7 + (2.7 * i) / 80);
			const lg = Math.log10(l);
			if (lg < L0 || lg > L1) continue;
			const y = SP.y + SP.h - planckShape(l, T) * (SP.h - 6);
			d += `${d ? 'L' : 'M'}${lx(l).toFixed(1)} ${y.toFixed(1)}`;
		}
		return d;
	}
	const specNow = $derived(curve(temp));
	const specToday = curve(T0);
	const nText = $derived(nPerP > 0 ? `1 for every ${(1 / nPerP).toFixed(1)} protons` : '—');
	const Y = heliumMassFraction();
	const zLabel = $derived(z < 1e-6 ? '0' : z > 1e5 ? sci(z, 2) : zText(z));
	const sizeText = $derived(a >= 0.999 ? '1 (today)' : `${sci(a, 2)} of today’s`);
	const timeLabel = $derived(logT >= LOGNOW - 1e-4 ? '13.8 billion years' : timeText(sec));
</script>

{#snippet row(y: number, label: string, value: string, color?: string)}
	<T x={560} {y} text={label} size={12.5} muted />
	<T x={924} {y} text={value} size={13.5} weight={700} anchor="end" {color} />
{/snippet}

<g>
	<!-- the box -->
	<Card x={16} y={16} w={504} h={430} />
	<Readout id="headline" order={1} label="What is happening" value={headline}>
		<T x={32} y={44} text={headline} size={14.5} weight={700} />
	</Readout>
	<defs>
		<clipPath id="tl-box">
			<rect x={BX} y={BY} width={BW} height={BH} rx="10" />
		</clipPath>
	</defs>
	<rect x={BX} y={BY} width={BW} height={BH} rx="10" fill="var(--bb-dark)" />
	<rect x={BX} y={BY} width={BW} height={BH} rx="10" fill="var(--bb-plasma)" opacity={glow} />
	<g clip-path="url(#tl-box)">
		{#each stars as s (s.k)}
			<circle cx={s.x} cy={s.y} r="26" fill="#ffd43b" opacity="0.12" />
			<circle cx={s.x} cy={s.y} r="5" fill="#fab005" />
		{/each}
		{#each photons as p (p.k)}
			<path
				d={wavePath}
				transform="translate({p.x} {p.y}) rotate({(Math.atan2(p.uy, p.ux) * 180) / Math.PI})"
				fill="none"
				stroke={photonColor}
				stroke-width="1.6"
				opacity={photonOpacity}
			/>
		{/each}
		{#each neutrinos as v (v.k)}
			<circle cx={v.x} cy={v.y} r="2" fill="var(--bb-neutrino)" />
		{/each}
		{#each nucleons as n (n.k)}
			<circle
				cx={n.x}
				cy={n.y}
				r={n.he >= 0 ? 3.6 : 4.2}
				fill={n.n ? 'var(--bb-neutron)' : 'var(--bb-proton)'}
				stroke={n.he >= 0 ? 'var(--bb-helium)' : 'none'}
				stroke-width="0.8"
			/>
		{/each}
		{#each pairList as q (q.k)}
			<circle cx={q.e.x} cy={q.e.y} r="2.2" fill="var(--bb-electron)" />
			<circle cx={q.p.x} cy={q.p.y} r="2.2" fill="var(--bb-positron)" />
		{/each}
		{#each electrons as e (e.k)}
			<circle cx={e.x} cy={e.y} r="2.2" fill="var(--bb-electron)" />
		{/each}
	</g>
	<Readout id="key">
		{#each [{ k: 'p', c: 'var(--bb-proton)', t: 'proton' }, { k: 'n', c: 'var(--bb-neutron)', t: 'neutron' }, { k: 'e', c: 'var(--bb-electron)', t: 'electron' }, { k: 'e+', c: 'var(--bb-positron)', t: 'positron' }, { k: 'v', c: 'var(--bb-neutrino)', t: 'neutrino' }, { k: 'h', c: 'var(--bb-helium)', t: 'helium' }] as key, i (key.k)}
			<circle cx={36 + i * 80} cy={438 - 4} r="4" fill={key.c} />
			<T x={44 + i * 80} y={438} text={key.t} size={11} muted />
		{/each}
	</Readout>

	<!-- readouts -->
	<Card x={536} y={16} w={408} h={430} />
	<Readout id="time" order={2} label="Time" value={timeLabel}>
		<T x={560} y={46} text="Time since the Big Bang" size={12.5} muted />
		<T x={924} y={46} text={timeLabel} size={15} weight={700} anchor="end" />
	</Readout>
	<Readout id="temp" order={3} label="Temperature" value={tempText(temp)}>
		{@render row(76, 'Temperature', tempText(temp), 'var(--bb-arrow)')}
	</Readout>
	<Readout id="size">
		{@render row(102, 'Distances, compared with today', sizeText)}
	</Readout>
	<Readout id="z" order={5} label="Its light reaches us at redshift" value={zLabel}>
		{@render row(128, 'Its light reaches us at redshift z', zLabel)}
	</Readout>
	{#if phase === 'second' || phase === 'helium'}
		<Readout id="np" order={6} label="Neutrons" value={nText}>
			{@render row(162, 'Neutrons', nText, 'var(--bb-neutron)')}
		</Readout>
		{#if phase === 'second'}
			<Readout
				id="pairs"
				order={7}
				label="Electron–positron pairs left"
				value="{Math.round(pairsLeft(temp) * 100)}%"
			>
				{@render row(188, 'Electron–positron pairs left', `${Math.round(pairsLeft(temp) * 100)}%`)}
			</Readout>
		{:else}
			<Readout
				id="he"
				order={7}
				label="Helium, share of the mass"
				value={fused ? `${(Y * 100).toFixed(1)}%` : 'not yet'}
			>
				{@render row(
					188,
					'Helium, share of the mass',
					fused ? `${(Y * 100).toFixed(1)}%` : 'not yet'
				)}
			</Readout>
			<!-- mass bar -->
			<rect x={560} y={202} width={364} height="14" rx="3" fill="var(--bb-proton)" opacity="0.75" />
			<rect
				x={560 + 364 * (1 - (fused ? Y : 0))}
				y={202}
				width={364 * (fused ? Y : 0)}
				height="14"
				fill="var(--bb-helium)"
			/>
			<T x={566} y={234} text="hydrogen" size={11} muted />
			<T x={918} y={234} text="helium" size={11} anchor="end" muted />
		{/if}
	{:else if phase === 'cmb'}
		<Readout
			id="atoms"
			order={6}
			label="Electrons bound in atoms"
			value="{Math.round(neutral * 100)}%"
		>
			{@render row(162, 'Electrons bound in atoms', `${Math.round(neutral * 100)}%`)}
		</Readout>
		<Readout id="peak" order={7} label="The light is brightest at" value={lambdaText(lambdaPeak)}>
			{@render row(188, 'The light is brightest at', lambdaText(lambdaPeak))}
		</Readout>
		<Readout id="opaque">
			<T
				x={560}
				y={222}
				text={neutral < 0.5
					? 'Opaque: light bounces off free electrons'
					: 'Transparent: light flies straight'}
				size={12}
			/>
		</Readout>
	{:else if phase === 'stars'}
		<Readout
			id="ion"
			order={6}
			label="Hydrogen ionized again"
			value="{Math.round(ionizedAgain * 100)}%"
		>
			{@render row(162, 'Hydrogen ionized again', `${Math.round(ionizedAgain * 100)}%`)}
		</Readout>
		<Readout id="stars-note">
			<T x={560} y={196} text="First stars expected at z ≈ 30–20 (100–180 Myr)" size={12} />
			<T x={560} y={216} text="JADES-GS-z14-0 seen at z = 14.3 (≈ 290 Myr)" size={12} />
		</Readout>
	{:else}
		<!-- the last 13.8 Gyr on a linear scale -->
		{@const LX0 = 560}
		{@const LW = 364}
		{@const lin = (g: number) => LX0 + (g / AGE) * LW}
		<T x={560} y={160} text="The same history on an ordinary (linear) scale" size={12} muted />
		<rect x={LX0} y={170} width={LW} height="10" rx="3" fill="var(--stage-grid)" />
		<rect
			x={LX0}
			y={170}
			width={lin(Math.min(gyr, AGE)) - LX0}
			height="10"
			rx="3"
			fill="var(--bb-curve)"
			opacity="0.6"
		/>
		{#each [{ g: 0.00001, t: 'Big Bang', y: 198, anchor: 'start' }, { g: 7.7, t: 'speeding up', y: 198, anchor: 'middle' }, { g: 9.23, t: 'Sun', y: 216, anchor: 'middle' }, { g: AGE, t: 'today', y: 198, anchor: 'end' }] as m (m.t)}
			<line x1={lin(m.g)} x2={lin(m.g)} y1={166} y2={184} stroke="var(--stage-ink)" />
			<T
				x={lin(m.g)}
				y={m.y}
				text={m.t}
				size={11}
				anchor={m.anchor as 'start' | 'middle' | 'end'}
			/>
		{/each}
		<Readout id="today-note">
			<T
				x={560}
				y={244}
				text="Everything before the first billion years fits in the first 7%."
				size={12}
				muted
			/>
		</Readout>
	{/if}

	<!-- spectrum -->
	<T
		x={560}
		y={270}
		text="The light: Planck’s spectrum at {tempText(temp)}"
		size={12.5}
		weight={650}
	/>
	{#each BANDS as b (b.id)}
		{#if b.id === 'v'}
			{#each [400, 450, 500, 550, 600, 650, 700] as w (w)}
				<rect
					x={lx(w * 1e-9)}
					y={SP.y}
					width={lx((w + 50) * 1e-9) - lx(w * 1e-9) + 0.4}
					height={SP.h}
					fill={wavelengthToColor(w + 25)}
					opacity="0.45"
				/>
			{/each}
		{:else}
			<line x1={lx(b.from)} x2={lx(b.from)} y1={SP.y} y2={SP.y + SP.h} stroke="var(--stage-grid)" />
			<T
				x={(lx(b.from) + lx(b.to)) / 2}
				y={SP.y + SP.h + 16}
				text={b.text}
				size={10.5}
				anchor="middle"
				muted
			/>
		{/if}
	{/each}
	<line x1={SP.x} x2={SP.x + SP.w} y1={SP.y + SP.h} y2={SP.y + SP.h} stroke="var(--stage-line)" />
	{#if phase === 'cmb' || phase === 'today'}
		<path
			d={specToday}
			fill="none"
			stroke="var(--stage-ink-muted)"
			stroke-width="1.4"
			stroke-dasharray="4 3"
		/>
		<T
			x={lx(peakWavelength(T0)) - 8}
			y={SP.y + 10}
			text="today, 2.7255 K"
			size={10.5}
			anchor="end"
			muted
		/>
	{/if}
	<path d={specNow} fill="none" stroke="var(--bb-arrow)" stroke-width="2.4" />
	<T
		x={SP.x + SP.w}
		y={SP.y + SP.h + 34}
		text="wavelength (each tick ×1,000)"
		size={10.5}
		anchor="end"
		muted
	/>

	<!-- the timeline -->
	<Card x={16} y={458} w={928} h={126} />
	{#each ERAS as e (e.id)}
		<rect
			x={tx(e.from)}
			y={TY - 4}
			width={tx(e.to) - tx(e.from)}
			height="8"
			fill={e.color}
			opacity="0.55"
		/>
	{/each}
	<T x={tx(Math.log10(tEq)) - 6} y={TY + 22} text="radiation era" size={10.5} anchor="end" muted />
	<T x={tx(Math.log10(tEq)) + 6} y={TY + 22} text="matter era" size={10.5} muted />
	{#each TICKS as k (k.text)}
		<line x1={tx(k.lg)} x2={tx(k.lg)} y1={TY + 4} y2={TY + 30} stroke="var(--stage-grid)" />
		<T x={tx(k.lg)} y={TY + 44} text={k.text} size={10.5} anchor="middle" muted />
	{/each}
	<T x={TX1} y={TY + 44} text="today" size={10.5} anchor="end" muted />
	{#each EVENTS as ev (ev.id)}
		<line
			x1={tx(ev.lg)}
			x2={tx(ev.lg)}
			y1={TY - (ev.row ? 34 : 18)}
			y2={TY - 4}
			stroke="var(--stage-ink-muted)"
		/>
		<T
			x={tx(ev.lg)}
			y={TY - (ev.row ? 38 : 22)}
			text={ev.text}
			size={11}
			anchor={ev.anchor as 'start' | 'middle' | 'end'}
		/>
	{/each}
	<!-- the cursor -->
	<line
		x1={tx(logT)}
		x2={tx(logT)}
		y1={TY - 50}
		y2={TY + 30}
		stroke="var(--bb-view)"
		stroke-width="2.5"
	/>
	<circle cx={tx(logT)} cy={TY} r="7" fill="var(--bb-view)" />
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<rect
		class="scrub"
		x={TX0 - 10}
		y={TY - 54}
		width={TX1 - TX0 + 20}
		height="90"
		fill="transparent"
		style:cursor="ew-resize"
		onpointerdown={(e) => startDrag(e, moveTo)}
	/>
</g>
