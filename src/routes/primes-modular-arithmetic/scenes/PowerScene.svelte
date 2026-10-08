<script lang="ts">
	/**
	 * Powers of 2 on the 101-hour clock: quick forwards, slow backwards.
	 *
	 * Phases (`step.hints.phase`):
	 * - `fast`: square-and-multiply for 2ˣ mod 101, x = `params.exponent`. The ladder of
	 *   squares 2¹, 2², 2⁴, … (each reduced mod 101) builds up row by row; the rows picked
	 *   by the 1-bits of x are multiplied together; bars compare the multiplication count
	 *   with doing it one multiplication at a time.
	 * - `reverse`: 2ˣ mod 101 for x = 0 … 99 as a scatter (with the smooth curve of 2ˣ
	 *   without the clock for contrast), and a search trying x = 0, 1, 2, … until 2ˣ lands
	 *   on `params.target`. Loops.
	 *
	 * All values come from the model (`fastPower`, `discreteLog`, `slowPower`). Reduced
	 * motion shows the finished frame. Text uses `style:` (the stage CSS overrides
	 * presentation attributes).
	 */
	import { clamp, cycle } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { discreteLog, fastPower, slowPower, sup } from '../modular';

	let { step, t, params, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'fast'));
	const P = 101;
	const G = 2;

	// ---- fast --------------------------------------------------------------------------
	const x = $derived(clamp(Math.round(Number(params.exponent ?? 77)), 1, 1000));
	const fp = $derived(fastPower(G, x, P));
	const tv = $derived(reduced ? Infinity : t);
	const ROW = 0.45;
	const rowOn = (k: number) => clamp((tv - 0.4 - k * ROW) / 0.3, 0, 1);
	const ladderEnd = $derived(0.4 + fp.rungs.length * ROW + 0.2);
	const resultOn = $derived(clamp((tv - ladderEnd) / 0.4, 0, 1));
	const used = $derived(fp.rungs.filter((r) => r.used));
	const binary = $derived(x.toString(2));
	const RY = (k: number) => 138 + k * 40;
	const LX = 40;
	const PX = 560;
	const BAR_W = 330;
	const barScale = $derived(BAR_W / Math.max(fp.naive, 1));

	// ---- reverse -----------------------------------------------------------------------
	const target = $derived(clamp(Math.round(Number(params.target ?? 61)), 1, 100));
	const found = $derived(discreteLog(G, target, P));
	const pts = Array.from({ length: P - 1 }, (_, i) => ({ i, v: slowPower(G, i, P) }));
	const AX = { x0: 64, x1: 524, y0: 516, y1: 76 };
	const sx = (v: number) => AX.x0 + (v / 100) * (AX.x1 - AX.x0);
	const sy = (v: number) => AX.y0 - (v / 100) * (AX.y0 - AX.y1);
	const RATE = 14;
	const searchEnd = $derived(0.6 + (found.tries - 1) / RATE);
	const period = $derived(searchEnd + 6);
	const su = $derived(reduced ? Infinity : cycle(t, period) * period);
	/** Exponent being tried now (or the answer once found). */
	const trying = $derived(
		Math.min((found.x ?? 99) as number, Math.max(0, Math.floor((su - 0.6) * RATE)))
	);
	const searching = $derived(su >= 0.6);
	const hit = $derived(su >= searchEnd);
	const nTries = $derived(hit ? found.tries : searching ? trying + 1 : 0);
	const curve = (() => {
		let d = '';
		for (let i = 0; i <= 40; i++) {
			const v = (Math.log2(100) * i) / 40;
			d += `${i ? 'L' : 'M'}${sx(v).toFixed(1)} ${sy(2 ** v).toFixed(1)} `;
		}
		return d;
	})();
	const fwd = $derived(fastPower(G, Math.max(1, found.x ?? 1), P));
	const TICKS = [0, 20, 40, 60, 80, 100];
</script>

{#snippet txt(
	x: number,
	y: number,
	text: string,
	size: number,
	opts: {
		anchor?: string;
		color?: string;
		weight?: number;
		muted?: boolean;
		opacity?: number;
		halo?: boolean;
	} = {}
)}
	<text
		{x}
		{y}
		class:halo={opts.halo !== false}
		class:muted={opts.muted}
		text-anchor={opts.anchor ?? 'start'}
		font-weight={opts.weight ?? 500}
		opacity={opts.opacity ?? 1}
		style:font-size="{size}px"
		style:fill={opts.color}
		style:font-variant-numeric="tabular-nums">{text}</text
	>
{/snippet}

