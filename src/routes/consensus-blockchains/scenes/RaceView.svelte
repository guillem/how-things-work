<script lang="ts">
	/**
	 * The double-spend race (`race`): each new block is the attacker's with probability q.
	 * Top: the public chain (with the payment to the shop) and the attacker's secret chain (with
	 * the same coins paid to himself), one block every STEP seconds; the shop hands over the
	 * goods once the public chain has z blocks; the race ends when the attacker catches up or
	 * falls GIVE_UP blocks behind. Bottom: the probability that he ever catches up, against z,
	 * from Nakamoto's formula and the exact one. Loops; reduced motion shows the finished race.
	 */
	import { clamp, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type Params } from '#lib/explainer/index.ts';
	import { confirmationsFor, exactRace, nakamoto, race } from '../consensus';
	import Txt from './Txt.svelte';

	interface Props {
		t: number;
		params: Params;
		reduced: boolean;
	}
	let { t, params, reduced }: Props = $props();

	const q = $derived(clamp(Number(params.q ?? 30), 5, 50) / 100);
	const z = $derived(clamp(Math.round(Number(params.z ?? 6)), 0, 12));
	const seed = $derived(1 + Number(params.rerace ?? 0));
	const GIVE_UP = 6;
	const run = $derived(race(q, z, seed, GIVE_UP, 40));

	const STEP = 0.7;
	const START = 0.8;
	const period = $derived(START + run.seq.length * STEP + 4.5);
	let lastKey = '';
	let t0 = 0;
	const s = $derived.by(() => {
		const key = `${q}|${z}|${seed}`;
		if (key !== lastKey) {
			t0 = lastKey === '' ? 0 : t;
			lastKey = key;
		}
		if (t < t0) t0 = 0;
		if (reduced) return 1e6;
		return (t - t0) % period;
	});
	const fade = $derived(reduced ? 1 : 1 - smoothstep(period - 0.5, period - 0.05, s));
	/** How many blocks of the race have been found by time s. */
	const k = $derived(clamp(Math.floor((s - START) / STEP) + 1, 0, run.seq.length));
	const blocks = $derived.by(() => {
		let h = 0;
		let a = 0;
		return run.seq.slice(0, k).map((who, i) => {
			if (who === 'h') h++;
			else a++;
			return { who, n: who === 'h' ? h : a, i };
		});
	});
	const h = $derived(blocks.filter((b) => b.who === 'h').length);
	const a = $derived(blocks.length - h);
	const accepted = $derived(z === 0 || h >= z);
	const over = $derived(k >= run.seq.length);

	// ---- layout ---------------------------------------------------------------------------------
	const ROW = { honest: 150, attacker: 236 };
	const BX = 112;
	const COL = 48;
	const VISIBLE = 16;
	const scroll = $derived(Math.max(0, Math.max(h, a) - VISIBLE));
	const x = (n: number) => BX + (n - scroll) * COL;
	const pctText = (p: number) =>
		p >= 0.995
			? '100 %'
			: p >= 0.001
				? `${(p * 100).toFixed(p >= 0.1 ? 0 : 1)} %`
				: `${(p * 100).toPrecision(2)} %`;
	const behindChance = $derived(Math.pow(q / (1 - q), GIVE_UP));

	const outcome = $derived(
		!over
			? ''
			: run.outcome === 'caught-up'
				? 'The secret chain caught up: the attacker publishes it, and the payment to the shop vanishes'
				: run.outcome === 'gave-up'
					? `The attacker is ${GIVE_UP} blocks behind and gives up (his chance from there: ${pctText(behindChance)})`
					: 'Still racing after 40 blocks'
	);

	// ---- chart ------------------------------------------------------------------------------------
	const CH = { x0: 110, x1: 560, y0: 548, y1: 352 };
	const LOGMIN = -8;
	const cx = (zz: number) => CH.x0 + ((CH.x1 - CH.x0) * zz) / 12;
	const cy = (p: number) =>
		CH.y1 + ((CH.y0 - CH.y1) * Math.min(-Math.log10(Math.max(p, 1e-9)), -LOGMIN)) / -LOGMIN;
	const zs = Array.from({ length: 13 }, (_, i) => i);
	const nak = $derived(zs.map((zz) => nakamoto(q, zz)));
	const exact = $derived(zs.map((zz) => exactRace(q, zz)));
	const line = (ps: number[]) =>
		ps.map((p, i) => `${i === 0 ? 'M' : 'L'}${cx(i)} ${cy(p)}`).join(' ');
	const needed = $derived(confirmationsFor(q));
