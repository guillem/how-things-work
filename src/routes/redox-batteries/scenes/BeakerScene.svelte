<script lang="ts">
	/**
	 * Zinc in copper sulfate: on the left the beaker (the strip slowly coated with copper,
	 * the blue fading), on the right a zoom on the strip's surface where each event is one
	 * redox step: a Cu²⁺ ion arrives, two electrons hop to it from a zinc atom, the copper
	 * atom stays on the metal and the new Zn²⁺ ion drifts off into the solution.
	 *
	 * Each event is a pure function of t (period P, staggered); the macro changes are slow
	 * functions of t. Under reduced motion t = 2.5 s, where the three events are at
	 * different stages (arriving, just transferred, drifting off).
	 */
	import { Label, clamp, cycle, lerp, smoothstep, easeInOut } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import Ion from '../parts/Ion.svelte';

	let { t, reduced }: StageProps = $props();

	// ---- the beaker ------------------------------------------------------------------------
	const BX = 70;
	const BW = 300;
	const BTOP = 170;
	const BBOT = 520;
	const LEVEL = 230;
	// The blue fades and the copper coat grows over the first 20 s (reduced: a little way in).
	const progress = $derived(reduced ? 0.45 : smoothstep(0, 20, t));
	const blue = $derived(1 - 0.6 * progress);

	// ---- the zoom ----------------------------------------------------------------------------
	const ZX = 690;
	const ZY = 330;
	const ZR = 210;
	/** Surface of the zinc (the metal is to the left of it). */
	const SURF = 600;
	const SITES = [250, 330, 410];
	const P = 6;

	interface Event {
		k: number;
		cu: { x: number; y: number; o: number; atom: boolean };
		zn: { x: number; y: number; o: number; ion: boolean };
		electrons: { x: number; y: number; o: number }[];
	}

	function eventAt(k: number, time: number): Event {
		const u = cycle(time, P, k / SITES.length + 0.12);
		const y = SITES[k];
		const site = SURF + 16;
		const fadeIn = smoothstep(0, 0.06, u);
		const fadeOut = 1 - smoothstep(0.92, 1, u);
		// 0–0.35 the Cu²⁺ ion swims in; 0.35–0.5 two electrons hop; then it is a Cu atom.
		const arrive = easeInOut(clamp(u / 0.35));
		const cu = {
			x: lerp(ZX + 150, site, arrive),
			y: y + (1 - arrive) * (k - 1) * 40,
			o: fadeIn * fadeOut,
			atom: u >= 0.5
		};
		// The zinc atom sits in the surface until the hop, then leaves as Zn²⁺.
		const leave = easeInOut(clamp((u - 0.5) / 0.42));
		const zn = {
			// Up off the surface first, clear of the arriving copper, then out into the solution.
			x: lerp(SURF - 14, ZX + 120, leave ** 1.5),
			y: y - 70 * smoothstep(0, 0.25, leave) - 20 * leave,
			o: u < 0.5 ? 1 : 1 - smoothstep(0.85, 0.97, u),
			ion: u >= 0.5
		};
		const hop = clamp((u - 0.35) / 0.15);
		const show = u >= 0.35 && u < 0.5 ? 1 : 0;
		const electrons = [-1, 1].map((s) => ({
			x: lerp(SURF - 10, site - 4, hop),
			y: y + s * 7 - 16 * Math.sin(Math.PI * hop),
			o: show
		}));
		return { k, cu, zn, electrons };
	}
	const events = $derived(SITES.map((_, k) => eventAt(k, t)));

	// Spectator Cu²⁺ ions and sulfate ions drifting in the zoom (fixed spots, small wobble).
	const SPECTATORS = [
		{ x: 700, y: 172, kind: 'so4' },
		{ x: 800, y: 196, kind: 'cu' },
		{ x: 860, y: 300, kind: 'so4' },
		{ x: 790, y: 478, kind: 'so4' },
		{ x: 690, y: 500, kind: 'cu' }
	] as const;
	const wob = (i: number) => (reduced ? 0 : 6 * Math.sin((t / 2.3 + i * 1.7) * Math.PI));

	// Zinc lattice behind the surface.
	const lattice = (() => {
		const out: { x: number; y: number; key: string }[] = [];
		for (let c = 0; c < 4; c++)
			for (let r = 0; r < 9; r++) {
				const x = SURF - 14 - c * 30;
				const y = 170 + r * 40 + (c % 2) * 20;
				// The surface sites themselves are drawn by the events.
				if (c === 0 && SITES.includes(y)) continue;
				out.push({ x, y, key: `${c}-${r}` });
			}
		return out;
	})();
</script>

