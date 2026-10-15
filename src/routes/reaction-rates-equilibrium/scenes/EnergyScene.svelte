<script lang="ts">
	/**
	 * How collision energies are spread at a temperature, and the share above the
	 * barrier: e^(−E/RT) (see `fractionAbove` in ../model.ts).
	 *
	 * Left: the distribution itself, f(E) = e^(−E/RT)/RT per kJ/mol, over 0–40 kJ/mol,
	 * with dots for collisions arriving (energies drawn from the same distribution,
	 * by a fixed hash, each one fading in and out). The barrier is far off the right
	 * edge. Right: the share of collisions with at least E, on a powers-of-ten axis,
	 * a straight line whose slope is −1/RT; the barrier and the share above it.
	 * A faint copy of both curves at 700 K stays when the temperature moves.
	 * Reduced motion: the dots are drawn at full strength, frozen.
	 */
	import { Axes, Label, hash, linePath, scale, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { EA_F, R, fractionAbove } from '../model';
	import { fmtPow, sig, superscript } from '../look';

	let { t, params, reduced }: StageProps = $props();

	const T = $derived(Math.min(781, Math.max(556, Number(params.tShare ?? 700))));
	const rt = (temp: number) => (R * temp) / 1000; // kJ/mol
	const EA = EA_F / 1000;

	// ---- left: the distribution ------------------------------------------------------
	const L = { x: 76, y: 140, w: 360, h: 300 };
	const lx = scale([0, 40], [L.x, L.x + L.w]);
	const ly = scale([0, 0.25], [L.y + L.h, L.y]);
	const density = (e: number, temp: number) => Math.exp(-e / rt(temp)) / rt(temp);
	const grid = Array.from({ length: 81 }, (_, i) => (i / 80) * 40);
	const curve = (temp: number) =>
		linePath(
			grid,
			(e) => e,
			(e) => density(e, temp),
			lx,
			ly
		);
	const area = $derived(
		curve(T) + `L${lx(40).toFixed(1)} ${ly(0).toFixed(1)}L${lx(0).toFixed(1)} ${ly(0).toFixed(1)}Z`
	);
	const ghost = curve(700);

	const DOTS = 36;
	const LIFE = 2.4;
	const dots = $derived.by(() => {
		const out: { k: number; x: number; y: number; o: number }[] = [];
		for (let k = 0; k < DOTS; k++) {
			const off = k / DOTS;
			const life = Math.floor(t / LIFE + off);
			const u = reduced ? 0.5 : (t / LIFE + off) % 1;
			const e = -rt(T) * Math.log(Math.max(1e-9, hash(k * 977 + life * 31, 1)));
			if (e > 40) continue;
			const y = hash(k * 131 + life * 17, 2) * density(e, T);
			out.push({
				k,
				x: lx(e),
				y: ly(y),
				o: reduced ? 0.9 : smoothstep(0, 0.15, u) * (1 - smoothstep(0.75, 1, u))
			});
		}
		return out;
	});

	// ---- right: the share above E, powers of ten ----------------------------------------
	const P = { x: 540, y: 140, w: 370, h: 300 };
	const px = scale([0, 200], [P.x, P.x + P.w]);
	const py = scale([-16, 0], [P.y + P.h, P.y]);
	const logShare = (e: number, temp: number) => -e / (rt(temp) * Math.LN10);
	const line = (temp: number) => {
		// The line leaves the chart at 10⁻¹⁶; clip it there.
		const eEnd = Math.min(200, 16 * rt(temp) * Math.LN10);
		return `M${px(0)} ${py(0)}L${px(eEnd).toFixed(1)} ${py(logShare(eEnd, temp)).toFixed(1)}`;
	};
	const shareLine = $derived(line(T));
	const ghostLine = line(700);
	const share = $derived(fractionAbove(EA_F, T));
	const vs700 = $derived(share / fractionAbove(EA_F, 700));
	const vsText = $derived(
		Math.abs(vs700 - 1) < 0.01
			? ''
			: vs700 > 1
				? `${sig(vs700)} × as many as at 700 K`
				: `${sig(1 / vs700)} × fewer than at 700 K`
	);
	const yTicks = [0, -4, -8, -12, -16];
	const yFmt = (v: number) => (v === 0 ? '1' : `10${superscript(v)}`);
</script>

<g style:font-variant-numeric="tabular-nums">
	<Readout
		id="title"
		order={1}
		label="Temperature"
		value="{Math.round(T)} K ({Math.round(T - 273.15)} °C)"
	>
		<text x={28} y={44} font-size="16" font-weight="600"
			>Collision energies at {Math.round(T)} K<tspan
				dx="10"
				font-size="13"
				font-weight="400"
				class="muted">({Math.round(T - 273.15)} °C)</tspan
			></text
		>
	</Readout>

	<!-- left -->
	<Readout id="left-title">
		<Label
			x={L.x - 8}
			y={L.y - 34}
			text="How collision energies are spread"
			size={13}
			anchor="start"
			weight={600}
		/>
	</Readout>
	<Axes
		sx={lx}
		sy={ly}
		xLabel="collision energy, kJ/mol"
		yLabel="share per kJ/mol"
		yTicks={[0, 0.1, 0.2]}
	/>
	{#if Math.abs(T - 700) > 1}
		<path
			d={ghost}
			fill="none"
			stroke="var(--stage-ink-muted)"
			stroke-width="1.5"
			stroke-dasharray="4 4"
		/>
	{/if}
	<path d={area} fill="var(--rr-forward)" opacity="0.22" />
	<path d={curve(T)} fill="none" stroke="var(--rr-forward)" stroke-width="2.4" />
	{#each dots as d (d.k)}
		<circle
			cx={d.x}
			cy={d.y}
			r="3"
			fill="var(--rr-forward)"
			stroke="var(--stage-bg)"
			opacity={d.o}
		/>
	{/each}
	<Readout id="rt" order={3} label="Typical collision, RT" value="{rt(T).toFixed(1)} kJ/mol">
		<line
			x1={lx(rt(T))}
			x2={lx(rt(T))}
			y1={ly(0)}
			y2={ly(density(rt(T), T)) - 4}
			stroke="var(--stage-ink)"
			stroke-dasharray="2 3"
		/>
		<Label
			x={lx(rt(T)) + 8}
			y={ly(density(rt(T), T)) - 8}
			text="typical: RT = {rt(T).toFixed(1)} kJ/mol"
			size={12}
			anchor="start"
		/>
	</Readout>
	<Readout id="far">
		<path
			d="M{L.x + L.w - 60} {L.y + 112} h56 m-8 -6 l8 6 l-8 6"
			fill="none"
			stroke="var(--rr-barrier)"
			stroke-width="2"
		/>
		<Label
			x={L.x + L.w}
			y={L.y + 54}
			text="the barrier is at {Math.round(EA)} kJ/mol,"
			size={12}
			anchor="end"
			color="var(--rr-barrier)"
		/>
		<Label
			x={L.x + L.w}
			y={L.y + 74}
			text="more than 4 times this chart’s width"
			size={12}
			anchor="end"
			color="var(--rr-barrier)"
		/>
	</Readout>

	<!-- right -->
	<Readout id="right-title">
		<Label
			x={P.x - 8}
			y={P.y - 34}
			text="Share with at least this energy"
			size={13}
			anchor="start"
			weight={600}
		/>
	</Readout>
	<Axes
		sx={px}
		sy={py}
		xLabel="collision energy, kJ/mol"
		xTicks={[0, 50, 100, 150, 200]}
		{yTicks}
		yFormat={yFmt}
	/>
	{#if Math.abs(T - 700) > 1}
		<path d={ghostLine} stroke="var(--stage-ink-muted)" stroke-width="1.5" stroke-dasharray="4 4" />
		<Readout id="ghost">
			<Label
				x={px(60) + 8}
				y={py(logShare(60, 700)) - 10}
				text="700 K"
				size={11}
				anchor="start"
				muted
			/>
		</Readout>
	{/if}
	<path d={shareLine} stroke="var(--rr-forward)" stroke-width="2.4" fill="none" />
	<line
		x1={px(EA)}
		x2={px(EA)}
		y1={py(0)}
		y2={py(-16)}
		stroke="var(--rr-barrier)"
		stroke-width="1.5"
		stroke-dasharray="5 4"
	/>
	<Readout id="barrier">
		<Label
			x={px(EA) - 6}
			y={py(-1)}
			text="barrier {Math.round(EA)}"
			size={12}
			anchor="end"
			color="var(--rr-barrier)"
		/>
	</Readout>
	{#if logShare(EA, T) >= -16}
		<circle
			cx={px(EA)}
			cy={py(logShare(EA, T))}
			r="6"
			fill="var(--rr-forward)"
			stroke="var(--stage-bg)"
			stroke-width="1.5"
		/>
	{/if}
	<Readout
		id="share"
		order={2}
		label="Collisions over the barrier"
		value="1 in {fmtPow(1 / share)}"
		color="var(--rr-forward)"
	>
		<Label
			x={px(EA) - 20}
			y={Math.min(py(-13.5), py(logShare(EA, T)) + 28)}
			text="1 in {fmtPow(1 / share)}"
			size={14}
			weight={600}
			anchor="end"
			pill
		/>
	</Readout>

	<Readout
		id="vs"
		order={4}
		label="Compared with 700 K"
		value={vsText || 'the same'}
		opacity={vsText ? 1 : 0}
	>
		<Label x={P.x + P.w / 2} y={530} text={vsText} size={13} opacity={vsText ? 1 : 0} />
	</Readout>
	<Readout id="note">
		<Label x={L.x + L.w / 2} y={530} text="each dot: a collision" size={12} muted />
	</Readout>
</g>
