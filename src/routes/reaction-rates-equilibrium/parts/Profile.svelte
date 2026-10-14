<script lang="ts">
	/**
	 * The energy profile of H₂ + I₂ ⇌ 2 HI: the uncatalysed path, optionally a dashed
	 * catalysed one, arrows for the two barriers, and an optional marker riding
	 * the curve. Energies in kJ/mol.
	 */
	import { Label } from '#lib/draw/index.ts';
	import { Readout } from '#lib/explainer/index.ts';
	import { climbTo, profileEnergy } from '../look';

	interface Props {
		x: number;
		y: number;
		w: number;
		h: number;
		ea: number;
		dh: number;
		/** Barrier lowering by a catalyst (kJ/mol), 0 = none. */
		lowering?: number;
		/** Show the reverse barrier's arrow too. */
		reverse?: boolean;
		/** A marker on the curve: position u (0–1) and which path. */
		marker?: { u: number; cat?: boolean; height?: number; glow?: boolean } | null;
		/** Height of a "typical collision" band at the reactants (kJ/mol), 0 = none. */
		band?: number;
		opacity?: number;
		/** Unique prefix for readout ids. */
		id?: string;
	}
	let {
		x,
		y,
		w,
		h,
		ea,
		dh,
		lowering = 0,
		reverse = false,
		marker = null,
		band = 0,
		opacity = 1,
		id = 'profile'
	}: Props = $props();

	const E_TOP = 200;
	const E_BOTTOM = -30;
	const sx = (u: number) => x + 34 + u * (w - 44);
	const sy = (e: number) => y + 22 + ((E_TOP - e) / (E_TOP - E_BOTTOM)) * (h - 50);

	const curve = (ea2: number) => {
		let d = '';
		for (let i = 0; i <= 80; i++) {
			const u = i / 80;
			d += `${i ? 'L' : 'M'}${sx(u).toFixed(1)} ${sy(profileEnergy(u, ea2, dh)).toFixed(1)}`;
		}
		return d;
	};
	const main = $derived(curve(ea));
	const eaCat = $derived(ea - lowering);
	const cat = $derived(lowering > 0.5 ? curve(eaCat) : '');
	const m = $derived.by(() => {
		if (!marker) return null;
		const e =
			marker.height !== undefined
				? marker.height
				: profileEnergy(marker.u, marker.cat ? eaCat : ea, dh);
		return { x: sx(marker.u), y: sy(e) };
	});
</script>

<g {opacity}>
	<rect {x} {y} width={w} height={h} rx="12" fill="var(--surface)" stroke="var(--border)" />
	<!-- energy axis -->
	<line x1={x + 24} x2={x + 24} y1={y + 18} y2={y + h - 22} stroke="var(--stage-line)" />
	<path
		d="M{x + 20} {y + 24} L{x + 24} {y + 16} L{x + 28} {y + 24}"
		fill="none"
		stroke="var(--stage-line)"
	/>
	<Readout id="{id}-axis">
		<Label x={x + 32} y={y + 16} text="energy" size={11} anchor="start" muted />
		<Label
			x={x + w - 12}
			y={y + h - 8}
			text="course of the reaction →"
			size={11}
			anchor="end"
			muted
		/>
	</Readout>

	{#if band > 0}
		<rect
			x={sx(0)}
			y={sy(band)}
			width={sx(0.2) - sx(0)}
			height={sy(0) - sy(band)}
			fill="var(--rr-forward)"
			opacity="0.35"
		/>
	{/if}

	<path d={main} fill="none" stroke="var(--stage-ink)" stroke-width="2.4" stroke-linejoin="round" />
	{#if cat}
		<path
			d={cat}
			fill="none"
			stroke="var(--rr-cat)"
			stroke-width="2.4"
			stroke-dasharray="6 5"
			stroke-linejoin="round"
		/>
	{/if}

	<!-- forward barrier -->
	<line
		x1={sx(0.5) - 5}
		x2={sx(0.5) - 5}
		y1={sy(0)}
		y2={sy(ea) + 3}
		stroke="var(--rr-barrier)"
		stroke-width="1.5"
		stroke-dasharray="3 3"
	/>
	<line x1={sx(0.14)} x2={sx(0.5)} y1={sy(0)} y2={sy(0)} stroke="var(--stage-grid)" />
	<Readout id="{id}-ea">
		<Label
			x={sx(climbTo(ea * 0.5, ea)) - 10}
			y={sy(ea * 0.5)}
			text={reverse ? `forward ${Math.round(ea)} kJ/mol` : `Ea = ${Math.round(ea)} kJ/mol`}
			size={12}
			anchor="end"
			color="var(--rr-barrier)"
		/>
	</Readout>
	{#if reverse}
		<line
			x1={sx(0.5) + 5}
			x2={sx(0.5) + 5}
			y1={sy(dh)}
			y2={sy(ea) + 3}
			stroke="var(--rr-reverse)"
			stroke-width="1.5"
			stroke-dasharray="3 3"
		/>
		<line x1={sx(0.5)} x2={sx(0.86)} y1={sy(dh)} y2={sy(dh)} stroke="var(--stage-grid)" />
		<Readout id="{id}-er">
			<Label
				x={sx(1 - climbTo(ea * 0.5, ea)) + 10}
				y={sy(ea * 0.5)}
				text="reverse {Math.round(ea - dh)} kJ/mol"
				size={12}
				anchor="start"
				color="var(--rr-reverse)"
			/>
		</Readout>
	{/if}
	{#if cat}
		<Readout id="{id}-cat" order={22} label="With the catalyst" value="{Math.round(eaCat)} kJ/mol">
			<Label
				x={sx(0.5)}
				y={sy(eaCat) + 22}
				text="catalyst: {Math.round(eaCat)}"
				size={12}
				color="var(--rr-cat)"
			/>
		</Readout>
	{/if}

	<Readout id="{id}-ends">
		<Label x={sx(0.1)} y={sy(0) - 9} text="H₂ + I₂" size={12} />
		<Label x={sx(0.9)} y={sy(dh) + 18} text="2 HI" size={12} />
		<Label x={sx(0.9)} y={sy(dh) - 9} text="{Math.round(dh)} kJ/mol" size={11} muted />
	</Readout>

	{#if m}
		{#if marker?.glow}
			<circle cx={m.x} cy={m.y} r="11" fill="var(--rr-forward)" opacity="0.3" />
		{/if}
		<circle
			cx={m.x}
			cy={m.y}
			r="6"
			fill="var(--rr-forward)"
			stroke="var(--stage-bg)"
			stroke-width="1.5"
		/>
	{/if}
</g>
