import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';
import { CUT_AT, ROUTERS } from './network';

const router: Control = {
	type: 'select',
	id: 'router',
	label: 'Router',
	default: 'D',
	options: ROUTERS.map((r) => ({ value: r, label: r })),
	help: 'Or click a router on the map.'
};

const cut: Control = {
	type: 'select',
	id: 'cut',
	label: 'Link that fails',
	default: 'D-G',
	options: [
		{ value: 'none', label: 'None' },
		// The links of the best route and two side links; clicking the map can cut any link.
		...['A-D', 'D-G', 'G-H', 'B-F', 'C-E'].map((id) => ({ value: id, label: id.replace('-', '–') }))
	],
	help: `Or click a link on the map. It fails ${CUT_AT} s into every run.`
};

const loss: Control = {
	type: 'range',
	id: 'loss',
	label: 'Packets lost on each link',
	min: 0,
	max: 10,
	step: 1,
	default: 5,
	unit: '%'
};

const load: Control = {
	type: 'range',
	id: 'load',
	label: 'Other traffic through router G',
	min: 0,
	max: 90,
	step: 5,
	default: 60,
	unit: '%',
	help: 'As a share of what G can forward.'
};

const send: Control = {
	type: 'action',
	id: 'send',
	label: 'Luck',
	action: 'Send again',
	help: 'Same settings, different packets lost.'
};

const rtt: Control = {
	type: 'range',
	id: 'rtt',
	label: 'Round trip to the web server',
	min: 10,
	max: 300,
	step: 10,
	default: 80,
	unit: ' ms'
};

const cached: Control = {
	type: 'toggle',
	id: 'cached',
	label: 'Resolver already knows the address',
	default: false
};

