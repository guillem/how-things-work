<script lang="ts">
	/**
	 * A streptocyanine dye, (CH₃)₂N–(CH)ₖ=N⁺(CH₃)₂, as a Hückel chain of k + 2 sites with k + 3
	 * π electrons. Top left: its HOMO and LUMO drawn on the chain. Right: the energy ladder with
	 * the HOMO → LUMO gap (`hints.focus: 'gap'`) or the series' absorption maxima against the
	 * chain length, the model's line beside Simpson's measured values (`'chart'`). Bottom left:
	 * the spectrum from 200 to 900 nm with the predicted and measured maxima, and a swatch of the
	 * absorbed colour.
	 */
	import { Axes, Label, scale, wavelengthToColor } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { BETA_EV, CYANINE_MEASURED, cyanine, cyanineNm, measuredNm, solve } from '../huckel';
	import Ladder from './Ladder.svelte';
	import OrbitalView from './OrbitalView.svelte';
	import { colourName, layout, sub } from './look';

	let { step, t, params, reduced }: StageProps = $props();

	const k = $derived(Number(params.dyeC ?? 5));
	const focus = $derived(String(step.hints?.focus ?? 'gap'));
	const mol = $derived(cyanine(k));
	const sol = $derived(solve(mol));
	const nm = $derived(cyanineNm(k));
	const measured = $derived(measuredNm(k));
	const vis = $derived(nm >= 380 && nm <= 780);
	const eV = $derived(sol.gap * BETA_EV);
	const pulse = $derived(reduced ? 1 : 1 + 0.035 * Math.sin((2 * Math.PI * t) / 2.6));

	// ---- the two chains
	const geoH = $derived(layout(mol.n, false, 300, 250, 420, 90, 64));
	const geoL = $derived(layout(mol.n, false, 300, 150, 420, 90, 64));
	const ends = $derived({ 0: 'N', [mol.n - 1]: 'N' } as Record<number, string>);
	const cRef = $derived(
		Math.max(...[sol.homo, sol.lumo].flatMap((i) => sol.orbitals[i].c.map((c) => Math.abs(c))))
	);

	// ---- spectrum strip
	const SX = scale([200, 900], [60, 520]);
	const SY = 430;
	const visible = Array.from({ length: 41 }, (_, i) => 380 + i * 10);
	const nmText = (v: number) => `${Math.round(v)} nm`;

	// ---- chart
	const cx = scale([0, 14], [640, 920]);
	const cy = scale([200, 900], [480, 150]);
	const series = Array.from({ length: 7 }, (_, i) => 1 + 2 * i);
	const line = series.map((c, i) => `${i ? 'L' : 'M'}${cx(c)} ${cy(cyanineNm(c))}`).join(' ');
</script>

