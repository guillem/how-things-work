<script lang="ts">
	/**
	 * Halley's whole orbit, drawn flat and to scale, with the Sun on the right and the planets'
	 * paths (Earth to Neptune) as faint circles. The comet sits on its path at the chosen year;
	 * the reader drags it along (or moves the year slider). Its tail, drawn far bigger than life,
	 * appears only while its ice is turning to gas, and points away from the Sun.
	 */
	import { Handle, Label, clamp } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { useReadouts } from '#lib/explainer/readouts.svelte.ts';
	import {
		HALLEY,
		daysOfYear,
		gasTailDirection,
		iceRate,
		nearestDay,
		orbitPath,
		speed,
		stateAt,
		yearOf
	} from '../model';
	import { far, monthOf } from '../steps';

	let { params, setParam }: StageProps = $props();

	const readouts = useReadouts();
	/** A phone: the stage is drawn small, so the comet's handle is drawn bigger for a finger. */
	const phone = $derived(readouts?.out ?? false);

	const K = 24; // px per au
	const SX = 900;
	const SY = 292;
	const X = (x: number) => SX + x * K;
	const Y = (y: number) => SY - y * K;

	const MIN = Math.round(yearOf(-HALLEY.period / 2) * 10) / 10;
	const MAX = Math.round(yearOf(HALLEY.period / 2) * 10) / 10;
	const year = $derived(clamp(Number(params.year ?? 1960), MIN, MAX));
	const days = $derived(daysOfYear(year));
	const s = $derived(stateAt(days));
	const cx = $derived(X(s.x));
	const cy = $derived(Y(s.y));

	const path = orbitPath(720)
		.map((p, i) => `${i === 0 ? 'M' : 'L'}${X(p.x).toFixed(1)} ${Y(p.y).toFixed(1)}`)
		.join(' ');

	const planets = [
		{ name: 'Earth', r: 1, lx: 872, ly: 296, anchor: 'end' as const },
		{ name: 'Jupiter', r: 5.2, at: 236 },
		{ name: 'Saturn', r: 9.54, at: 222 },
		{ name: 'Uranus', r: 19.2, at: 206 },
		{ name: 'Neptune', r: 30.07, at: 196 }
	].map((p) => {
		if (p.lx !== undefined) return { ...p, x: p.lx, y: p.ly };
		const a = ((p.at ?? 0) * Math.PI) / 180;
		return {
			...p,
			x: SX + p.r * K * Math.cos(a),
			y: SY - p.r * K * Math.sin(a),
			anchor: 'middle' as const
		};
	});

	/** Activity, 0 (frozen) to 1 (closest), on a scale that shows the first trickle. */
	const rate = $derived(iceRate(s.r) / iceRate(HALLEY.q));
	const active = $derived(clamp(Math.log10(Math.max(rate, 1e-9)) / 3 + 1));
	const tailDir = $derived(gasTailDirection(s));
	const tailLen = $derived(90 * active);
	const tail = $derived({
		x: cx + tailDir.x * tailLen,
		y: cy - tailDir.y * tailLen
	});
	// The dust tail bends back along the path: towards where the comet came from.
	const back = $derived(stateAt(days - 25));
	const bend = $derived({
		x: cx + (tail.x - cx) * 0.6 + (X(back.x) - cx) * 0.35,
		y: cy + (tail.y - cy) * 0.6 + (Y(back.y) - cy) * 0.35
	});

	const v = $derived(speed(s));
	const speedText = $derived(v < 10 ? v.toFixed(1) : String(Math.round(v)));
	const where = $derived(
		s.r > 30.07
			? 'beyond Neptune'
			: s.r > 19.2
				? 'between Uranus and Neptune'
				: s.r > 9.54
					? 'between Saturn and Uranus'
					: s.r > 5.2
						? 'between Jupiter and Saturn'
						: s.r > 1
							? 'inside Jupiter’s path'
							: 'inside Earth’s path'
	);
	const status = $derived(
		active > 0.02 ? 'ice turning to gas: it has a tail' : 'frozen: no tail, no fuzz'
	);

	function move(p: { x: number; y: number }) {
		const d = nearestDay((p.x - SX) / K, (SY - p.y) / K, -HALLEY.period / 2, HALLEY.period / 2);
		setParam('year', clamp(Math.round(yearOf(d) * 20) / 20, MIN, MAX));
	}
	function key(step: number | 'start' | 'end') {
		if (step === 'start') setParam('year', MIN);
		else if (step === 'end') setParam('year', MAX);
		else setParam('year', clamp(Math.round((year + step * 0.25) * 20) / 20, MIN, MAX));
	}
