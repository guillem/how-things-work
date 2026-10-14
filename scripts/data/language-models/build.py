"""
Builds the data of the language-models explainer from GPT-2 small's real next-token
predictions, computed here, once, with numpy:

  src/routes/language-models/gpt2-lm-data.ts   prompts, next-token distributions, sampled runs
  src/routes/language-models/gpt2-merges.bin   GPT-2's 50,000 BPE merges (for the tokenizer)
  src/routes/language-models/tokenizer-cases.ts  Python's token ids for tricky strings (tests only)

Model: GPT-2 small (124M parameters; Radford, Wu, Child, Luan, Amodei & Sutskever, "Language
Models are Unsupervised Multitask Learners", OpenAI 2019). Weights, vocabulary and BPE merges from
Hugging Face, openai-community/gpt2 at revision 607a30d783dfa663caf39e06633721c8d4cfcd7e
(licence: MIT), the same files as scripts/data/transformers/build.py. model.safetensors is
548105171 bytes, SHA-256 248dfc3911869ec493c76e65bf2fcf7f615828b0254c12b473182f0f81d3a707
(checked below).

No dependency is added to the site. To rebuild, in a throwaway directory outside the repository:

    REV=607a30d783dfa663caf39e06633721c8d4cfcd7e
    mkdir dl && for f in model.safetensors vocab.json merges.txt; do
      curl -sL -o dl/$f https://huggingface.co/openai-community/gpt2/resolve/$REV/$f; done
    python3 -m venv venv && venv/bin/pip install numpy safetensors regex
    venv/bin/python3 -I <repo>/scripts/data/language-models/build.py dl <repo>/src/routes/language-models

(about 10 minutes on a laptop: every node below is one forward pass). The tokenizer and forward
pass are in gpt2.py next to this file. Every text is prefixed with <|endoftext|>, as GPT-2 saw at
the start of documents in training.

What is stored (all probabilities are GPT-2's, over its whole vocabulary of 50,257 tokens):

  nodes     one per prompt or prefix whose next-token distribution the page shows:
            k: the K = 10 most likely next tokens (ids), l: their logits minus the largest logit
            (3 decimals), z: log Σ exp((logit − max) / T) over the WHOLE vocabulary for
            T = 0.1, 0.2, … 2.0, so that p(token | T) = exp(l / T − z(T)) exactly, for any T on
            that grid (T → 0 is the argmax). Optional: nuc, the size of the top-p nucleus for
            every T on the grid × p = 0.05, 0.10, … 1.00 (row by row) and nucm, its probability mass; ch, the node reached by
            appending each of the first CHILDREN tokens (−1 if not stored); g, GPT-2's greedy
            continuation from the node (GREEDY_AFTER ids).
  prompts   the fixed prompts: { id, text, ids, node }.
  runs      sampled continuations of RUN_LENGTH tokens (greedy: GREEDY_LENGTH):
            { prompt, T, p, seed, steps } with, at every step, d: the
            five most likely tokens of the distribution actually sampled from (temperature T,
            then top-p p, renormalised) as [id, probability]; r: the random number drawn
            (numpy default_rng(seed), 6 decimals; d has 5, and the script checks
            that the rounded numbers still select the same token); pick: the token chosen, the one whose interval of the
            cumulative distribution (tokens sorted by probability) contains r; pp: its
            probability. T = 0 is greedy decoding (always the most likely token; r unused, and d is
            the model's own distribution at T = 1).
  training  one sentence fed to the model: for each position, the probability GPT-2 gave to the
            token that really comes next, and its own top three guesses.
  tok       id → decoded text, for every id used above.

Checks (the script stops if one fails): the weights' checksum; GPT-2's vocabulary is the 256 byte
tokens in bytes_to_unicode order followed by the 50,000 merges in rank order, then <|endoftext|>;
"Paris is the capital of France, and Rome is the capital of" → " Italy" with p = 0.3543, as on the
transformers page (float64 there, float32 here); the stored z reproduces the probabilities of the
full softmax; the files stay small.
"""

import hashlib
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gpt2 import BOS, REVISION, SHA256, Model, Tokenizer, probs  # noqa: E402

