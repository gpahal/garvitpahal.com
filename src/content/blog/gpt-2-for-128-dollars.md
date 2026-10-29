---
title: Training GPT-2 for $128
description: I pretrained a 124M-parameter GPT from scratch on 8 H200s in about four hours, and it beat OpenAI's GPT-2 of the same size on HellaSwag
publishedOn: 15/10/2024
tags: [ai, llms, pytorch]
---

I trained a 124M-parameter GPT from scratch, and it peaked at 34.6% on HellaSwag. OpenAI's GPT-2 checkpoint of the same size scores 29.4% and its GPT-3 checkpoint 33.7%. The run took about four hours on 8 H200 GPUs, which cost about \$128.

The code is [microgpt](https://github.com/gpahal/microgpt), a small GPT implementation and training pipeline in PyTorch.

## Why build it

I wanted to understand three things by building them myself:

- How attention and RoPE work
- How to train a model across several GPUs, with checkpoints and everything else a long run needs to finish
- How multi-stage training works, including souping the weights of several runs

The model is deliberately plain. It has no newer features such as grouped-query attention, RMSNorm or mixture of experts, and no post-training. Those would cost more than I wanted to spend.

## How it works

The tokenizer is my own byte-pair encoding tokenizer with GPT-2's vocabulary size of 50,257, trained on a slice of [FineWeb-Edu](https://huggingface.co/datasets/HuggingFaceFW/fineweb-edu).

Training has two stages:

1. Stage 1 trains on 10 billion tokens of FineWeb-Edu, mostly web text, for five epochs.
2. Stage 2 continues from stage 1 on up to 310 million tokens of higher-quality text from [Cosmopedia](https://huggingface.co/datasets/HuggingFaceTB/cosmopedia) and [Alpaca](https://huggingface.co/datasets/yahma/alpaca-cleaned).

Stage 2 runs three times with different seeds. A script then averages the three models' weights into one, a technique known as a model soup.

Both stages use PyTorch's DistributedDataParallel, launched with `torchrun` as one process per GPU. A HellaSwag eval runs during training, so I could watch accuracy climb against the OpenAI baselines.

![Two charts from stage 1 training. Left: training and validation loss falling over about 90,000 iterations, with validation loss ending below OpenAI GPT-2's. Right: HellaSwag accuracy rising from about 0.24, passing GPT-2's 0.294 early and GPT-3's 0.337 later in the run](./images/gpt-2-for-128-dollars/loss-and-eval.png)

The chart shows stage 1.

## What it cost

The GPUs were 8 H200s on [Runpod](https://www.runpod.io/) at \$32 an hour. About four hours came to about \$128. A separate AWS c8g.4xlarge instance ran for about 16 hours to train the tokeniser and then tokenise the training data, about \$6.75 more.

## Outcome

A GPT-2-class model is cheap to train from scratch, and the biggest lesson was how much data quality matters. A plain architecture beat the original GPT-2 checkpoint on HellaSwag after about 48 billion tokens, five passes over 10 billion tokens of FineWeb-Edu. OpenAI never said how many tokens GPT-2 saw; Andrej Karpathy [estimates about 100 billion](https://x.com/karpathy/status/1795513568655487221), from WebText, a 2019 scrape of pages linked from Reddit. GPT-3's model of the same size saw 300 billion.

FineWeb-Edu is one of the newest open datasets. It is Common Crawl filtered and deduplicated, then cut to the pages that a classifier, trained on Llama 3 70B's ratings, judged educational. In the [FineWeb paper](https://arxiv.org/abs/2406.17557), it matched another open dataset's MMLU score with almost 10 times fewer tokens. Cosmopedia, in stage 2, is synthetic textbooks, stories and WikiHow-style articles written by Mixtral.

Data quality isn't the whole story, though. FineWeb-Edu's gains are biggest on knowledge benchmarks such as MMLU and ARC, and its authors set its filter threshold as a trade-off against HellaSwag scores. HellaSwag's questions also come from WikiHow articles and video captions, plain English much like FineWeb-Edu's, while the model likely gave up skills HellaSwag doesn't test, such as code.

Next I'd like to try post-training it, with supervised fine-tuning and then reinforcement learning.

The pretrained model and tokenizer download with one script, and the notebooks walk through the tokenizer, the model and the training plots.

## Resources

- [microgpt](https://github.com/gpahal/microgpt), the code, pretrained model and notebooks
- [Neural Networks: Zero to Hero](https://www.youtube.com/playlist?list=PLAqhIrjkxbuWI23v9cThsA9GvCAUhRvKZ) by Andrej Karpathy
- [karpathy/nanoGPT](https://github.com/karpathy/nanoGPT) and [karpathy/minbpe](https://github.com/karpathy/minbpe)
- [HellaSwag](https://rowanzellers.com/hellaswag/), the eval
