<script lang="ts">
	/**
	 * Diffie–Hellman on the 101-hour clock. Alice's card on the left, Bob's on the right, the
	 * public numbers at the top, the open channel between the cards and Eve below it with
	 * her notebook.
	 *
	 * Phases (`step.hints.phase`):
	 * - `public`: each secret appears, each side computes g^secret mod p (with the number of
	 *   multiplications square-and-multiply needs) and sends it; Eve copies both.
	 * - `shared`: each raises what it received to its own secret: the two keys agree, and a
	 *   banner shows why ((2ᵇ)ᵃ = (2ᵃ)ᵇ).
	 *
	 * Numbers come from the model (`diffieHellman`, `fastPower`); the secrets are the `a` and
	 * `b` sliders. Reduced motion shows the complete frame.
	 */
	import { clamp, lerp, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { fastPower, sup } from '../../primes-modular-arithmetic/modular';
	import { DH, diffieHellman } from '../crypto';
	import Person from './Person.svelte';
	import Txt from './Txt.svelte';

	let { step, t, params, reduced }: StageProps = $props();
	const phase = $derived(String(step.hints?.phase ?? 'public'));
	const num = (v: unknown, fallback: number) => clamp(Math.round(Number(v ?? fallback)), 2, 99);
	const a = $derived(num(params.a, 29));
	const b = $derived(num(params.b, 64));
	const k = $derived(diffieHellman(a, b));
	const costA = $derived(fastPower(DH.g, a, DH.p).total);
	const costB = $derived(fastPower(DH.g, b, DH.p).total);

	// ---- timing -------------------------------------------------------------------------------
	const tv = $derived(reduced ? 1e6 : t);
	const pub = $derived(phase === 'public');
	const secretOn = $derived(pub ? smoothstep(0.3, 0.9, tv) : 1);
	const powerOn = $derived(pub ? smoothstep(1.0, 1.6, tv) : 1);
	const travel = $derived(pub ? clamp((tv - 2.0) / 2.0) : 1);
	const eveOn = $derived(pub ? smoothstep(3.0, 3.4, tv) : 1);
	const keyOn = $derived(pub ? 0 : smoothstep(0.5, 1.3, tv));
	const bannerOn = $derived(pub ? 0 : smoothstep(1.8, 2.4, tv));

	// ---- layout -------------------------------------------------------------------------------
	const CARD = { y: 136, w: 300, h: 340 };
	const AX = 30;
	const BX = 960 - 30 - 300;
	const LANE_A = 268;
	const LANE_B = 314;
	const EVE = { x: 480, y: 400 };
	const NOTE = { x: 360, y: 452, w: 240, h: 112 };

	const pillW = (s: string) => s.length * 8 + 24;
</script>

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

{#snippet keyIcon(x: number, y: number)}
	<g transform="translate({x} {y})" fill="none" stroke="var(--cr-key)" stroke-width="3">
		<circle cx="0" cy="0" r="7" />
		<path d="M7 0 H26 M20 0 V7 M25 0 V6" stroke-linecap="round" />
	</g>
{/snippet}

{#snippet card(
	x: number,
	who: string,
	color: string,
	secretName: string,
	secret: number,
	pubName: string,
	pubValue: number,
	cost: number,
	otherName: string,
	otherValue: number,
	key: number
)}
	<rect
		{x}
		y={CARD.y}
		width={CARD.w}
		height={CARD.h}
		rx="12"
		fill="var(--surface)"
		stroke={color}
		stroke-opacity="0.55"
	/>
	<g opacity={secretOn}>
		<Readout
			id="secret-{who}"
			order={who === 'Alice' ? 1 : 2}
			label="{who}’s secret"
			value="{secretName} = {secret}"
			{color}
			opacity={secretOn}
		>
			<Txt
				x={x + 20}
				y={CARD.y + 36}
				text="{who}’s secret: {secretName} = {secret}"
				size={16}
				weight={700}
				{color}
				halo={false}
			/>
			{#snippet narrow()}
				<Txt
					x={x + 20}
					y={CARD.y + 44}
					text="{secretName} = {secret}"
					size={32}
					weight={700}
					{color}
					halo={false}
				/>
			{/snippet}
		</Readout>
		{@render lock(x + CARD.w - 26, CARD.y + 30)}
	</g>
	<g opacity={powerOn}>
		<Readout
			id="sends-{who}"
			order={who === 'Alice' ? 3 : 4}
			label="{who} sends"
			value="{pubName} = 2{sup(secret)} mod 101 = {pubValue}"
			note="{cost} multiplication{cost === 1 ? '' : 's'}"
			opacity={pub ? powerOn : 0}
		>
			<Txt
				x={x + 20}
				y={CARD.y + 78}
				text="{pubName} = 2{sup(secret)} mod 101"
				size={15}
				halo={false}
			/>
			<Txt x={x + 20} y={CARD.y + 112} text="= {pubValue}" size={24} weight={700} halo={false} />
			<Txt
				x={x + 20}
				y={CARD.y + 138}
				text="{cost} multiplication{cost === 1 ? '' : 's'} (square-and-multiply)"
				size={12}
				muted
				halo={false}
			/>
			{#snippet narrow()}
				<Txt
					x={x + 20}
					y={CARD.y + 110}
					text="{pubName} = {pubValue}"
					size={32}
					weight={700}
					halo={false}
				/>
			{/snippet}
		</Readout>
	</g>
	<g opacity={travel >= 1 ? 1 : 0}>
		<line
			x1={x + 20}
			x2={x + CARD.w - 20}
			y1={CARD.y + 168}
			y2={CARD.y + 168}
			stroke="var(--border)"
		/>
		<Readout id="received-{who}">
			<Txt
				x={x + 20}
				y={CARD.y + 198}
				text="received {otherName} = {otherValue}"
				size={15}
				halo={false}
			/>
			{#snippet narrow()}
				<Txt
					x={x + 20}
					y={CARD.y + 206}
					text="got {otherName} = {otherValue}"
					size={28}
					halo={false}
				/>
			{/snippet}
		</Readout>
	</g>
	{#if keyOn > 0}
		<g opacity={keyOn}>
			<Readout
				id="key-{who}"
				order={3}
				label={who === 'Alice' ? 'Shared key' : undefined}
				value={String(key)}
				note="each computes it alone; it is never sent"
				color="var(--cr-key)"
				opacity={keyOn}
			>
				<Txt
					x={x + 20}
					y={CARD.y + 236}
					text="key = {otherValue}{sup(secret)} mod 101"
					size={15}
					halo={false}
				/>
				<Txt
					x={x + 20}
					y={CARD.y + 276}
					text="= {key}"
					size={28}
					weight={700}
					color="var(--cr-key)"
					halo={false}
				/>
				{@render keyIcon(x + 112, CARD.y + 266)}
				<Txt
					x={x + 20}
					y={CARD.y + 310}
					text="never sent over the line"
					size={12}
					muted
					halo={false}
				/>
				{#snippet narrow()}
					<Txt
						x={x + 20}
						y={CARD.y + 280}
						text="key = {key}"
						size={34}
						weight={700}
						color="var(--cr-key)"
						halo={false}
					/>
				{/snippet}
			</Readout>
		</g>
	{/if}
{/snippet}

{#snippet pill(x: number, y: number, text: string, color: string)}
	{@const w = pillW(text)}
	<rect x={x - w / 2} y={y - 14} width={w} height="28" rx="14" fill={color} />
	<Txt {x} y={y + 5} {text} size={14} weight={700} anchor="middle" color="#fff" halo={false} />
{/snippet}

<g>
	<Person x={70} y={64} name="Alice" color="var(--cr-alice)" />
	<Person x={890} y={64} name="Bob" color="var(--cr-bob)" />

	<!-- the public numbers -->
	<rect
		x={340}
		y={34}
		width={280}
		height={72}
		rx="12"
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	<!-- <Readout>: on narrow screens these are hidden or listed as HTML under the stage -->
	<Readout id="public-title">
		<Txt
			x={480}
			y={62}
			text="Public: everyone knows"
			size={12}
			anchor="middle"
			muted
			halo={false}
		/>
	</Readout>
	<Readout id="public-numbers">
		<Txt
			x={480}
			y={90}
			text="clock p = 101,  base g = 2"
			size={17}
			weight={700}
			anchor="middle"
			halo={false}
		/>
		{#snippet narrow()}
			<Txt
				x={480}
				y={82}
				text="p = 101, g = 2"
				size={30}
				weight={700}
				anchor="middle"
				halo={false}
			/>
		{/snippet}
	</Readout>

	{@render card(AX, 'Alice', 'var(--cr-alice)', 'a', a, 'A', k.A, costA, 'B', k.B, k.aliceKey)}
	{@render card(BX, 'Bob', 'var(--cr-bob)', 'b', b, 'B', k.B, costB, 'A', k.A, k.bobKey)}

	<!-- the open line between the cards -->
	<line
		x1={AX + CARD.w}
		x2={BX}
		y1={LANE_A}
		y2={LANE_A}
		stroke="var(--stage-line)"
		stroke-width="1.5"
		marker-end="url(#arrowhead)"
	/>
	<line
		x1={BX}
		x2={AX + CARD.w}
		y1={LANE_B}
		y2={LANE_B}
		stroke="var(--stage-line)"
		stroke-width="1.5"
		marker-end="url(#arrowhead)"
	/>
	<line
		x1={EVE.x}
		x2={EVE.x}
		y1={LANE_B + 8}
		y2={EVE.y - 40}
		stroke="var(--cr-eve)"
		stroke-width="2"
		stroke-dasharray="5 4"
	/>
	{#if travel > 0 && travel < 1}
		{@render pill(lerp(AX + CARD.w + 40, BX - 40, travel), LANE_A, `A = ${k.A}`, 'var(--cr-alice)')}
		{@render pill(lerp(BX - 40, AX + CARD.w + 40, travel), LANE_B, `B = ${k.B}`, 'var(--cr-bob)')}
	{/if}

	<Person x={EVE.x} y={EVE.y} name="Eve" color="var(--cr-eve)" />
	<g opacity={eveOn}>
		<rect
			x={NOTE.x}
			y={NOTE.y}
			width={NOTE.w}
			height={NOTE.h}
			rx="10"
			fill="var(--surface)"
			stroke="var(--cr-eve)"
			stroke-opacity="0.6"
		/>
		<Readout id="eve-note">
			<Txt
				x={NOTE.x + 16}
				y={NOTE.y + 28}
				text="Eve knows p = 101, g = 2"
				size={13}
				weight={600}
				halo={false}
			/>
			<Txt
				x={NOTE.x + 16}
				y={NOTE.y + 52}
				text="A = {k.A},  B = {k.B}"
				size={13}
				weight={600}
				halo={false}
			/>
			<Txt
				x={NOTE.x + 16}
				y={NOTE.y + 82}
				text={pub ? 'but not a or b' : 'but not a, b or the key'}
				size={13}
				weight={700}
				color="var(--cr-eve)"
				halo={false}
			/>
			{#snippet narrow()}
				<Txt
					x={NOTE.x + 16}
					y={NOTE.y + 46}
					text="A = {k.A}, B = {k.B}"
					size={26}
					weight={700}
					halo={false}
				/>
				<Txt
					x={NOTE.x + 16}
					y={NOTE.y + 92}
					text={pub ? 'not a or b' : 'not a, b, key'}
					size={26}
					weight={700}
					color="var(--cr-eve)"
					halo={false}
				/>
			{/snippet}
		</Readout>
	</g>

	{#if bannerOn > 0}
		<g opacity={bannerOn}>
			{#each [{ cx: AX + CARD.w / 2, got: k.B, own: a, other: b, o: 'B' }, { cx: BX + CARD.w / 2, got: k.A, own: b, other: a, o: 'A' }] as c (c.o)}
				<Readout
					id="why-{c.o}"
					order={4}
					label={c.o === 'B' ? 'Why they agree' : undefined}
					value="2 to the power {a} × {b}, mod 101"
					note="(2ᵇ)ᵃ = (2ᵃ)ᵇ: same exponent, either order"
					opacity={bannerOn}
				>
					<Txt
						x={c.cx}
						y={CARD.y + CARD.h + 40}
						text="{c.o} = {c.got} = 2{sup(c.other)}, so the key is (2{sup(c.other)}){sup(c.own)}"
						size={13}
						anchor="middle"
						muted
					/>
					<Txt
						x={c.cx}
						y={CARD.y + CARD.h + 70}
						text="= 2 to the power {a} × {b}, mod 101"
						size={15}
						weight={600}
						anchor="middle"
					/>
				</Readout>
			{/each}
		</g>
	{/if}
</g>
