import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';

const PAINT_OPTIONS = [
	{ value: 'red', label: 'Red' },
	{ value: 'blue', label: 'Blue' },
	{ value: 'teal', label: 'Teal' },
	{ value: 'violet', label: 'Violet' }
];
const alicePaint: Control = {
	type: 'select',
	id: 'alicePaint',
	label: 'Alice’s secret paint',
	default: 'red',
	options: PAINT_OPTIONS
};
const bobPaint: Control = {
	type: 'select',
	id: 'bobPaint',
	label: 'Bob’s secret paint',
	default: 'blue',
	options: PAINT_OPTIONS
};

const secretA: Control = {
	type: 'range',
	id: 'a',
	label: 'Alice’s secret a',
	min: 2,
	max: 99,
	step: 1,
	default: 29
};
const secretB: Control = {
	type: 'range',
	id: 'b',
	label: 'Bob’s secret b',
	min: 2,
	max: 99,
	step: 1,
	default: 64
};

const digits: Control = {
	type: 'range',
	id: 'digits',
	label: 'Hex digits to match',
	min: 1,
	max: 4,
	step: 1,
	default: 2,
	help: 'Each extra digit makes the search about 16 times longer.'
};

const resend: Control = {
	type: 'action',
	id: 'resend',
	label: 'Delivery',
	action: 'Deliver the message untouched',
	help: 'Undo any change to what Bob received.'
};