<g>
	<clipPath id="beaker-zoom"><circle cx={ZX} cy={ZY} r={ZR} /></clipPath>

	<!-- the beaker -->
	<path
		d="M{BX} {BTOP} V{BBOT - 14} Q{BX} {BBOT} {BX + 14} {BBOT} H{BX + BW - 14} Q{BX +
			BW} {BBOT} {BX + BW} {BBOT - 14} V{BTOP}"
		fill="none"
		stroke="var(--rb-glass)"
		stroke-width="2"
	/>
	<path
		d="M{BX + 2} {LEVEL} H{BX + BW - 2} V{BBOT - 14} Q{BX + BW - 2} {BBOT - 2} {BX +
			BW -
			14} {BBOT - 2} H{BX + 14} Q{BX + 2} {BBOT - 2} {BX + 2} {BBOT - 14} Z"
		fill="var(--rb-solution-cu)"
		opacity={0.25 + 0.75 * blue}
	/>
	<!-- zinc strip, with copper growing on its wet part -->
	<rect x={BX + 130} y={120} width="36" height="330" rx="3" fill="var(--rb-zn)" />
	<rect
		x={BX + 127}
		y={LEVEL + 4}
		width="42"
		height={450 - LEVEL - 4}
		rx="4"
		fill="var(--rb-cu)"
		opacity={0.15 + 0.7 * progress}
	/>
	<Readout id="strip">
		<Label x={BX + 148} y={106} text="zinc strip" size={13} />
		<Label x={BX + BW / 2} y={BBOT + 26} text="copper sulfate solution (Cu²⁺, SO₄²⁻)" size={12} />
		<Label
			x={BX + 148}
			y={470}
			text={progress > 0.3 ? 'copper coat growing' : ''}
			size={11}
			muted
		/>
	</Readout>

	<!-- zoom guides -->
	<path
		d="M{BX + 166} {300} L{ZX - ZR * 0.72} {ZY - ZR * 0.69} M{BX + 166} {340} L{ZX -
			ZR * 0.72} {ZY + ZR * 0.69}"
		stroke="var(--stage-line)"
		stroke-dasharray="4 4"
	/>
	<rect
		x={BX + 160}
		y={290}
		width="16"
		height="60"
		fill="none"
		stroke="var(--stage-ink-muted)"
		stroke-width="1"
	/>

	<!-- the zoom -->
	<circle
		cx={ZX}
		cy={ZY}
		r={ZR}
		fill="var(--stage-bg)"
		stroke="var(--stage-line)"
		stroke-width="1.5"
	/>
	<g clip-path="url(#beaker-zoom)">
		<rect
			x={ZX - ZR}
			y={ZY - ZR}
			width={2 * ZR}
			height={2 * ZR}
			fill="var(--rb-solution-cu)"
			opacity={0.18 + 0.4 * blue}
		/>
		<rect
			x={ZX - ZR}
			y={ZY - ZR}
			width={SURF - (ZX - ZR)}
			height={2 * ZR}
			fill="var(--rb-zn)"
			opacity="0.25"
		/>
		{#each lattice as a (a.key)}
			<Ion x={a.x} y={a.y} r={14} fill="var(--rb-zn)" text="Zn" size={10} />
		{/each}
		{#each SPECTATORS as s, i (i)}
			{#if s.kind === 'cu'}
				<Ion
					x={s.x + wob(i)}
					y={s.y - wob(i + 3)}
					r={15}
					fill="var(--rb-cu-ion)"
					text="Cu²⁺"
					size={10}
				/>
			{:else}
				<Ion
					x={s.x - wob(i)}
					y={s.y + wob(i + 2)}
					r={18}
					fill="var(--rb-anion)"
					text="SO₄²⁻"
					size={9}
				/>
			{/if}
		{/each}
		{#each events as e (e.k)}
			<Ion
				x={e.zn.x}
				y={e.zn.y}
				r={14}
				fill={e.zn.ion ? 'var(--rb-zn-ion)' : 'var(--rb-zn)'}
				text={e.zn.ion ? 'Zn²⁺' : 'Zn'}
				size={e.zn.ion ? 9.5 : 10}
				opacity={e.zn.o}
			/>
			<Ion
				x={e.cu.x}
				y={e.cu.y}
				r={e.cu.atom ? 14 : 15}
				fill={e.cu.atom ? 'var(--rb-cu)' : 'var(--rb-cu-ion)'}
				text={e.cu.atom ? 'Cu' : 'Cu²⁺'}
				size={10}
				opacity={e.cu.o}
			/>
			{#each e.electrons as el, j (j)}
				<circle cx={el.x} cy={el.y} r="5.5" fill="var(--rb-electron)" stroke="var(--stage-bg)" opacity={el.o} />
			{/each}
		{/each}
	</g>
	<Readout id="zoomtitle">
		<Label x={ZX} y={ZY - ZR - 14} text="zoom: the surface of the strip" size={13} />
		<Label x={SURF - 60} y={ZY + ZR - 26} text="zinc metal" size={12} anchor="end" />
		<Label x={ZX + 90} y={ZY + ZR - 26} text="solution" size={12} />
	</Readout>

	<!-- the two halves -->
	<Readout
		id="ox"
		order={1}
		label="Oxidation (zinc loses electrons)"
		value="Zn → Zn²⁺ + 2e⁻"
		color="var(--rb-zn-ion)"
	>
		<Label
			x={ZX - 120}
			y={576}
			text="oxidation: Zn → Zn²⁺ + 2e⁻"
			size={14}
			weight={600}
			color="var(--rb-zn-ion)"
		/>
	</Readout>
	<Readout
		id="red"
		order={2}
		label="Reduction (copper ions gain them)"
		value="Cu²⁺ + 2e⁻ → Cu"
		color="var(--rb-cu-ion)"
	>
		<Label
			x={ZX + 130}
			y={576}
			text="reduction: Cu²⁺ + 2e⁻ → Cu"
			size={14}
			weight={600}
			color="var(--rb-cu-ion)"
		/>
	</Readout>
	<Readout id="eq" order={0} label="Overall" value="Zn + Cu²⁺ → Zn²⁺ + Cu">
		<Label x={220} y={56} text="Zn + Cu²⁺ → Zn²⁺ + Cu" size={18} weight={600} />
		<Label
			x={220}
			y={80}
			text="electrons jump straight across: the energy only warms the beaker"
			size={12}
			muted
		/>
	</Readout>
	<Readout id="key">
		<circle cx={ZX + 120} cy={58} r="4.5" fill="var(--rb-electron)" />
		<Label x={ZX + 132} y={62} text="electron, e⁻" size={12} anchor="start" />
	</Readout>
</g>
