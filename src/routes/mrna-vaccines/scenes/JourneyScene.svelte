<script lang="ts">
	/**
	 * Steps "injection" to "fading", and "recap": the vaccine's journey.
	 *
	 * "muscle": the shoulder with the needle, and a close-up of the muscle in
	 * which particles spread out from the injection; some drain along a lymph
	 * vessel to the lymph node in the armpit.
	 *
	 * The other views share one cell (muscle cell, cytoplasm, nucleus with its
	 * DNA, endoplasmic reticulum, Golgi), each looping one part of the story:
	 *   entry    a particle is swallowed into an endosome, which turns acidic
	 *            and bursts; the message spills into the cytoplasm
	 *   ribosome ribosomes read a message lying on the ER; finished spikes ride
	 *            vesicles to the cell surface; a codon counter at the real speed
	 *            (5.6 codons a second, Ingolia et al. 2011)
	 *   nucleus  the cell's own messages leave the nucleus through its pores;
	 *            the vaccine's message stays outside
	 *   fade     the slider's day: messages and surface spikes in proportion to
	 *            the share of the mRNA still translated (`mrnaLeft`, half-life
	 *            20.6 h), with the decay curve
	 *   recap    everything, with numbered stages
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { clamp, cycle, hash, Label, lerp, smoothstep, TAU } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { MRNA, mrnaLeft } from '../model';
	import { SEQUENCE } from '../data';

	let { step, t, params, reduced }: StageProps = $props();
	const view = $derived(String(step.hints?.view ?? 'muscle'));
	const time = $derived(reduced ? 2.5 : t);

	// crossfade between the arm and the cell
	const cellMix = new Tween(0, { duration: 900, easing: cubicInOut });
	$effect(() => {
		const v = view === 'muscle' ? 0 : 1;
		untrack(() => cellMix.set(v, { duration: reduced ? 0 : 900 }));
	});
	const on = (v: string) => (view === v ? 1 : 0);

	// ======================================================= the arm ======
	const NEEDLE = { x: 250, y: 250 };
	/** Particles spreading out from the injection point inside the close-up. */
	const ZOOM = { x: 640, y: 330, r: 230 };
	const SPREAD = Array.from({ length: 34 }, (_, i) => ({
		k: i,
		a: hash(i, 1) * TAU,
		d: 0.25 + 0.7 * hash(i, 2),
		o: hash(i, 3)
	}));
	const spread = $derived(
		SPREAD.map((p) => {
			const u = reduced ? 0.8 : cycle(time, 9, p.o);
			const r = Math.sqrt(u) * p.d * ZOOM.r * 0.85;
			return {
				k: p.k,
				x: ZOOM.x - 120 + Math.cos(p.a) * r * 0.9,
				y: ZOOM.y + Math.sin(p.a) * r * 0.75,
				o: reduced ? 1 : smoothstep(0, 0.1, u) * (1 - smoothstep(0.85, 1, u))
			};
		})
	);
	const FIBRES = Array.from({ length: 7 }, (_, i) => ({ k: i, y: ZOOM.y - 190 + i * 58 }));
	const lymphPath = [
		{ x: ZOOM.x + 40, y: ZOOM.y - 30 },
		{ x: ZOOM.x + 130, y: ZOOM.y - 120 },
		{ x: ZOOM.x + 200, y: ZOOM.y - 230 }
	];
	const lymph = $derived(
		[0, 1, 2].map((k) => {
			const u = reduced ? 0.5 : cycle(time, 5, k / 3);
			const a = lymphPath[0];
			const b = lymphPath[1];
			const c = lymphPath[2];
			const w = 1 - u;
			return {
				k,
				x: w * w * a.x + 2 * w * u * b.x + u * u * c.x,
				y: w * w * a.y + 2 * w * u * b.y + u * u * c.y,
				o: smoothstep(0, 0.1, u) * (1 - smoothstep(0.85, 1, u))
			};
		})
	);

	// ======================================================= the cell =====
	const C = { x: 470, y: 330, rx: 430, ry: 238 };
	const N = { x: 705, y: 345, r: 105 };
	const memY = (x: number, sign = -1) =>
		C.y + sign * C.ry * Math.sqrt(Math.max(0, 1 - ((x - C.x) / C.rx) ** 2));
	const PORES = Array.from({ length: 10 }, (_, i) => ({ k: i, a: (i / 10) * TAU + 0.2 }));
	const DNA = Array.from({ length: 5 }, (_, i) => {
		let d = '';
		for (let j = 0; j <= 30; j++) {
			const u = j / 30;
			const x = N.x - 70 + u * 140;
			const y = N.y - 52 + i * 26 + Math.sin(u * 18 + i) * 6;
			d += `${j ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
		}
		return { k: i, d };
	});
	const ER = [0, 1, 2].map((i) => {
		const r = N.r + 26 + i * 18;
		const a0 = (125 * Math.PI) / 180;
		const a1 = (235 * Math.PI) / 180;
		let d = '';
		for (let j = 0; j <= 24; j++) {
			const a = lerp(a0, a1, j / 24);
			const rr = r + Math.sin(j * 1.3 + i) * 4;
			d += `${j ? 'L' : 'M'}${(N.x + Math.cos(a) * rr).toFixed(1)} ${(N.y + Math.sin(a) * rr).toFixed(1)}`;
		}
		return { k: i, d };
	});
	const GOLGI = { x: 470, y: 200 };

	/** A wavy message strand centred at (x, y), `len` long, at angle a. */
	const strand = (x: number, y: number, len: number, a: number, phase: number) => {
		let d = '';
		const ca = Math.cos(a);
		const sa = Math.sin(a);
		for (let i = 0; i <= 16; i++) {
			const u = i / 16 - 0.5;
			const px = u * len;
			const py = Math.sin(u * 12 + phase) * 4;
			d += `${i ? 'L' : 'M'}${(x + px * ca - py * sa).toFixed(1)} ${(y + px * sa + py * ca).toFixed(1)}`;
		}
		return d;
	};

	// ---- entry ----------------------------------------------------------------
	const ENTRY = { x: 118, y: 192 }; // where the particle meets the membrane
	const ENDO = { x: 250, y: 300 }; // where the endosome bursts
	const ph = $derived(reduced ? 0.78 : cycle(time, 9));
	const entry = $derived.by(() => {
		const p = ph;
		const approach = smoothstep(0, 0.18, p);
		const inward = smoothstep(0.25, 0.5, p);
		const acid = smoothstep(0.4, 0.6, p);
		const burst = smoothstep(0.62, 0.7, p);
		const out = smoothstep(0.68, 0.95, p);
		return {
			lx: lerp(ENTRY.x - 70, ENTRY.x + 8, approach) + inward * (ENDO.x - ENTRY.x - 8),
			ly: lerp(ENTRY.y - 70, ENTRY.y + 6, approach) + inward * (ENDO.y - ENTRY.y - 6),
			pocket: smoothstep(0.15, 0.25, p) * (1 - smoothstep(0.25, 0.32, p)),
			endo: smoothstep(0.22, 0.3, p) * (1 - burst),
			acid,
			burst,
			out,
			fade: 1 - smoothstep(0.95, 1, p),
			stage: p < 0.22 ? 1 : p < 0.4 ? 2 : p < 0.64 ? 3 : 4
		};
	});
	const STAGES = [
		{ n: 1, label: 'taken in', x: 110, y: 420 },
		{ n: 2, label: 'inside an endosome', x: 110, y: 440 },
		{ n: 3, label: 'acid: the lipid turns positive', x: 110, y: 460 },
		{ n: 4, label: 'it bursts: the message is out', x: 110, y: 480 }
	];
	const PROTONS = Array.from({ length: 8 }, (_, i) => ({ k: i, a: (i / 8) * TAU }));

	// ---- ribosome ---------------------------------------------------------------
	const POLY = { x0: 290, y0: 470, x1: 440, y1: 420 }; // the message lying on the ER
	const polyAt = (u: number) => ({
		x: lerp(POLY.x0, POLY.x1, u),
		y: lerp(POLY.y0, POLY.y1, u)
	});
	const ribos = $derived(
		[0, 1, 2, 3].map((k) => {
			const u = reduced ? 0.15 + k * 0.22 : cycle(time, 10, k / 4);
			return { k, u, ...polyAt(u), o: smoothstep(0, 0.06, u) * (1 - smoothstep(0.94, 1, u)) };
		})
	);
	/** Vesicles from the ER to the Golgi to the surface, carrying finished spikes. */
	const vesicles = $derived(
		[0, 1, 2].map((k) => {
			const u = reduced ? 0.3 + k * 0.25 : cycle(time, 6, k / 3);
			const a = { x: 450, y: 400 };
			const b = { x: GOLGI.x, y: GOLGI.y + 10 };
			const c = { x: 430 + k * 50, y: memY(430 + k * 50) + 10 };
			const p =
				u < 0.5
					? { x: lerp(a.x, b.x, u * 2), y: lerp(a.y, b.y, u * 2) }
					: { x: lerp(b.x, c.x, u * 2 - 1), y: lerp(b.y, c.y, u * 2 - 1) };
			return { k, ...p, o: smoothstep(0, 0.08, u) * (1 - smoothstep(0.9, 1, u)) };
		})
	);
	const codonNow = $derived(Math.floor((time * 5.6) % SEQUENCE.codons) + 1);

	// ---- surface spikes (ribosome, fade, recap) -----------------------------------
	const SURF = Array.from({ length: 14 }, (_, i) => ({ k: i, x: 190 + i * 40 }));

	// ---- nucleus ------------------------------------------------------------------
	const own = $derived(
		[0, 1, 2].map((k) => {
			const pore = PORES[[3, 5, 6][k]];
			const u = reduced ? 0.6 : cycle(time, 6, k / 3);
			const r = N.r - 30 + u * 90;
			return {
				k,
				x: N.x + Math.cos(pore.a) * r,
				y: N.y + Math.sin(pore.a) * r,
				a: pore.a,
				o: smoothstep(0, 0.1, u) * (1 - smoothstep(0.85, 1, u))
			};
		})
	);
	/** The vaccine's message near the nucleus: it drifts but never crosses in. */
	const near = $derived({
		x: N.x - N.r - 70 + Math.sin(time * 0.8) * 20,
		y: N.y + 120 + Math.cos(time * 0.6) * 10
	});

	// ---- fade -----------------------------------------------------------------------
	const day = $derived(Number(params.day ?? 1));
	const dayT = Tween.of(() => day, { duration: 600, easing: cubicInOut });
	const left = $derived(mrnaLeft([0], dayT.current));
	const MSGS = Array.from({ length: 14 }, (_, i) => ({
		k: i,
		x: 170 + hash(i, 4) * 330,
		y: 250 + hash(i, 5) * 230,
		a: hash(i, 6) * Math.PI,
		r: hash(i, 7)
	}));
	/** Message i is still being read while its rank is under the share left. */
	const msgOpacity = (r: number, share: number) => clamp((share - r * 0.98) / 0.03 + 0.5);
	const PLOT = { x0: 600, x1: 880, y0: 490, y1: 560 };
	const curve = (() => {
		let d = '';
		for (let i = 0; i <= 56; i++) {
			const dd = (i / 56) * 14;
			const x = lerp(PLOT.x0, PLOT.x1, dd / 14);
			const y = lerp(PLOT.y1, PLOT.y0, mrnaLeft([0], dd));
			d += `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
		}
		return d;
	})();
	const fadeX = $derived(lerp(PLOT.x0, PLOT.x1, dayT.current / 14));
	const pct = (v: number) =>
		v >= 0.1
			? `${Math.round(v * 100)}%`
			: v >= 0.01
				? `${(v * 100).toFixed(1)}%`
				: v >= 0.001
					? `${(v * 100).toFixed(2)}%`
					: 'under 0.1%';

	const surfOpacity = $derived(
		view === 'fade'
			? (k: number) => msgOpacity(SURF[k].x / 1000, left)
			: () => (view === 'ribosome' || view === 'recap' ? 1 : 0)
	);
