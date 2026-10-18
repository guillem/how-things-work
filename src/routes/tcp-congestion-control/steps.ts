import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';
import { BUFFERS, LOSS_RATES, SENDERS } from './model';

const buffer: Control = {
	type: 'range',
	id: 'buffer',
	label: 'Router queue',
	min: BUFFERS[0],
	max: BUFFERS[BUFFERS.length - 1],
	step: 1,
	default: 60,
	values: () => BUFFERS,
	format: (v) => `${v} packets (${v} ms when full)`
};

const rule: Control = {
	type: 'select',
	id: 'rule',
	label: 'Rule',
	default: 'reno',
	options: [
		{ value: 'reno', label: 'AIMD: +1 packet per round trip, halve on loss' },
		{ value: 'mimd', label: 'MIMD: +5 % per round trip, halve on loss' }
	]
};

const rtt2: Control = {
	type: 'range',
	id: 'rtt2',
	label: "Second user's round trip",
	min: 20,
	max: 300,
	step: 1,
	default: 60,
	values: () => [20, 40, 60, 100, 150, 200, 300],
	format: (v) => `${v} ms`
};

const n2: Control = {
	type: 'range',
	id: 'n2',
	label: "Second user's connections",
	min: 1,
	max: 4,
	step: 1,
	default: 1,
	format: (v) => `${v}`
};

const loss: Control = {
	type: 'range',
	id: 'loss',
	label: 'Random loss on the link',
	min: LOSS_RATES[0],
	max: LOSS_RATES[LOSS_RATES.length - 1],
	step: 0.0001,
	default: 0.002,
	values: () => LOSS_RATES,
	format: (v) => `${Number((v * 100).toPrecision(2))} % of packets`
};

const senders: Control = {
	type: 'range',
	id: 'senders',
	label: 'Senders',
	min: SENDERS[0],
	max: SENDERS[SENDERS.length - 1],
	step: 1,
	default: 32,
	values: () => SENDERS,
	format: (v) => `${v}`
};

const backoff: Control = {
	type: 'toggle',
	id: 'backoff',
	label: 'Congestion control (Jacobson 1988)',
	default: false
};

const rival: Control = {
	type: 'toggle',
	id: 'rival',
	label: 'A Reno flow joins at 30 s',
	default: false
};

/**
 * Scenes: `pipe` (one sender's packets and acknowledgements crossing a bottleneck, with the
 * window plotted below; hints `focus` 'window' | 'start'), `trace` (one Reno flow over 40 s:
 * window, queue delay and rate; `focus` 'saw' | 'bloat', the latter with the sweep over queue
 * sizes), `phase` (two flows in Chiu & Jain's phase plane), `share` (flows with different round
 * trips and a user with several connections), `mathis` (throughput against random loss),
 * `collapse` (goodput against the number of senders) and `compare` (Reno, CUBIC and Vegas on a
 * longer, faster path).
 */
