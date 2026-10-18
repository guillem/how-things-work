<script lang="ts">
	/**
	 * Noise damage. Top: the organ of Corti uncoiled, one row of inner hair cells and three rows of
	 * outer hair cells, with `params.loss` % of the outer ones lost along 4 mm around the 5 kHz
	 * place (each cell in or out by a fixed pseudo-random draw against the loss profile). Left:
	 * the audiogram of that ear, in dB HL (the model's threshold minus the healthy model's).
	 * Right: the largest motion on the membrane for a 4 kHz tone against its level, healthy and
	 * damaged, with the threshold line and the level `params.level` marked. Focus
	 * (`step.hints.focus`): 'notch' (the audiogram) or 'loud' (the input–output curves).
	 */
	import { Axes, Label, linePath, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		AUDIOGRAM_FREQS,
		HEALTHY,
		LOSS_AT,
		LOSS_HALF_WIDTH,
		SECTIONS,
		audiogram,
		cfAt,
		dbRe,
		lossProfile,
		placeOf,
		respond,
		threshold,
		type Ear
	} from '../model.ts';
	import { MAP_TICKS, X0, X1, hz, xAt } from './geometry';

	let { step, params }: StageProps = $props();

	const focus = $derived(String(step.hints?.focus ?? 'notch'));
	const lost = $derived(Number(params.loss ?? 100) / 100);
	const level = $derived(Number(params.level ?? 40));
	const ear: Ear = $derived({ active: true, loss: lost, lossAt: LOSS_AT });

	// ---- the hair cells ------------------------------------------------------------------------
	const COLS = 70;
	const ROWS_Y = [78, 90, 102];
	const IHC_Y = 122;
	const BASE_Y = 136;
	const colMm = (c: number) => ((c + 0.5) * 35) / COLS;
	/** A fixed pseudo-random number in [0, 1) for each cell. */
	const draw = (c: number, r: number) => {
		const s = Math.sin((c + 1) * 12.9898 + (r + 1) * 78.233) * 43758.5453;
		return s - Math.floor(s);
	};
	const profile = $derived(lossProfile(ear));
	const sectionOf = (mm: number) => Math.min(SECTIONS - 1, Math.floor((mm / 35) * SECTIONS));
	const dot = (x: number, y: number, r: number) =>
		`M${(x - r).toFixed(1)} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
	const cells = $derived.by(() => {
		let alive = '';
		let gone = '';
		for (let c = 0; c < COLS; c++) {
			const p = profile[sectionOf(colMm(c))];
			const x = xAt(colMm(c));
			ROWS_Y.forEach((y, r) => {
				if (draw(c, r) < p) gone += `M${x - 2.5} ${y - 2.5}l5 5m0 -5l-5 5`;
				else alive += dot(x, y, 3);
			});
		}
		return { alive, gone };
	});
	const ihc = (() => {
		let d = '';
		for (let c = 0; c < COLS; c++) d += dot(xAt(colMm(c)), IHC_Y, 3.4);
		return d;
	})();
	const lo = placeOf(LOSS_AT) - LOSS_HALF_WIDTH;
	const hi = placeOf(LOSS_AT) + LOSS_HALF_WIDTH;

	// ---- the audiogram -------------------------------------------------------------------------
	const gram = $derived(audiogram(ear));
	const ax = scale([0, AUDIOGRAM_FREQS.length - 1], [96, 430]);
	const ay = scale([-10, 40], [244, 474]);
	const at = (f: number) => gram.find((p) => p.f === f)!.hl;

	// ---- the input–output curves at 4 kHz -------------------------------------------------------
	const F = 4000;
	const LEVELS = Array.from({ length: 23 }, (_, i) => i * 5);
	const curveOf = (e: Ear) => {
		let prev: Float64Array | undefined;
		return LEVELS.map((L) => {
			const r = respond(F, L, e, prev);
			prev = r.gamma;
			return { L, db: dbRe(r.mag[r.peak]) };
		});
	};
	const healthy = curveOf(HEALTHY);
	const damaged = $derived(curveOf(ear));
	const ix = scale([0, 110], [580, 920]);
	const iy = scale([-40, 80], [474, 244]);
	const nowHealthy = $derived(
		dbRe(respond(F, level, HEALTHY).mag.reduce((a, b) => Math.max(a, b)))
	);
	const nowDamaged = $derived(dbRe(respond(F, level, ear).mag.reduce((a, b) => Math.max(a, b))));
	const thHealthy = threshold(F, HEALTHY);
	const thDamaged = $derived(threshold(F, ear));
	const clampI = (v: number) => Math.max(-40, Math.min(80, v));

	const dimNotch = $derived(focus === 'notch' ? 1 : 0.45);
	const dimLoud = $derived(focus === 'loud' ? 1 : 0.45);
	const title = $derived(
		`outer hair cells lost around the 5 kHz place: ${Math.round(lost * 100)} %`
	);
</script>

<g>
	<Readout
		id="title"
		order={1}
		label="Lost outer hair cells"
		value="{Math.round(lost * 100)} %"
		note="along 4 mm around the 5 kHz place"
	>
		<Label anchor="start" x={24} y={34} text={title} size={15} weight={600} />
	</Readout>

	<!-- the organ of Corti, uncoiled -->
	<rect x={X0} y={BASE_Y} width={X1 - X0} height="6" rx="3" fill="var(--co-membrane)" />
	<path d={cells.alive} fill="var(--co-ohc)" />
	<path d={cells.gone} stroke="var(--co-lost)" stroke-width="1.4" fill="none" />
	<path d={ihc} fill="var(--co-ihc)" />
	<Readout id="rows" label="Three rows of outer hair cells (green), one of inner hair cells (blue)">
		<Label
			anchor="end"
			x={X0 - 10}
			y={94}
			text="outer hair cells"
			size={12}
			color="var(--co-ohc-text)"
		/>
		<Label
			anchor="end"
			x={X0 - 10}
			y={IHC_Y + 4}
			text="inner hair cells"
			size={12}
			color="var(--co-ihc-text)"
		/>
	</Readout>
	{#if lost > 0}
		<path
			d="M{xAt(lo)} 66 L{xAt(lo)} 60 L{xAt(hi)} 60 L{xAt(hi)} 66"
			fill="none"
			stroke="var(--co-damaged)"
			stroke-width="1.5"
		/>
		<Label
			x={(xAt(lo) + xAt(hi)) / 2}
			y={54}
			text="lost: places tuned to {hz(cfAt(hi))}–{hz(cfAt(lo))}"
			size={12}
			color="var(--co-damaged-text)"
		/>
	{/if}
	<line x1={X0} x2={X1} y1={160} y2={160} stroke="var(--stage-line)" />
	{#each MAP_TICKS as [f, label] (f)}
		<line
			x1={xAt(placeOf(f))}
			x2={xAt(placeOf(f))}
			y1={156}
			y2={164}
			stroke="var(--stage-ink-muted)"
		/>
		<Label x={xAt(placeOf(f))} y={178} text={label} size={11} muted halo={false} />
	{/each}
	<Readout id="tuned-to">
		<Label anchor="end" x={X0 - 10} y={164} text="tuned to" size={11} muted />
	</Readout>

	<!-- the audiogram -->
	<g opacity={dimNotch}>
		<Axes
			sx={ax}
			sy={ay}
			xTicks={AUDIOGRAM_FREQS.map((_, i) => i)}
			xFormat={(i: number) => {
				const f = AUDIOGRAM_FREQS[i];
				return f >= 1000 ? `${f / 1000}k` : String(f);
			}}
			yTicks={[-10, 0, 10, 20, 30, 40]}
			xLabel="frequency (Hz)"
			yLabel="hearing level (dB HL)"
		/>
		<line
			x1={ax(0)}
			x2={ax(7)}
			y1={ay(0)}
			y2={ay(0)}
			stroke="var(--co-wave)"
			stroke-dasharray="5 4"
		/>
		<path
			d={linePath(
				gram.map((p, i) => ({ i, hl: p.hl })),
				(p) => p.i,
				(p) => p.hl,
				ax,
				ay
			)}
			fill="none"
			stroke="var(--co-damaged)"
			stroke-width="2"
		/>
		{#each gram as p, i (p.f)}
			<circle
				cx={ax(i)}
				cy={ay(p.hl)}
				r="5"
				fill="var(--stage-bg)"
				stroke="var(--co-damaged)"
				stroke-width="2"
			/>
		{/each}
		<Readout
			id="gram"
			order={2}
			label="Hearing level"
			value="4 kHz: {at(4000).toFixed(0)} dB HL"
			note="2 kHz: {at(2000).toFixed(0)} · 8 kHz: {at(8000).toFixed(0)} dB HL"
		>
			<Label
				anchor="start"
				x={ax(0) + 4}
				y={ay(0) - 8}
				text="healthy ear (0 dB HL)"
				size={11}
				color="var(--co-wave-text)"
			/>
			<Label
				x={ax(5)}
				y={ay(at(4000)) + 22}
				text="4 kHz: {at(4000).toFixed(0)} dB HL"
				size={12}
				weight={600}
				color="var(--co-damaged-text)"
				tabular
			/>
		</Readout>
	</g>

	<!-- loudness growth at 4 kHz -->
	<g opacity={dimLoud}>
		<Axes
			sx={ix}
			sy={iy}
			xTicks={[0, 20, 40, 60, 80, 100]}
			yTicks={[-40, -20, 0, 20, 40, 60, 80]}
			xLabel="4 kHz tone (dB SPL)"
			yLabel="largest motion (dB)"
		/>
		<line
			x1={ix(0)}
			x2={ix(110)}
			y1={iy(0)}
			y2={iy(0)}
			stroke="var(--co-threshold)"
			stroke-width="1.2"
		/>
		<path
			d={linePath(
				healthy,
				(p) => p.L,
				(p) => clampI(p.db),
				ix,
				iy
			)}
			fill="none"
			stroke="var(--co-wave)"
			stroke-width="2.2"
		/>
		<path
			d={linePath(
				damaged,
				(p) => p.L,
				(p) => clampI(p.db),
				ix,
				iy
			)}
			fill="none"
			stroke="var(--co-damaged)"
			stroke-width="2.2"
		/>
		<Readout id="io-key" label="Healthy (pink) and damaged (orange)">
			<Label
				anchor="end"
				x={ix(110)}
				y={iy(0) + 16}
				text="heard above this line"
				size={11}
				color="var(--co-threshold-text)"
			/>
			<Label
				anchor="start"
				x={ix(4)}
				y={iy(70)}
				text="healthy"
				size={12}
				weight={600}
				color="var(--co-wave-text)"
			/>
			<Label
				anchor="start"
				x={ix(4)}
				y={iy(56)}
				text="damaged"
				size={12}
				weight={600}
				color="var(--co-damaged-text)"
			/>
		</Readout>
		{#if focus === 'loud'}
			<line
				x1={ix(level)}
				x2={ix(level)}
				y1={iy(-40)}
				y2={iy(80)}
				stroke="var(--stage-ink-muted)"
				stroke-dasharray="3 3"
			/>
			<circle cx={ix(level)} cy={iy(clampI(nowHealthy))} r="5" fill="var(--co-wave)" />
			<circle cx={ix(level)} cy={iy(clampI(nowDamaged))} r="5" fill="var(--co-damaged)" />
			<Readout
				id="now"
				order={3}
				label="At {level} dB SPL"
				value="healthy {nowHealthy.toFixed(0)} dB · damaged {nowDamaged.toFixed(0)} dB"
				note="softest heard: {thHealthy.toFixed(0)} and {thDamaged.toFixed(0)} dB SPL"
			>
				<Label
					anchor="start"
					x={24}
					y={548}
					text="at {level} dB SPL: healthy {nowHealthy.toFixed(0)} dB, damaged {nowDamaged.toFixed(
						0
					)} dB above threshold · softest 4 kHz tone heard: {thHealthy.toFixed(
						0
					)} and {thDamaged.toFixed(0)} dB SPL"
					size={12}
					tabular
				/>
			</Readout>
		{/if}
	</g>
</g>
