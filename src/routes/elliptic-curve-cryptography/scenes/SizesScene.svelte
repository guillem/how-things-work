<script lang="ts">
	/**
	 * Key sizes at equal security, NIST SP 800-57 Part 1 Rev. 5, Table 2: for each security level
	 * a bar for the modulus of finite-field Diffie–Hellman or RSA and one for the elliptic curve,
	 * the chosen level (`params.security`) in focus; below, the two keys of that level as blocks of
	 * 64 bits each. The blocks of the modular key fill in over the first 1.5 s (a function of t);
	 * reduced motion shows them complete.
	 */
	import { Label, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { KEY_SIZES } from '../ecc';

	let { t, params }: StageProps = $props();

	const level = $derived(
		KEY_SIZES.find((r) => String(r.security) === String(params.security ?? '128')) ?? KEY_SIZES[2]
	);
	const BX = 140;
	const scale = 740 / 15360;
	const rowY = (i: number) => 92 + i * 44;
	const fmt = (v: number) => v.toLocaleString('en-US');

	const BLOCK = 64;
	const PER_ROW = 32;
	const SQ = 14;
	const modBlocks = $derived(level.modular / BLOCK);
	const curveBlocks = $derived(level.curve / BLOCK);
	const grow = $derived(smoothstep(0.2, 1.6, t));
	const blockY = 368;
	const ratio = $derived(level.modular / level.curve);
</script>

<g>
	<Label
		x={40}
		y={44}
		text="Key size for the same security"
		size={16}
		weight={700}
		anchor="start"
	/>
	<Label
		x={300}
		y={44}
		text="NIST SP 800-57 Part 1 Rev. 5, Table 2"
		size={12}
		anchor="start"
		muted
	/>
	<g transform="translate(560 30)">
		<rect x="0" y="0" width="14" height="10" rx="2" fill="var(--ecc-eve)" />
		<Label x={20} y={9} text="modular (Diffie–Hellman, RSA)" size={12} anchor="start" />
		<rect x="230" y="0" width="14" height="10" rx="2" fill="var(--ecc-curve)" />
		<Label x={250} y={9} text="elliptic curve" size={12} anchor="start" />
	</g>

	{#each KEY_SIZES as r, i (r.security)}
		{@const on = r.security === level.security}
		{@const y = rowY(i)}
		<g opacity={on ? 1 : 0.45}>
			<Label
				x={BX - 14}
				y={y + 14}
				text="{r.security}-bit"
				size={13}
				weight={on ? 700 : 500}
				anchor="end"
			/>
			<rect x={BX} {y} width={r.modular * scale} height="14" rx="3" fill="var(--ecc-eve)" />
			<Label
				x={BX + r.modular * scale + 8}
				y={y + 11}
				text="{fmt(r.modular)} bits"
				size={12}
				anchor="start"
				tabular
			/>
			<rect
				x={BX}
				y={y + 17}
				width={Math.max(3, r.curve * scale)}
				height="14"
				rx="3"
				fill="var(--ecc-curve)"
			/>
			<Label
				x={BX + r.curve * scale + 8}
				y={y + 28}
				text="{r.curve} bits"
				size={12}
				anchor="start"
				tabular
			/>
		</g>
	{/each}
	<Label x={BX - 14} y={rowY(5) + 2} text="security" size={11} anchor="end" muted />

	<!-- the chosen level as blocks of 64 bits -->
	<line
		x1={40}
		x2={920}
		y1={blockY - 44}
		y2={blockY - 44}
		stroke="var(--stage-line)"
		opacity="0.4"
	/>
	<Readout
		id="level"
		order={0}
		label="{level.security}-bit security"
		value="{fmt(level.modular)} bits modular vs {level.curve} bits curve"
	>
		<Label
			x={40}
			y={blockY - 16}
			text="{level.security} bits of security · each full square is 64 bits of key"
			size={14}
			weight={700}
			anchor="start"
		/>
	</Readout>
	{#each Array.from({ length: modBlocks }, (_, i) => i) as i (i)}
		<rect
			x={40 + (i % PER_ROW) * SQ}
			y={blockY + Math.floor(i / PER_ROW) * SQ}
			width={SQ - 2}
			height={SQ - 2}
			rx="1.5"
			fill="var(--ecc-eve)"
			opacity={i < grow * modBlocks + 0.5 ? 0.85 : 0.08}
		/>
	{/each}
	{#each Array.from({ length: Math.ceil(curveBlocks) }, (_, i) => i) as i (i)}
		<rect
			x={540 + i * SQ}
			y={blockY}
			width={(SQ - 2) * Math.min(1, curveBlocks - i)}
			height={SQ - 2}
			rx="1.5"
			fill="var(--ecc-curve)"
		/>
	{/each}
	<Label
		x={40}
		y={blockY + Math.ceil(modBlocks / PER_ROW) * SQ + 18}
		text="modular key: {fmt(level.modular)} bits"
		size={12.5}
		anchor="start"
		color="var(--ecc-eve)"
		weight={600}
	/>
	<Label
		x={540}
		y={blockY + SQ + 18}
		text="curve key: {level.curve} bits"
		size={12.5}
		anchor="start"
		color="var(--ecc-curve)"
		weight={600}
	/>
	<Readout id="ratio" order={1} label="Ratio" value="{ratio.toFixed(0)}× shorter on the curve">
		<Label
			x={540}
			y={blockY + SQ + 44}
			text="{ratio.toFixed(0)}× shorter on the curve"
			size={18}
			weight={700}
			anchor="start"
		/>
	</Readout>
	<Readout
		id="why"
		order={2}
		label="Why"
		value="modular: number field sieve; curve: only √n (Pollard's rho)"
	>
		<Label
			x={540}
			y={blockY + SQ + 76}
			text="modular: the number field sieve is far faster than trying"
			size={12}
			anchor="start"
			muted
		/>
		<Label
			x={540}
			y={blockY + SQ + 94}
			text="curve: no known attack beats √n, so 2s bits give s bits"
			size={12}
			anchor="start"
			muted
		/>
	</Readout>
</g>