</script>

<g class="orbit">
	<defs>
		<clipPath id="ct-orbit-clip">
			<rect x="16" y="16" width="928" height="568" />
		</clipPath>
		<radialGradient id="ct-orbit-sun">
			<stop offset="0" stop-color="var(--ct-sun)" stop-opacity="0.7" />
			<stop offset="1" stop-color="var(--ct-sun)" stop-opacity="0" />
		</radialGradient>
	</defs>

	<g clip-path="url(#ct-orbit-clip)">
		{#each planets as p (p.name)}
			<circle
				cx={SX}
				cy={SY}
				r={p.r * K}
				fill="none"
				stroke="var(--ct-planet)"
				stroke-width="1.2"
				stroke-dasharray={p.name === 'Earth' ? '3 3' : '6 6'}
			/>
		{/each}
	</g>
	{#each planets as p (p.name)}
		<Readout id="ct-planet-{p.name}">
			<Label x={p.x} y={p.y} text={p.name} anchor={p.anchor} size={12} muted />
		</Readout>
	{/each}

	<path d={path} fill="none" stroke="var(--ct-orbit)" stroke-width="2" />

	<circle cx={SX} cy={SY} r="22" fill="url(#ct-orbit-sun)" />
	<circle cx={SX} cy={SY} r="8" fill="var(--ct-sun)" />
	<Label x={SX} y={SY + 48} text="Sun" size={13} weight={700} />

	{#if active > 0.02}
		<path
			d="M{cx} {cy} Q{bend.x} {bend.y} {tail.x + (bend.x - tail.x) * 0.3} {tail.y +
				(bend.y - tail.y) * 0.3}"
			fill="none"
			stroke="var(--ct-dust)"
			stroke-width="5"
			stroke-linecap="round"
			opacity={0.55 * active}
		/>
		<line
			x1={cx}
			y1={cy}
			x2={tail.x}
			y2={tail.y}
			stroke="var(--ct-gas)"
			stroke-width="3"
			stroke-linecap="round"
			opacity={0.9 * active}
		/>
	{/if}
	<Handle
		x={cx}
		y={cy}
		r={phone ? 24 : 9}
		color="var(--ct-head)"
		label="Halley’s comet"
		value={year}
		min={MIN}
		max={MAX}
		valuetext="{monthOf(year)}, {far(s.r)} from the Sun"
		onmove={move}
		onkey={key}
	/>

	<Readout id="ct-orbit-card">
		<rect
			x="20"
			y="20"
			width="372"
			height="128"
			rx="10"
			fill="var(--surface)"
			stroke="var(--border)"
			opacity="0.92"
		/>
	</Readout>
	<Readout id="ct-orbit-date" order={1} label="When" value={monthOf(year)}>
		<Label
			x={36}
			anchor="start"
			y={50}
			text={monthOf(year)}
			size={19}
			weight={700}
			tabular
			halo={false}
		/>
	</Readout>
	<Readout id="ct-orbit-far" order={2} label="From the Sun" value="{far(s.r)}, {where}">
		<Label x={36} anchor="start" y={76} text="{far(s.r)}, {where}" size={14} halo={false} />
	</Readout>
	<Readout id="ct-orbit-speed" order={3} label="Speed" value="{speedText} km a second">
		<Label
			x={36}
			anchor="start"
			y={100}
			text="speed: {speedText} km a second"
			size={14}
			halo={false}
			tabular
		/>
	</Readout>
	<Readout id="ct-orbit-status" order={4} label="The comet" value={status}>
		<Label
			x={36}
			anchor="start"
			y={128}
			text={status}
			size={14}
			weight={700}
			color={active > 0.02 ? 'var(--ct-gas-ink)' : 'var(--stage-ink-muted)'}
			halo={false}
		/>
	</Readout>
	<Readout id="ct-orbit-note">
		<Label
			x={944}
			y={580}
			text="distances to scale; the comet and its tail drawn far bigger than life"
			anchor="end"
			size={11}
			muted
		/>
	</Readout>
</g>