export const spec: ExplainerSpec = {
	slug: 'internet',
	title: 'How the Internet moves your data',
	summary:
		'Send a message across a map of routers and watch it split into packets, find its own way hop by hop, survive cut links, lost packets and traffic jams, and arrive in one piece.',
	chapters: [
		{ id: 'packets', title: 'Packets' },
		{ id: 'trouble', title: 'When things go wrong' },
		{ id: 'web', title: 'A web page' }
	],
	steps: [
		{
			id: 'packets',
			chapter: 'packets',
			title: 'A message in pieces',
			scene: 'net',
			hints: { panel: 'header', still: 4.6 },
			duration: 26,
			body: `
<p>When Ada sends Ben a message, her computer doesn't open a private line to his, as an old telephone call did. It cuts the message into small pieces called <dfn data-def="A small chunk of data with a header in front: where it comes from, where it is going and which piece it is.">packets</dfn> and sends them out one after another.</p>
<p>Each packet starts with a <dfn data-def="The first part of a packet, read by the network: addresses, a number and a few other fields.">header</dfn>, like the outside of an envelope: who it is from, who it is for, and its number in the message. The addresses are just bits: an <dfn data-def="Internet Protocol address, version 4: a 32-bit number that identifies a computer on the Internet, written as four bytes in decimal.">IPv4 address</dfn> is 32 bits, written as four bytes, such as 192.0.2.10.</p>
<p>Watch the eight packets hop from router to router and get put back in order at Ben's end.</p>`,
			notes: `<p>Here each packet carries two letters; a real one carries up to about 1,500 bytes. Time is slowed down enormously: a signal in an optical fibre covers about 200 km per millisecond, so a real hop takes from a fraction of a millisecond to a few tens of milliseconds for a cable under an ocean. The addresses shown come from ranges set aside for examples. Strictly, the addresses sit in the IP header and the number in the TCP header that follows it (TCP numbers bytes rather than packets).</p>
<p>32 bits allow about 4.3 billion addresses, fewer than there are devices today. The newer IPv6 uses 128-bit addresses.</p>`
		},
		{
			id: 'routers',
			chapter: 'packets',
			title: 'Hop by hop',
			scene: 'net',
			hints: { panel: 'table', arrows: true, still: 3 },
			duration: 28,
			controls: [router],
			body: `
<p>A packet doesn't carry its route, and nobody plans its trip. Each <dfn data-def="A computer whose job is to pass packets on: it reads a packet's destination and sends it out along one of its links.">router</dfn> reads only the destination address and looks it up in its own <dfn data-def="A router's list of destinations, each with the neighbour to pass the packet to next.">forwarding table</dfn>: “for Ben, send it to G”. The next router does the same, and so on, hop by hop.</p>
<p>The arrows show where each router would send a packet for Ben. Nobody drew them centrally: routers tell their neighbours about their own links, the news is passed on, and each router works out the shortest way from its copy of the map by itself. Click a router to see its table.</p>`,
			notes: `<p>Inside one organisation's network this is a <em>link-state</em> protocol such as OSPF, and the shortest way is found with Dijkstra's algorithm (see the graph-search explainer). The Internet is tens of thousands of such networks; between them, routers use BGP, which passes on routes (“through me you can reach these addresses”) rather than maps. Tables list blocks of addresses rather than single computers.</p>`
		},
		{
			id: 'reroute',
			chapter: 'trouble',
			title: 'Cut a link',
			scene: 'net',
			hints: { arrows: true, useCut: true, panel: 'stats', still: 3.1 },
			duration: 30,
			controls: [cut],
			body: `
<p>Now the link between D and G fails while the message is on its way. Packets on the wire are lost. D and G notice first; the news spreads router by router (the rings), and each router changes its own arrow only when the news reaches it. Until then it keeps sending packets towards the dead link.</p>
<p>Packets sent later go round by another route, so <strong>packets of one message can take different routes</strong> and arrive out of order. Ben doesn't mind: he sorts them by their numbers. Click any link to make it fail instead.</p>`,
			notes: `<p>When nothing changes, the packets of one conversation normally all follow the same path. Different routes appear when the routes change part-way through, as here, or when a network spreads traffic over several equally good paths.</p>`
		},
		{
			id: 'loss',
			chapter: 'trouble',
			title: 'Lost packets are sent again',
			scene: 'net',
			hints: { acks: true, useLoss: true, panel: 'stats', still: 6.2 },
			duration: 32,
			controls: [loss, send],
			body: `
<p>Links lose packets now and then: noise garbles some bits, the next router spots the damage and throws the packet away. A router keeps no copy of what it has passed on, so it can't send it again.</p>
<p>Reliability is added by the two ends. Ben sends a small <dfn data-def="A short reply that says “I got packet number n”.">acknowledgement</dfn> back for every packet he gets. Ada keeps each packet until it is acknowledged, and if no acknowledgement arrives in time (a <dfn data-def="The time a sender waits for an acknowledgement before it sends a packet again.">timeout</dfn>), she sends it again. Watch the ✓ marks on her side. This is what <dfn data-def="Transmission Control Protocol: the rules much of the Internet's traffic uses to deliver data completely and in order.">TCP</dfn> does.</p>`,
			notes: `<p>An acknowledgement can be lost too; then Ada resends a packet Ben already has, and he simply acknowledges it again. Real TCP acknowledges “everything up to n”, measures the round trip to set its timeout, and resends early when acknowledgements show a gap. Applications for which late data is useless, such as video calls, use UDP and skip the resending.</p>`
		},
		{
			id: 'congestion',
			chapter: 'trouble',
			title: 'Traffic jams',
			scene: 'net',
			hints: { acks: true, useLoad: true, panel: 'stats', still: 5.2 },
			duration: 30,
			controls: [load],
			body: `
<p>Router G also carries other people's traffic (grey). It forwards one packet at a time; the others wait in its <dfn data-def="The packets waiting in a router's memory for their turn to be sent on.">queue</dfn>, and its memory holds only a few. When the queue is full, any packet that arrives is thrown away.</p>
<p>Ordinary routing doesn't steer round a busy router: routes depend on the links, not on how busy a router is. So again it's Ada's timeouts that put things right. Turn the other traffic up and down.</p>`,
			notes: `<p>Real senders also slow down when packets go missing (TCP's congestion control), and speed up again when they get through. That polite back-off by millions of senders, not any central traffic control, is what keeps the Internet from jamming solid.</p>`
		},
		{
			id: 'web',
			chapter: 'web',
			title: 'Loading a web page',
			scene: 'web',
			hints: { still: 2.5 },
			duration: 32,
			controls: [rtt, cached],
			body: `
<p>Type example.org and press Enter. First the browser needs the address: it asks a <dfn data-def="The Domain Name System: the Internet's directory, which turns names like example.org into addresses.">DNS</dfn> resolver, which asks a root server, then the .org servers, then example.org's own name server. Resolvers remember answers, so usually this step is short.</p>
<p>Then three round trips to the web server: one to open a TCP connection, one to agree secret keys (<dfn data-def="Transport Layer Security: encrypts the connection; it is the S in https.">TLS</dfn>), and one to ask for the page (“GET /”) and receive it. Every message is packets, routed hop by hop as before. Change the round trip and see why a distant server feels slow.</p>`,
			notes: `<p>Here the resolver is assumed 20 ms away and each name server 40 ms. The page itself usually needs many more packets and further requests for images and scripts, and browsers reuse connections to save the handshakes. Newer protocols (QUIC, used by HTTP/3) merge the connection and key handshakes into one round trip.</p>`
		},
		{
			id: 'nocenter',
			chapter: 'web',
			title: 'Nobody in charge',
			scene: 'net',
			hints: {
				arrows: true,
				acks: true,
				useCut: true,
				useLoss: true,
				useLoad: true,
				panel: 'stats',
				still: 4.2
			},
			duration: 40,
			controls: [cut, loss, load, send],
			body: `
<p>Now everything at once: cut a link, lose packets, jam router G. Watch how each part copes on its own.</p>
<p><strong>The Internet has no central controller.</strong> Data is cut into packets that are routed independently, each router making its own choice from its own table; when links fail, the news spreads and routers change their own minds. Routers just do their best and drop what they can't handle. <strong>Reliability is added by the two ends of the connection</strong>: numbers to put packets in order, acknowledgements, and resending after a timeout.</p>`
		}
	]
};