</script>

<g opacity={fade}>
	<Readout
		id="title"
		order={1}
		label="Attacker"
		value="{Math.round(q * 100)} % of the power · shop waits {z} blocks"
	>
		<Txt
			x={24}
			y={36}
			text="An attacker with {Math.round(
				q * 100
			)} % of the computing power; the shop waits for {z} block{z === 1 ? '' : 's'}"
			size={16}
			weight={700}
		/>
	</Readout>

	<!-- the two chains -->
	<rect
		x={BX - 92}
		y={(ROW.honest + ROW.attacker) / 2 - 15}
		width="64"
		height="30"
		rx="5"
		fill="var(--stage-ink-muted)"
	/>
	<Txt
		x={BX - 60}
		y={(ROW.honest + ROW.attacker) / 2 + 4}
		text="before"
		size={11}
		anchor="middle"
		halo={false}
		color="var(--surface)"
	/>
	<Readout
		id="rows"
		order={2}
		label="Block 1"
		value="public: pays the shop · secret: pays the attacker"
	>
		<Txt
			x={BX - 20}
			y={ROW.honest - 28}
			text="public chain (all honest miners): its block 1 pays the shop"
			size={12}
			weight={700}
			color="var(--cb-honest)"
		/>
		<Txt
			x={BX - 20}
			y={ROW.attacker + 40}
			text="attacker’s secret chain: its block 1 pays the same coins back to him"
			size={12}
			weight={700}
			color="var(--cb-attacker)"
		/>
	</Readout>
	{#each ['honest', 'attacker'] as row (row)}
		<path
			d="M{BX - 28} {(ROW.honest + ROW.attacker) / 2} C{BX - 10} {(ROW.honest + ROW.attacker) /
				2}, {BX - 30} {row === 'honest' ? ROW.honest : ROW.attacker}, {x(1) - 20} {row === 'honest'
				? ROW.honest
				: ROW.attacker}"
			fill="none"
			stroke="var(--stage-line)"
			stroke-width="1.5"
		/>
	{/each}
	<clipPath id="race-clip"
		><rect
			x={BX - 24}
			y={ROW.honest - 60}
			width={VISIBLE * COL + 40}
			height={ROW.attacker - ROW.honest + 110}
		/></clipPath
	>
	<g clip-path="url(#race-clip)">
		{#each blocks as b (b.i)}
			{@const y = b.who === 'h' ? ROW.honest : ROW.attacker}
			{@const appear = reduced
				? 1
				: smoothstep(START + b.i * STEP - STEP, START + b.i * STEP - STEP + 0.25, s)}
			<g opacity={appear}>
				{#if b.n > 1}
					<line
						x1={x(b.n - 1) + 18}
						x2={x(b.n) - 18}
						y1={y}
						y2={y}
						stroke="var(--stage-line)"
						stroke-width="1.5"
					/>
				{/if}
				<rect
					x={x(b.n) - 18}
					y={y - 15}
					width="36"
					height="30"
					rx="5"
					fill={b.who === 'h' ? 'var(--cb-honest)' : 'var(--cb-attacker)'}
				/>
				<text
					x={x(b.n)}
					y={y + 5}
					text-anchor="middle"
					style:font-size="12px"
					style:font-weight="700"
					style:fill="white">{b.n}</text
				>
			</g>
		{/each}
	</g>

	<!-- the shop's moment -->
	{#if accepted}
		{@const sx = z === 0 ? BX - 24 : x(z) + 24}
		<line
			x1={sx}
			x2={sx}
			y1={ROW.honest - 20}
			y2={ROW.attacker + 20}
			stroke="var(--cb-work)"
			stroke-width="2"
			stroke-dasharray="5 4"
		/>
		<Readout
			id="shop"
			order={3}
			label="Shop"
			value="hands over the goods after {z} block{z === 1 ? '' : 's'}"
			color="var(--cb-work)"
		>
			<Txt
				x={sx + 6}
				y={(ROW.honest + ROW.attacker) / 2 + 4}
				text="shop hands over the goods"
				size={12}
				weight={700}
				color="var(--cb-work)"
			/>
		</Readout>
	{/if}

	<Readout id="count" order={4} label="Race" value="public {h} · secret {a}">
		<Txt x={24} y={ROW.attacker + 72} text="public {h} · secret {a}" size={13} weight={700} />
	</Readout>
	{#if outcome}
		<Readout
			id="outcome"
			order={5}
			label="Outcome"
			value={outcome}
			color={run.outcome === 'caught-up' ? 'var(--cb-bad)' : 'var(--cb-ok)'}
		>
			<Txt
				x={190}
				y={ROW.attacker + 72}
				text={outcome}
				size={13}
				weight={700}
				color={run.outcome === 'caught-up' ? 'var(--cb-bad)' : 'var(--cb-ok)'}
			/>
		</Readout>
	{/if}

	<!-- chart -->
	<Readout id="chart-title">
		<Txt
			x={CH.x0}
			y={CH.y1 - 18}
			text="Chance the attacker ever catches up, against the blocks the shop waits for"
			size={12}
			weight={700}
		/>
	</Readout>
	{#each [0, -2, -4, -6, -8] as e (e)}
		<line x1={CH.x0} x2={CH.x1} y1={cy(10 ** e)} y2={cy(10 ** e)} stroke="var(--stage-grid)" />
		<Txt
			x={CH.x0 - 8}
			y={cy(10 ** e) + 4}
			text={['100 %', '1 %', '0.01 %', '0.0001 %', '≤ 10⁻⁶ %'][-e / 2]}
			size={11}
			anchor="end"
			muted
		/>
	{/each}
	{#each zs as zz (zz)}
		<Txt x={cx(zz)} y={CH.y0 + 18} text={String(zz)} size={11} anchor="middle" muted />
	{/each}
	<path
		d={line(exact)}
		fill="none"
		stroke="var(--cb-attacker)"
		stroke-width="1.5"
		stroke-dasharray="5 4"
	/>
	<path d={line(nak)} fill="none" stroke="var(--cb-attacker)" stroke-width="2.5" />
	{#each nak as p, i (i)}
		<circle
			cx={cx(i)}
			cy={cy(p)}
			r={i === z ? 7 : 3.5}
			fill={i === z ? 'var(--cb-attacker)' : 'var(--surface)'}
			stroke="var(--cb-attacker)"
			stroke-width="2"
		/>
	{/each}

	<Readout
		id="p"
		order={6}
		label="Nakamoto 2008"
		value="{pctText(nak[z])} chance at z = {z}"
		color="var(--cb-attacker)"
	>
		<Txt
			x={600}
			y={384}
			text="At z = {z}: {pctText(nak[z])}"
			size={16}
			weight={700}
			color="var(--cb-attacker)"
		/>
		<Txt x={600} y={406} text="Nakamoto’s formula (solid line)" size={12} muted />
	</Readout>
	<Readout id="p-exact" order={7} label="Exact" value={pctText(exact[z])}>
		<Txt x={600} y={436} text="exact value: {pctText(exact[z])} (dashed)" size={12} />
	</Readout>
	<Readout
		id="need"
		order={8}
		label="Below 0.1 %"
		value={Number.isFinite(needed) ? `${needed} blocks` : 'never'}
	>
		<Txt
			x={600}
			y={470}
			text={q >= 0.5
				? 'With half the power or more, he always catches up.'
				: `Risk below 0.1 % after ${needed} block${needed === 1 ? '' : 's'}.`}
			size={13}
			weight={600}
			color={q >= 0.5 ? 'var(--cb-bad)' : undefined}
		/>
	</Readout>
</g>
