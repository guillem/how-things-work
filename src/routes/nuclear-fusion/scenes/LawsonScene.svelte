<script lang="ts">
	/**
	 * The Lawson diagram: triple product n T τ_E against temperature, both logarithmic. The
	 * ignition line (alpha heating = all losses) is a U with its bottom near 14 keV and a wall
	 * at the ideal ignition temperature (4.3 keV), where bremsstrahlung alone beats the alphas;
	 * fainter lines show gain Q = 10 and Q = 1. The dot is the reader's plasma.
	 */
	import { Axes, Label, cycle, scale, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { bestIgnition, idealIgnitionTemperature, powers, tripleFor } from '../model';
	import { plasmaOf, pow10, qText, sci } from './settings';

	let { t, params, reduced }: StageProps = $props();

	const X0 = 120;
	const X1 = 880;
	const Y0 = 100;
	const Y1 = 480;
	const Y_LO = 17;
	const Y_HI = 24;
	const lx = scale([0, 2], [X0, X1]);
	const ly = scale([Y_LO, Y_HI], [Y1, Y0]);
	const sx = (tk: number) => lx(Math.log10(tk));
	const sy = (v: number) => ly(Math.min(Y_HI + 0.5, Math.max(Y_LO - 0.5, Math.log10(v))));

	const temps = Array.from({ length: 241 }, (_, i) => 10 ** (i / 120));
	const line = (q: number) => {
		let d = '';
		for (const tk of temps) {
			const v = tripleFor(tk, q);
			if (!Number.isFinite(v) || Math.log10(v) > Y_HI + 0.3) {
				if (d && !d.endsWith('|')) d += '|';
				continue;
			}
			d += `${d === '' || d.endsWith('|') ? 'M' : 'L'}${sx(tk).toFixed(1)} ${sy(v).toFixed(1)}`;
		}
		return d.replaceAll('|', ' ');
	};
	const ignition = line(Infinity);
	const q10 = line(10);
	const q1 = line(1);
	// Region above the ignition line, closed along the top of the chart.
	const region = (() => {
		const pts = temps
			.map((tk) => ({ tk, v: tripleFor(tk) }))
			.filter((p) => Number.isFinite(p.v) && Math.log10(p.v) <= Y_HI);
		let d = `M${sx(pts[0].tk).toFixed(1)} ${Y0}`;
		for (const p of pts) d += ` L${sx(p.tk).toFixed(1)} ${sy(p.v).toFixed(1)}`;
		return d + ` L${X1} ${Y0} Z`;
	})();
	const best = bestIgnition();
	const wall = idealIgnitionTemperature();

	const plasma = $derived(plasmaOf(params));
	const triple = $derived(plasma.n * plasma.t * plasma.tau);
	const need = $derived(tripleFor(plasma.t));
	const q = $derived(powers(plasma).q);
	const above = $derived(!Number.isFinite(q));
	const draw = $derived(reduced ? 1 : smoothstep(0.2, 1.6, t));
	const pulse = $derived(reduced ? 0 : Math.sin(cycle(t, 1.6) * 2 * Math.PI));
	const yTicks = [17, 18, 19, 20, 21, 22, 23, 24];
	const dot = $derived({ x: sx(plasma.t), y: sy(triple) });
	const status = $derived(
		above ? 'above the line: it ignites' : `below the line: gain Q = ${qText(q)}`
	);
	const needText = $derived(Number.isFinite(need) ? sci(need) : 'impossible: too cold');
	const needLine = $derived(
		Number.isFinite(need)
			? `ignition at ${plasma.t} keV needs ${sci(need)}`
			: `ignition at ${plasma.t} keV: impossible, too cold`
	);
</script>

<g>
	<defs>
		<clipPath id="lawson-reveal">
			<rect x={X0} y={Y0 - 4} width={(X1 - X0) * draw} height={Y1 - Y0 + 8} />
		</clipPath>
		<clipPath id="lawson-box">
			<rect x={X0} y={Y0} width={X1 - X0} height={Y1 - Y0} />
		</clipPath>
	</defs>
	<path d={region} fill="var(--nf-ignite)" opacity={0.9 * draw} clip-path="url(#lawson-box)" />
	<Axes
		sx={lx}
		sy={ly}
		xTicks={[0, Math.log10(2), Math.log10(5), 1, Math.log10(20), Math.log10(50), 2]}
		xFormat={(v: number) => String(Math.round(10 ** v))}
		{yTicks}
		yFormat={(v: number) => pow10(v)}
		xLabel="temperature (keV)"
		yLabel="triple product n T τ_E (keV s m⁻³)"
	/>
	<g clip-path="url(#lawson-reveal)">
		<path
			d={q1}
			fill="none"
			stroke="var(--nf-dd)"
			stroke-width="1.5"
			stroke-dasharray="5 4"
			opacity="0.8"
		/>
		<path d={q10} fill="none" stroke="var(--nf-alpha)" stroke-width="1.5" stroke-dasharray="5 4" />
		<path d={ignition} fill="none" stroke="var(--nf-fusion)" stroke-width="3" />
	</g>
	<line
		x1={sx(wall)}
		x2={sx(wall)}
		y1={Y1}
		y2={Y0}
		stroke="var(--stage-ink-muted)"
		stroke-dasharray="3 4"
	/>
	<Readout id="wall">
		<Label
			x={sx(wall) - 8}
			y={Y1 - 14}
			text="no ignition below {wall.toFixed(1)} keV"
			anchor="end"
			size={11}
			muted
		/>
	</Readout>
	<g opacity={draw}>
		<Readout id="l-ign" order={7} label="Ignition (Lawson)" color="var(--nf-fusion)">
			<Label
				x={sx(60)}
				y={sy(tripleFor(60)) - 14}
				text="ignition"
				color="var(--nf-fusion)"
				weight={700}
			/>
		</Readout>
		<Readout id="l-q10" order={8} label="Gain Q = 10" color="var(--nf-alpha)">
			<Label
				x={sx(70)}
				y={sy(tripleFor(70, 10)) + 18}
				text="Q = 10"
				color="var(--nf-alpha)"
				size={12}
			/>
		</Readout>
		<Readout id="l-q1" order={9} label="Gain Q = 1" color="var(--nf-dd)">
			<Label x={sx(70)} y={sy(tripleFor(70, 1)) + 18} text="Q = 1" color="var(--nf-dd)" size={12} />
		</Readout>
		<circle cx={sx(best.t)} cy={sy(best.triple)} r="4" fill="var(--nf-fusion)" />
		<Readout id="best">
			<Label
				x={sx(best.t)}
				y={sy(best.triple) - 14}
				text="lowest: {sci(best.triple, 1)} at {Math.round(best.t)} keV"
				size={11}
				muted
			/>
		</Readout>
		<Label
			x={(sx(20) + X1) / 2}
			y={Y0 + 26}
			text="ignites"
			size={13}
			weight={600}
			color="var(--nf-fusion)"
		/>
	</g>

	<!-- the reader's plasma -->
	<circle cx={dot.x} cy={dot.y} r={10 + 2 * pulse} fill="var(--nf-fusion)" opacity="0.22" />
	<circle
		cx={dot.x}
		cy={dot.y}
		r="7"
		fill={above ? 'var(--nf-fusion)' : 'var(--stage-bg)'}
		stroke="var(--nf-fusion)"
		stroke-width="2.5"
	/>

	<Readout id="yours" order={1} label="Your triple product" value="{sci(triple)} keV s m⁻³">
		<Label
			x={X1}
			y={44}
			text="your plasma: n T τ_E = {sci(triple)} keV s m⁻³"
			anchor="end"
			size={14}
			weight={600}
		/>
	</Readout>
	<Readout id="need" order={2} label="Ignition at {plasma.t} keV needs" value={needText}>
		<Label x={X1} y={68} text={needLine} anchor="end" size={12} muted />
	</Readout>
	<Readout id="status" order={3} label="Result" value={status} color="var(--nf-fusion)">
		<Label
			x={X0 + 10}
			y={44}
			text={status}
			anchor="start"
			size={14}
			weight={700}
			color="var(--nf-fusion)"
		/>
	</Readout>
</g>
