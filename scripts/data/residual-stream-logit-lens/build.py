"""
Builds src/routes/residual-stream-logit-lens/lens-data.ts: the residual stream of GPT-2 small for
five fixed prompts, read out with the logit lens after every block, and the same runs with each
block's attention or MLP output switched off (zero-ablated), computed here once with numpy.

Model: GPT-2 small (124M parameters; Radford, Wu, Child, Luan, Amodei & Sutskever, "Language
Models are Unsupervised Multitask Learners", OpenAI 2019). Weights, vocabulary and BPE merges from
Hugging Face, openai-community/gpt2 at revision 607a30d783dfa663caf39e06633721c8d4cfcd7e
(licence: MIT), the same files as the transformers and language-models pages.

No dependency is added to the site, and no PyTorch is needed. To rebuild, in a throwaway directory
outside the repository:

    REV=607a30d783dfa663caf39e06633721c8d4cfcd7e
    mkdir dl && for f in model.safetensors vocab.json merges.txt; do
      curl -sL -o dl/$f https://huggingface.co/openai-community/gpt2/resolve/$REV/$f; done
    python3 -m venv venv && venv/bin/pip install numpy safetensors regex
    venv/bin/python3 -I <repo>/scripts/data/residual-stream-logit-lens/build.py dl \
      <repo>/src/routes/residual-stream-logit-lens/lens-data.ts

The tokenizer is the one in scripts/data/language-models/gpt2.py. The forward pass is GPT-2's own,
as in scripts/data/transformers/build.py, in float64: x_0 = token embedding + position embedding;
block l adds a_l = Attn_l(LN1_l(x)) and then m_l = MLP_l(LN2_l(x)) to the running vector x, so
after block l, x_{l+1} = x_l + a_l + m_l. The logit lens (nostalgebraist 2020) reads any x_L as
the model reads its last one: softmax(LN_f(x_L) · W_Eᵀ), the final layer norm then the (tied)
unembedding. After block 12 it is the model's own output. Each prompt starts with <|endoftext|>.

Zero-ablation of a component: the run is repeated with that block's attention output a_l (or MLP
output m_l), bias included, replaced by zeros at every position; everything else is recomputed.

Checks run on every build (the script stops if one fails): the stream is the sum of its parts;
the clean run through the ablation code equals the plain run; for the indirect-object sentence
the top next token is " Mary" (Wang et al. 2022), for the count " 7", for the repeated phrase
" fox".

Output: a TypeScript module exporting `data` (type LensData from lens.ts). For each prompt:
  tokens   the decoded tokens, the first being <|endoftext|> (position 0, never read out)
  vocab    the token strings the readouts below index into
  lens     [layer 0..12][position 1..n-1] → [i1, p1, i2, p2, i3, p3]: the lens's three most likely
           next tokens (indices into vocab) and their probabilities in thousandths
  answer   [layer][position] → probability, in thousandths, of the token the model finally
           predicts at that position (its top-1 after block 12)
  last     the last position in detail: stream[L] = |x_L|; attn[l], mlp[l] = |a_l|, |m_l|;
           ln1[l], ln2[l] = the standard deviation each block's layer norms divide by;
           plane: the 2-D projection of x_0 and of every a_l, m_l onto two unit directions:
           u = the final answer's unembedding direction as the lens sees it (γ_f ∘ W_E[answer],
           centred, as the final layer norm subtracts the mean), and v = the same for the
           runner-up, made orthogonal to u. Projections are linear, so the arrows sum exactly
           to the projection of x_L. Also the answer's and the runner-up's tokens.
  ablate   24 entries, attn 0, mlp 0, attn 1, … mlp 11: for the run without that component,
           grid[layer][position] = [i, p] the lens's top-1 for layers after the switched-off
           block (rows before it are unchanged), and next = the final top three at the last
           position as [token, p] and pAnswer = the clean answer's probability (thousandths).
"""

import json
import os
import sys
import warnings

import numpy as np

sys.dont_write_bytecode = True  # no __pycache__ next to gpt2.py in the repository
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'language-models'))
from gpt2 import BOS, REVISION, SHA256, Tokenizer  # noqa: E402
from safetensors.numpy import load_file  # noqa: E402

warnings.filterwarnings('ignore', category=RuntimeWarning)

PROMPTS = [
    ('mary', 'When Mary and John went to the store, John gave a drink to', ' Mary'),
    ('count', '1, 2, 3, 4, 5, 6,', ' 7'),
    ('fox', 'The quick brown fox jumps. The quick brown', ' fox'),
    ('light', 'She opened the door and turned on the', None),
    ('france', 'The capital of France is the city of', None),
]
TOP = 3


