---
title: pdf-rag-embed-bench
description: A benchmark of text, multimodal and multi-vector embedders, sparse retrieval and reranking for finding the right PDF page
href: https://github.com/gpahal/pdf-rag-embed-bench
---

## The result

The best setup I tested found the right PDF page with 94.0% NDCG@5. It combined Cohere's multimodal embedder on page images, Nomic's Colnomic multi-vector embedder, BGE-M3 sparse retrieval and Voyage's reranker. The best dense text embedder on parsed pages reached 84.0% on its own.

A simpler setup came close: Colnomic alone, with sparse retrieval and the reranker, reached 93.8%.

## Why build it

A RAG system over PDFs has to find the right page before a model can answer from it. There are many ways to do that: parse the PDF and embed the text, embed page images, use multi-vector models, add sparse retrieval or rerank. Each choice adds cost and latency, so I wanted numbers on which ones pay off.

## How it works

I used a subset of the PDFs in [OHR-Bench](https://huggingface.co/datasets/opendatalab/OHR-Bench), across seven domains: academic, administration, finance, law, manuals, news and textbooks. Each setup returns its top five pages for a query, scored with NDCG@5 and recall@5.

I compared text embedders from Voyage, Cohere and Gemini on pages parsed by [Marker](https://github.com/datalab-to/marker), multimodal embedders from Voyage, Cohere and Jina on page images, and multi-vector embedders from Jina and Nomic. I added BGE-M3 sparse retrieval and Voyage's reranker to each, then combined two embedders. I also tested Marker against two other parsers and the dataset's ground-truth text.

| Setup                         | Alone | Reranked | Sparse and reranked |
| ----------------------------- | ----- | -------- | ------------------- |
| Text dense (Voyage)           | 84.0% | 89.5%    | 91.1%               |
| Image dense (Cohere)          | 85.8% | 91.5%    | 92.6%               |
| Text multi-vector (Jina)      | 87.9% | 91.3%    | 91.9%               |
| Image multi-vector (Colnomic) | 91.4% | 93.5%    | 93.8%               |
| Best combination              | -     | -        | 94.0%               |

## Outcome

Reranking lifted every embedder, by 2.1 to 9.2 points, and it took Gemini on text from 76.6% to 85.8%. Embedding the page beat embedding its text. Among dense embedders, Cohere on page images scored 85.8% against 84.0% for Voyage on text. Among multi-vector ones, Colnomic on images scored 91.4% against 87.9% for Jina on text. Even perfect text, the dataset's ground truth, lifted Voyage only to 86.4%.

Sparse retrieval raised every setup, but a second embedder added little: the best combination beat Colnomic alone by 0.2 points and costs more to query.

A cheap parser was enough. With Voyage, [Contextual AI](https://contextual.ai/blog/document-parser-for-rag/) scored 84.2% and [Landing AI](https://landing.ai/agentic-document-extraction) 82.9%, against 84.0% for Marker, at roughly 10 to 13 times the cost. Finance was the hardest domain throughout: the best combination reached 88.1% there.

The [results](https://github.com/gpahal/pdf-rag-embed-bench/tree/main/results) have NDCG@5 and recall@5 per domain for every setup. The [precomputed embeddings](https://huggingface.co/datasets/gpahal/pdf-rag-embed-bench) are about 14.5GB zipped.