<g>
	<Readout
		id="dye-title"
		order={0}
		label="Dye"
		value="(CH₃)₂N–(CH){sub(k)}=N⁺(CH₃)₂: {mol.n} sites, {mol.electrons} π electrons"
	>
		<Label
			x={24}
			y={38}
			text="cyanine with {k} carbon{k === 1 ? '' : 's'}: (CH₃)₂N–(CH){sub(k)}=N⁺(CH₃)₂"
			size={16}
			weight={700}
			anchor="start"
		/>
		<Label
			x={24}
			y={60}
			text="{mol.n} sites in the chain, {mol.electrons} π electrons"
			size={12}
			anchor="start"
			muted
		/>
	</Readout>

	<!-- HOMO and LUMO on the chain -->
	<g data-testid="dye-orbitals">
		<Readout id="lumo-label">
			<Label x={24} y={154} text="LUMO" size={13} weight={700} anchor="start" muted />
		</Readout>
		<OrbitalView
			{sol}
			pts={geoL.pts}
			L={geoL.L}
			orbital={sol.lumo}
			{cRef}
			{pulse}
			atomLabels={ends}
			tag="lumo"
		/>
		<Readout id="homo-label">
			<Label x={24} y={254} text="HOMO" size={13} weight={700} anchor="start" muted />
		</Readout>
		<OrbitalView
			{sol}
			pts={geoH.pts}
			L={geoH.L}
			orbital={sol.homo}
			{cRef}
			{pulse}
			atomLabels={ends}
			tag="homo"
		/>
	</g>

	<!-- spectrum -->
	<g data-testid="spectrum">
		<Readout id="spec-title">
			<Label x={24} y={350} text="Absorbed light" size={13} weight={700} anchor="start" />
		</Readout>
		<rect x={SX(200)} y={SY - 14} width={SX(380) - SX(200)} height="28" fill="var(--stage-grid)" />
		<rect x={SX(780)} y={SY - 14} width={SX(900) - SX(780)} height="28" fill="var(--stage-grid)" />
		{#each visible as w (w)}
			<rect
				x={SX(w)}
				y={SY - 14}
				width={SX(w + 10) - SX(w) + 0.5}
				height="28"
				fill={wavelengthToColor(w + 5)}
			/>
		{/each}
		<rect
			x={SX(200)}
			y={SY - 14}
			width={SX(900) - SX(200)}
			height="28"
			fill="none"
			stroke="var(--stage-line)"
		/>
		<Readout id="spec-axis">
			<Label x={(SX(200) + SX(380)) / 2} y={SY + 4} text="UV" size={11} muted />
			<Label x={(SX(780) + SX(900)) / 2} y={SY + 4} text="IR" size={11} muted />
			{#each [200, 300, 400, 500, 600, 700, 800, 900] as w (w)}
				<line x1={SX(w)} x2={SX(w)} y1={SY + 14} y2={SY + 19} stroke="var(--stage-ink-muted)" />
				<Label x={SX(w)} y={SY + 32} text={String(w)} size={11} muted tabular />
			{/each}
			<Label x={SX(900)} y={SY + 48} text="wavelength (nm)" size={11} muted anchor="end" />
		</Readout>
		{#each CYANINE_MEASURED as d (d.carbons)}
			<circle
				cx={SX(d.nm)}
				cy={SY + 14}
				r="3"
				fill="var(--stage-ink)"
				opacity={d.carbons === k ? 0 : 0.45}
			/>
		{/each}
		<!-- model -->
		{#if nm <= 900}
			<path
				d="M{SX(nm) - 7} {SY - 28} L{SX(nm) + 7} {SY - 28} L{SX(nm)} {SY - 15} Z"
				fill="var(--hk-model)"
			/>
			<Readout
				id="spec-model"
				order={1}
				label="Model"
				value="{nmText(nm)} ({colourName(nm)})"
				color="var(--hk-model)"
			>
				<Label
					x={SX(nm)}
					y={SY - 34}
					text="model {nmText(nm)}"
					size={12}
					weight={700}
					color="var(--hk-model)"
				/>
			</Readout>
		{/if}
		{#if measured}
			<circle
				cx={SX(measured)}
				cy={SY + 14}
				r="6"
				fill="var(--stage-ink)"
				stroke="var(--stage-bg)"
				stroke-width="2"
			/>
			<Readout
				id="spec-measured"
				order={2}
				label="Measured"
				value="{nmText(measured)} (Simpson 1948)"
			>
				<Label
					x={SX(measured) + (measured > 700 ? -10 : 10)}
					y={SY + 62}
					text="measured {nmText(measured)}"
					size={12}
					weight={600}
					anchor={measured > 700 ? 'end' : 'start'}
				/>
			</Readout>
		{:else}
			<Readout id="spec-measured" order={2} label="Measured" value="no value in this series">
				<Label
					x={SX(200)}
					y={SY + 62}
					text="no measured value for this length here"
					size={11}
					anchor="start"
					muted
				/>
			</Readout>
		{/if}

		<!-- swatch -->
		<rect
			x="24"
			y="512"
			width="56"
			height="56"
			rx="8"
			fill={vis ? wavelengthToColor(nm) : 'var(--stage-grid)'}
			stroke="var(--stage-line)"
		/>
		{#if !vis}
			<Label x={52} y={545} text="unseen" size={11} muted />
		{/if}
		<Readout id="swatch" order={3} label="Absorbs" value={colourName(nm)}>
			<Label
				x={92}
				y={534}
				text="absorbs {colourName(nm)} light"
				size={14}
				weight={700}
				anchor="start"
			/>
			<Label
				x={92}
				y={556}
				text={vis
					? 'the dye looks the complementary colour'
					: nm < 380
						? 'colourless to the eye: it absorbs ultraviolet'
						: 'absorbs beyond the red: near infrared'}
				size={12}
				anchor="start"
				muted
			/>
		</Readout>
	</g>

	{#if focus === 'chart'}
		<g data-testid="chart">
			<Axes
				sx={cx}
				sy={cy}
				xLabel="carbons in the chain"
				yLabel="λmax (nm)"
				xTicks={[1, 3, 5, 7, 9, 11, 13]}
				yTicks={[200, 400, 600, 800]}
			/>
			<rect
				x={cx(0)}
				y={cy(780)}
				width={cx(14) - cx(0)}
				height={cy(380) - cy(780)}
				fill="var(--hk-pos)"
				opacity="0.06"
			/>
			<Readout id="chart-visible">
				<Label x={cx(0) + 6} y={cy(780) + 14} text="visible" size={11} muted anchor="start" />
			</Readout>
			<line
				x1={cx(k)}
				x2={cx(k)}
				y1={cy(900)}
				y2={cy(200)}
				stroke="var(--hk-model)"
				stroke-dasharray="3 4"
				opacity="0.6"
			/>
			<path d={line} fill="none" stroke="var(--hk-model)" stroke-width="2.4" />
			{#each series as c (c)}
				<circle cx={cx(c)} cy={cy(cyanineNm(c))} r={c === k ? 6 : 4} fill="var(--hk-model)" />
			{/each}
			{#each CYANINE_MEASURED as d (d.carbons)}
				<rect
					x={cx(d.carbons) - 5}
					y={cy(d.nm) - 5}
					width="10"
					height="10"
					fill="var(--stage-bg)"
					stroke="var(--stage-ink)"
					stroke-width="2"
					transform="rotate(45 {cx(d.carbons)} {cy(d.nm)})"
				/>
			{/each}
			<Readout id="chart-legend">
				<circle cx={660} cy={92} r="4" fill="var(--hk-model)" />
				<Label x={670} y={96} text="Hückel, one fitted β" size={12} anchor="start" />
				<rect
					x={801}
					y={87}
					width="9"
					height="9"
					fill="var(--stage-bg)"
					stroke="var(--stage-ink)"
					stroke-width="2"
					transform="rotate(45 805.5 91.5)"
				/>
				<Label x={816} y={96} text="measured" size={12} anchor="start" />
			</Readout>
			<Readout
				id="beta"
				order={4}
				label="Fitted |β|"
				value="{BETA_EV.toFixed(2)} eV (from the 3-carbon dye)"
			>
				<Label
					x={660}
					y={540}
					text="|β| = {BETA_EV.toFixed(2)} eV, set by the 3-carbon dye"
					size={12}
					anchor="start"
					muted
				/>
			</Readout>
		</g>
	{:else}
		<g data-testid="ladder">
			<Ladder
				{sol}
				selected={null}
				cx={760}
				gapText="{sol.gap.toFixed(3)}|β| = {eV.toFixed(2)} eV"
			/>
		</g>
		<Readout
			id="gap"
			order={4}
			label="HOMO–LUMO gap"
			value="{sol.gap.toFixed(3)}|β| = {eV.toFixed(2)} eV"
		>
			<Label
				x={590}
				y={540}
				text="gap {sol.gap.toFixed(3)}|β| × {BETA_EV.toFixed(2)} eV = {eV.toFixed(2)} eV"
				size={13}
				anchor="start"
				tabular
			/>
			<Label
				x={590}
				y={562}
				text="λ = hc / gap = {nmText(nm)}"
				size={13}
				anchor="start"
				weight={700}
				color="var(--hk-model)"
			/>
		</Readout>
	{/if}
</g>
