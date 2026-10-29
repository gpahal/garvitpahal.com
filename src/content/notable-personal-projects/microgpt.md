---
project: microgpt
href: https://github.com/gpahal/microgpt
startedOn: 01/07/2024
endedOn: 31/07/2024
resume: 124M GPT pretrained from scratch on 8 H200s for about $128, beating GPT-2 on HellaSwag (34.6% vs 29.4%)
---

[microgpt](https://github.com/gpahal/microgpt) is a small GPT implementation and training pipeline in PyTorch, which I built to understand attention, RoPE and multi-GPU training.

It pretrains a GPT-2-class model in two stages: web data first, then three runs on smaller, high-quality data whose weights are averaged. The run took about four hours on 8 H200 GPUs, about $128 of GPU time.

The 124M-parameter model peaked at 34.6% on HellaSwag, above OpenAI's GPT-2 (29.4%) and GPT-3 (33.7%) checkpoints of the same size.
