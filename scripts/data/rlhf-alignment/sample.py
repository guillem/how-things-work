"""
Samples the candidate answers of the rlhf-alignment explainer from GPT-2 small, and records for
each one the features its reward model reads. Writes a JSON file that build.py turns into
src/routes/rlhf-alignment/rlhf-data.ts.

Model: GPT-2 small (Radford et al., OpenAI 2019), Hugging Face openai-community/gpt2 at revision
607a30d783dfa663caf39e06633721c8d4cfcd7e (MIT), the same files as the language-models,
transformers and residual-stream-logit-lens pages; tokenizer and forward pass from
scripts/data/language-models/gpt2.py. To rebuild, in a throwaway directory outside the repository:

    REV=607a30d783dfa663caf39e06633721c8d4cfcd7e
    mkdir dl && for f in model.safetensors vocab.json merges.txt; do
      curl -sL -o dl/$f https://huggingface.co/openai-community/gpt2/resolve/$REV/$f; done
    python3 -m venv venv && venv/bin/pip install numpy safetensors regex
    venv/bin/python3 -I <repo>/scripts/data/rlhf-alignment/sample.py dl samples.json
    venv/bin/python3 -I <repo>/scripts/data/rlhf-alignment/build.py samples.json \
      <repo>/src/routes/rlhf-alignment/rlhf-data.ts

Sampling (the reference policy, π_ref): for each prompt, N answers with seeds 0..N-1, each token
drawn from GPT-2's next-token distribution restricted to its 40 most likely tokens (top-k 40, as
in OpenAI's published GPT-2 samples) at temperature 1. An answer ends at a new line, at the end of
a sentence ('.', '!' or '?' ending a token) once it has at least 6 words, or after 40 tokens. A
new line as the very first token is excluded (renormalised away), so no answer is empty.

Features (what the reward model reads): the mean, over the answer's tokens, of GPT-2's final
hidden state (768 numbers after the last layer norm) with the prompt before it. A real reward
model is usually the language model itself with a scalar head on its last hidden state; the mean
is used here because one position of a model this small is dominated by a few huge components.
"""

import json
import os
import sys

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'language-models'))
sys.path.insert(0, HERE)
import numpy as np  # noqa: E402
from gpt2 import BOS, Model, Tokenizer, probs  # noqa: E402
from gpt2_hidden import forward  # noqa: E402

PROMPTS = [
    ('sleep', 'Q: How can I fall asleep faster?\nA:'),
    ('hiking', 'Q: What should I pack for a day of hiking?\nA:'),
    ('plants', 'Q: How do I keep my houseplants alive?\nA:'),
]
N = 64
TOP_K = 40
MAX_TOKENS = 40
MIN_WORDS = 6


def main(src, out):
    tok = Tokenizer(src)
    model = Model(src)
    newline = [i for i in range(50257) if '\n' in tok.token(i)]
    result = []
    for pid, text in PROMPTS:
        ids0 = [BOS] + tok.encode(text)
        answers = []
        for seed in range(N):
            rng = np.random.default_rng(seed)
            ids = list(ids0)
            logp = 0.0
            while True:
                _, lg = forward(model, ids)
                if len(ids) == len(ids0):
                    lg = lg.copy()
                    lg[newline] = -np.inf
                p = probs(lg)
                order = np.argsort(-p)[:TOP_K]
                q = p[order] / p[order].sum()
                j = int(rng.choice(TOP_K, p=q))
                t = int(order[j])
                piece = tok.token(t)
                if '\n' in piece:
                    break
                ids.append(t)
                logp += float(np.log(q[j]))
                words = len(tok.decode(ids[len(ids0):]).split())
                n = len(ids) - len(ids0)
                if n >= MAX_TOKENS or (words >= MIN_WORDS and piece.rstrip()[-1:] in ('.', '!', '?')):
                    break
            hid, _ = forward(model, ids)
            cont = ids[len(ids0):]
            feat = hid[len(ids0):].astype(np.float64).mean(0)
            answers.append({
                'seed': seed,
                'text': tok.decode(cont),
                'tokens': len(cont),
                'logp': logp,
                'feat': [float(x) for x in feat],
            })
            print(pid, seed, repr(answers[-1]['text']), flush=True)
        result.append({'id': pid, 'prompt': text, 'answers': answers})
    json.dump(result, open(out, 'w'))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