</script>

<g>
	<!-- ================================================= the arm ===== -->
	<g opacity={1 - cellMix.current}>
		<!-- shoulder and upper arm -->
		<path
			d="M60 120 C 120 70, 260 70, 320 140 C 350 180, 345 300, 330 420 L 310 560 L 150 560 L 140 420 C 120 330, 60 250, 60 120 Z"
			fill="var(--im-cell)"
			stroke="var(--im-cell-edge)"
			stroke-width="1.5"
		/>
		<path
			d="M150 170 C 200 140, 280 160, 300 230 C 310 290, 280 330, 230 340 C 180 330, 150 280, 150 170 Z"
			fill="var(--mv-muscle)"
			stroke="var(--mv-muscle-edge)"
		/>
		<!-- needle -->
		<g transform="rotate(-25 {NEEDLE.x} {NEEDLE.y})">
			<rect
				x={NEEDLE.x - 4}
				y={NEEDLE.y - 112}
				width="8"
				height="22"
				rx="2"
				fill="var(--stage-line)"
			/>
			<rect
				x={NEEDLE.x - 14}
				y={NEEDLE.y - 180}
				width="28"
				height="70"
				rx="4"
				fill="var(--surface)"
				stroke="var(--stage-ink-muted)"
			/>
			<rect
				x={NEEDLE.x - 10}
				y={NEEDLE.y - 150}
				width="20"
				height="36"
				fill="var(--mv-lnp)"
				opacity="0.9"
			/>
			<line
				x1={NEEDLE.x}
				y1={NEEDLE.y - 90}
				x2={NEEDLE.x}
				y2={NEEDLE.y}
				stroke="var(--stage-ink-muted)"
				stroke-width="2"
			/>
		</g>
		<circle
			cx={NEEDLE.x}
			cy={NEEDLE.y}
			r="20"
			fill="none"
			stroke="var(--stage-ink-muted)"
			stroke-dasharray="3 3"
		/>
		<path
			d="M{NEEDLE.x + 20} {NEEDLE.y - 8} L{ZOOM.x - ZOOM.r + 20} {ZOOM.y - ZOOM.r + 70} M{NEEDLE.x +
				20} {NEEDLE.y + 8} L{ZOOM.x - ZOOM.r + 20} {ZOOM.y + ZOOM.r - 70}"
			stroke="var(--stage-ink-muted)"
			stroke-dasharray="3 4"
			fill="none"
		/>
		<Readout
			opacity={1 - cellMix.current}
			id="arm"
			order={1}
			label="Injected into the shoulder muscle"
			value="0.3 mL holding 30 µg of mRNA: about 13 trillion copies of the message"
		>
			<Label x={200} y={40} text="into the shoulder muscle" size={15} weight={600} />
			<Label x={200} y={60} text="30 µg of mRNA ≈ 13 trillion messages" size={12} muted />
		</Readout>

		<!-- the close-up -->
		<clipPath id="journey-zoom"><circle cx={ZOOM.x} cy={ZOOM.y} r={ZOOM.r} /></clipPath>
		<circle
			cx={ZOOM.x}
			cy={ZOOM.y}
			r={ZOOM.r}
			fill="var(--stage-bg)"
			stroke="var(--stage-ink-muted)"
		/>
		<g clip-path="url(#journey-zoom)">
			{#each FIBRES as f (f.k)}
				<rect
					x={ZOOM.x - ZOOM.r - 20}
					y={f.y}
					width={ZOOM.r * 2 + 40}
					height="48"
					rx="24"
					fill="var(--mv-muscle)"
					stroke="var(--mv-muscle-edge)"
				/>
				{#each [0, 1, 2, 3, 4] as j (j)}
					<ellipse
						cx={ZOOM.x - 200 + j * 100 + (f.k % 2) * 50}
						cy={f.y + 24}
						rx="9"
						ry="5"
						fill="var(--mv-muscle-edge)"
						opacity="0.6"
					/>
				{/each}
			{/each}
			<path
				d="M{lymphPath[0].x} {lymphPath[0].y} Q{lymphPath[1].x} {lymphPath[1].y} {lymphPath[2]
					.x} {lymphPath[2].y}"
				fill="none"
				stroke="var(--im-node-edge)"
				stroke-width="16"
				stroke-linecap="round"
				opacity="0.5"
			/>
			{#each spread as p (p.k)}
				<circle
					cx={p.x}
					cy={p.y}
					r="6"
					fill="var(--mv-lnp)"
					stroke="var(--mv-lnp-edge)"
					stroke-width="1.5"
					opacity={p.o}
				/>
			{/each}
			{#each lymph as p (p.k)}
				<circle
					cx={p.x}
					cy={p.y}
					r="6"
					fill="var(--mv-lnp)"
					stroke="var(--mv-lnp-edge)"
					stroke-width="1.5"
					opacity={p.o}
				/>
			{/each}
			<!-- a dendritic cell picking particles up -->
			<g transform="translate({ZOOM.x - 40} {ZOOM.y + 120})">
				{#each [0, 1, 2, 3, 4, 5] as j (j)}
					<path
						d="M0 0 L{Math.cos((j * TAU) / 6 + 0.3) * 34} {Math.sin((j * TAU) / 6 + 0.3) * 30}"
						stroke="var(--mv-ribosome)"
						stroke-width="7"
						stroke-linecap="round"
						opacity="0.7"
					/>
				{/each}
				<circle r="16" fill="var(--mv-ribosome)" opacity="0.8" />
			</g>
		</g>
		<Readout
			opacity={1 - cellMix.current}
			id="zoom-key"
			order={2}
			label="In the muscle"
			value="the particles spread out and are taken up by muscle cells and immune cells; some drain to the lymph node in the armpit"
		>
			<Label x={ZOOM.x - 120} y={ZOOM.y + 6} text="lipid particles" size={12} weight={600} pill />
			<Label x={ZOOM.x} y={ZOOM.y - 150} text="muscle fibres (cells)" size={11} muted />
			<Label x={ZOOM.x - 40} y={ZOOM.y + 182} text="dendritic cell" size={11} pill />
			<Label x={ZOOM.x + 170} y={ZOOM.y - 150} text="lymph vessel" size={11} anchor="start" muted />
		</Readout>
		{#if view === 'muscle'}
			<Readout id="node" order={3} label="Lymph node (armpit)">
				<ellipse
					cx={ZOOM.x + 220}
					cy={ZOOM.y - 262}
					rx="62"
					ry="26"
					fill="var(--im-node)"
					stroke="var(--im-node-edge)"
					stroke-width="1.5"
				/>
				<Label x={ZOOM.x + 220} y={ZOOM.y - 258} text="to the lymph node" size={11} />
			</Readout>
		{/if}
	</g>

	<!-- ================================================= the cell ===== -->
	<g opacity={cellMix.current}>
		<ellipse
			cx={C.x}
			cy={C.y}
			rx={C.rx}
			ry={C.ry}
			fill="var(--cell)"
			stroke="var(--membrane-edge)"
			stroke-width="3"
		/>
		<!-- ER and Golgi -->
		<g opacity={view === 'ribosome' || view === 'recap' ? 1 : 0.5}>
			{#each ER as e (e.k)}
				<path
					d={e.d}
					fill="none"
					stroke="var(--mv-endosome-edge)"
					stroke-width="7"
					stroke-linecap="round"
					opacity="0.35"
				/>
			{/each}
			{#each [0, 1, 2] as j (j)}
				<path
					d="M{GOLGI.x - 40 + j * 4} {GOLGI.y + j * 10} q 40 -14 80 0"
					fill="none"
					stroke="var(--mv-ribosome)"
					stroke-width="5"
					stroke-linecap="round"
					opacity="0.4"
				/>
			{/each}
		</g>
		<!-- nucleus -->
		<g opacity={view === 'nucleus' || view === 'recap' ? 1 : 0.55}>
			<circle
				cx={N.x}
				cy={N.y}
				r={N.r}
				fill="var(--mv-nucleus)"
				stroke="var(--mv-nucleus-edge)"
				stroke-width="4"
			/>
			<circle
				cx={N.x}
				cy={N.y}
				r={N.r - 6}
				fill="none"
				stroke="var(--mv-nucleus-edge)"
				stroke-width="1.5"
			/>
			{#each PORES as p (p.k)}
				<circle
					cx={N.x + Math.cos(p.a) * (N.r - 3)}
					cy={N.y + Math.sin(p.a) * (N.r - 3)}
					r="5"
					fill="var(--cell)"
					stroke="var(--mv-nucleus-edge)"
				/>
			{/each}
			{#each DNA as d (d.k)}
				<path d={d.d} fill="none" stroke="var(--mv-nucleus-edge)" stroke-width="2" opacity="0.8" />
			{/each}
		</g>
		<Readout
			opacity={cellMix.current}
			id="cell-key"
			order={1}
			label="A muscle cell"
			value="cytoplasm, nucleus with the DNA, endoplasmic reticulum (ER)"
		>
			<Label x={N.x} y={N.y + N.r + 22} text="nucleus (DNA)" size={12} weight={600} />
			<Label x={N.x - N.r - 70} y={N.y - 120} text="ER" size={11} muted />
			<Label x={GOLGI.x} y={GOLGI.y - 14} text="Golgi" size={11} muted />
		</Readout>

		<!-- entry -->
		<g opacity={on('entry') * entry.fade}>
			<!-- the membrane pocket -->
			<circle
				cx={ENTRY.x + 6}
				cy={ENTRY.y + 4}
				r={18 * entry.pocket}
				fill="var(--stage-bg)"
				stroke="var(--membrane-edge)"
				stroke-width="2"
			/>
			{#if entry.endo > 0.02}
				<circle
					cx={entry.lx}
					cy={entry.ly}
					r="26"
					fill={entry.acid > 0.5 ? 'var(--mv-endosome)' : 'var(--stage-bg)'}
					stroke="var(--mv-endosome-edge)"
					stroke-width="2"
					opacity={entry.endo}
				/>
				{#each PROTONS as h (h.k)}
					<text
						x={entry.lx + Math.cos(h.a + time) * 18}
						y={entry.ly + Math.sin(h.a + time) * 18 + 4}
						style:font-size="9px"
						text-anchor="middle"
						style:fill="var(--im-virus)"
						opacity={entry.acid * entry.endo}>H⁺</text
					>
				{/each}
			{/if}
			{#if entry.burst < 0.98}
				<circle
					cx={entry.lx}
					cy={entry.ly}
					r="12"
					fill="var(--mv-lnp)"
					stroke="var(--mv-lnp-edge)"
					stroke-width="2"
					opacity={1 - entry.burst}
				/>
			{/if}
			{#if entry.burst > 0.02}
				{#each [0, 1, 2, 3, 4, 5] as j (j)}
					<path
						d="M{ENDO.x + Math.cos(j) * 24} {ENDO.y + Math.sin(j) * 24} l {Math.cos(j) *
							10 *
							entry.burst} {Math.sin(j) * 10 * entry.burst}"
						stroke="var(--mv-endosome-edge)"
						stroke-width="2"
						opacity={1 - entry.out}
					/>
				{/each}
				<path
					d={strand(
						ENDO.x + 60 * entry.out,
						ENDO.y + 40 * entry.out,
						50 + 40 * entry.out,
						0.4,
						time * 2
					)}
					fill="none"
					stroke="var(--mv-mrna)"
					stroke-width="3"
					stroke-linecap="round"
					opacity={entry.burst}
				/>
			{/if}
			<Readout
				opacity={on('entry') * cellMix.current}
				id="entry-steps"
				order={2}
				label="Getting in"
				value={STAGES[entry.stage - 1].label}
			>
				{#each STAGES as s (s.n)}
					<text
						x={s.x}
						y={s.y}
						style:font-size="12px"
						font-weight={s.n === entry.stage ? 700 : 400}
						class:muted={s.n !== entry.stage}>{s.n}. {s.label}</text
					>
				{/each}
			</Readout>
			<Readout id="entry-cyto">
				<Label
					x={ENDO.x + 80}
					y={ENDO.y + 110}
					text="cytoplasm: where the ribosomes are"
					size={11}
					muted
				/>
			</Readout>
		</g>

		<!-- ribosome: the polysome on the ER, vesicles, surface spikes -->
		<g opacity={on('ribosome')}>
			<path
				d="M{POLY.x0} {POLY.y0} L{POLY.x1} {POLY.y1}"
				stroke="var(--mv-mrna)"
				stroke-width="3"
				stroke-linecap="round"
			/>
			{#each ribos as r (r.k)}
				<g opacity={r.o}>
					<ellipse cx={r.x} cy={r.y - 9} rx="15" ry="10" fill="var(--mv-ribosome)" />
					<ellipse cx={r.x} cy={r.y + 7} rx="11" ry="7" fill="var(--mv-ribosome)" opacity="0.7" />
					<path
						d="M{r.x} {r.y - 18} q {-6 - r.u * 10} -8 {-4 - r.u * 18} {-14 - r.u * 22}"
						fill="none"
						stroke="var(--mv-spike)"
						stroke-width="2.5"
						stroke-linecap="round"
					/>
				</g>
			{/each}
			{#each vesicles as v (v.k)}
				<circle
					cx={v.x}
					cy={v.y}
					r="10"
					fill="none"
					stroke="var(--mv-ribosome)"
					stroke-width="2"
					opacity={v.o}
				/>
				<circle cx={v.x} cy={v.y} r="3.5" fill="var(--mv-spike)" opacity={v.o} />
			{/each}
			<Readout
				opacity={on('ribosome') * cellMix.current}
				id="codon"
				order={2}
				label="Reading"
				value="codon {codonNow} of 1,273, at 5.6 codons a second"
			>
				<Label
					x={POLY.x0 - 10}
					y={POLY.y0 + 34}
					text="ribosomes reading the message"
					size={12}
					weight={600}
					anchor="start"
				/>
				<Label
					x={POLY.x0 - 10}
					y={POLY.y0 + 52}
					text="codon {codonNow} of 1,273 (real speed)"
					size={11}
					anchor="start"
					muted
				/>
			</Readout>
			<Readout id="vesicle">
				<Label
					x={GOLGI.x + 70}
					y={GOLGI.y + 50}
					text="finished spikes ride to the surface"
					size={11}
					anchor="start"
					muted
				/>
			</Readout>
		</g>

		<!-- spikes on the surface -->
		{#each SURF as s (s.k)}
			{@const y = memY(s.x)}
			{@const o = surfOpacity(s.k)}
			{#if o > 0.02}
				<g transform="translate({s.x} {y})" opacity={o}>
					<path d="M0 0 L0 -12" stroke="var(--mv-s2)" stroke-width="5" stroke-linecap="round" />
					<circle cy="-18" r="7" fill="var(--mv-s1)" />
				</g>
			{/if}
		{/each}

		<!-- nucleus: one-way traffic -->
		<g opacity={on('nucleus')}>
			{#each own as m (m.k)}
				<path
					d={strand(m.x, m.y, 30, m.a + Math.PI / 2, time * 3 + m.k)}
					fill="none"
					stroke="var(--mv-nucleus-edge)"
					stroke-width="2.5"
					stroke-linecap="round"
					opacity={m.o}
				/>
			{/each}
			<path
				d={strand(near.x, near.y, 70, 0.3, time * 2)}
				fill="none"
				stroke="var(--mv-mrna)"
				stroke-width="3"
				stroke-linecap="round"
			/>
			<path
				d="M{near.x + 40} {near.y - 20} L{N.x - N.r * 0.75} {N.y + N.r * 0.6}"
				stroke="var(--im-virus)"
				stroke-width="2"
				stroke-dasharray="4 4"
			/>
			<g
				transform="translate({(near.x + 40 + N.x - N.r * 0.75) / 2} {(near.y -
					20 +
					N.y +
					N.r * 0.6) /
					2})"
			>
				<circle r="12" fill="var(--surface)" stroke="var(--im-virus)" stroke-width="2" />
				<path d="M-5 -5 L5 5 M5 -5 L-5 5" stroke="var(--im-virus)" stroke-width="2.5" />
			</g>
			<Readout
				opacity={on('nucleus') * cellMix.current}
				id="nuc-out"
				order={2}
				label="Traffic through the nuclear pores"
				value="the cell's own messages go out; nothing carries the vaccine's message in"
			>
				<Label
					x={N.x + 30}
					y={N.y - N.r - 24}
					text="the cell’s own messages leave through the pores"
					size={12}
					weight={600}
				/>
			</Readout>
			<Readout
				opacity={on('nucleus') * cellMix.current}
				id="nuc-vax"
				order={3}
				label="The vaccine's message"
				value="stays in the cytoplasm: no way into the nucleus; it brings no DNA and no reverse transcriptase"
			>
				<Label
					x={near.x - 10}
					y={near.y + 36}
					text="vaccine mRNA: stays in the cytoplasm"
					size={12}
					weight={600}
					color="var(--mv-mrna)"
				/>
				<Label
					x={near.x - 10}
					y={near.y + 54}
					text="RNA, not DNA; the vaccine brings no enzyme to copy it into DNA"
					size={11}
					muted
				/>
			</Readout>
		</g>

		<!-- fade: the day slider -->
		<g opacity={on('fade') * (view === 'recap' ? 0 : 1)}>
			{#each MSGS as m (m.k)}
				{@const o = msgOpacity(m.r, left)}
				{#if o > 0.02}
					<g opacity={o}>
						<path
							d={strand(m.x, m.y, 40, m.a, time * 2 + m.k)}
							fill="none"
							stroke="var(--mv-mrna)"
							stroke-width="3"
							stroke-linecap="round"
						/>
						<ellipse
							cx={m.x + Math.cos(m.a) * cycle(time, 4, m.r) * 30 - Math.cos(m.a) * 15}
							cy={m.y + Math.sin(m.a) * cycle(time, 4, m.r) * 30 - Math.sin(m.a) * 15 - 6}
							rx="8"
							ry="6"
							fill="var(--mv-ribosome)"
						/>
					</g>
				{:else}
					<g opacity="0.35">
						<path
							d="M{m.x - 6} {m.y} l 4 -3 M{m.x + 2} {m.y + 2} l 5 1 M{m.x - 1} {m.y + 6} l 3 2"
							stroke="var(--stage-ink-muted)"
							stroke-width="2"
							stroke-linecap="round"
						/>
					</g>
				{/if}
			{/each}
			<rect
				x={PLOT.x0 - 50}
				y={PLOT.y0 - 34}
				width={PLOT.x1 - PLOT.x0 + 70}
				height={PLOT.y1 - PLOT.y0 + 56}
				rx="10"
				fill="var(--surface)"
				stroke="var(--border)"
			/>
			<line x1={PLOT.x0} x2={PLOT.x1} y1={PLOT.y1} y2={PLOT.y1} stroke="var(--stage-line)" />
			<line x1={PLOT.x0} x2={PLOT.x0} y1={PLOT.y0} y2={PLOT.y1} stroke="var(--stage-line)" />
			<path d={curve} fill="none" stroke="var(--mv-mrna)" stroke-width="2.5" />
			<line
				x1={fadeX}
				x2={fadeX}
				y1={PLOT.y0}
				y2={PLOT.y1}
				stroke="var(--stage-ink-muted)"
				stroke-dasharray="2 3"
			/>
			<circle cx={fadeX} cy={lerp(PLOT.y1, PLOT.y0, left)} r="4.5" fill="var(--mv-mrna)" />
			<Readout
				opacity={on('fade') * cellMix.current}
				id="fade-left"
				order={2}
				label="Day {day}"
				value="{pct(left)} of the messages still being read (half-life {MRNA.halfLifeHours} h)"
				color="var(--mv-mrna)"
			>
				<text x={PLOT.x0 - 40} y={PLOT.y0 - 14} style:font-size="12px" font-weight="600"
					>day {day}: {pct(left)} of the mRNA still read</text
				>
				<text x={PLOT.x0 - 6} y={PLOT.y0 + 4} style:font-size="10px" text-anchor="end" class="muted"
					>100%</text
				>
				<text x={PLOT.x0 - 6} y={PLOT.y1 + 3} style:font-size="10px" text-anchor="end" class="muted"
					>0</text
				>
				<text x={PLOT.x0} y={PLOT.y1 + 15} style:font-size="10px" class="muted">0</text>
				<text x={PLOT.x1} y={PLOT.y1 + 15} style:font-size="10px" text-anchor="end" class="muted"
					>14 days</text
				>
			</Readout>
			<Readout id="fade-note">
				<Label x={200} y={540} text="cut up and recycled by the cell" size={11} muted />
			</Readout>
		</g>

		<!-- recap: numbered stages -->
		{#if view === 'recap'}
			{#each [{ n: 1, x: 150, y: 250, label: 'out of the bubble' }, { n: 2, x: 250, y: 510, label: 'ribosomes make the spike' }, { n: 3, x: 420, y: 70, label: 'shown on the surface' }, { n: 4, x: 600, y: 230, label: 'never into the nucleus' }] as s (s.n)}
				<Readout id="recap-{s.n}" order={s.n} label={s.label} marker={s.n} at={[s.x, s.y]}>
					<circle cx={s.x} cy={s.y} r="11" fill="var(--mv-mrna)" />
					<text
						x={s.x}
						y={s.y + 4}
						style:font-size="12px"
						text-anchor="middle"
						font-weight="700"
						style:fill="var(--stage-bg)">{s.n}</text
					>
					<Label x={s.x + 18} y={s.y + 4} text={s.label} size={12} weight={600} anchor="start" />
				</Readout>
			{/each}
			<path
				d={strand(ENDO.x, ENDO.y, 60, 0.4, time * 2)}
				fill="none"
				stroke="var(--mv-mrna)"
				stroke-width="3"
				stroke-linecap="round"
			/>
			{#each [0, 1, 2] as k (k)}
				{@const p = polyAt(0.2 + k * 0.3)}
				<path
					d="M{POLY.x0} {POLY.y0} L{POLY.x1} {POLY.y1}"
					stroke="var(--mv-mrna)"
					stroke-width="3"
				/>
				<ellipse cx={p.x} cy={p.y - 9} rx="15" ry="10" fill="var(--mv-ribosome)" />
			{/each}
			<Readout
				id="recap-5"
				order={5}
				label="then: the B and T cells that fit multiply, and some stay as memory"
			>
				<Label
					x={480}
					y={584}
					text="then: matching B and T cells multiply, and some stay as memory"
					size={12}
					muted
				/>
			</Readout>
		{/if}
	</g>
</g>
