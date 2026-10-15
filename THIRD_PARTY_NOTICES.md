# Third-party notices

This repository's code is MIT-licensed (see `LICENSE`), but it contains a
small amount of third-party text, listed here with its source and terms. The
dataset's third-party material is listed separately in `dataset/LICENSE`.

## ImpossibleBench cheating-judge prompt

`src/generate_transcripts/scorers.py` quotes the judge prompt from
ImpossibleBench (`impossiblebench/analysis/llm_judge.py`,
https://github.com/safety-research/impossiblebench, commit
`061dc3dce6a96ab6cf02a855157263033dcfa3ba`), used under the following licence:

```
MIT License

Copyright (c) 2025 ImpossibleBench Team

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Kissane et al. seed instructions

`src/kissane_replication/scenarios/kissane_reward_hacking.json` reproduces
verbatim the five `IMPOSSIBLE_TEST_SEEDS` from `scripts/seeds.py` in
https://github.com/ckkissane/petri-realism-win-rate (commit
`fa821d7efa706df57ba10b348d21869c79b2e4ee`), from Kissane et al. (2026),
"Measuring and improving coding audit realism with deployment resources",
https://alignment.anthropic.com/2026/coding-audit-realism/. That repository
publishes no licence; the seeds are included, with attribution, so that the
replication in `src/kissane_replication/` can be reproduced. All rights remain
with their authors. Their grader prompts are not redistributed: `graders.json`
records where they live and they are fetched at run time.

## Benchmark abstracts

`src/transcripts/papers/` holds the abstracts of three papers, kept exactly as
the auditors in our experiments saw them:

- `sharma_et_al_2023_sycophancy.abstract.txt` — Mrinank Sharma et al.,
  "Towards Understanding Sycophancy in Language Models", arXiv:2310.13548,
  licensed CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/).
- `zhong_et_al_2025_impossiblebench.abstract.txt` — Ziqian Zhong et al.,
  "ImpossibleBench: Measuring LLMs' Propensity of Exploiting Test Cases",
  arXiv:2510.20270, licensed CC BY 4.0
  (https://creativecommons.org/licenses/by/4.0/).
- `andriushchenko_et_al_2024_agentharm.abstract.txt` — Maksym Andriushchenko
  et al., "AgentHarm: A Benchmark for Measuring Harmfulness of LLM Agents",
  arXiv:2410.09024. The text matches arXiv's metadata abstract, which arXiv
  makes available under CC0 1.0
  (https://info.arxiv.org/help/api/tou.html).

Typography and, for the first two, a few words differ from the current arXiv
abstracts; no changes were made beyond extraction.
