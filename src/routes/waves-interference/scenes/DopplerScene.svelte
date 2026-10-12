<script lang="ts">
	/**
	 * A source of sound moving at `params.speed` (m/s) through still air, where
	 * sound travels at 343 m/s (dry air at 20 °C, `SOUND_SPEED`). Its tone is
	 * 440 Hz.
	 *
	 * Phases (`step.hints.phase`):
	 *   fronts — seen from above and hugely slowed down: the source moves right
	 *            and sends out a crest every 0.5 s; each crest is a circle centred
	 *            where it was sent, growing at the (drawn) speed of sound. The
	 *            ratio of the two speeds is the real one. The source crosses the
	 *            stage in at most 20 s and starts again (a short fade hides the
	 *            jump); the reduced-motion frame has it in the middle. Brackets mark
	 *            the squeezed spacing ahead and the stretched one behind; the card
	 *            gives the pitch heard ahead and behind.
	 *   passby — in real time: a car on a road passes a listener 10 m away. Below
	 *            the road, on the same horizontal scale, the pitch the listener
	 *            hears against where the car is (`passBy`, which accounts for the
	 *            travel time of the sound); a ghost marks where the sound being
	 *            heard was sent from. The car drives from −X to X, X = min(60 m,
	 *            speed × 3 s), then waits 1 s.
	 *
	 * `params.passby` (an action) plays the same pass-by as sound (see
	 * `sound.ts`) and restarts the drive, so the car on the stage goes past in
	 * step with what you hear (at 1× speed).
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { smoothstep } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { SOUND_SPEED, dopplerAhead, dopplerBehind, passBy } from '../waves';
	import Card from './Card.svelte';
	import { playNote, playSweep, stopAll } from './sound';
	import { fmt, pathOf, type Cell } from './ui';

	let { step, t, params, reduced }: StageProps = $props();

	const F = 440; // Hz, the tone sent out
	const C = SOUND_SPEED;
	const D = 10; // m from the road to the listener

	const phase = $derived(String(step.hints?.phase ?? 'fronts'));
	const v = $derived(Math.max(0, Math.min(0.9 * C, Number(params.speed ?? 30))));
	const beta = $derived(v / C);
	const fAhead = $derived(dopplerAhead(F, v, C));
	const fBehind = $derived(dopplerBehind(F, v, C));

	const wPass = new Tween(0, { duration: 700, easing: cubicInOut });
	$effect(() => {
		const w = phase === 'passby' ? 1 : 0;
		untrack(() => wPass.set(w, { duration: reduced ? 0 : 700 }));
	});
	const oF = $derived(1 - wPass.current);
	const oP = $derived(wPass.current);

	// ---- the pass-by, as heard ------------------------------------------------------------
	const X = $derived(Math.min(60, 3 * v)); // m either side of the closest point
	const driveTime = $derived(v > 0 ? (2 * X) / v : 0);

	let lastPress: number | undefined;
	$effect(() => {
		const c = Number(params.passby ?? 0);
		untrack(() => {
			if (lastPress !== undefined && c !== lastPress) {
				if (v <= 0) playNote([{ f: F, a: 1 }], 2);
				else {
					const n = 240;
					const freqs: number[] = [];
					const gains: number[] = [];
					for (let i = 0; i < n; i++) {
						const tt = -X / v + (i / (n - 1)) * driveTime;
						const h = passBy(F, v, C, D, tt);
						freqs.push(h.f);
						gains.push(Math.max(0.08, D / h.distance));
					}
					playSweep(freqs, gains, driveTime);
				}
			}
			lastPress = c;
		});
	});
	$effect(() => {
		void step.id;
		return () => stopAll();
	});

	// ---- fronts (slowed down) ---------------------------------------------------------------
	const FY0 = 120;
	const FY1 = 584;
	const SY = 360;
	const C_PX = 110; // px/s: the drawn speed of sound
	const T_VIS = 0.5; // s between crests, as drawn
	const AGE = 9; // s: crests older than this have left the stage
	const vPx = $derived(beta * C_PX);
	const travel = $derived(vPx > 0 ? Math.min(680, vPx * 20) : 0);
	const loop = $derived(vPx > 0 ? travel / vPx : 20);
	const xStart = $derived(480 - travel / 2);
	/** Time since this crossing began; the reduced frame has the source in the middle. */
	const s = $derived.by(() => {
		const tt = reduced ? 2.5 : t;
		return (((tt - 2.5 + loop / 2) % loop) + loop) % loop;
	});
	const xs = (tau: number) => xStart + vPx * tau;
	const srcX = $derived(xs(s));
	const loopFade = $derived(
		vPx > 0 ? smoothstep(0, 0.4, s) * (1 - smoothstep(loop - 0.4, loop, s)) : 1
	);
	const fronts = $derived.by(() => {
		const out: { k: number; x: number; r: number; o: number }[] = [];
		const k1 = Math.floor(s / T_VIS);
		const k0 = Math.ceil((s - AGE) / T_VIS);
		for (let k = k0; k <= k1; k++) {
			const tau = k * T_VIS;
			const r = C_PX * (s - tau);
			out.push({ k, x: xs(tau), r, o: Math.max(0, 1 - r / (C_PX * AGE)) });
		}
		return out;
	});
	/** Brackets between the 2nd and 3rd newest crests, ahead and behind, on the line of motion. */
	const brackets = $derived.by(() => {
		const n = fronts.length;
		if (n < 3) return null;
		const a = fronts[n - 2];
		const b = fronts[n - 3];
		return {
			ahead: [a.x + a.r, b.x + b.r],
			behind: [a.x - a.r, b.x - b.r]
		};
	});

	// ---- the pass-by drawing (real time) -------------------------------------------------------
	const RX0 = 40;
	const RX1 = 920;
	const RY = 178; // road centre
	const PXM = (RX1 - RX0) / 120; // px per metre: ±60 m
	const LX = (RX0 + RX1) / 2; // the listener's x (closest point)
	const LY = RY + D * PXM;
	const rx = (m: number) => LX + m * PXM;
	let memo = { key: '', start: 0 };
	const since = $derived.by(() => {
		const key = `${phase}|${params.passby ?? 0}`;
		if (key !== memo.key || t < memo.start) memo = { key, start: memo.key === '' ? 0 : t };
		return t - memo.start;
	});
	const passLoop = $derived(v > 0 ? driveTime + 1 : 4);
	const drive = $derived.by(() => {
		const u = reduced ? 2.5 : since % passLoop;
		if (v <= 0) return { x: 0, heard: passBy(F, 0, C, D, 0), o: 1 };
		const tt = -X / v + Math.min(u, driveTime);
		const o = smoothstep(0, 0.15, u) * (1 - smoothstep(driveTime + 0.6, driveTime + 1, u));
		return { x: v * tt, heard: passBy(F, v, C, D, tt), o };
	});
	// plot of heard pitch against the car's position
	const PY0 = 336;
	const PY1 = 540;
	const range = $derived.by(() => {
		const lo = Math.min(fBehind, F);
		const hi = Math.max(fAhead, F);
		const pad = Math.max(8, (hi - lo) * 0.12);
		return { lo: lo - pad, hi: hi + pad };
	});
	const py = (f: number) => PY1 - ((f - range.lo) / (range.hi - range.lo)) * (PY1 - PY0);
	const ticks = $derived.by(() => {
		const span = range.hi - range.lo;
		const raw = span / 4;
		const mag = 10 ** Math.floor(Math.log10(raw));
		const st = [1, 2, 5, 10].map((k) => k * mag).find((k) => k >= raw) ?? raw;
		const out: number[] = [];
		for (let f = Math.ceil(range.lo / st) * st; f <= range.hi; f += st) out.push(f);
		return out;
	});
	const curve = $derived.by(() => {
		if (v <= 0)
			return pathOf([
				{ x: RX0, y: py(F) },
				{ x: RX1, y: py(F) }
			]);
		const pts = [];
		for (let i = 0; i <= 200; i++) {
			const m = -60 + (i / 200) * 120;
			pts.push({ x: rx(m), y: py(passBy(F, v, C, D, m / v).f) });
		}
		return pathOf(pts);
	});

	const cells = $derived<Cell[]>(
		phase === 'passby'
			? [
					{
						id: 'car',
						label: 'Car',
						value: `${drive.x < 0 ? 'coming' : drive.x > 0 ? 'going' : 'level'}, ${fmt(Math.abs(drive.x), 0)} m`,
						sub: `${v} m/s · horn 440 Hz`
					},
					{
						id: 'hear',
						label: 'You hear',
						value: `${fmt(drive.heard.f, 0)} Hz`,
						sub:
							drive.heard.f > F + 0.5
								? 'higher than the horn'
								: drive.heard.f < F - 0.5
									? 'lower than the horn'
									: 'the horn’s own pitch',
						color: drive.heard.f >= F ? 'var(--wav-b)' : 'var(--wav-a)'
					},
					{
						id: 'range',
						label: 'From … to',
						value: `${fmt(fAhead, 0)} → ${fmt(fBehind, 0)} Hz`,
						sub: 'far ahead → far behind'
					}
				]
			: [
					{
						id: 'v',
						label: 'Source speed',
						value: `${v} m/s`,
						sub: `${fmt(beta, 2)} × the speed of sound`
					},
					{
						id: 'f',
						label: 'Tone sent out',
						value: '440 Hz',
						sub: 'one crest every 1/440 s'
					},
					{
						id: 'a',
						label: 'Heard ahead',
						value: `${fmt(fAhead, 0)} Hz`,
						sub: v > 0 ? 'crests squeezed: higher' : 'no shift when still',
						color: 'var(--wav-b)'
					},
					{
						id: 'b',
						label: 'Heard behind',
						value: `${fmt(fBehind, 0)} Hz`,
						sub: v > 0 ? 'crests stretched: lower' : 'no shift when still',
						color: 'var(--wav-a)'
					}
				]
	);