def main(src, out):
    tok = Tokenizer(src)
    W = {k: v.astype(np.float64) for k, v in load_file(src + '/model.safetensors').items()}
    wte = W['wte.weight']

    def ln(x, g, b):
        m = x.mean(-1, keepdims=True)
        v = ((x - m) ** 2).mean(-1, keepdims=True)
        return (x - m) / np.sqrt(v + 1e-5) * g + b

    def sd(x):
        return np.sqrt(((x - x.mean(-1, keepdims=True)) ** 2).mean(-1) + 1e-5)

    def gelu(x):
        return 0.5 * x * (1 + np.tanh(np.sqrt(2 / np.pi) * (x + 0.044715 * x**3)))

    def run(ids, off=None):
        """The stream x_0..x_12 (13 × n × 768), the parts a_l, m_l, and the layer norms' σ."""
        n = len(ids)
        x = wte[ids] + W['wpe.weight'][:n]
        mask = np.triu(np.full((n, n), -np.inf), 1)
        stream, attn, mlp, s1, s2 = [x.copy()], [], [], [], []
        for l in range(12):
            p = f'h.{l}.'
            s1.append(sd(x))
            h = ln(x, W[p + 'ln_1.weight'], W[p + 'ln_1.bias'])
            qkv = h @ W[p + 'attn.c_attn.weight'] + W[p + 'attn.c_attn.bias']
            q, k, v = (m.reshape(n, 12, 64).transpose(1, 0, 2) for m in np.split(qkv, 3, axis=-1))
            s = q @ k.transpose(0, 2, 1) / 8 + mask
            a = np.exp(s - s.max(-1, keepdims=True))
            a /= a.sum(-1, keepdims=True)
            av = (a @ v).transpose(1, 0, 2).reshape(n, 768) @ W[p + 'attn.c_proj.weight'] + W[p + 'attn.c_proj.bias']
            if off == ('attn', l):
                av = np.zeros_like(av)
            x = x + av
            s2.append(sd(x))
            h = ln(x, W[p + 'ln_2.weight'], W[p + 'ln_2.bias'])
            mv = gelu(h @ W[p + 'mlp.c_fc.weight'] + W[p + 'mlp.c_fc.bias']) @ W[p + 'mlp.c_proj.weight'] + W[p + 'mlp.c_proj.bias']
            if off == ('mlp', l):
                mv = np.zeros_like(mv)
            x = x + mv
            attn.append(av)
            mlp.append(mv)
            stream.append(x.copy())
        out = np.array(stream)
        assert np.isfinite(out).all()
        return out, np.array(attn), np.array(mlp), np.array(s1), np.array(s2)

    def lens(x):
        z = ln(x, W['ln_f.weight'], W['ln_f.bias']) @ wte.T
        p = np.exp(z - z.max(-1, keepdims=True))
        return p / p.sum(-1, keepdims=True)

    # What the lens reads of a token: γ_f ∘ W_E[t], centred (the final layer norm subtracts the
    # mean), minus the same for the average token. Adding the average part raises every logit
    # alike, which the softmax ignores; GPT-2's last blocks write a lot along it.
    mean_row = wte.mean(0)

    def direction(t):
        d = W['ln_f.weight'] * (wte[t] - mean_row)
        return d - d.mean()

    def per_mille(p):
        return int(round(float(p) * 1000))

    prompts = []
    for pid, text, expect in PROMPTS:
        ids = [BOS] + tok.encode(text)
        n = len(ids)
        assert n <= 16, (pid, n)
        stream, attn, mlp, s1, s2 = run(ids)
        # the stream is the sum of its parts
        assert np.allclose(stream[12], stream[0] + attn.sum(0) + mlp.sum(0))
        clean2, *_ = run(ids, ('none', -1))
        assert np.array_equal(clean2, stream)
        P = lens(stream)  # 13 × n × vocab
        final = P[12].argmax(-1)
        if expect is not None:
            assert tok.token(int(final[-1])) == expect, (pid, tok.token(int(final[-1])))

        vocab, index = [], {}

        def vi(t):
            t = int(t)
            if t not in index:
                index[t] = len(vocab)
                vocab.append(tok.token(t))
            return index[t]

        lens_rows, answer_rows = [], []
        for L in range(13):
            row, arow = [], []
            for i in range(1, n):
                top = np.argsort(-P[L, i])[:TOP]
                cell = []
                for t in top:
                    cell += [vi(t), per_mille(P[L, i, t])]
                row.append(cell)
                arow.append(per_mille(P[L, i, final[i]]))
            lens_rows.append(row)
            answer_rows.append(arow)

        order = np.argsort(-P[12, -1])
        ans, run_up = int(order[0]), int(order[1])
        u = direction(ans)
        u /= np.linalg.norm(u)
        v = direction(run_up)
        v -= (v @ u) * u
        v /= np.linalg.norm(v)
        proj = lambda vec: [round(float(vec @ u), 3), round(float(vec @ v), 3)]
        last = {
            'stream': [round(float(np.linalg.norm(stream[L, -1])), 2) for L in range(13)],
            'attn': [round(float(np.linalg.norm(attn[l, -1])), 2) for l in range(12)],
            'mlp': [round(float(np.linalg.norm(mlp[l, -1])), 2) for l in range(12)],
            'ln1': [round(float(s1[l, -1]), 3) for l in range(12)],
            'ln2': [round(float(s2[l, -1]), 3) for l in range(12)],
            'answer': tok.token(ans),
            'runnerUp': tok.token(run_up),
            'plane': {
                'x0': proj(stream[0, -1]),
                'attn': [proj(attn[l, -1]) for l in range(12)],
                'mlp': [proj(mlp[l, -1]) for l in range(12)],
                'final': proj(stream[12, -1]),
            },
        }

        ablate = []
        for l in range(12):
            for kind in ('attn', 'mlp'):
                s_off, *_ = run(ids, (kind, l))
                # rows up to block l (attention) are unchanged
                assert np.array_equal(s_off[: l + 1], stream[: l + 1])
                Q = lens(s_off[l + 1 :])
                grid = [[[vi(Q[r, i].argmax()), per_mille(Q[r, i].max())] for i in range(1, n)] for r in range(len(Q))]
                q = Q[-1, -1]
                top = np.argsort(-q)[:TOP]
                ablate.append(
                    {
                        'kind': kind,
                        'layer': l,
                        'grid': grid,
                        'next': [[tok.token(int(t)), per_mille(q[t])] for t in top],
                        'pAnswer': per_mille(q[ans]),
                    }
                )

        prompts.append(
            {
                'id': pid,
                'text': text,
                'tokens': [tok.token(i) for i in ids],
                'vocab': vocab,
                'lens': lens_rows,
                'answer': answer_rows,
                'last': last,
                'next': [[tok.token(int(t)), round(float(P[12, -1, t]), 4)] for t in order[:5]],
                'ablate': ablate,
            }
        )
        print(pid, n, 'tokens; answer', repr(tok.token(ans)), round(float(P[12, -1, ans]), 3))

    data = {
        'source': {
            'model': 'GPT-2 small (OpenAI, 2019)',
            'repository': 'https://huggingface.co/openai-community/gpt2',
            'revision': REVISION,
            'licence': 'MIT',
            'sha256': SHA256,
            'script': 'scripts/data/residual-stream-logit-lens/build.py',
        },
        'prompts': prompts,
    }
    header = (
        '/**\n * GPT-2 small through the logit lens, for the residual-stream explainer. GENERATED by\n'
        ' * scripts/data/residual-stream-logit-lens/build.py (see its header for the format) — do not\n'
        ' * edit by hand.\n *\n'
        ' * Model: GPT-2 small, OpenAI 2019, https://huggingface.co/openai-community/gpt2 at revision\n'
        ' * 607a30d783dfa663caf39e06633721c8d4cfcd7e (model.safetensors SHA-256 248dfc39…a707). Licence: MIT.\n'
        ' * Citation: Alec Radford, Jeffrey Wu, Rewon Child, David Luan, Dario Amodei and Ilya Sutskever.\n'
        ' * 2019. Language Models are Unsupervised Multitask Learners. OpenAI.\n *\n'
        ' * Subset: 5 fixed prompts, each prefixed with <|endoftext|>, run in float64 numpy: the lens\'s\n'
        ' * top three after every block at every position, the last position\'s parts in two\n'
        ' * directions, and 24 runs per prompt with one attention or MLP output zero-ablated.\n */\n'
        "import type { LensData } from './lens';\n\n"
        '// prettier-ignore\n'
        'export const data: LensData = '
    )
    with open(out, 'w', encoding='utf-8') as fh:
        fh.write(header)
        json.dump(data, fh, ensure_ascii=False, separators=(',', ':'))
        fh.write(';\n')
    print('wrote', out, os.path.getsize(out), 'bytes')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