K = 10
TGRID = [round(0.1 * i, 1) for i in range(1, 21)]
PGRID = [round(0.05 * i, 2) for i in range(1, 21)]
CHILDREN = 4
DEPTH = 3
GREEDY_AFTER = 12
RUN_LENGTH = 20
RUN_TOP = 5
SEEDS = [1, 2, 3]
GREEDY_LENGTH = 32
# Every shipped text was read before publishing. One high-temperature run produced a sexual
# word; it is replaced by the run with the next unused seed (documented here, not hidden).
RESEED = {('story', 1.5, 1.0, 1): 4}
RUN_SETTINGS = [(0, 1.0)] + [(T, p) for T in (0.3, 0.7, 1.0, 1.5) for p in (1.0, 0.9)]
# the bare question only needs greedy decoding and a few samples at T = 0.7 (base-model step)
SHORT_SETTINGS = [(0, 1.0), (0.7, 1.0)]

PROMPTS = [
    ('capital', 'Paris is the capital of France, and Rome is the capital of'),
    ('story', 'Once upon a time, there was a'),
    ('eiffel', 'The Eiffel Tower is in the city of'),
    ('qa', 'Q: What is the boiling point of water?\nA:'),
    ('question', 'What is the boiling point of water?'),
]
TREES = ['story', 'eiffel']
RUN_PROMPTS = ['story', 'eiffel', 'qa']
SHORT_PROMPTS = ['question']
TRAINING = 'The Eiffel Tower is in Paris. It was built in 1889 and is 330 metres tall.'
TOKENIZER_CASES = [
    'Hello world',
    'Paris',
    ' Paris',
    'paris',
    'PARIS',
    "I didn't know they'd gone.",
    'unbelievable tokenization',
    '  two spaces',
    'line one\nline two\n\n',
    'In 2026, 3.14159 × 1,000,000',
    'Café crème, naïve résumé',
    'Ünïcödé — “quotes” …',
    '東京は日本の首都です',
    'emoji 🙂👍🏽',
    'def add(a, b):\n    return a + b',
    'https://example.com/a?b=c&d=e',
    '   ',
    '',
    "It's 'quoted' and they're OK; we've won, I'm sure, you'll see",
    'The Eiffel Tower is in the city of',
]
MAX_JSON = 300_000


def sig(x, n=4):
    """x to n significant digits (so that tiny probabilities keep their size)."""
    return float(f'{float(x):.{n}g}')


