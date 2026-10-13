<!-- batch msgbatch_01RwbH2w8JY5g9dqUqigDc89, claude-opus-5-5, submitted 2026-10-13T06:28:32.417Z, ~$0.58 in tokens + 8 web searches -->
# Review: internet

## Verdict
The page is ready after the fixes below. Most of it checks out: the facts, the routing model (Dijkstra on link delays, the news of a cut flooding out from both ends, each router keeping its own table), the selective-repeat resending and the web-request timeline. I ran the model under Node and it does what the narrative promises. With D–G cut, packets 1 and 2 are lost on the wire, later packets go A-D-B-F-H and then A-B-F-H, and packet 6 reaches Ben before packet 5. At 60% load, G drops about two of Ada's packets per run and every one gets resent. The most important fix is the "Cut a link" note. It says that spreading traffic over equally good paths sends one conversation's packets down different routes, but real routers deliberately keep each connection on one path. Second in importance: the "Cut a link" step shows resends that the text never explains, and the busy-router queue is a simplification the page doesn't state.

## Factual errors
- **medium**, steps.ts:124. The note says different routes for one conversation also appear "when a network spreads traffic over several equally good paths". Routers that use equal-cost multipath hash each connection onto a single path, precisely to avoid reordering. So that mechanism spreads *different* conversations across paths, not the packets of one. Fix: "…Different routes appear when the routes change part-way through, as here. Networks that spread traffic over several equally good paths usually keep each connection on one of them, precisely so its packets don't arrive out of order." Sources: https://dev.to/pathvector-dev/ecmp-explained-two-equal-paths-and-the-kernel-hashes-flows-across-them-1cbo and RFC 2992, https://www.rfc-editor.org/rfc/rfc2992
- **medium**, steps.ts:135 (and the 5% default, steps.ts:34). The step presents noise as the normal reason links lose packets, and 5% per link (about 23% per packet one way) is far above what real wired links lose to bit errors. In wired network, packet loss is mainly due to congestion in path. This simplification isn't stated on the page. Fix: add to the notes "Real wired links lose far fewer packets to noise than this; the rate is exaggerated so you can see it. Most real losses happen at full queues, as in the next step." Source: https://www.researchgate.net/publication/343749274_Impact_of_Router's_Buffer_Size_on_Packet_Loss_Due_To_Congestion_in_TCP
- **low**, steps.ts:161. The cold lookup walks root → .org → example.org. Real resolvers also cache the root and .org referrals (they are kept for days), so even a name the resolver hasn't seen usually needs only the last query. Fix: add to the notes "Even without the answer, a resolver usually remembers where the .org servers are, so it skips the first two questions." I'm confident in this but didn't fetch a source.

Checked and correct: about 200 km per millisecond in fibre; packets of up to about 1,500 bytes; 2³² ≈ 4.3 billion addresses; IPv6 uses 128 bits; TCP numbers bytes, not packets; OSPF is link-state, BGP passes on routes; TLS 1.3 needs one round trip (a faster handshake (1-RTT), https://securew2.com/blog/tls-explained); QUIC merges the two handshakes; UDP for video calls; the addresses come from the RFC 5737 example ranges (https://www.rfc-editor.org/rfc/rfc5737.txt).

## Model issues
- **medium**, network.ts:17–20, 536–579, and steps.ts:148. Each router is one first-come-first-served server, so the other traffic going F→G→E competes with Ada's packets going G→H. In a real router, packets wait in a queue in front of each *outgoing* link. Traffic leaving towards E wouldn't delay traffic leaving towards H, and jams form where more traffic heads for one link than it can carry. Fix: in network.ts:542 change `const to = 'E';` to `const to = 'H';` so the extra traffic competes for the G–H link. Then add to the congestion notes: "Here a router handles one packet at a time; a real router keeps a queue for each outgoing link, and a jam forms where more traffic heads for one link than it can carry."
- **low**, e2e/network-model.e2e.ts:113. `reassemble(r.chunks, r.count)` always passes, because `r.chunks` is just `packetize()`, not what Ben received. Fix:
  ```ts
  const got: string[] = [];
  for (const p of r.packets)
  	if (p.kind === 'data' && p.fate === 'delivered') got[p.seq] = r.chunks[p.seq];
  expect(reassemble(got, r.count)).toBe(MESSAGE);
  ```
  A real fix would carry the data inside the packet.
- **low**, network.ts:158 and NetScene.svelte:57–58. At 10% loss, about 1 run in 200 never completes by `HORIZON` (60 s). Ben's panel then says "waiting for packet n…" until the loop restarts, and when `done` is Infinity the loop lasts a full minute. Fix: raise `HORIZON` to 120, or cap Ada's attempts and show "gave up".
- **low**, WebScene.svelte:8. The comment says playback is "100× slower", but `SLOW = 0.01` s per ms makes it 10× slower. Fix: change the comment to "10× slower".

## Narrative and scene mismatches
- **medium**, steps.ts:122–123 (step "reroute"). With D–G cut, the scene resends packets 1 and 2 at 7.4 s and 7.8 s: the outbox shows "×2" and the counter shows "sent again 2". Acknowledgements and timeouts aren't shown or explained until the next step, and the text never says how the lost packets reach Ben. Fix: add after "Packets on the wire are lost.": "Ada will notice they never arrived and send them again; the next step shows how."
- **low**, steps.ts:163. "The resolver is assumed 20 ms away and each name server 40 ms": in the model these are *round trips* (`r / 2` per leg). Fix: "Here the round trip to the resolver is assumed to be 20 ms, and to each name server 40 ms."
- **low**, steps.ts:21. The "Link that fails" menu offers B–F and C–E. I ran both: the message behaves exactly as with no cut, which may puzzle the reader. Fix: add to the step body "Cut a side link such as B–F and the message isn't affected at all, though some arrows still change."

## Catalogue requirements
All met. The message is split into packets that travel hop by hop, sometimes by different routes, and are put back together. The reader can cut links, congest router G and drop packets, and watch the network reroute and Ada resend. The web request is traced from the name lookup to the page. The takeaway (each router's own arrows, the news spreading, resends only at the ends) can be seen in the graphic.

## Clarity
- **low**, steps.ts:162. "Round trip" isn't explained for a level-1 reader. Fix: "Then three round trips (there and back) to the web server…"
- **low**, steps.ts:166–167. "Nobody in charge" is a router-map summary but sits in the chapter "A web page". Fix: move it into the `trouble` chapter, or give it its own chapter, e.g. `{ id: 'summary', title: 'Nobody in charge' }`.

## Sources consulted
- https://www.rfc-editor.org/rfc/rfc2992 (Analysis of an Equal-Cost Multi-Path Algorithm)
- https://dev.to/pathvector-dev/ecmp-explained-two-equal-paths-and-the-kernel-hashes-flows-across-them-1cbo
- https://www.researchgate.net/publication/343749274_Impact_of_Router's_Buffer_Size_on_Packet_Loss_Due_To_Congestion_in_TCP
- https://archive.nanog.org/sites/default/files/wednesday_tutorial_szarecki_packet-buffering.pdf (queues at the outgoing ports of routers)
- https://securew2.com/blog/tls-explained (TLS 1.3, RFC 8446, one round trip)
- https://www.rfc-editor.org/rfc/rfc5737.txt (IPv4 example address ranges)
- My own runs of `network.ts` under Node 22 (every option in the cut menu, loads of 30/60/90% and 200 seeds for loss and for all problems at once)