<g>
	{#if phase === 'fast'}
		<!-- the ladder of squares -->
		{@render txt(LX, 72, `2ˣ on a 101-hour clock, x = ${x} = ${binary}₂`, 18, { weight: 700 })}
		{@render txt(LX + 10, 108, 'square', 12, { muted: true, weight: 600 })}
		{@render txt(LX + 110, 108, '= row above, squared', 12, { muted: true, weight: 600 })}
		{@render txt(LX + 300, 108, 'mod 101', 12, { muted: true, weight: 600 })}
		{@render txt(LX + 400, 108, 'bit', 12, { muted: true, weight: 600, anchor: 'middle' })}
		{#each fp.rungs as r (r.k)}
			{@const on = rowOn(r.k)}
			{@const pick = r.used && resultOn > 0}
			<g opacity={on}>
				{#if pick}
					<rect
						x={LX - 4}
						y={RY(r.k) - 23}
						width="430"
						height="34"
						rx="8"
						fill="var(--pm-walk)"
						fill-opacity={0.16 * resultOn}
						stroke="var(--pm-walk)"
						stroke-opacity={resultOn}
					/>
				{/if}
				{@render txt(LX + 10, RY(r.k), `2${sup(r.power)}`, 17, { weight: 700, halo: false })}
				{@render txt(
					LX + 110,
					RY(r.k),
					r.k === 0 ? '= 2' : `= ${fp.rungs[r.k - 1].value}² = ${r.raw}`,
					15,
					{ halo: false }
				)}
				{@render txt(LX + 300, RY(r.k), `≡ ${r.value}`, 17, {
					weight: 700,
					color: 'var(--pm-walk)',
					halo: false
				})}
				{@render txt(LX + 400, RY(r.k), r.used ? '1' : '0', 16, {
					anchor: 'middle',
					weight: 700,
					color: r.used ? 'var(--pm-walk)' : undefined,
					muted: !r.used,
					halo: false
				})}
			</g>
		{/each}

		<!-- the product and the counts -->
		<g opacity={resultOn}>
			{@render txt(
				PX,
				140,
				`${x} = ${used
					.map((r) => r.power)
					.reverse()
					.join(' + ')}`,
				15,
				{ weight: 600 }
			)}
			{@render txt(PX, 172, `2${sup(x)} = ${used.map((r) => `2${sup(r.power)}`).join(' × ')}`, 15)}
			{@render txt(PX, 198, `≡ ${used.map((r) => r.value).join(' × ')}`, 15)}
			{@render txt(PX, 236, `2${sup(x)} ≡ ${fp.result}  (mod 101)`, 24, {
				weight: 700,
				color: 'var(--pm-walk)'
			})}
			{@render txt(PX, 262, 'remainder taken after every multiplication', 12, { muted: true })}

			{@render txt(PX, 318, 'Multiplications needed', 14, { weight: 700 })}
			{@render txt(PX, 346, `one at a time: ${fp.naive}`, 13)}
			<rect
				x={PX}
				y={354}
				width={Math.max(2, fp.naive * barScale)}
				height="16"
				rx="4"
				fill="var(--pm-bad)"
				fill-opacity="0.75"
			/>
			{@render txt(
				PX,
				396,
				`square-and-multiply: ${fp.squarings} squarings + ${fp.multiplications} products = ${fp.total}`,
				13
			)}
			<rect
				x={PX}
				y={404}
				width={Math.max(2, fp.total * barScale)}
				height="16"
				rx="4"
				fill="var(--pm-ok)"
			/>
			{@render txt(PX, 456, 'Doubling x adds just one more squaring.', 13, { muted: true })}
		</g>
	{:else}
		<!-- axes -->
		{#each TICKS as v (v)}
			<line x1={AX.x0} x2={AX.x1} y1={sy(v)} y2={sy(v)} stroke="var(--stage-grid)" />
			{@render txt(AX.x0 - 8, sy(v) + 4, String(v), 11, { anchor: 'end', muted: true })}
			{@render txt(sx(v), AX.y0 + 20, String(v), 11, { anchor: 'middle', muted: true })}
		{/each}
		<line x1={AX.x0} x2={AX.x0} y1={AX.y0} y2={AX.y1} stroke="var(--stage-line)" />
		<line x1={AX.x0} x2={AX.x1} y1={AX.y0} y2={AX.y0} stroke="var(--stage-line)" />
		{@render txt((AX.x0 + AX.x1) / 2, AX.y0 + 44, 'exponent x', 13, {
			anchor: 'middle',
			weight: 600
		})}
		{@render txt(AX.x0 - 40, AX.y1 - 24, '2ˣ mod 101', 13, { weight: 600 })}

		<!-- 2^x without the clock: smooth and rising -->
		<path
			d={curve}
			fill="none"
			stroke="var(--stage-ink-muted)"
			stroke-width="2"
			stroke-dasharray="5 4"
		/>
		{@render txt(sx(7.5), AX.y1 - 6, '2ˣ without the clock', 12, { muted: true })}

		<!-- target line -->
		<line
			x1={AX.x0}
			x2={AX.x1}
			y1={sy(target)}
			y2={sy(target)}
			stroke="var(--pm-p5)"
			stroke-width="1.5"
			stroke-dasharray="6 4"
		/>
		{@render txt(AX.x1 + 6, sy(target) + 4, String(target), 13, {
			weight: 700,
			color: 'var(--pm-p5)'
		})}

		<!-- scan line -->
		{#if searching && !hit}
			<line
				x1={sx(trying)}
				x2={sx(trying)}
				y1={AX.y0}
				y2={AX.y1}
				stroke="var(--pm-walk)"
				stroke-width="1.5"
				opacity="0.5"
			/>
		{/if}

		<!-- the powers -->
		{#each pts as p (p.i)}
			{@const tried = searching && p.i <= trying}
			<circle
				cx={sx(p.i)}
				cy={sy(p.v)}
				r={tried ? 4 : 3.2}
				fill={tried ? 'var(--pm-walk)' : 'var(--stage-ink-muted)'}
				opacity={tried ? 0.9 : 0.45}
			/>
		{/each}
		{#if hit && found.x !== null}
			<circle
				cx={sx(found.x)}
				cy={sy(target)}
				r="10"
				fill="none"
				stroke="var(--pm-p5)"
				stroke-width="3"
			/>
			{@render txt(sx(found.x), sy(target) - 16, `x = ${found.x}`, 14, {
				anchor: 'middle',
				weight: 700,
				color: 'var(--pm-p5)'
			})}
		{:else if searching}
			{@const v = slowPower(G, trying, P)}
			<circle
				cx={sx(trying)}
				cy={sy(v)}
				r="7"
				fill="none"
				stroke="var(--pm-walk)"
				stroke-width="2"
			/>
		{/if}

		<!-- panel -->
		{@render txt(PX + 20, 92, `Find x with 2ˣ ≡ ${target} (mod 101)`, 18, { weight: 700 })}
		{@render txt(PX + 20, 116, 'No pattern to follow: try x = 0, 1, 2, …', 13, { muted: true })}
		{@render txt(
			PX + 20,
			160,
			hit
				? `Found: 2${sup(found.x ?? 0)} ≡ ${target}`
				: searching
					? `Trying x = ${trying}: 2${sup(trying)} ≡ ${slowPower(G, trying, P)}`
					: 'Trying x = 0, 1, 2, …',
			17,
			{ weight: 600, color: hit ? 'var(--pm-p5)' : undefined }
		)}
		{@render txt(PX + 20, 210, 'Backwards, by trying', 14, { weight: 700 })}
		{@render txt(PX + 20, 232, `${nTries} ${nTries === 1 ? 'try' : 'tries'}`, 22, {
			weight: 700,
			color: 'var(--pm-bad)'
		})}
		{@render txt(PX + 20, 280, 'Forwards, by square-and-multiply', 14, { weight: 700 })}
		{@render txt(PX + 20, 302, `${fwd.total} multiplication${fwd.total === 1 ? '' : 's'}`, 22, {
			weight: 700,
			color: 'var(--pm-ok)'
		})}
		<rect
			x={PX + 20}
			y={344}
			width="340"
			height="128"
			rx="10"
			fill="var(--surface)"
			stroke="var(--border)"
		/>
		{@render txt(PX + 36, 370, 'With a 617-digit prime instead of 101:', 13, { weight: 700 })}
		{@render txt(PX + 36, 396, 'forwards: at most 4,094 multiplications', 13)}
		{@render txt(PX + 36, 418, 'backwards by trying: up to about 10⁶¹⁶ tries', 13)}
		{@render txt(PX + 36, 446, 'Cleverer methods exist, but none is known', 12, { muted: true })}
		{@render txt(PX + 36, 462, 'that makes it anywhere near feasible.', 12, { muted: true })}
	{/if}
</g>
