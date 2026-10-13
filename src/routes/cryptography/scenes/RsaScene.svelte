<script lang="ts">
	/**
	 * Toy RSA on the textbook key p = 61, q = 53 (n = 3233, e = 17, d = 2753).
	 *
	 * Phases (`step.hints.phase`):
	 * - `keys`: Alice builds the key pair line by line, ending in a public and a private key
	 *   card; on the right, Eve factors n by trial division (2, 3, 4, … until 53 divides it),
	 *   and a box gives the real sizes. Loops the search.
	 * - `sign`: Alice's message (an input, `params.signMsg`) is hashed, reduced mod n and
	 *   signed with d. The message and signature travel to Bob (loops). Bob's copy is an input
	 *   too (`params.recv`): it follows Alice's message until the reader edits it (playing Eve).
	 *   Bob hashes what he received, raises the signature to e and compares. The action
	 *   `params.resend` restores Bob's copy.
	 *
	 * Numbers come from the model (`RSA`, `sign`, `verify`, `hashToNumber`, `trialFactor`).
	 * Reduced motion shows the finished frame.
	 */
	import { untrack } from 'svelte';
	import { clamp, cycle, lerp, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { sup } from '../../primes-modular-arithmetic/modular';
	import { REAL, RSA, hashToNumber, sha256Hex, sign, trialFactor, verify } from '../crypto';
	import Person from './Person.svelte';
	import Txt from './Txt.svelte';

	let { step, t, params, setParam, reduced }: StageProps = $props();
	const phase = $derived(String(step.hints?.phase ?? 'keys'));
	const tv = $derived(reduced ? 1e6 : t);

	// ---- keys ---------------------------------------------------------------------------------
	const lineOn = (i: number) =>
		phase === 'keys' ? smoothstep(0.3 + i * 0.5, 0.7 + i * 0.5, tv) : 1;
	const factor = trialFactor(RSA.n);
	const CANDIDATES = Array.from({ length: 55 }, (_, i) => i + 2); // 2 … 56 (√3233 ≈ 56.9)
	const SEARCH_RATE = 14;
	const searchEnd = 1.2 + factor.tries / SEARCH_RATE;
	const keysPeriod = searchEnd + 5;
	const ks = $derived(reduced ? 1e6 : cycle(t, keysPeriod) * keysPeriod);
	const divisor = $derived(
		Math.min(factor.p, 2 + Math.max(0, Math.floor((ks - 1.2) * SEARCH_RATE)))
	);
	const factored = $derived(ks >= searchEnd);
	const CHIP = { x: 512, y: 112, w: 36, h: 28, cols: 11 };
	const chipX = (k: number) => CHIP.x + ((k - 2) % CHIP.cols) * (CHIP.w + 4);
	const chipY = (k: number) => CHIP.y + Math.floor((k - 2) / CHIP.cols) * (CHIP.h + 6);

	// ---- sign ---------------------------------------------------------------------------------
	const DEFAULT = 'Pay Bob 10 €';
	const signMsg = $derived(typeof params.signMsg === 'string' ? params.signMsg : DEFAULT);
	const recv = $derived(typeof params.recv === 'string' ? params.recv : signMsg);
	const h = $derived(hashToNumber(signMsg));
	const s = $derived(sign(signMsg));
	const check = $derived(verify(recv, s));
	const tampered = $derived(recv !== signMsg);

	function editAlice(value: string) {
		// Bob's copy follows Alice's message unless it has been changed in transit.
		const follow = !tampered;
		setParam('signMsg', value);
		if (follow) setParam('recv', value);
	}

	// "Deliver the message untouched": restore Bob's copy when the button is pressed (not on
	// mount, so a tampered copy survives a visit to another step).
	const resend = $derived(Number(params.resend ?? 0));
	let lastResend = untrack(() => resend);
	$effect(() => {
		const n = resend;
		if (n === lastResend) return;
		lastResend = n;
		untrack(() => setParam('recv', signMsg));
	});

	const SEND_PERIOD = 6;
	const su = $derived(reduced ? 1e6 : cycle(t, SEND_PERIOD) * SEND_PERIOD);
	const travel = $derived(clamp((su - 0.6) / 2.4));
	const verdictOn = $derived(phase === 'sign' ? (reduced ? 1 : smoothstep(0.8, 1.4, tv)) : 0);
	const short = (text: string) => (text.length > 22 ? text.slice(0, 21) + '…' : text);
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

{#snippet field(
	x: number,
	y: number,
	w: number,
	value: string,
	label: string,
	oninput: (v: string) => void,
	warn = false
)}
	<foreignObject {x} {y} width={w} height="44">
		<input
			class="cr-text"
			class:warn
			type="text"
			{value}
			maxlength="60"
			spellcheck="false"
			autocomplete="off"
			aria-label={label}
			oninput={(e) => oninput(e.currentTarget.value)}
		/>
	</foreignObject>
{/snippet}