export const spec: ExplainerSpec = {
	slug: 'tcp-congestion-control',
	title: 'TCP congestion control: probing for a share',
	summary:
		'Send a file through a bottleneck router and watch the sender feel for the link: slow start, a lost packet, the AIMD sawtooth. Add flows, enlarge the queue, lose packets to noise, remove the backoff, and compare Reno, CUBIC and Vegas.',
	chapters: [
		{ id: 'one', title: 'One sender' },
		{ id: 'share', title: 'Sharing the bottleneck' },
		{ id: 'signal', title: 'Loss as the signal' },
		{ id: 'beyond', title: 'Beyond Reno' }
	],
	steps: [
		// ------------------------------------------------------------------ one
		{
			id: 'window',
			chapter: 'one',
			title: 'A window of packets in flight',
			scene: 'pipe',
			hints: { focus: 'window' },
			duration: 30,
			body: `
<p>A file goes from a server to you through a dozen routers, and somewhere on the way is the slowest link, the <dfn data-def="The link with the lowest capacity on a path; it sets the most the path can carry, and its router is where packets queue up.">bottleneck</dfn>. Here it carries 12 Mbit/s: 1000 packets of 1500 bytes a second. In front of it sits a router with a queue for 60 packets; a packet that arrives to a full queue is thrown away (<dfn data-def="The simplest queue: first in, first out, and when it is full every new arrival is dropped.">drop-tail</dfn>).</p>
<p>The sender doesn't know the bottleneck's speed, or how many others are using it. It keeps a <strong>congestion window</strong>, cwnd: the number of packets it may have sent but not yet seen <a href="../internet/#loss">acknowledged</a>. Each acknowledgement that returns lets a new packet out, so the sender sends about cwnd packets per round trip: a rate of cwnd ÷ RTT.</p>
<p>That is not the receiver's window. The receiver advertises how much it can buffer (<dfn data-def="Flow control: the receiver tells the sender how much free buffer it has, so a fast sender can't overwhelm a slow receiver.">flow control</dfn>), which protects the receiver; the congestion window protects the network. TCP sends no more than the smaller of the two. Here the receiver could take anything, so the congestion window alone decides.</p>`,
			notes: `<p>Base round trip 60 ms: 15 ms to the router, 15 ms on to the receiver, 30 ms for the acknowledgement back. The path itself holds rate × round trip = 1000 × 0.06 = 60 packets (the <dfn data-def="Bandwidth-delay product: how much data is in flight when a path is full; rate × round-trip time.">bandwidth-delay product</dfn>), and the queue 60 more. The picture is slowed down 20 times; one dot is one packet, acknowledgements are the small dots on the lower lane. The receiver here acknowledges every packet; real receivers usually acknowledge every second one (delayed ACKs), which changes the numbers a little, not the picture.</p>`
		},
		{
			id: 'slow-start',
			chapter: 'one',
			title: 'Slow start: double until something breaks',
			scene: 'pipe',
			hints: { focus: 'start' },
			duration: 34,
			body: `
<p>A new connection starts with a window of 2 packets. In <strong>slow start</strong> every acknowledgement adds one packet to the window, so each round trip the window doubles: 2, 4, 8, 16, 32, 64… It reaches the path's 60 packets in about five round trips, a third of a second.</p>
<p>Past that point the extra packets pile up in the router's queue, and when the window passes 121 (60 in the pipe, 61 at the router) the queue overflows. Slow start doesn't stop there: the acknowledgements telling the sender about the first loss are still a round trip away, so it keeps doubling and loses about a hundred packets at once.</p>
<p>The receiver keeps the packets that arrive after a gap and reports them (<dfn data-def="Selective acknowledgement: the receiver tells the sender which later packets it already holds, so the sender knows exactly which are missing.">SACK</dfn>). Three later packets arriving while one is missing tells the sender it was lost: it resends the missing ones and <strong>halves</strong> its window. This is <dfn data-def="Resending a packet as soon as three later packets are reported, instead of waiting for the retransmission timer.">fast retransmit</dfn>.</p>`,
			notes: `<p>Slow start is slow only next to what came before it: senders used to blast a whole receiver window at once. Today's stacks start with 10 packets (RFC 6928) instead of 2, and Linux's CUBIC adds HyStart, which watches the round trip grow and leaves slow start before the overshoot. Loss recovery here follows RFC 6675: a packet counts as lost once three packets sent after it have arrived, and the window is halved once per window of data, however many packets that window lost.</p>`
		},
		{
			id: 'sawtooth',
			chapter: 'one',
			title: 'Additive increase, multiplicative decrease',
			scene: 'trace',
			hints: { focus: 'saw' },
			duration: 30,
			controls: [buffer],
			body: `
<p>After slow start comes <strong>congestion avoidance</strong>: the window grows by just one packet per round trip (each acknowledgement adds 1/cwnd). When a loss shows up, it is halved. <dfn data-def="Additive increase, multiplicative decrease: grow the window by a constant each round trip, cut it by a factor on each loss.">AIMD</dfn> traces a sawtooth: the window climbs from 61 to 121 packets, the queue fills, one packet is dropped, the window falls back to 61.</p>
<p>Nobody told the sender to slow down. The router doesn't send a message; it just drops a packet when its queue is full, and the sender infers congestion from the loss. That is <a href="../feedback-control/#proportional">feedback control</a> with the network as the plant and the lost packet as the only sensor reading: a reading that arrives a round trip late, which is why the loop overshoots.</p>
<p>Shrink the queue below the path's 60 packets and the halved window no longer fills the pipe: the link idles after every loss. With 60 or more, the queue absorbs the cut and the link stays busy.</p>`,
			notes: `<p>Routers can also mark packets instead of dropping them (<dfn data-def="Explicit Congestion Notification (RFC 3168): a router sets two bits in a packet's IP header when its queue is building; the receiver echoes the mark and the sender reacts as if a packet had been lost.">ECN</dfn>), and active queue management such as CoDel drops or marks early, before the queue is full; but most of the Internet still runs on drops. Window halving was Van Jacobson's 1988 rule ("Congestion avoidance and control"), and became Reno with fast recovery in 1990. With the queue equal to the bandwidth-delay product, a single AIMD flow keeps the link busy all the time: the classic buffer-sizing rule.</p>`
		},
		{
			id: 'bufferbloat',
			chapter: 'one',
			title: 'Bigger queues only add delay',
			scene: 'trace',
			hints: { focus: 'bloat' },
			duration: 30,
			controls: [buffer],
			body: `
<p>If a small queue wastes the link, why not a huge one? Because a loss-based sender fills whatever queue it is given before it backs off. The chart below runs the same flow with eight queue sizes.</p>
<p>Up to 60 packets, a bigger queue buys throughput. Beyond it, none at all: the link was already busy. Each extra packet in the queue is another millisecond of waiting for every packet behind it, so the round trip grows from 60 ms towards 60 + 400 ms. A video call sharing this link would wait too.</p>
<p>This is <dfn data-def="Excessive delay caused by oversized buffers that loss-based senders keep full.">bufferbloat</dfn>, and cheap memory made it common in home routers and cable modems: queues of seconds behind a slow uplink. Here, slide the queue to 400 and watch the delay balloon while the rate stays put.</p>`,
			notes: `<p>Each point is 40 s of simulated time, averaged after the first 10 s. With 300 or 400 packets of queue, the window grows so slowly (one packet per 300-ms round trip) that the queue doesn't fill again within the run; the delay is already well beyond what a phone call tolerates (about 150 ms one way). Jim Gettys named bufferbloat in 2010; its cures are active queue management in routers (CoDel, FQ-CoDel, RFC 8290) and senders that watch delay as well as loss.</p>`
		},
		// ------------------------------------------------------------------ share
		{
			id: 'fairness',
			chapter: 'share',
			title: 'Two flows find equal shares',
			scene: 'phase',
			duration: 36,
			controls: [rule],
			body: `
<p>A second flow starts 5 s after the first, when the first already has the whole link. Plot one flow's window against the other's: every point on the line where they add up to 121 fills the link and the queue, and the diagonal is where they are equal.</p>
<p>Under AIMD both windows grow by one packet per round trip: the point moves at 45°, parallel to the diagonal, keeping the difference. A loss halves both: the point moves towards the origin, halving the difference. Each cycle the gap shrinks, and the flows converge to equal shares, wherever they started. Dah-Ming Chiu and Raj Jain proved in 1989 that among linear rules only this one converges to fairness while staying efficient.</p>
<p>Switch to multiplicative increase (MIMD): both grow by 5 % a round trip and halve on loss, so the ratio between them never changes, and the late flow stays a small one.</p>`,
			notes: `<p>Chiu and Jain, "Analysis of the increase and decrease algorithms for congestion avoidance in computer networks" (1989). Their argument assumes both flows see every loss. A full drop-tail queue usually does drop packets of both flows in the same overflow, as here, but not always, so the path wobbles around the ideal one. Additive increase with additive decrease (AIAD) keeps the difference unchanged as well, in their picture; multiplicative decrease is what pulls the flows together.</p>`
		},
		{
			id: 'rtt',
			chapter: 'share',
			title: 'Fair per flow, and only for equal round trips',
			scene: 'share',
			duration: 34,
			controls: [rtt2, n2],
			body: `
<p>AIMD's fairness has fine print. Each window grows by one packet per <em>round trip</em>, so a flow with a short round trip grows faster, and it sends its window more often. Give the second user a 150 ms path against the first's 60 ms and it gets about a quarter of the link, not half. A flow with a short round trip grabs more.</p>
<p>And it is fair between <em>flows</em>, not people. Let the second user open four connections, as a download manager does, and the bottleneck gives each connection about the same: four fifths for the second user, one fifth for the first. TCP has no idea who is behind a connection.</p>`,
			notes: `<p>Flows that lose packets independently at the same rate get throughput ∝ 1/RTT (the Mathis formula of the next chapter). Flows that lose in the same overflows, as a drop-tail queue tends to make them, grow for the same time between losses, each by one packet per its own round trip, so their windows go as 1/RTT and their rates as 1/RTT². The queueing delay both flows share is part of each round trip, which softens the bias: 60 and 150 ms of path become about 90 and 180 ms. CUBIC (last chapter) grows with time rather than per round trip, partly to reduce this bias.</p>`
		},
		// ------------------------------------------------------------------ signal
		{
			id: 'mathis',
			chapter: 'signal',
			title: 'Throughput from the loss rate',
			scene: 'mathis',
			duration: 30,
			controls: [loss],
			body: `
<p>If every loss halves the window and the window climbs back one packet per round trip, the loss rate fixes the size of the sawtooth. Work it through: a window cycling from W/2 to W lasts W/2 round trips and carries 3W²/8 packets, one of them lost, so p = 8/(3W²) and the average rate is ¾W/RTT. Eliminate W:</p>
<p class="formula">rate ≈ (MSS ÷ RTT) × √(3/2) ÷ √p ≈ 1.22 · MSS ÷ (RTT · √p)</p>
<p>That is the formula of Mathis, Semke, Mahdavi and Ott (1997). The dots are the simulation on a fast link with a 100 ms round trip that loses packets at random. They follow the line within about 20 %: four times the loss, half the rate.</p>
<p>The link here is never congested; its losses are noise, as on a weak <a href="../wireless-signals/">wireless link</a>. TCP can't tell the difference and backs off anyway: 1 % random loss caps this flow near 1.5 Mbit/s on a link that could carry 120. That's why Wi-Fi and mobile links resend damaged frames themselves, so that TCP rarely sees the loss.</p>`,
			notes: `<p>Mathis and colleagues measured a constant between 0.87 and 1.31 depending on the acknowledgement policy and whether losses are periodic or random; random losses with an acknowledgement for every packet give about 1.31, 7 % above 1.22, close to what the simulation shows. At high loss rates retransmission timeouts take over and the formula is too optimistic; the more detailed model of Padhye and colleagues (1998) includes them. The same formula, in reverse, is why a fast long-distance transfer needs a loss rate of one in a billion or less: one reason for CUBIC.</p>`
		},
		{
			id: 'collapse',
			chapter: 'signal',
			title: 'Congestion collapse',
			scene: 'collapse',
			duration: 32,
			controls: [senders, backoff],
			body: `
<p>In October 1986 the link between the Lawrence Berkeley Laboratory and the University of California at Berkeley, 400 yards apart, slowed from 32 kbit/s to 40 bit/s. The network wasn't broken; it was busy carrying copies.</p>
<p>TCP then had no congestion window. Each sender kept its receiver's whole window in flight, and resent any packet whose timer, twice the average round trip, ran out. When queues grow, round trips grow; timers fire on packets that are only waiting; the copies make the queues longer still. The bottleneck stays fully busy, but more and more of what it carries is packets the receiver already has.</p>
<p>Add senders with congestion control off: the useful throughput (<dfn data-def="The data delivered to the receiving application, each byte counted once: throughput minus duplicates.">goodput</dfn>) falls as the load rises. Switch it on and the same crowd keeps more than 90 % of the link useful, because every sender backs off.</p>`,
			notes: `<p>Van Jacobson and Michael Karels, "Congestion avoidance and control" (SIGCOMM 1988), introduced slow start, the congestion window with AIMD, a round-trip estimator with a variance term, exponential backoff of the retransmission timer, and fast retransmit. The senders without them here follow RFC 793: a timer for every packet set to twice a smoothed round trip, no backoff; and they time the round trip from a packet's latest transmission, so an acknowledgement of the original that arrives after a resend looks like a short round trip and shortens the timer further (the ambiguity Karn and Partridge resolved in 1987). Each has a receiver window of 16 packets; round trips from 50 to 100 ms. John Nagle had described this collapse in 1984 (RFC 896). The real 1986 collapse was far deeper than this simulation's, across several hops and slower links.</p>`
		},
		// ------------------------------------------------------------------ beyond
		{
			id: 'compare',
			chapter: 'beyond',
			title: 'CUBIC and a delay-based sender',
			scene: 'compare',
			duration: 36,
			controls: [rival],
			body: `
<p>On a faster, longer path (24 Mbit/s, 100 ms, a queue of 100 packets) Reno's one packet per round trip is slow: after a loss it takes about 18 seconds to climb back. <strong>CUBIC</strong>, the default in Linux, Windows and macOS, grows its window as a cubic function of the time since the last loss: fast at first, flat near the window where the loss happened, then probing beyond it (RFC 9438). It refills in four to ten seconds, and backs off by only 30 %.</p>
<p><strong>Vegas</strong> (1994) listens to delay instead of loss: it compares the rate it would get on an empty path, cwnd ÷ the shortest round trip, with the rate it gets, and keeps just 2 to 4 of its own packets in the queue. Alone, it fills the link with almost no queue and no losses.</p>
<p>Now let a Reno flow join. Reno fills the queue; Vegas sees the delay rise and backs off; Reno fills the space. A polite sender loses to a loss-based one, which is why Vegas never spread.</p>`,
			notes: `<p>CUBIC: W(t) = C(t − K)³ + W<sub>max</sub>, with C = 0.4, β = 0.7 (the window becomes 0.7 W<sub>max</sub> after a loss), K = ∛(W<sub>max</sub>(1 − β)/C), and a "Reno-friendly" floor so it is never slower than Reno would be (Ha, Rhee and Xu 2008; RFC 9438). Vegas: Brakmo and Peterson (1995). Google's <strong>BBR</strong> (Cardwell and colleagues, 2016) goes further: it estimates the bottleneck's rate and the empty-path round trip, and paces packets at that rate instead of keeping a window full, so it keeps queues short without yielding entirely; its fairness with CUBIC has been the subject of much study, and BBR is still evolving. Both flows here start with a slow-start threshold of 100 packets, as one remembered from an earlier connection would give, to skip the overshoot of the second step.</p>`
		}
	]
};