export const spec: ExplainerSpec = {
	slug: 'cryptography',
	title: 'How cryptography keeps secrets in the open',
	summary:
		'Agree on a secret with a stranger while an eavesdropper hears every word, fingerprint any text with a hash, and sign a message so nobody can forge it — all on one idea: some things are easy to do and practically impossible to undo.',
	chapters: [
		{ id: 'problem', title: 'Secrets on an open line' },
		{ id: 'paint', title: 'Mixing paint' },
		{ id: 'numbers', title: 'The real thing: clock arithmetic' },
		{ id: 'hash', title: 'Fingerprints' },
		{ id: 'sign', title: 'Signatures' }
	],
	steps: [
		// ---------------------------------------------------------------- problem
		{
			id: 'open-line',
			chapter: 'problem',
			title: 'Everyone can listen',
			scene: 'channel',
			hints: { phase: 'open' },
			duration: 16,
			body: `
<p>When your phone talks to your bank, its messages cross Wi-Fi, cables and routers owned by strangers. Any of them could copy every bit. Cryptographers call the two people who want to talk <strong>Alice</strong> and <strong>Bob</strong>, and the one listening in <strong>Eve</strong>, the <dfn data-def="Someone who can read every message on the channel but cannot change the people at either end.">eavesdropper</dfn>.</p>
<p>On the internet, Eve doesn't need to break in: the <dfn data-def="A communication line that anyone may be listening to, such as the internet or a radio link.">public channel</dfn> is open by design. Every message Alice sends, Eve sees as well. The question of this page: can Alice and Bob keep anything secret when <em>every word they say is overheard</em>?</p>`
		},
		{
			id: 'shared-key',
			chapter: 'problem',
			title: 'A shared key solves it — if you have one',
			scene: 'channel',
			hints: { phase: 'key' },
			duration: 22,
			body: `
<p>If Alice and Bob already share a secret <dfn data-def="A secret string of bits that scrambles and unscrambles messages. Whoever has the key can read them.">key</dfn>, hiding messages is easy. Write the message in <a href="../binary/">binary</a>, then flip every bit where the key has a 1: that is <dfn data-def="Exclusive or: 1 if exactly one of the two bits is 1, otherwise 0. Applying the same key twice gives back the original.">XOR</dfn>. "HI" becomes a jumble of bits; Bob XORs the same key again and every flipped bit flips back.</p>
<p>Eve sees only the jumble. If the key is truly random, as long as the message and never reused (a <dfn data-def="A random key as long as the message, used once. Claude Shannon proved in 1949 that it cannot be broken.">one-time pad</dfn>), the jumble tells her nothing at all. Real systems use a short key and a cipher such as AES to stretch it, but the problem is the same: <strong>how do Alice and Bob agree on a key, if every message they exchange is overheard?</strong></p>`,
			notes: `<p>For most of history, keys travelled by courier. A cipher that uses the same key to lock and unlock is called <em>symmetric</em>; AES, standardised in 2001, is the one that encrypts almost all internet traffic today. It is fast, but it needs a key both sides already have.</p>`
		},
		// ---------------------------------------------------------------- paint
		{
			id: 'paint-secrets',
			chapter: 'paint',
			title: 'Paint: a common colour and two secret ones',
			scene: 'paint',
			hints: { phase: 'secrets' },
			duration: 18,
			controls: [alicePaint, bobPaint],
			body: `
<p>Here is a trick that works, first with paint. Alice and Bob agree out loud on a <strong>common colour</strong>, yellow. Eve hears it too. Then each picks a <strong>secret colour</strong> and tells nobody: Alice red, Bob blue.</p>
<p>The trick depends on one property of paint: <strong>mixing is easy, unmixing is practically impossible</strong>. Pour two paints together and stir, and nobody can separate them again.</p>`
		},
		{
			id: 'paint-swap',
			chapter: 'paint',
			title: 'Swap the mixtures in public',
			scene: 'paint',
			hints: { phase: 'swap' },
			duration: 20,
			controls: [alicePaint, bobPaint],
			body: `
<p>Each mixes one part of their secret colour into one part of yellow and sends the mixture across the open channel. Alice sends orange, Bob sends a green.</p>
<p>Eve now has yellow, the orange and the green. But to learn Alice's secret she would have to take the yellow back out of the orange. She can't.</p>`
		},
		{
			id: 'paint-final',
			chapter: 'paint',
			title: 'Both end with the same colour',
			scene: 'paint',
			hints: { phase: 'final' },
			duration: 22,
			controls: [alicePaint, bobPaint],
			body: `
<p>Now each adds their own secret colour to the mixture they received. Alice adds red to Bob's green; Bob adds blue to Alice's orange. Both pots now hold <strong>equal parts of yellow, red and blue</strong>, poured in a different order, so they are <strong>the same colour</strong>. That colour is their shared secret.</p>
<p>Eve's best move is to pour the two mixtures she saw together. But that gives two parts yellow to one each of red and blue: too much yellow, a different colour. Try other secret colours: Alice and Bob always match, Eve never does.</p>`,
			notes: `<p>The drawing mixes colours with a simple model (each colour channel's reflectance is averaged geometrically, part for part), not real pigment physics. All that matters is that the result depends only on the proportions, not on the order of pouring. Real paint could be analysed with a spectrometer; the numbers in the next chapter have no such loophole that anyone knows of.</p>`
		},
		// ---------------------------------------------------------------- numbers
		{
			id: 'dh-public',
			chapter: 'numbers',
			title: 'Paint becomes powers on a clock',
			scene: 'dh',
			hints: { phase: 'public' },
			duration: 24,
			controls: [secretA, secretB],
			body: `
<p>Computers do the same thing with <a href="../primes-modular-arithmetic/#powers">powers on a prime clock</a>. The public "common colour" is a prime clock of p = 101 hours and a base g = 2. Alice's secret is a number a, say 29; Bob's is b = 64.</p>
<p>Mixing in your secret means raising to its power: Alice computes A = 2<sup>29</sup> mod 101 = 59 and sends it; Bob sends B = 2<sup>64</sup> mod 101 = 79. With <dfn data-def="Computing a power by squaring repeatedly and multiplying together the squares that the binary digits of the exponent pick out.">square-and-multiply</dfn> that takes a handful of multiplications. Eve sees p, g, A and B.</p>`
		},
		{
			id: 'dh-shared',
			chapter: 'numbers',
			title: 'The same key on both sides',
			scene: 'dh',
			hints: { phase: 'shared' },
			duration: 24,
			controls: [secretA, secretB],
			body: `
<p>Alice raises Bob's number to her secret: 79<sup>29</sup> mod 101 = 37. Bob raises Alice's number to his: 59<sup>64</sup> mod 101 = 37. The same number, because both are really 2<sup>29 × 64</sup>: (2<sup>b</sup>)<sup>a</sup> = (2<sup>a</sup>)<sup>b</sup>, just as the paint ended up with the same parts.</p>
<p>That is the <dfn data-def="A method for two parties to agree on a shared secret key over a public channel, published by Whitfield Diffie and Martin Hellman in 1976.">Diffie–Hellman key exchange</dfn>. Move the sliders: whatever secrets they pick, the two keys always agree. Alice and Bob now share a key they never sent.</p>`,
			notes: `<p>Whitfield Diffie and Martin Hellman published it in 1976 in "New Directions in Cryptography". Malcolm Williamson at the British intelligence agency GCHQ had found the same idea a couple of years earlier, but it stayed classified until 1997. Every time your browser opens an HTTPS connection (TLS 1.3), it runs a Diffie–Hellman exchange, today usually on an elliptic curve rather than a clock, but on the same principle.</p>`
		},
		{
			id: 'dh-eve',
			chapter: 'numbers',
			title: 'What Eve would have to do',
			scene: 'dlog',
			duration: 26,
			controls: [secretA, secretB],
			body: `
<p>Eve knows 2<sup>a</sup> mod 101 = 59 and wants a. That is the <dfn data-def="Given g, p and the remainder of gˣ divided by p, finding the exponent x.">discrete logarithm</dfn> problem: on the clock the powers jump around with no pattern, so she tries a = 0, 1, 2, … until one lands on 59. Here that takes her 30 tries — trivial, because the clock is tiny. <strong>These small numbers are for illustration only.</strong></p>
<p>Real Diffie–Hellman uses a prime of at least 2048 bits, a number with 617 digits. Alice's work grows only with the number of digits (a few thousand multiplications); Eve's trial search would have to wade through numbers up to 10<sup>616</sup>. The best known attacks are far cleverer than trying, yet the record is a 240-digit prime, broken in 2019 after thousands of years of computer time spread over many machines.</p>`,
			notes: `<p>Key sizes: NIST (SP 800-57 Part 1, Rev. 5, 2020) rates 2048-bit Diffie–Hellman and RSA keys at about 112 bits of security and requires at least that size; elliptic-curve versions get the same or better protection from 256-bit keys. The 795-bit discrete-logarithm record and the 829-bit RSA-250 factoring record (February 2020) are by Boudot, Gaudry, Guillevic, Heninger, Thomé and Zimmermann. Nobody has proved that a fast method cannot exist, and a large quantum computer running Shor's algorithm would solve both problems quickly. That is why new "post-quantum" standards were published in 2024.</p>`
		},
		// ---------------------------------------------------------------- hash
		{
			id: 'hash',
			chapter: 'hash',
			title: 'A hash: the fingerprint of a text',
			scene: 'hash',
			hints: { phase: 'digest' },
			duration: 20,
			body: `
<p>A second one-way tool needs no secret at all. A <dfn data-def="A function that turns any input into a fixed-size output (a digest) such that it is easy to compute, practically impossible to reverse, and practically impossible to find two inputs with the same output.">cryptographic hash function</dfn> turns any text, a word or a whole film, into a fixed-size <dfn data-def="The output of a hash function: here 256 bits, written as 64 hexadecimal digits.">digest</dfn>. The one shown is <strong>SHA-256</strong>, the real standard used everywhere today: it chops the text's bits into blocks and stirs each block through 64 rounds of shifts, XORs and additions.</p>
<p>Type in the box. Whatever you write, out come exactly 256 bits, shown as 64 <dfn data-def="Base 16: digits 0–9 and a–f, each standing for 4 bits.">hexadecimal</dfn> digits and as a 16 × 16 grid. The same text always gives the same digest, so the digest acts as a fingerprint.</p>`,
			notes: `<p>SHA-256 was designed by the US National Security Agency and standardised by NIST in 2002; the current specification is FIPS 180-4 (2015). The one running here is a complete implementation, checked against NIST's published examples ("abc" gives ba7816bf…). Software downloads publish their SHA-256 so you can check that nothing was altered on the way.</p>`
		},
		{
			id: 'avalanche',
			chapter: 'hash',
			title: 'Change one letter, change everything',
			scene: 'hash',
			hints: { phase: 'avalanche' },
			duration: 22,
			body: `
<p>Here are two texts that differ in a single letter: "noon" and "moon". Their digests have nothing in common. Of the 256 bits, about half flip — exactly what you'd expect from two unrelated random strings. This is the <dfn data-def="The property that a tiny change in the input changes about half of the output bits, unpredictably.">avalanche effect</dfn>.</p>
<p>Edit either box, by one character or many: the count of differing bits always hovers around 128. Nothing in the digest points back towards the text, so similar texts can't be found by nudging one until the digest looks close.</p>`
		},
		{
			id: 'hash-oneway',
			chapter: 'hash',
			title: 'Easy forwards, hopeless backwards',
			scene: 'hash',
			hints: { phase: 'search' },
			duration: 26,
			controls: [digits],
			body: `
<p>Can Eve find a text with a given digest? She can only guess: hash "try 0", "try 1", "try 2", … and compare. Watch the search match just the first few hex digits of your text's digest. Each digit matches by luck 1 time in 16, so each extra digit takes about 16 times as many tries.</p>
<p>Matching all 64 digits would take around 2<sup>256</sup> ≈ 10<sup>77</sup> tries — more than the number of atoms in the Earth. Hashing is easy one way, practically impossible the other.</p>`,
			notes: `<p>Websites store a hash of your password rather than the password itself (in practice a deliberately slow, salted hash such as bcrypt or Argon2). Bitcoin mining is exactly this kind of guessing on purpose: miners hunt for a block whose double SHA-256 digest falls below a target, that is, starts with a long run of zeros. A quantum computer would help only modestly here: Grover's algorithm roughly halves the exponent, which 256 bits can afford.</p>`
		},
		// ---------------------------------------------------------------- sign
		{
			id: 'rsa-keys',
			chapter: 'sign',
			title: 'A lock anyone can check, a key only one has',
			scene: 'rsa',
			hints: { phase: 'keys' },
			duration: 24,
			body: `
<p>Bob gets a message "from Alice". How does he know Eve didn't write it? With a <dfn data-def="A pair of numbers: a private key kept secret, and a public key published for anyone to use.">key pair</dfn>, as in <dfn data-def="A public-key system published by Rivest, Shamir and Adleman in 1977, based on the difficulty of factoring a product of two large primes.">RSA</dfn>. Alice picks two primes, p = 61 and q = 53, and multiplies them: n = 3233. That is easy.</p>
<p>From p and q she works out two exponents that undo each other on the n-hour clock: e = 17 and d = 2753, because 17 × 2753 is one more than a multiple of (p − 1)(q − 1) = 3120. She publishes n and e (the <strong>public key</strong>) and keeps d (the <strong>private key</strong>). Finding d needs p and q, and getting them back from n means <dfn data-def="Writing a number as a product of primes; for a product of two large primes, no fast method is known.">factoring</dfn>: here Eve finds 53 after 52 trial divisions, but for a 617-digit n nobody can.</p>`,
			notes: `<p>Why e and d undo each other: by Euler's theorem, x<sup>(p−1)(q−1)</sup> ≡ 1 mod n for x sharing no factor with n, so x<sup>e·d</sup> = x<sup>1 + k·3120</sup> ≡ x. The record for factoring an RSA modulus is RSA-250, 829 bits (250 digits), in February 2020; real keys are 2048 bits or more. Clifford Cocks at GCHQ found the same scheme in 1973, kept secret until 1997.</p>`
		},
		{
			id: 'sign',
			chapter: 'sign',
			title: 'Sign, then verify',
			scene: 'rsa',
			hints: { phase: 'sign' },
			duration: 26,
			controls: [resend],
			body: `
<p>To <dfn data-def="Attaching a number that only the holder of the private key could have computed from this exact message, and that anyone can check with the public key.">sign</dfn> a message, Alice hashes it, reduces the hash to a number h on the 3233-hour clock and computes the signature s = h<sup>d</sup> mod n. Only she can: it takes her private d.</p>
<p>Bob, or anyone, checks it with the public key: s<sup>e</sup> mod n must give back the hash of the message he received. Change what Bob received, even one character, and its hash changes completely, so the check fails. Edit Alice's message and she signs again, and the check passes. Without d, Eve can't make a signature that passes.</p>`,
			notes: `<p>This is "textbook" RSA on a toy key, for illustration only. With n = 3233, a changed message still passes about once in 3233 tries, by luck. Real signatures use a 2048-bit or larger n and a padding scheme (RSA-PSS), or an elliptic-curve scheme. Your browser checks signatures like this on every HTTPS site: the site's certificate is signed by an authority whose public key is built into the browser.</p>`
		},
		{
			id: 'one-way',
			chapter: 'sign',
			title: 'One-way streets',
			scene: 'summary',
			duration: 22,
			body: `
<p>Everything on this page rests on one asymmetry. Raising to a power on a prime clock is quick; finding the exponent is not. Hashing is quick; finding a text for a digest is not. Multiplying two primes is quick; factoring the product is not.</p>
<p><strong>Some operations are easy to do and practically impossible to undo, and that asymmetry lets strangers share secrets and prove who they are over an open network.</strong> "Practically" is the key word: nobody has proved these problems are hard, they have only resisted everyone who tried. A large quantum computer would break the clock and the factoring (though not the hash), which is why new <dfn data-def="Public-key schemes built on problems that no known quantum algorithm solves fast, such as finding short vectors in lattices. NIST published the first standards in 2024.">post-quantum</dfn> schemes are already being rolled out.</p>`,
			notes: `<p>The key exchange, the hash and the signature work together every time you open an HTTPS page: a Diffie–Hellman exchange agrees on a key, the server's signature proves who it is, hashes bind everything together, and a fast symmetric cipher like AES carries the actual data.</p>`
		}
	]
};