def main(src, outdir):
    h = hashlib.sha256()
    with open(src + '/model.safetensors', 'rb') as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b''):
            h.update(chunk)
    assert h.hexdigest() == SHA256, h.hexdigest()

    tk = Tokenizer(src)
    model = Model(src)

    # ---- the vocabulary is bytes, then merges in rank order, then <|endoftext|>
    assert len(tk.enc) == 50257 and len(tk.merges) == 50000
    for i, u in enumerate(tk.b2u[b] for b in tk.byte_order):
        assert tk.enc[u] == i, (u, i)
    for r, (a, b) in enumerate(tk.merges):
        assert tk.enc[a + b] == 256 + r, r
    assert tk.dec[BOS] == '<|endoftext|>'

    # merges as pairs of token ids (uint16 little-endian): merge r makes token 256 + r
    pairs = np.array([[tk.enc[a], tk.enc[b]] for a, b in tk.merges], dtype='<u2')
    merges_bin = pairs.tobytes()
    assert len(merges_bin) == 200_000

    used = set()

    def node_of(ids, nuc=False):
        lg = model.logits(ids)
        top = np.argsort(-lg)[:K]
        m = lg[top[0]]
        rel = lg - m
        z = []
        for T in TGRID:
            e = rel / T
            z.append(float(np.log(np.exp(e).sum())))
        # check: the stored numbers reproduce the full softmax
        for T, zt in zip(TGRID, z):
            p = probs(lg, T)[top]
            mine = np.exp(np.round(rel[top], 3) / T - round(zt, 4))
            assert np.abs(mine - p).max() < 2e-3 * max(1.0, 1 / T), (T, np.abs(mine - p).max())
        used.update(int(i) for i in top)
        node = {
            'k': [int(i) for i in top],
            'l': [round(float(x), 3) for x in rel[top]],
            'z': [round(x, 4) for x in z],
        }
        if nuc:
            sizes, mass = [], []
            for T in TGRID:
                c = np.cumsum(np.sort(probs(lg, T))[::-1])
                for p in PGRID:
                    n = int(min(len(c), np.searchsorted(c, p - 1e-12) + 1)) if p < 1 else len(c)
                    sizes.append(n)
                    mass.append(round(float(c[n - 1]), 4))
            node['nuc'] = sizes
            node['nucm'] = mass
        return node, lg

    nodes = []
    prompts = []

    def add(node):
        nodes.append(node)
        return len(nodes) - 1

    def greedy(ids, n):
        ids = list(ids)
        out = []
        for _ in range(n):
            t = int(np.argmax(model.logits(ids)))
            ids.append(t)
            out.append(t)
        used.update(out)
        return out

    for pid, text in PROMPTS:
        ids = [BOS] + tk.encode(text)
        node, lg = node_of(ids, nuc=True)
        idx = add(node)
        prompts.append({'id': pid, 'text': text, 'ids': ids, 'node': idx})
        if pid == 'capital':
            p = probs(lg)
            italy = tk.encode(' Italy')[0]
            assert int(np.argmax(p)) == italy and abs(p[italy] - 0.3543) < 5e-4, p[italy]
        print('prompt', pid, [tk.token(i) for i in node['k'][:5]], flush=True)

    # ---- trees of choices: the top CHILDREN tokens at each level, DEPTH levels deep
    def expand(ids, idx, depth):
        node = nodes[idx]
        node['g'] = greedy(ids, GREEDY_AFTER)
        if depth == DEPTH:
            return
        ch = []
        for t in node['k'][:CHILDREN]:
            nid = ids + [t]
            child, _ = node_of(nid)
            cidx = add(child)
            ch.append(cidx)
            expand(nid, cidx, depth + 1)
        node['ch'] = ch

    for pid in TREES:
        p = next(x for x in prompts if x['id'] == pid)
        expand(p['ids'], p['node'], 0)
        print('tree', pid, len(nodes), flush=True)

    # ---- sampled runs
    runs = []
    for pid in RUN_PROMPTS + SHORT_PROMPTS:
        p = next(x for x in prompts if x['id'] == pid)
        for T, top_p in RUN_SETTINGS if pid in RUN_PROMPTS else SHORT_SETTINGS:
            for seed in SEEDS if T > 0 else [0]:
                seed = RESEED.get((pid, T, top_p, seed), seed)
                rng = np.random.default_rng(seed)
                ids = list(p['ids'])
                steps = []
                for _ in range(RUN_LENGTH if T > 0 else GREEDY_LENGTH):
                    lg = model.logits(ids)
                    if T == 0:
                        # greedy: d is the model's own distribution (T = 1), and the top token is taken
                        pr = probs(lg)
                        order = np.argsort(-pr)[:RUN_TOP]
                        pick, r = int(order[0]), None
                        d = [[int(i), round(float(pr[i]), 4)] for i in order]
                        pp = d[0][1]
                    else:
                        pr = probs(lg, T)
                        order = np.argsort(-pr)
                        c = np.cumsum(pr[order])
                        keep = len(c) if top_p >= 1 else int(np.searchsorted(c, top_p - 1e-12) + 1)
                        order = order[:keep]
                        q = pr[order] / pr[order].sum()
                        r = float(rng.random())
                        j = min(int(np.searchsorted(np.cumsum(q), r, side='right')), keep - 1)
                        pick = int(order[j])
                        d = [[int(i), round(float(x), 5)] for i, x in zip(order[:RUN_TOP], q[:RUN_TOP])]
                        pp = sig(q[j])
                        r = round(r, 6)
                        # the stored (rounded) numbers must give the same token as the exact ones
                        c, shown = 0.0, -1
                        for jj, (_, x) in enumerate(d):
                            c += x
                            if r < c:
                                shown = jj
                                break
                        assert (shown == j) if j < RUN_TOP else (shown == -1), (pid, T, top_p, seed, r)
                    steps.append({'d': d, 'r': r, 'pick': pick, 'pp': pp})
                    used.update(i for i, _ in d)
                    used.add(pick)
                    ids.append(pick)
                runs.append({'prompt': pid, 'T': T, 'p': top_p, 'seed': seed, 'steps': steps})
                print('run', pid, T, top_p, seed, repr(tk.decode([s['pick'] for s in steps])), flush=True)

    # ---- teacher forcing: what the model expected at every position of a real sentence
    ids = [BOS] + tk.encode(TRAINING)
    tr = []
    for i in range(1, len(ids)):
        pr = probs(model.logits(ids[:i]))
        top = np.argsort(-pr)[:3]
        used.update(int(x) for x in top)
        tr.append({'p': sig(pr[ids[i]]), 'top': [[int(x), sig(pr[x])] for x in top]})
    used.update(ids)
    training = {'text': TRAINING, 'ids': ids, 'steps': tr}

    for p in prompts:
        used.update(p['ids'])
    used.add(BOS)
    data = {
        'source': {
            'model': 'GPT-2 small (OpenAI, 2019)',
            'repository': 'https://huggingface.co/openai-community/gpt2',
            'revision': REVISION,
            'licence': 'MIT',
            'sha256': SHA256,
            'script': 'scripts/data/language-models/build.py',
        },
        'vocab': len(tk.enc),
        'K': K,
        'tgrid': TGRID,
        'pgrid': PGRID,
        'prompts': prompts,
        'nodes': nodes,
        'runs': runs,
        'training': training,
        'tok': {str(i): tk.token(i) for i in sorted(used)},
    }
    body = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
    assert len(body.encode('utf-8')) < MAX_JSON, len(body.encode('utf-8'))
    header = (
        '/**\n * GPT-2 small\'s next-token predictions for the language-models explainer. GENERATED by\n'
        ' * scripts/data/language-models/build.py (see its header for the format) — do not edit by hand.\n'
        ' *\n * Model: GPT-2 small, OpenAI 2019, https://huggingface.co/openai-community/gpt2 at revision\n'
        ' * 607a30d783dfa663caf39e06633721c8d4cfcd7e (model.safetensors SHA-256 248dfc39…a707). Licence: MIT.\n'
        ' * Citation: Alec Radford, Jeffrey Wu, Rewon Child, David Luan, Dario Amodei and Ilya Sutskever.\n'
        ' * 2019. Language Models are Unsupervised Multitask Learners. OpenAI.\n'
        ' *\n * Subset: 5 fixed prompts, each prefixed with <|endoftext|>; the 10 most likely next tokens with\n'
        ' * their logits and the normalisers needed for any temperature on a 0.1 grid; two trees of the\n'
        ' * top 4 choices, 3 tokens deep; sampled continuations of 20 tokens at fixed settings and seeds.\n */\n'
        "import type { LmData } from './lm';\n\n"
        '// prettier-ignore\n'
        'export const data: LmData = '
    )
    with open(outdir + '/gpt2-lm-data.ts', 'w', encoding='utf-8') as fh:
        fh.write(header + body + ';\n')
    with open(outdir + '/gpt2-merges.bin', 'wb') as fh:
        fh.write(merges_bin)
    cases = [[s, tk.encode(s)] for s in TOKENIZER_CASES]
    with open(outdir + '/tokenizer-cases.ts', 'w', encoding='utf-8') as fh:
        fh.write(
            '/**\n * GPT-2\'s own token ids for tricky strings, from the Python tokenizer of\n'
            ' * scripts/data/language-models/build.py. GENERATED — do not edit. Used only by the model tests.\n */\n'
            '// prettier-ignore\nexport const cases: [string, number[]][] = '
            + json.dumps(cases, ensure_ascii=False)
            + ';\n'
        )
    print('wrote', outdir, len(nodes), 'nodes', len(runs), 'runs', len(body), 'bytes of JSON')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
