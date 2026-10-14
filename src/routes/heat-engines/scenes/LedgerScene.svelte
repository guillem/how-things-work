<script lang="ts">
	/**
	 * Step 3: the entropy ledger of any heat engine. 1,000 J of heat leave a hot
	 * side at `params.ledgerHot`; `params.share` of it becomes work and the rest
	 * goes to a cold side at `params.ledgerCold`. Arrow widths are the energies;
	 * the bars on the right are the entropy changes of the two sides and their
	 * sum; the gauge at the bottom shows the share against the Carnot limit.
	 */
	import { Label, cycle, scale, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { carnotLimit, ledger } from '../engine';
	import { fmt, pct } from './colors';

	let { t, params, reduced }: StageProps = $props();
	const tm = $derived(reduced ? 2.5 : t);

	const Q = 1000;
	const tHot = $derived(Number(params.ledgerHot ?? 600));
	const tCold = $derived(Number(params.ledgerCold ?? 300));
	const share = $derived(Number(params.share ?? 30) / 100);
	const L = $derived(ledger(Q, share, tHot, tCold));
	const limit = $derived(carnotLimit(tHot, tCold));
	/** At the limit within the slider's 1% resolution. */
	const atLimit = $derived(Math.abs(share - limit) < 0.005);
	const verdict = $derived(
		atLimit
			? 'At the limit: total entropy unchanged'
			: L.allowed
				? `Allowed: total entropy rises by ${fmt(L.dsTotal, 2)} J/K`
				: `Impossible: total entropy would fall by ${fmt(-L.dsTotal, 2)} J/K`
	);
	const verdictColor = $derived(
		atLimit ? 'var(--he-carnot)' : L.allowed ? 'var(--he-work)' : 'var(--he-hot)'
	);

	// ---- energy flows ------------------------------------------------------------------------
	const ENG = { x: 220, y: 300, r: 46 };
	const HOT = { x: 70, y: 70, w: 300, h: 70 };
	const COLD = { x: 70, y: 460, w: 300, h: 70 };
	const PX_PER_J = 0.07; // 1,000 J = 70 px wide
	const wq = (j: number) => Math.max(j * PX_PER_J, 0.0001);

	const hotW = wq(Q);
	const workW = $derived(wq(L.work));
	const coldW = $derived(wq(L.qCold));

	/** Moving specks inside a band from (x0, y0) to (x1, y1), `n` of them. */
	function specks(
		x0: number,
		y0: number,
		x1: number,
		y1: number,
		w: number,
		n: number,
		k0: number
	) {
		const out: { id: number; x: number; y: number; o: number }[] = [];
		if (w < 4) return out;
		const len = Math.hypot(x1 - x0, y1 - y0);
		const nx = -(y1 - y0) / len;
		const ny = (x1 - x0) / len;
		for (let i = 0; i < n; i++) {
			const u = cycle(tm, 2.4, i / n);
			const side = ((i * 0.618) % 1) - 0.5;
			out.push({
				id: k0 + i,
				x: x0 + (x1 - x0) * u + nx * side * (w - 6),
				y: y0 + (y1 - y0) * u + ny * side * (w - 6),
				o: smoothstep(0, 0.12, u) * (1 - smoothstep(0.88, 1, u))
			});
		}
		return out;
	}
	const hotSpecks = $derived(specks(ENG.x, HOT.y + HOT.h, ENG.x, ENG.y - ENG.r, hotW, 6, 0));
	const coldSpecks = $derived(specks(ENG.x, ENG.y + ENG.r, ENG.x, COLD.y, coldW, 6, 10));
	const workSpecks = $derived(specks(ENG.x + ENG.r, ENG.y, 420, ENG.y, workW, 6, 20));

	// ---- entropy bars ---------------------------------------------------------------------------
	const sy = scale([-4, 4], [380, 104]);
	const BARS = $derived([
		{ id: 'hot', x: 560, v: L.dsHot, label: 'hot side', color: 'var(--he-hot)' },
		{ id: 'cold', x: 680, v: L.dsCold, label: 'cold side', color: 'var(--he-cold)' },
		{ id: 'total', x: 800, v: L.dsTotal, label: 'total', color: verdictColor }
	]);
	const BW = 70;

	// ---- the gauge ------------------------------------------------------------------------------
	const gx = scale([0, 1], [520, 900]);
	const GY = 528;
</script>

<g>
	<!-- hot and cold sides -->
	<rect
		x={HOT.x}
		y={HOT.y}
		width={HOT.w}
		height={HOT.h}
		rx="10"
		fill="var(--he-hot-soft)"
		stroke="var(--he-hot)"
	/>
	<Readout id="hot-side" order={1} label="Hot side" value="{fmt(tHot)} K" color="var(--he-hot)">
		<Label x={HOT.x + HOT.w / 2} y={HOT.y + 30} text="hot side" color="var(--he-hot)" />
		<Label x={HOT.x + HOT.w / 2} y={HOT.y + 52} text="T = {fmt(tHot)} K" size={14} weight={600} />
	</Readout>
	<rect
		x={COLD.x}
		y={COLD.y}
		width={COLD.w}
		height={COLD.h}
		rx="10"
		fill="var(--he-cold-soft)"
		stroke="var(--he-cold)"
	/>
	<Readout id="cold-side" order={2} label="Cold side" value="{fmt(tCold)} K" color="var(--he-cold)">
		<Label x={COLD.x + COLD.w / 2} y={COLD.y + 30} text="cold side" color="var(--he-cold)" />
		<Label
			x={COLD.x + COLD.w / 2}
			y={COLD.y + 52}
			text="T = {fmt(tCold)} K"
			size={14}
			weight={600}
		/>
	</Readout>

	<!-- energy bands -->
	<rect
		x={ENG.x - hotW / 2}
		y={HOT.y + HOT.h}
		width={hotW}
		height={ENG.y - ENG.r - HOT.y - HOT.h + 10}
		fill="var(--he-hot)"
		opacity="0.35"
	/>
	{#if L.qCold > 0.5}
		<rect
			x={ENG.x - coldW / 2}
			y={ENG.y + ENG.r - 10}
			width={coldW}
			height={COLD.y - ENG.y - ENG.r + 10}
			fill="var(--he-cold)"
			opacity="0.35"
		/>
	{/if}
	{#if L.work > 0.5}
		<rect
			x={ENG.x + ENG.r - 10}
			y={ENG.y - workW / 2}
			width={420 - ENG.x - ENG.r + 10}
			height={workW}
			fill="var(--he-work)"
			opacity="0.35"
		/>
		<path
			d="M420 {ENG.y - workW / 2 - 8} L444 {ENG.y} L420 {ENG.y + workW / 2 + 8} Z"
			fill="var(--he-work)"
			opacity="0.5"
		/>
	{/if}
	{#each [...hotSpecks, ...coldSpecks, ...workSpecks] as s (s.id)}
		<circle cx={s.x} cy={s.y} r="2.5" fill="var(--stage-bg)" opacity={s.o * 0.9} />
	{/each}
	<circle
		cx={ENG.x}
		cy={ENG.y}
		r={ENG.r}
		fill="var(--surface)"
		stroke="var(--stage-ink)"
		stroke-width="2"
	/>
	<Label x={ENG.x} y={ENG.y + 5} text="engine" size={13} weight={600} />

	<Readout id="q-hot" order={3} label="Heat from the hot side" value="{fmt(Q)} J">
		<Label
			x={ENG.x + hotW / 2 + 10}
			y={(HOT.y + HOT.h + ENG.y - ENG.r) / 2 + 5}
			text="heat in: {fmt(Q)} J"
			anchor="start"
			color="var(--he-hot)"
		/>
	</Readout>
	<Readout id="q-cold" order={5} label="Heat to the cold side" value="{fmt(L.qCold)} J">
		<Label
			x={ENG.x + Math.max(coldW, 0) / 2 + 10}
			y={(ENG.y + ENG.r + COLD.y) / 2 + 5}
			text="heat out: {fmt(L.qCold)} J"
			anchor="start"
			color="var(--he-cold)"
		/>
	</Readout>
	<Readout id="work" order={4} label="Work" value="{fmt(L.work)} J">
		<Label x={340} y={ENG.y - workW / 2 - 14} text="work: {fmt(L.work)} J" color="var(--he-work)" />
	</Readout>

	<!-- entropy bars -->
	<Readout id="s-title">
		<text x={520} y={80} font-size="12" class="muted">entropy change per cycle (J/K)</text>
	</Readout>
	{#each [-4, -2, 0, 2, 4] as v (v)}
		<line
			x1={520}
			x2={900}
			y1={sy(v)}
			y2={sy(v)}
			stroke={v === 0 ? 'var(--stage-line)' : 'var(--stage-grid)'}
		/>
		<text x={512} y={sy(v) + 4} font-size="11" text-anchor="end" class="muted"
			>{v > 0 ? '+' : ''}{v}</text
		>
	{/each}
	{#each BARS as b (b.id)}
		{@const v = Math.max(-4, Math.min(4, b.v))}
		<rect
			x={b.x - BW / 2}
			y={Math.min(sy(0), sy(v))}
			width={BW}
			height={Math.abs(sy(v) - sy(0))}
			rx="3"
			fill={b.color}
			opacity="0.75"
		/>
		<Readout
			id="bar-{b.id}"
			order={6 + (b.id === 'hot' ? 0 : b.id === 'cold' ? 1 : 2)}
			label="Entropy change, {b.label}"
			value="{b.v >= 0 ? '+' : '−'}{fmt(Math.abs(b.v), 2)} J/K"
		>
			<Label
				x={b.x}
				y={v >= 0 ? sy(v) - 8 : sy(v) + 18}
				text="{b.v >= 0 ? '+' : '−'}{fmt(Math.abs(b.v), 2)}"
				size={13}
				weight={600}
			/>
			<Label x={b.x} y={v >= 0 ? sy(0) + 18 : sy(0) - 8} text={b.label} size={12} muted />
		</Readout>
	{/each}
	<Readout id="formula">
		{#each [{ x: 560, sign: '−', q: 'h' }, { x: 680, sign: '+', q: 'c' }] as f (f.x)}
			<text x={f.x} y={sy(-4) + 20} font-size="12" text-anchor="middle" class="muted"
				>{f.sign}Q<tspan baseline-shift="sub" font-size="9">{f.q}</tspan>/T<tspan
					baseline-shift="sub"
					font-size="9">{f.q}</tspan
				></text
			>
		{/each}
	</Readout>

	<!-- the gauge -->
	<Readout id="gauge-title">
		<text x={520} y={GY - 22} font-size="12" class="muted">share of the heat turned into work</text>
	</Readout>
	<rect
		x={gx(0)}
		y={GY - 8}
		width={gx(1) - gx(0)}
		height="16"
		rx="8"
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	<rect
		x={gx(limit)}
		y={GY - 8}
		width={gx(1) - gx(limit)}
		height="16"
		fill="var(--he-hot)"
		opacity="0.15"
	/>
	<rect
		x={gx(0)}
		y={GY - 5}
		width={Math.max(0, gx(share) - gx(0))}
		height="10"
		rx="5"
		fill={verdictColor}
	/>
	<line
		x1={gx(limit)}
		x2={gx(limit)}
		y1={GY - 14}
		y2={GY + 14}
		stroke="var(--he-carnot)"
		stroke-width="2.5"
	/>
	<Readout
		id="limit"
		order={9}
		label="Carnot limit 1 − Tc/Th"
		value={pct(limit, 1)}
		color="var(--he-carnot)"
	>
		<Label
			x={gx(limit)}
			y={GY + 30}
			text="Carnot limit {pct(limit, 1)}"
			size={12}
			color="var(--he-carnot)"
			anchor={limit > 0.8 ? 'end' : limit < 0.2 ? 'start' : 'middle'}
		/>
	</Readout>
	<Readout id="verdict" order={0} label="Verdict" value={verdict} color={verdictColor}>
		<Label x={710} y={GY - 70} text={verdict} pill size={13} color={verdictColor} />
	</Readout>
</g>
