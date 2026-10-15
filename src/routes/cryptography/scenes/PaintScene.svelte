<script lang="ts">
	/**
	 * The paint-mixing key exchange. Alice on the left, Bob on the right, the public common
	 * paint and Eve in the middle. Each side reads as two equations: row 1 "yellow + secret =
	 * mixture (sent)", row 2 "received + secret = shared colour" (mirrored on Alice's side, so
	 * that the mixtures sent and received sit next to the middle). The two mixtures cross in an
	 * X over Eve, who keeps a copy of each.
	 *
	 * Phases (`step.hints.phase`):
	 * - `secrets`: the common paint is copied to both sides; each side's secret appears.
	 * - `swap`: each side mixes and sends; copies cross to the other side and to Eve. Loops.
	 * - `final`: each adds its secret to what arrived; the two shared colours match; Eve's pour
	 *   of the two mixtures she saw does not.
	 *
	 * Colours come from the model's mixing (`paintExchange`, `mixHex`). Secrets are the select
	 * controls `alicePaint` and `bobPaint`. Reduced motion shows the finished state of the step.
	 */
	import { clamp, cycle, Label, lerp, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { PAINTS, mixHex, paintExchange, type PaintId } from '../crypto';
	import Person from './Person.svelte';

	let { step, t, params, reduced }: StageProps = $props();
	const phase = $derived(String(step.hints?.phase ?? 'secrets'));

	const paintOf = (v: unknown, fallback: PaintId): PaintId =>
		typeof v === 'string' && v in PAINTS && v !== 'yellow' ? (v as PaintId) : fallback;
	const alice = $derived(paintOf(params.alicePaint, 'red'));
	const bob = $derived(paintOf(params.bobPaint, 'blue'));
	const x = $derived(paintExchange('yellow', alice, bob));
	const col = $derived({
		yellow: PAINTS.yellow.hex,
		alice: PAINTS[alice].hex,
		bob: PAINTS[bob].hex,
		aliceSends: mixHex(x.aliceSends),
		bobSends: mixHex(x.bobSends),
		aliceShared: mixHex(x.aliceFinal),
		bobShared: mixHex(x.bobFinal),
		eve: mixHex(x.eve)
	});

	// ---- layout ---------------------------------------------------------------------------
	const R1 = 206; // row 1: mix and send
	const R2 = 440; // row 2: add the secret to what arrived
	const R = 26;
	/** Swatch x positions on Alice's side; Bob's mirror them (960 − x). */
	const OUT = 110;
	const MID = 190;
	const IN = 280;
	const mirror = (v: number) => 960 - v;
	const COMMON = { x: 480, y: 112 };
	const EVE = { x: 480, y: 384 };
	const CARD = { x: 330, y: 470, w: 300, h: 104 };

	// ---- timing -----------------------------------------------------------------------------
	const SWAP_PERIOD = 8;
	const tv = $derived(reduced ? 1e6 : phase === 'swap' ? cycle(t, SWAP_PERIOD) * SWAP_PERIOD : t);
	const copyIn = $derived(phase === 'secrets' ? smoothstep(0.3, 1.5, tv) : 1);
	const secretOn = $derived(phase === 'secrets' ? smoothstep(1.4, 2.0, tv) : 1);
	const mixOn = $derived(phase === 'swap' ? smoothstep(0.4, 1.2, tv) : phase === 'final' ? 1 : 0);
	const travelU = $derived(phase === 'swap' ? clamp((tv - 1.6) / 2.2) : phase === 'final' ? 1 : 0);
	const arrived = $derived(travelU >= 1);
	const eveSaw = $derived(phase === 'swap' ? smoothstep(2.6, 3.0, tv) : phase === 'final' ? 1 : 0);
	const finalOn = $derived(phase === 'final' ? smoothstep(0.4, 1.2, tv) : 0);
	const matchOn = $derived(phase === 'final' ? smoothstep(1.4, 1.9, tv) : 0);
	const eveOn = $derived(phase === 'final' ? smoothstep(2.0, 2.6, tv) : 0);
	const row1Dim = $derived(phase === 'final' ? 0.5 : 1);

	/** The two crossing paths: Alice's mixture to Bob's "received" slot and vice versa. */
	const fromA = { x: IN, y: R1 };
	const toB = { x: mirror(IN), y: R2 };
	const fromB = { x: mirror(IN), y: R1 };
	const toA = { x: IN, y: R2 };
	const at = (a: { x: number; y: number }, b: { x: number; y: number }, u: number) => ({
		x: lerp(a.x, b.x, u),
		y: lerp(a.y, b.y, u)
	});
	const pA = $derived(at(fromA, toB, travelU));
	const pB = $derived(at(fromB, toA, travelU));
	const SIDES = ['alice', 'bob'] as const;
	const sideX = (s: 'alice' | 'bob', v: number) => (s === 'alice' ? v : mirror(v));
</script>

{#snippet swatch(cx: number, cy: number, fill: string, r = R, scale = 1)}
	{#if scale > 0}
		<circle {cx} {cy} r={r * scale} {fill} stroke="var(--stage-line)" stroke-width="1.5" />
	{/if}
{/snippet}

{#snippet lock(cx: number, cy: number)}
	<g transform="translate({cx} {cy})">
		<path
			d="M-5 -2 V-6 a5 5 0 0 1 10 0 V-2"
			fill="none"
			stroke="var(--stage-ink)"
			stroke-width="2"
		/>
		<rect x="-8" y="-3" width="16" height="12" rx="2.5" fill="var(--stage-ink)" />
	</g>
{/snippet}

{#snippet sign(cx: number, cy: number, s: string, opacity = 1)}
	<Label
		tabular
		x={cx}
		y={cy + 7}
		text={s}
		size={22}
		weight={600}
		anchor="middle"
		muted
		{opacity}
	/>
{/snippet}

<g>
	<Person x={70} y={70} name="Alice" color="var(--cr-alice)" />
	<Person x={890} y={70} name="Bob" color="var(--cr-bob)" />

	<!-- the common paint, public -->
	{@render swatch(COMMON.x, COMMON.y, col.yellow, 30)}
	<!-- <Readout>: on narrow screens these are hidden or listed as HTML under the stage -->
	<Readout id="common">
		<Label
			x={COMMON.x}
			y={COMMON.y - 42}
			text="common paint: public"
			size={13}
			weight={700}
			anchor="middle"
		/>
		{#snippet narrow()}
			<Label x={COMMON.x} y={COMMON.y - 46} text="public" size={26} weight={700} anchor="middle" />
		{/snippet}
	</Readout>
	{#each [OUT, mirror(OUT)] as tx (tx)}
		{@const side = tx < 480 ? -1 : 1}
		<path
			d="M{COMMON.x + side * 34} {COMMON.y} Q{tx} {COMMON.y} {tx} {R1 - R - 8}"
			fill="none"
			stroke="var(--stage-line)"
			stroke-width="1.5"
			stroke-dasharray="4 4"
			marker-end="url(#arrowhead)"
		/>
	{/each}

	<!-- the crossing: the mixtures travel over Eve -->
	{#if travelU > 0}
		<line
			x1={fromA.x}
			y1={fromA.y}
			x2={toB.x}
			y2={toB.y}
			stroke="var(--stage-line)"
			stroke-width="1.5"
			stroke-dasharray="3 5"
		/>
		<line
			x1={fromB.x}
			y1={fromB.y}
			x2={toA.x}
			y2={toA.y}
			stroke="var(--stage-line)"
			stroke-width="1.5"
			stroke-dasharray="3 5"
		/>
	{/if}

	<!-- row 1 on both sides: yellow + secret = mixture sent -->
	{#each SIDES as s (s)}
		{@const X = (v: number) => sideX(s, v)}
		<g opacity={row1Dim}>
			{@render swatch(X(OUT), R1, col.yellow, R, copyIn)}
			<Readout id="yellow-{s}">
				<Label x={X(OUT)} y={R1 + 46} text="yellow" size={11} anchor="middle" muted />
			</Readout>
			{@render sign((X(OUT) + X(MID)) / 2, R1, '+', secretOn)}
			<g opacity={secretOn}>
				{@render swatch(X(MID), R1, col[s])}
				{@render lock(X(MID) + 22, R1 - 22)}
				<Readout
					id="secret-{s}"
					order={s === 'alice' ? 1 : 2}
					label={s === 'alice' ? 'Alice’s secret' : 'Bob’s secret'}
					value={PAINTS[s === 'alice' ? alice : bob].name}
					color={col[s]}
					opacity={secretOn}
				>
					<Label
						tabular
						x={X(MID)}
						y={R1 + 46}
						text="{PAINTS[s === 'alice' ? alice : bob].name}: secret"
						size={11}
						anchor="middle"
						muted
					/>
					{#snippet narrow()}
						<Label x={X(MID)} y={R1 + 58} text="secret" size={22} anchor="middle" muted />
					{/snippet}
				</Readout>
			</g>
			{#if mixOn > 0}
				{@render sign((X(MID) + X(IN)) / 2, R1, '=', mixOn)}
				{@render swatch(X(IN), R1, s === 'alice' ? col.aliceSends : col.bobSends, R, mixOn)}
				<Readout id="sent-{s}">
					<Label
						x={X(IN)}
						y={R1 + 46}
						text="sent"
						size={11}
						weight={700}
						anchor="middle"
						opacity={mixOn}
					/>
					{#snippet narrow()}
						<Label
							x={X(IN)}
							y={R1 + 58}
							text="sent"
							size={22}
							weight={700}
							anchor="middle"
							opacity={mixOn}
						/>
					{/snippet}
				</Readout>
			{/if}
		</g>
	{/each}

	<Person x={EVE.x} y={EVE.y} name="Eve" color="var(--cr-eve)" role="sees everything sent" />

	<!-- row 2: received + secret = shared colour -->
	{#if phase !== 'secrets'}
		{#each SIDES as s (s)}
			{@const X = (v: number) => sideX(s, v)}
			{#if arrived}
				{@render swatch(X(IN), R2, s === 'alice' ? col.bobSends : col.aliceSends)}
				<Readout id="received-{s}">
					<Label x={X(IN)} y={R2 + 46} text="received" size={11} anchor="middle" muted />
				</Readout>
			{/if}
			{#if phase === 'final'}
				<Readout id="add-{s}">
					<Label
						x={X(MID)}
						y={R2 - 56}
						text="add the secret to what arrived"
						size={12}
						weight={600}
						anchor="middle"
						muted
					/>
				</Readout>
				{@render sign((X(MID) + X(IN)) / 2, R2, '+')}
				{@render swatch(X(MID), R2, col[s])}
				{@render lock(X(MID) + 22, R2 - 22)}
				<Readout id="name2-{s}">
					<Label
						tabular
						x={X(MID)}
						y={R2 + 46}
						text={PAINTS[s === 'alice' ? alice : bob].name}
						size={11}
						anchor="middle"
						muted
					/>
				</Readout>
				{@render sign((X(OUT) + X(MID)) / 2, R2, '=', finalOn)}
				{#if matchOn > 0}
					<circle
						cx={X(OUT)}
						cy={R2}
						r={R + 7}
						fill="none"
						stroke="var(--cr-key)"
						stroke-width="3"
						opacity={matchOn}
					/>
				{/if}
				{@render swatch(X(OUT), R2, s === 'alice' ? col.aliceShared : col.bobShared, R, finalOn)}
				<Readout
					id="shared-{s}"
					order={3}
					label={s === 'alice' ? 'Shared secret' : undefined}
					value="the same colour on both sides"
					color="var(--cr-key)"
					opacity={matchOn}
				>
					<Label
						x={X(OUT)}
						y={R2 + 52}
						text="shared secret"
						size={12}
						weight={700}
						anchor="middle"
						color="var(--cr-key)"
						opacity={matchOn}
					/>
					{#snippet narrow()}
						<Label
							x={X(OUT)}
							y={R2 + 62}
							text="shared"
							size={22}
							weight={700}
							anchor="middle"
							color="var(--cr-key)"
							opacity={matchOn}
						/>
					{/snippet}
				</Readout>
			{/if}
		{/each}
	{/if}

	<!-- mixtures in flight -->
	{#if travelU > 0 && travelU < 1}
		{@render swatch(pA.x, pA.y, col.aliceSends, 20)}
		{@render swatch(pB.x, pB.y, col.bobSends, 20)}
	{/if}

	<!-- Eve's card -->
	{#if phase !== 'secrets'}
		<g opacity={eveSaw}>
			<rect
				x={CARD.x}
				y={CARD.y}
				width={CARD.w}
				height={CARD.h}
				rx="10"
				fill="var(--surface)"
				stroke="var(--cr-eve)"
				stroke-opacity="0.6"
			/>
			<Readout id="eve-saw-title">
				<Label
					anchor="start"
					x={CARD.x + 16}
					y={CARD.y + 32}
					text="Eve saw:"
					size={13}
					weight={700}
					color="var(--cr-eve)"
					halo={false}
				/>
				{#snippet narrow()}
					<Label
						anchor="start"
						x={CARD.x + 16}
						y={CARD.y + 36}
						text="Eve saw"
						size={22}
						weight={700}
						color="var(--cr-eve)"
						halo={false}
					/>
				{/snippet}
			</Readout>
			{@render swatch(CARD.x + 130, CARD.y + 27, col.yellow, 14)}
			{@render swatch(CARD.x + 170, CARD.y + 27, col.aliceSends, 14)}
			{@render swatch(CARD.x + 210, CARD.y + 27, col.bobSends, 14)}
			{#if phase === 'final'}
				<g opacity={eveOn}>
					<Readout
						id="eve-pour"
						order={4}
						label="Eve’s best pour"
						value="≠ the shared colour"
						note="too much yellow"
						color="var(--cr-bad)"
						opacity={eveOn}
					>
						<Label
							anchor="start"
							x={CARD.x + 16}
							y={CARD.y + 80}
							text="Her best pour:"
							size={13}
							weight={700}
							color="var(--cr-eve)"
							halo={false}
						/>
						{#snippet narrow()}
							<Label
								anchor="start"
								x={CARD.x + 16}
								y={CARD.y + 84}
								text="her pour"
								size={22}
								weight={700}
								color="var(--cr-eve)"
								halo={false}
							/>
						{/snippet}
					</Readout>
					{@render swatch(CARD.x + 140, CARD.y + 75, col.eve, 18)}
					<Label
						x={CARD.x + 177}
						y={CARD.y + 83}
						text="≠"
						size={24}
						weight={700}
						anchor="middle"
						color="var(--cr-bad)"
						halo={false}
					/>
					{@render swatch(CARD.x + 214, CARD.y + 75, col.aliceShared, 18)}
					<Readout id="too-much">
						<Label
							anchor="start"
							x={CARD.x + 242}
							y={CARD.y + 72}
							text="too much"
							size={11}
							muted
							halo={false}
						/>
						<Label
							anchor="start"
							x={CARD.x + 242}
							y={CARD.y + 86}
							text="yellow"
							size={11}
							muted
							halo={false}
						/>
					</Readout>
				</g>
			{:else}
				<Readout
					id="eve-saw"
					order={4}
					label="Eve saw"
					value="the yellow and both mixtures"
					note="To find a secret she would have to take the yellow back out. She can’t."
					color="var(--cr-eve)"
				>
					<Label
						anchor="start"
						x={CARD.x + 16}
						y={CARD.y + 66}
						text="To find a secret she would have to"
						size={12}
						muted
						halo={false}
					/>
					<Label
						anchor="start"
						x={CARD.x + 16}
						y={CARD.y + 84}
						text="take the yellow back out. She can’t."
						size={12}
						muted
						halo={false}
					/>
				</Readout>
			{/if}
		</g>
	{:else}
		<Readout
			id="one-way"
			order={0}
			label="Mixing paint is easy"
			value="unmixing it: practically impossible"
		>
			<rect
				x={CARD.x}
				y={CARD.y}
				width={CARD.w}
				height={CARD.h}
				rx="10"
				fill="var(--surface)"
				stroke="var(--border)"
			/>
			<Label
				x={480}
				y={CARD.y + 42}
				text="Mixing paint is easy."
				size={15}
				weight={700}
				anchor="middle"
				halo={false}
			/>
			<Label
				x={480}
				y={CARD.y + 72}
				text="Unmixing it is practically impossible."
				size={15}
				weight={700}
				anchor="middle"
				halo={false}
			/>
		</Readout>
	{/if}
</g>
