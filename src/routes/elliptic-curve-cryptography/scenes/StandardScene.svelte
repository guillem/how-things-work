<script lang="ts">
	/**
	 * The real standards, checked in the browser with the page's own code.
	 *
	 * Phases (`step.hints.phase`):
	 *   secp   — secp256k1 (SEC 2 v2 §2.4.1): p, G, n; checks that G is on the curve and that
	 *            n·G = O by double-and-add in 256-bit BigInt arithmetic
	 *   x25519 — RFC 7748 §6.1: Alice's and Bob's keys, the public keys and the shared secret
	 *            from both sides, computed by the X25519 ladder and compared with the RFC
	 *
	 * The rows are revealed one by one over the first ~2.4 s; reduced motion shows them all.
	 * The results are computed once per mount (a few milliseconds).
	 */
	import { Label, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		BASE_U,
		RFC7748_DH as V,
		SECP256K1,
		bitLength,
		hexGroups,
		isOnCurve,
		multiply,
		x25519
	} from '../ecc';

	let { step, t }: StageProps = $props();
	const phase = $derived(String(step.hints?.phase ?? 'secp'));

	// ---- secp256k1 ------------------------------------------------------------------------------
	const S = SECP256K1;
	const onCurve = isOnCurve(S.curve, S.G);
	const nG = multiply(S.curve, S.n, S.G);
	const nGisO = nG.result === null;
	const doublings = nG.ops.filter((o) => o.op === 'double').length;
	const additions = nG.ops.length - doublings;

	// ---- X25519 ---------------------------------------------------------------------------------
	const alicePub = x25519(V.alicePrivate, BASE_U);
	const bobPub = x25519(V.bobPrivate, BASE_U);
	const aliceK = x25519(V.alicePrivate, bobPub);
	const bobK = x25519(V.bobPrivate, alicePub);
	const groups = (hex: string) => hex.replace(/(.{8})(?=.)/g, '$1 ');
	const rows = [
		{ who: 'Alice’s secret key', hex: V.alicePrivate, ok: null, color: 'var(--ecc-alice)' },
		{
			who: 'Alice’s public key',
			hex: alicePub,
			ok: alicePub === V.alicePublic,
			color: 'var(--ecc-alice)'
		},
		{ who: 'Bob’s secret key', hex: V.bobPrivate, ok: null, color: 'var(--ecc-bob)' },
		{ who: 'Bob’s public key', hex: bobPub, ok: bobPub === V.bobPublic, color: 'var(--ecc-bob)' },
		{
			who: 'Shared, as Alice computes it',
			hex: aliceK,
			ok: aliceK === V.shared,
			color: 'var(--ecc-sum)'
		},
		{ who: 'Shared, as Bob computes it', hex: bobK, ok: bobK === V.shared, color: 'var(--ecc-sum)' }
	];
	const reveal = (i: number) => smoothstep(0.2 + i * 0.35, 0.5 + i * 0.35, t);
	const X0 = 40;
</script>

