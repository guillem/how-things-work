<script lang="ts">
	/**
	 * Light from a galaxy at redshift z (`params.zLight`) crossing an expanding universe.
	 * Top: the journey, drawn to a fixed scale for each setting (today's distance fills the
	 * strip). The galaxy and the comoving tick marks between it and us spread apart as a(τ)
	 * grows; the wave packet travels at c (uniformly in conformal time) and its wavelength is
	 * the emitted one × a(τ)/a(emitted). Its colour is that of the hydrogen Hβ line (486 nm)
	 * stretched by the same factor. Bottom: the hydrogen lines in the lab and from the galaxy,
	 * at (1 + z) times their wavelengths.
	 *
	 * The journey loops every 10 s; under reduced motion the frame shows the light arrived.
	 */
	import { Label, wavelengthToColor } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { AGE, BALMER, conformalAt, distances, scaleAt, timeAt } from '../cosmology';
	import { glyText, gyrText } from '../format';
	import Card from './Card.svelte';

	let { t, params, reduced }: StageProps = $props();

	const z = $derived(Number(params.zLight ?? 0.4));
	const aE = $derived(1 / (1 + z));
	const tE = $derived(timeAt(aE));
	const d = $derived(distances(z));
	const etaE = $derived(conformalAt(aE));
	const eta0 = conformalAt(1);

	// ---- the journey --------------------------------------------------------------------
	const PERIOD = 10;
	const u = $derived.by(() => {
		if (reduced) return 1;
		const p = (t % PERIOD) / PERIOD;
		return Math.min(1, Math.max(0, (p - 0.06) / 0.78));
	});
	/** Conformal time now, along the journey, and the scale factor then. */
	const eta = $derived(etaE + (eta0 - etaE) * u);
	const aNow = $derived(u >= 1 ? 1 : scaleAt(timeAtConformal(eta)));
	function timeAtConformal(e: number) {
		// bisection in t between the emission and today
		let lo = tE;
		let hi = AGE;
		for (let k = 0; k < 40; k++) {
			const mid = (lo + hi) / 2;
			if (conformalAt(scaleAt(mid)) < e) lo = mid;
			else hi = mid;
		}
		return (lo + hi) / 2;
	}
	const tNow = $derived(u >= 1 ? AGE : timeAtConformal(eta));

	const MW = 884;
	const LEFT = 104;
	const SPAN = MW - LEFT;
	const Y = 150;
	/** Screen x of comoving distance c (Gly) from us, at scale factor aa. */
	const xOf = (c: number, aa: number) => MW - (c / d.comoving) * SPAN * aa;
	const srcX = $derived(xOf(d.comoving, aNow));
	const photonC = $derived(Math.max(0, d.comoving - (eta - etaE)));
	const photonX = $derived(xOf(photonC, aNow));
	const ticks = $derived(
		Array.from({ length: 9 }, (_, k) => ({ k, x: xOf((k * d.comoving) / 8, aNow) }))
	);

	const LAMBDA0 = 18; // px, the emitted wave (hugely enlarged)
	const stretch = $derived(aNow / aE);
	const nm = $derived(486.13 * stretch);
	const visible = (w: number) => w >= 380 && w <= 750;
	const colorOf = (w: number) => (visible(w) ? wavelengthToColor(w) : 'var(--stage-ink-muted)');
	function packet(x0: number, lam: number, cycles = 4) {
		let s = '';
		const len = lam * cycles;
		const n = Math.max(24, Math.round(len / 2));
		for (let k = 0; k <= n; k++) {
			const x = x0 - (len * k) / n;
			const env = Math.sin((Math.PI * k) / n);
			const y = Y - 14 * env * Math.sin((2 * Math.PI * (k / n) * len) / lam);
			s += `${k ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
		}
		return s;
	}
	const wave = $derived(packet(photonX, LAMBDA0 * stretch));
	const ghost = $derived(packet(srcX + LAMBDA0 * 4 + 14, LAMBDA0));
	const fade = $derived(u <= 0 ? 0 : Math.min(1, u * 30));

	// ---- the spectrum -------------------------------------------------------------------
	const SX0 = 76;
	const SX1 = 916;
	const NM0 = 350;
	const NM1 = 1700;
	const sx = (w: number) => SX0 + ((w - NM0) / (NM1 - NM0)) * (SX1 - SX0);
	const LAB_Y = 432;
	const GAL_Y = 512;
	const rainbow = Array.from({ length: 38 }, (_, k) => {
		const w = 380 + k * 10;
		return { k, x: sx(w), w: sx(w + 10) - sx(w) + 0.5, c: wavelengthToColor(w + 5) };
	});
	const lines = $derived(BALMER.map((b) => ({ ...b, seen: b.nm * (1 + z) })));
	const nmTicks = [400, 600, 800, 1000, 1200, 1400, 1600];
</script>

{#snippet strip(y: number, label: string)}
	<rect
		x={SX0}
		y={y - 18}
		width={SX1 - SX0}
		height="36"
		rx="6"
		fill="var(--stage-grid)"
		opacity="0.6"
	/>
	{#each rainbow as r (r.k)}
		<rect x={r.x} y={y - 18} width={r.w} height="36" fill={r.c} opacity="0.22" />
	{/each}
	<Label anchor="start" x={SX0} y={y - 26} text={label} size={12.5} weight={650} />
{/snippet}

<g>
	<!-- the journey -->
	<Card x={16} y={16} w={928} h={300} />
	<Readout id="title" order={1} label="Light from a galaxy at" value="z = {z.toFixed(2)}">
		<Label
			anchor="start"
			x={36}
			y={46}
			text="Light crossing an expanding universe"
			size={15}
			weight={700}
		/>
	</Readout>
	<Readout id="clock" order={2} label="Time" value="{gyrText(tNow)} after the Big Bang">
		<Label
			x={924}
			y={46}
			text="{gyrText(tNow)} after the Big Bang"
			size={13.5}
			weight={650}
			anchor="end"
		/>
	</Readout>
	<!-- comoving marks: fixed places in the expanding space -->
	<line x1={srcX} x2={MW} y1={Y + 44} y2={Y + 44} stroke="var(--stage-line)" />
	{#each ticks as k (k.k)}
		<line x1={k.x} x2={k.x} y1={Y + 38} y2={Y + 50} stroke="var(--stage-ink-muted)" />
	{/each}
	<Readout id="marks">
		<Label
			x={(srcX + MW) / 2}
			y={Y + 68}
			text="marks fixed in space: they spread apart as it stretches"
			size={11}
			anchor="middle"
			muted
		/>
	</Readout>
	<!-- the emitted wave, for comparison, and the wave on its way -->
	<path d={ghost} fill="none" stroke={wavelengthToColor(486.13)} stroke-width="1.4" opacity="0.6" />
	<Label x={srcX + 14 + LAMBDA0 * 2} y={Y + 30} text="as sent" size={10.5} anchor="middle" muted />
	<path
		d={wave}
		fill="none"
		stroke={colorOf(nm)}
		stroke-width="2.6"
		stroke-dasharray={visible(nm) ? undefined : '5 3'}
		opacity={fade}
	/>
	<!-- the galaxy and us -->
	<circle cx={srcX} cy={Y} r="9" fill="var(--bb-gal)" />
	<ellipse cx={srcX} cy={Y} rx="20" ry="6" fill="var(--bb-gal)" opacity="0.35" />
	<Label x={srcX} y={Y - 30} text="the galaxy" size={12.5} weight={650} anchor="middle" />
	<circle cx={MW} cy={Y} r="9" fill="var(--bb-view)" />
	<ellipse cx={MW} cy={Y} rx="20" ry="6" fill="var(--bb-view)" opacity="0.35" />
	<Label x={MW} y={Y - 30} text="us" size={12.5} weight={650} anchor="middle" />

	<Readout
		id="wl"
		order={3}
		label="Its Hβ light, now"
		value="{Math.round(nm)} nm (× {stretch.toFixed(2)})"
		color={visible(nm) ? colorOf(nm) : undefined}
	>
		<Label anchor="start" x={36} y={262} text="Hβ light sent at 486 nm, now" size={12.5} muted />
		<Label
			anchor="start"
			x={36}
			y={284}
			text="{Math.round(nm)} nm {visible(nm) ? '' : '(infrared)'} · stretched × {stretch.toFixed(
				2
			)}"
			size={14}
			weight={700}
			color={visible(nm) ? colorOf(nm) : undefined}
		/>
	</Readout>
	<Readout id="sent" order={4} label="Light sent" value="{gyrText(AGE - tE)} ago">
		<Label
			anchor="start"
			x={500}
			y={262}
			text="Sent {gyrText(AGE - tE)} ago, when the galaxy"
			size={12.5}
			muted
		/>
		<Label
			anchor="start"
			x={500}
			y={284}
			text="was {glyText(d.then)} away; now {glyText(d.comoving)}"
			size={12.5}
			muted
		/>
	</Readout>
	<Readout id="rule">
		<Label
			x={924}
			y={306}
			text="1 + z = size of the universe now ÷ size then = {(1 + z).toFixed(2)}"
			size={11.5}
			anchor="end"
			weight={600}
		/>
	</Readout>

	<!-- the spectrum -->
	<Card x={16} y={332} w={928} h={252} />
	<Readout id="spec-title">
		<Label anchor="start" x={36} y={360} text="Hydrogen’s fingerprint" size={15} weight={700} />
		<Label x={(sx(380) + sx(750)) / 2} y={406} text="visible" size={11} anchor="middle" muted />
		<Label x={(sx(750) + SX1) / 2} y={406} text="infrared" size={11} anchor="middle" muted />
	</Readout>
	{@render strip(LAB_Y, 'In the lab')}
	{@render strip(GAL_Y, `From the galaxy (z = ${z.toFixed(2)})`)}
	{#each lines as l (l.name)}
		<line
			x1={sx(l.nm)}
			y1={LAB_Y + 18}
			x2={sx(l.seen)}
			y2={GAL_Y - 18}
			stroke="var(--stage-ink-muted)"
			stroke-dasharray="3 3"
			opacity="0.6"
		/>
		<line
			x1={sx(l.nm)}
			x2={sx(l.nm)}
			y1={LAB_Y - 18}
			y2={LAB_Y + 18}
			stroke={colorOf(l.nm)}
			stroke-width="3"
		/>
		<line
			x1={sx(l.seen)}
			x2={sx(l.seen)}
			y1={GAL_Y - 18}
			y2={GAL_Y + 18}
			stroke={colorOf(l.seen)}
			stroke-width="3"
		/>
		<Label x={sx(l.nm)} y={LAB_Y + 32} text={l.name} size={10.5} anchor="middle" muted />
	{/each}
	{#each nmTicks as w (w)}
		<Label x={sx(w)} y={GAL_Y + 34} text={String(w)} size={10.5} anchor="middle" muted />
	{/each}
	<Label x={SX1} y={GAL_Y + 54} text="wavelength, nm" size={11} anchor="end" muted />
</g>