<g>
	{#if phase === 'keys'}
		<!-- Alice builds the key pair -->
		<rect
			x="24"
			y="24"
			width="440"
			height="552"
			rx="12"
			fill="var(--surface)"
			stroke="var(--cr-alice)"
			stroke-opacity="0.5"
		/>
		<!-- <Readout>: on narrow screens these are hidden or listed as HTML under the stage -->
		<Readout id="alice-title">
			<Txt
				x={44}
				y={56}
				text="Alice makes a key pair"
				size={16}
				weight={700}
				color="var(--cr-alice)"
				halo={false}
			/>
		</Readout>
		<g opacity={lineOn(0)}>
			<Readout id="primes">
				<Txt x={44} y={96} text="Two secret primes:  p = 61,  q = 53" size={15} halo={false} />
				{#snippet narrow()}
					<Txt x={44} y={104} text="p = 61, q = 53" size={30} weight={700} halo={false} />
				{/snippet}
			</Readout>
			{@render lock(440, 90)}
		</g>
		<g opacity={lineOn(1)}>
			<Readout id="n">
				<Txt x={44} y={134} text="n = p × q = 3233" size={15} weight={700} halo={false} />
				<Txt x={44} y={154} text="easy: one multiplication" size={12} muted halo={false} />
				{#snippet narrow()}
					<Txt x={44} y={150} text="n = 3233" size={30} weight={700} halo={false} />
				{/snippet}
			</Readout>
		</g>
		<g opacity={lineOn(2)}>
			<Readout id="phi">
				<Txt x={44} y={190} text="(p − 1)(q − 1) = 60 × 52 = 3120" size={15} halo={false} />
			</Readout>
			{@render lock(440, 184)}
		</g>
		<g opacity={lineOn(3)}>
			<Readout id="e">
				<Txt
					x={44}
					y={228}
					text="e = 17   (no factor in common with 3120)"
					size={15}
					halo={false}
				/>
			</Readout>
		</g>
		<g opacity={lineOn(4)}>
			<Readout id="d">
				<Txt x={44} y={266} text="d = 2753, because" size={15} halo={false} />
				<Txt x={44} y={290} text="17 × 2753 = 46,801 = 15 × 3120 + 1" size={15} halo={false} />
				<Txt
					x={44}
					y={310}
					text="so raising to e, then to d, gets back to the start"
					size={12}
					muted
					halo={false}
				/>
			</Readout>
			{@render lock(440, 260)}
		</g>
		<g opacity={lineOn(5)}>
			<rect
				x="44"
				y="336"
				width="400"
				height="98"
				rx="10"
				fill="var(--cr-ok)"
				fill-opacity="0.1"
				stroke="var(--cr-ok)"
			/>
			<Readout
				id="public"
				order={1}
				label="Public key"
				value="n = 3233, e = 17"
				note="used to check signatures"
				color="var(--cr-ok)"
				opacity={lineOn(5)}
			>
				<Txt
					x={60}
					y={364}
					text="PUBLIC KEY: published for everyone"
					size={13}
					weight={700}
					color="var(--cr-ok)"
					halo={false}
				/>
				<Txt x={60} y={398} text="n = 3233,  e = 17" size={22} weight={700} halo={false} />
				<Txt x={60} y={422} text="used to check signatures" size={12} muted halo={false} />
				{#snippet narrow()}
					<Txt
						x={60}
						y={368}
						text="PUBLIC"
						size={22}
						weight={700}
						color="var(--cr-ok)"
						halo={false}
					/>
					<Txt x={60} y={414} text="n = 3233, e = 17" size={34} weight={700} halo={false} />
				{/snippet}
			</Readout>
			<rect
				x="44"
				y="452"
				width="400"
				height="104"
				rx="10"
				fill="var(--cr-eve)"
				fill-opacity="0.08"
				stroke="var(--cr-eve)"
			/>
			<Readout
				id="private"
				order={2}
				label="Private key"
				value="d = 2753"
				note="17 × 2753 = 15 × 3120 + 1"
				color="var(--cr-eve)"
				opacity={lineOn(5)}
			>
				<Txt
					x={60}
					y={480}
					text="PRIVATE KEY: Alice alone"
					size={13}
					weight={700}
					color="var(--cr-eve)"
					halo={false}
				/>
				{#snippet narrow()}
					<Txt
						x={60}
						y={484}
						text="PRIVATE"
						size={22}
						weight={700}
						color="var(--cr-eve)"
						halo={false}
					/>
					<Txt x={60} y={532} text="d = 2753" size={34} weight={700} halo={false} />
				{/snippet}
			</Readout>
			{@render lock(424, 474)}
			<Readout id="private-d">
				<Txt x={60} y={514} text="d = 2753" size={22} weight={700} halo={false} />
				<Txt
					x={60}
					y={540}
					text="used to sign; p, q and 3120 stay secret too"
					size={12}
					muted
					halo={false}
				/>
			</Readout>
		</g>

		<!-- Eve tries to factor n -->
		<Person x={900} y={56} name="Eve" color="var(--cr-eve)" />
		<Readout id="eve-has">
			<Txt
				x={500}
				y={56}
				text="Eve has n = 3233. To get d she needs p and q:"
				size={14}
				weight={700}
			/>
			<Txt x={500} y={80} text="she divides by 2, 3, 4, … up to √3233 ≈ 57" size={13} muted />
			{#snippet narrow()}
				<Txt x={500} y={86} text="Eve divides 3233 by" size={26} weight={700} />
			{/snippet}
		</Readout>
		{#each CANDIDATES as k (k)}
			{@const tried = k <= divisor && ks >= 1.2}
			{@const hit = factored && k === factor.p}
			<rect
				x={chipX(k)}
				y={chipY(k)}
				width={CHIP.w}
				height={CHIP.h}
				rx="5"
				fill={hit ? 'var(--cr-key)' : tried ? 'var(--cr-eve)' : 'var(--cr-cell)'}
				fill-opacity={hit ? 1 : tried ? 0.25 : 1}
				stroke={k === divisor && !factored && ks >= 1.2 ? 'var(--cr-eve)' : 'none'}
				stroke-width="2"
			/>
			<Readout id="chip-{k}">
				<Txt
					x={chipX(k) + CHIP.w / 2}
					y={chipY(k) + 19}
					text={String(k)}
					size={13}
					weight={hit ? 700 : 500}
					anchor="middle"
					color={hit ? '#fff' : undefined}
					halo={false}
				/>
				{#snippet narrow()}
					<Txt
						x={chipX(k) + CHIP.w / 2}
						y={chipY(k) + 22}
						text={String(k)}
						size={20}
						weight={700}
						anchor="middle"
						color={hit ? '#fff' : undefined}
						halo={false}
					/>
				{/snippet}
			</Readout>
		{/each}
		<Readout
			id="factor"
			order={3}
			label="Eve factors n"
			value={factored
				? '3233 = 53 × 61'
				: ks >= 1.2
					? `3233 ÷ ${divisor}: remainder ${RSA.n % divisor}`
					: 'trying 2, 3, 4, …'}
			note={factored
				? `after ${factor.tries} divisions: with p and q she could work out d`
				: undefined}
			color={factored ? 'var(--cr-key)' : undefined}
		>
			<Txt
				x={500}
				y={312}
				text={factored
					? `3233 = 53 × 61, found after ${factor.tries} divisions`
					: ks >= 1.2
						? `3233 ÷ ${divisor} leaves remainder ${RSA.n % divisor}`
						: 'Trying divisors 2, 3, 4, …'}
				size={15}
				weight={700}
				color={factored ? 'var(--cr-key)' : undefined}
			/>
			{#if factored}
				<Txt
					x={500}
					y={336}
					text="With p and q, Eve could work out d. Easy here: n is tiny."
					size={13}
					muted
				/>
			{/if}
		</Readout>

		<Readout
			id="real"
			order={4}
			label="Real keys"
			value="n of {REAL.keyBits} bits ({REAL.keyDigits} digits)"
			note="trial division: up to about 10³⁰⁸ divisions"
		>
			<rect
				x="490"
				y="372"
				width="446"
				height="204"
				rx="12"
				fill="var(--surface)"
				stroke="var(--border)"
			/>
			<Txt
				x={508}
				y={402}
				text="Real keys: n of {REAL.keyBits} bits ({REAL.keyDigits} digits) or more"
				size={14}
				weight={700}
				halo={false}
			/>
			<Txt
				x={508}
				y={434}
				text="Multiplying p × q: a split second"
				size={13}
				color="var(--cr-ok)"
				weight={600}
				halo={false}
			/>
			<Txt
				x={508}
				y={460}
				text="Trial division: up to about 10³⁰⁸ divisions"
				size={13}
				color="var(--cr-bad)"
				weight={600}
				halo={false}
			/>
			<Txt x={508} y={494} text="The best known method's record: RSA-250," size={13} halo={false} />
			<Txt
				x={508}
				y={516}
				text="{REAL.rsaRecordBits} bits ({REAL.rsaRecordDigits} digits), factored in {REAL.rsaRecordYear} after"
				size={13}
				halo={false}
			/>
			<Txt x={508} y={538} text="thousands of years of computer time." size={13} halo={false} />
			<Txt
				x={508}
				y={562}
				text="The numbers here are for illustration."
				size={12}
				muted
				halo={false}
			/>
		</Readout>
	{:else}
		<!-- Alice signs -->
		<rect
			x="20"
			y="20"
			width="440"
			height="342"
			rx="12"
			fill="var(--surface)"
			stroke="var(--cr-alice)"
			stroke-opacity="0.5"
		/>
		<Readout id="alice-signs">
			<Txt
				x={38}
				y={50}
				text="Alice signs her message"
				size={16}
				weight={700}
				color="var(--cr-alice)"
				halo={false}
			/>
		</Readout>
		{@render field(38, 64, 404, signMsg, 'Alice’s message', editAlice)}
		<Readout id="alice-hash">
			<Txt
				x={38}
				y={138}
				text="SHA-256: {sha256Hex(signMsg).slice(0, 16)}…"
				size={13}
				mono
				halo={false}
			/>
			<Txt
				x={38}
				y={164}
				text="as a number on the 3233-hour clock: h = {h}"
				size={14}
				halo={false}
			/>
			<Txt x={38} y={206} text="signature s = h{sup(RSA.d)} mod 3233" size={15} halo={false} />
			<Txt x={38} y={232} text="= {h}{sup(RSA.d)} mod 3233" size={15} halo={false} />
			{#snippet narrow()}
				<Txt x={38} y={190} text="h = {h}" size={30} weight={600} halo={false} />
			{/snippet}
		</Readout>
		<Readout
			id="signature"
			order={1}
			label="Alice’s signature"
			value="s = {s}"
			note="h{sup(RSA.d)} mod 3233: needs the private d"
			color="var(--cr-alice)"
		>
			<Txt
				x={38}
				y={276}
				text="s = {s}"
				size={28}
				weight={700}
				color="var(--cr-alice)"
				halo={false}
			/>
			{#snippet narrow()}
				<Txt
					x={38}
					y={282}
					text="s = {s}"
					size={36}
					weight={700}
					color="var(--cr-alice)"
					halo={false}
				/>
			{/snippet}
		</Readout>
		{@render lock(200, 266)}
		<Readout id="alice-hints">
			<Txt x={216} y={272} text="needs the private d" size={12} muted halo={false} />
			<Txt
				x={38}
				y={334}
				text="Edit the message: she signs it again."
				size={12}
				muted
				halo={false}
			/>
		</Readout>

		<!-- Bob checks -->
		<rect
			x="500"
			y="20"
			width="440"
			height="342"
			rx="12"
			fill="var(--surface)"
			stroke={check.ok ? 'var(--cr-ok)' : 'var(--cr-bad)'}
			stroke-width={verdictOn > 0.5 ? 2 : 1}
		/>
		<Readout id="bob-title">
			<Txt
				x={518}
				y={50}
				text="What Bob received"
				size={16}
				weight={700}
				color="var(--cr-bob)"
				halo={false}
			/>
		</Readout>
		{@render field(
			518,
			64,
			404,
			recv,
			'The message Bob received',
			(v) => setParam('recv', v),
			tampered
		)}
		<Readout id="bob-hash">
			<Txt
				x={518}
				y={138}
				text="SHA-256: {sha256Hex(recv).slice(0, 16)}…"
				size={13}
				mono
				halo={false}
			/>
			<Txt x={518} y={164} text="as a number: {check.expected}" size={14} halo={false} />
			<Txt
				x={518}
				y={206}
				text="check with the public key: s{sup(RSA.e)} mod 3233"
				size={15}
				halo={false}
			/>
			<Txt
				x={518}
				y={232}
				text="= {s}{sup(RSA.e)} mod 3233 = {check.recovered}"
				size={15}
				halo={false}
			/>
			{#snippet narrow()}
				<Txt x={518} y={190} text="h = {check.expected}" size={30} weight={600} halo={false} />
			{/snippet}
		</Readout>
		<g opacity={verdictOn}>
			<Readout
				id="verdict"
				order={2}
				label="Bob checks: s{sup(RSA.e)} mod 3233"
				value={check.ok
					? `✓ ${check.recovered} = ${check.expected}: valid`
					: `✗ ${check.recovered} ≠ ${check.expected}: invalid`}
				note={check.ok
					? 'Signed by Alice’s key, and not changed since.'
					: 'Changed in transit, or not signed by Alice.'}
				color={check.ok ? 'var(--cr-ok)' : 'var(--cr-bad)'}
				opacity={verdictOn}
			>
				{#if check.ok}
					<Txt
						x={518}
						y={276}
						text="✓ {check.recovered} = {check.expected}: valid"
						size={24}
						weight={700}
						color="var(--cr-ok)"
						halo={false}
					/>
					<Txt
						x={518}
						y={302}
						text="Signed by Alice's key, and not changed since."
						size={12}
						muted
						halo={false}
					/>
				{:else}
					<Txt
						x={518}
						y={276}
						text="✗ {check.recovered} ≠ {check.expected}: invalid"
						size={24}
						weight={700}
						color="var(--cr-bad)"
						halo={false}
					/>
					<Txt
						x={518}
						y={302}
						text="Changed in transit, or not signed by Alice."
						size={12}
						muted
						halo={false}
					/>
				{/if}
				{#snippet narrow()}
					<Txt
						x={518}
						y={290}
						text={check.ok ? '✓ valid' : '✗ invalid'}
						size={40}
						weight={700}
						color={check.ok ? 'var(--cr-ok)' : 'var(--cr-bad)'}
						halo={false}
					/>
				{/snippet}
			</Readout>
		</g>
		<Readout id="bob-hint">
			<Txt x={518} y={334} text="Edit this copy to play Eve." size={12} muted halo={false} />
		</Readout>

		<!-- the transfer -->
		<Person x={70} y={420} name="Alice" color="var(--cr-alice)" />
		<Person x={890} y={420} name="Bob" color="var(--cr-bob)" />
		<line
			x1="120"
			x2="840"
			y1="420"
			y2="420"
			stroke="var(--stage-line)"
			stroke-width="1.5"
			marker-end="url(#arrowhead)"
		/>
		{#if travel > 0 && travel < 1}
			{@const px = lerp(200, 760, travel)}
			{@const label = `“${short(signMsg)}” + s = ${s}`}
			{@const w = label.length * 7.6 + 26}
			<rect x={px - w / 2} y="405" width={w} height="30" rx="15" fill="var(--cr-alice)" />
			<Txt
				x={px}
				y={425}
				text={label}
				size={13}
				weight={600}
				anchor="middle"
				color="#fff"
				halo={false}
			/>
		{/if}
		<Person x={480} y={520} name="Eve" color="var(--cr-eve)" />
		<line
			x1="480"
			x2="480"
			y1="428"
			y2="480"
			stroke="var(--cr-eve)"
			stroke-width="2"
			stroke-dasharray="5 4"
		/>
		<Readout
			id="eve"
			order={3}
			label="Eve"
			value={tampered ? `changed it to “${short(recv)}”` : 'can change the message on the way'}
			note={tampered
				? 'but she can’t make a matching signature without d'
				: 'but without d she can’t sign the new one'}
			color="var(--cr-eve)"
		>
			<Txt
				x={540}
				y={500}
				text={tampered
					? `Eve changed it to “${short(recv)}”`
					: 'Eve can change the message on the way,'}
				size={13}
				weight={tampered ? 700 : 500}
				color={tampered ? 'var(--cr-eve)' : undefined}
			/>
			<Txt
				x={540}
				y={520}
				text={tampered
					? 'but she can’t make a matching signature without d.'
					: 'but without d she can’t sign the new one.'}
				size={13}
				muted
			/>
		</Readout>
	{/if}
</g>

<style>
	.cr-text {
		box-sizing: border-box;
		width: 100%;
		height: 100%;
		padding: 0 12px;
		border: 1.5px solid var(--border);
		border-radius: 10px;
		background: var(--stage-bg);
		color: var(--stage-ink);
		font: 500 18px var(--font-mono);
		user-select: text;
		-webkit-user-select: text;
	}
	/* on phones the stage is drawn at ~0.4 scale: larger type keeps the field legible */
	@media (max-width: 640px) {
		.cr-text {
			padding: 0 8px;
			font-size: 32px;
		}
	}
	.cr-text.warn {
		border-color: var(--cr-eve);
	}
	.cr-text:focus {
		outline: none;
		border-color: var(--cr-alice);
		box-shadow: 0 0 0 3px color-mix(in oklab, var(--cr-alice) 30%, transparent);
	}
</style>