<g>
	{#if phase === 'secp'}
		<Label
			x={X0}
			y={52}
			text="secp256k1"
			size={22}
			weight={700}
			anchor="start"
			color="var(--ecc-curve)"
		/>
		<Label
			x={X0 + 140}
			y={52}
			text="SEC 2 v2, §2.4.1 · the curve of Bitcoin and Ethereum"
			size={13}
			anchor="start"
			muted
		/>
		<Readout id="eq" order={0} label="Curve" value="y² = x³ + 7 over F_p, p = 2²⁵⁶ − 2³² − 977">
			<Label
				x={X0}
				y={92}
				text="y² ≡ x³ + 7  (mod p),   with p = 2²⁵⁶ − 2³² − 977"
				size={16}
				weight={600}
				anchor="start"
			/>
		</Readout>
		{#each [{ name: 'p', v: S.curve.p, note: `${bitLength(S.curve.p)} bits` }, { name: 'Gx', v: S.G.x, note: 'generator, x' }, { name: 'Gy', v: S.G.y, note: 'generator, y' }, { name: 'n', v: S.n, note: `${bitLength(S.n)}-bit prime: the number of multiples of G` }] as row, i (row.name)}
			<g opacity={reveal(i)}>
				<Label
					x={X0}
					y={140 + i * 58}
					text={row.name}
					size={15}
					weight={700}
					anchor="start"
					color="var(--ecc-curve)"
				/>
				<Label x={X0 + 44} y={140 + i * 58} text={hexGroups(row.v)} size={14} anchor="start" mono />
				<Label x={X0 + 44} y={160 + i * 58} text={row.note} size={11.5} anchor="start" muted />
			</g>
		{/each}
		<g opacity={reveal(4.5)}>
			<rect
				x={X0 - 12}
				y={392}
				width={884}
				height={150}
				rx="10"
				fill="var(--surface)"
				stroke="var(--border)"
			/>
			<Label
				x={X0 + 4}
				y={420}
				text="checked just now in your browser, by this page's own code:"
				size={13}
				anchor="start"
				muted
			/>
			<Readout
				id="on"
				order={1}
				label="G on the curve"
				value={onCurve ? 'yes ✓' : 'no ✗'}
				color="var(--ecc-ok)"
			>
				<Label
					x={X0 + 4}
					y={452}
					text="{onCurve ? '✓' : '✗'}  Gy² ≡ Gx³ + 7 (mod p): G is on the curve"
					size={15}
					weight={600}
					anchor="start"
					color={onCurve ? 'var(--ecc-ok)' : 'var(--ecc-eve)'}
				/>
			</Readout>
			<Readout
				id="ng"
				order={2}
				label="n · G"
				value={nGisO ? 'O ✓' : 'not O ✗'}
				color="var(--ecc-ok)"
			>
				<Label
					x={X0 + 4}
					y={482}
					text="{nGisO
						? '✓'
						: '✗'}  n · G = O, by double-and-add: {doublings} doublings and {additions} additions"
					size={15}
					weight={600}
					anchor="start"
					color={nGisO ? 'var(--ecc-ok)' : 'var(--ecc-eve)'}
				/>
			</Readout>
			<Readout id="key">
				<Label
					x={X0 + 4}
					y={516}
					text="a private key is a number k from 1 to n − 1; the public key is the point k·G"
					size={13}
					anchor="start"
				/>
			</Readout>
		</g>
	{:else}
		<Label
			x={X0}
			y={52}
			text="X25519"
			size={22}
			weight={700}
			anchor="start"
			color="var(--ecc-curve)"
		/>
		<Label
			x={X0 + 100}
			y={52}
			text="RFC 7748, §6.1 test vector · Curve25519: y² = x³ + 486662x² + x over p = 2²⁵⁵ − 19"
			size={13}
			anchor="start"
			muted
		/>
		{#each rows as row, i (row.who)}
			{@const y = 104 + i * 66 + (i >= 4 ? 14 : 0)}
			<g opacity={reveal(i)}>
				<Label x={X0} {y} text={row.who} size={13} weight={700} anchor="start" color={row.color} />
				<Label x={X0} y={y + 24} text={groups(row.hex)} size={14} anchor="start" mono />
				{#if row.ok !== null}
					<Label
						x={940}
						y={y + 24}
						text={row.ok ? '✓ matches the RFC' : '✗ differs from the RFC'}
						size={13}
						weight={700}
						anchor="end"
						color={row.ok ? 'var(--ecc-ok)' : 'var(--ecc-eve)'}
					/>
				{/if}
			</g>
		{/each}
		<Readout
			id="match"
			order={0}
			label="RFC 7748 vector"
			value={rows.every((r) => r.ok !== false) ? 'all values match ✓' : 'mismatch ✗'}
			color="var(--ecc-ok)"
			opacity={reveal(5)}
		>
			<Label
				x={X0}
				y={548}
				text={aliceK === bobK
					? '✓ both sides hold the same 32-byte secret, the one printed in the standard'
					: '✗ the two sides disagree'}
				size={14}
				weight={700}
				anchor="start"
				color="var(--ecc-ok)"
				opacity={reveal(5)}
			/>
		</Readout>
		<Readout id="note">
			<Label
				x={X0}
				y={572}
				text="keys are 32 bytes, little-endian, as the RFC writes them; the public key is the x-coordinate of k·(9, …)"
				size={11.5}
				anchor="start"
				muted
			/>
		</Readout>
	{/if}
</g>