</script>

<g>
	<defs>
		<clipPath id="doppler-clip">
			<rect x="16" y={FY0} width="928" height={FY1 - FY0} rx="14" />
		</clipPath>
	</defs>
	<Card x={16} y={16} w={928} {cells} />

	<!-- ---- fronts ---- -->
	{#if oF > 0}
		<g opacity={oF} style:pointer-events="none">
			<rect
				x="16"
				y={FY0}
				width="928"
				height={FY1 - FY0}
				rx="14"
				fill="var(--sky)"
				stroke="var(--border)"
			/>
			<g clip-path="url(#doppler-clip)" opacity={loopFade}>
				{#each fronts as f (f.k)}
					<circle
						cx={f.x}
						cy={SY}
						r={f.r}
						fill="none"
						stroke="var(--wav-sum)"
						stroke-width="1.6"
						opacity={0.15 + 0.7 * f.o}
					/>
				{/each}
				<line x1="16" x2="944" y1={SY} y2={SY} stroke="var(--stage-line)" stroke-dasharray="3 5" />
				{#if brackets && vPx > 0}
					{@const [a1, a2] = brackets.ahead}
					{@const [b1, b2] = brackets.behind}
					<g transform="translate(0 {SY + 22})">
						<line
							x1={a1 - 2}
							x2={a2 + 2}
							y1="0"
							y2="0"
							stroke="var(--wav-b)"
							stroke-width="2"
							marker-start="url(#arrowhead)"
							marker-end="url(#arrowhead)"
						/>
						<line
							x1={b1 + 2}
							x2={b2 - 2}
							y1="0"
							y2="0"
							stroke="var(--wav-a)"
							stroke-width="2"
							marker-start="url(#arrowhead)"
							marker-end="url(#arrowhead)"
						/>
					</g>
					<text
						x={(a1 + a2) / 2}
						y={SY + 42}
						text-anchor="middle"
						class="halo"
						style:font-size="12px"
						style:fill="var(--wav-b)"
						font-weight="600">squeezed</text
					>
					<text
						x={(b1 + b2) / 2}
						y={SY + 42}
						text-anchor="middle"
						class="halo"
						style:font-size="12px"
						style:fill="var(--wav-a)"
						font-weight="600">stretched</text
					>
				{/if}
				<!-- the source -->
				<circle
					cx={srcX}
					cy={SY}
					r="11"
					fill="var(--wav-bead)"
					stroke="var(--stage-bg)"
					stroke-width="2.5"
				/>
				{#if vPx > 0}
					<line
						x1={srcX + 16}
						x2={srcX + 50}
						y1={SY - 22}
						y2={SY - 22}
						stroke="var(--wav-bead)"
						stroke-width="2"
						marker-end="url(#arrowhead)"
					/>
				{/if}
			</g>
			<!-- listeners -->
			{#each [{ x: 66, f: fBehind, l: 'behind', c: 'var(--wav-a)', a: 'start' as const }, { x: 894, f: fAhead, l: 'ahead', c: 'var(--wav-b)', a: 'end' as const }] as e (e.l)}
				<circle cx={e.x} cy={SY} r="9" fill="var(--surface)" stroke={e.c} stroke-width="2.5" />
				<text
					x={e.x + (e.a === 'start' ? -30 : 30)}
					y={SY + 70}
					text-anchor={e.a}
					class="halo"
					style:font-size="12px"
					style:fill={e.c}
					font-weight="600">listener {e.l}</text
				>
				<text
					x={e.x + (e.a === 'start' ? -30 : 30)}
					y={SY + 90}
					text-anchor={e.a}
					class="halo"
					style:font-size="15px"
					style:fill={e.c}
					font-weight="700">{fmt(e.f, 0)} Hz</text
				>
			{/each}
			<text x="32" y={FY1 - 14} class="muted halo" style:font-size="11px"
				>seen from above · crests drawn hugely slowed down; the speeds’ ratio is real</text
			>
		</g>
	{/if}

	<!-- ---- pass-by ---- -->
	{#if oP > 0}
		<g opacity={oP} style:pointer-events="none">
			<!-- road -->
			<rect
				x={RX0}
				y={RY - 20}
				width={RX1 - RX0}
				height="40"
				rx="6"
				fill="var(--stage-grid)"
				stroke="var(--stage-line)"
			/>
			<line x1={RX0} x2={RX1} y1={RY} y2={RY} stroke="var(--stage-line)" stroke-dasharray="14 12" />
			{#each [-60, -40, -20, 0, 20, 40, 60] as m (m)}
				<text x={rx(m)} y={RY - 28} text-anchor="middle" class="muted" style:font-size="11px"
					>{m === 0 ? '0 m' : `${m > 0 ? '+' : '−'}${Math.abs(m)}`}</text
				>
			{/each}
			<!-- the listener -->
			<line
				x1={LX}
				x2={LX}
				y1={RY + 20}
				y2={LY - 10}
				stroke="var(--stage-line)"
				stroke-dasharray="2 3"
			/>
			<text x={LX + 8} y={(RY + 20 + LY) / 2 + 4} class="muted" style:font-size="11px">10 m</text>
			<circle
				cx={LX}
				cy={LY}
				r="9"
				fill="var(--surface)"
				stroke="var(--stage-ink)"
				stroke-width="2.5"
			/>
			<text x={LX + 16} y={LY + 4} style:font-size="12px" font-weight="600">you</text>
			<!-- where the sound being heard was sent from -->
			{#if v > 0}
				{@const ex = rx(drive.heard.emitted * v)}
				<g opacity={drive.o}>
					<line
						x1={ex}
						y1={RY}
						x2={LX}
						y2={LY}
						stroke="var(--stage-ink-muted)"
						stroke-dasharray="3 4"
					/>
					<circle
						cx={ex}
						cy={RY}
						r="6"
						fill="none"
						stroke="var(--wav-bead)"
						stroke-dasharray="2 2"
					/>
				</g>
			{/if}
			<!-- the car -->
			<g opacity={drive.o}>
				<rect
					x={rx(drive.x) - 18}
					y={RY - 9}
					width="36"
					height="18"
					rx="6"
					fill="var(--wav-bead)"
					stroke="var(--stage-bg)"
					stroke-width="2"
				/>
			</g>

			<!-- plot -->
			{#each ticks as f (f)}
				<line x1={RX0} x2={RX1} y1={py(f)} y2={py(f)} stroke="var(--stage-grid)" />
				<text x={RX0 + 4} y={py(f) - 4} class="muted" style:font-size="11px"
					>{Math.round(f)} Hz</text
				>
			{/each}
			<line
				x1={RX0}
				x2={RX1}
				y1={py(F)}
				y2={py(F)}
				stroke="var(--stage-ink-muted)"
				stroke-dasharray="5 5"
			/>
			<text x={RX1} y={py(F) - 6} text-anchor="end" class="muted halo" style:font-size="11px"
				>the horn’s own 440 Hz</text
			>
			<path d={curve} fill="none" stroke="var(--wav-sum)" stroke-width="2.5" />
			<line
				x1={rx(drive.x)}
				x2={rx(drive.x)}
				y1={PY0 - 8}
				y2={PY1}
				stroke="var(--wav-bead)"
				opacity={0.5 * drive.o}
			/>
			<circle
				cx={rx(drive.x)}
				cy={py(drive.heard.f)}
				r="6"
				fill="var(--wav-bead)"
				opacity={drive.o}
			/>
			<line x1={RX0} x2={RX1} y1={PY1} y2={PY1} stroke="var(--stage-line)" />
			<text
				x={(RX0 + RX1) / 2}
				y={PY1 + 22}
				text-anchor="middle"
				class="muted"
				style:font-size="12px"
				>pitch you hear, against where the car is on the road (same scale as above)</text
			>
			<text x={RX0} y={PY0 - 14} style:font-size="13px" font-weight="600">What you hear</text>
		</g>
	{/if}
</g>
