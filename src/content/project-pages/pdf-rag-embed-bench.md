---
title: pdf-rag-embed-bench
description: A benchmark of text, multimodal and multi-vector embedders, sparse retrieval and reranking for finding the right PDF page
href: https://github.com/gpahal/pdf-rag-embed-bench
---

The best setup I tested found the right PDF page with 94.0% NDCG@5. It combined Cohere's multimodal embedder on page images, Nomic's Colnomic multi-vector embedder, BGE-M3 sparse retrieval and Voyage's reranker. Colnomic alone, with sparse retrieval and the reranker, came close at 93.8%.

## Why build it

A RAG system over PDFs has to find the right page before a model can answer. Each retrieval option adds cost and latency, so I measured which ones pay off.

## How it works

I used a subset of the PDFs in [OHR-Bench](https://huggingface.co/datasets/opendatalab/OHR-Bench) across seven domains: academic, administration, finance, law, manuals, news and textbooks. Each setup returns its top five pages per query, scored with NDCG@5 and recall@5.

I compared text embedders from Voyage, Cohere and Gemini on pages parsed by [Marker](https://github.com/datalab-to/marker), multimodal embedders from Voyage, Cohere and Jina on page images and multi-vector embedders from Jina and Nomic, each alone, reranked by Voyage and with BGE-M3 sparse retrieval added. I also tested two other parsers and the dataset's ground-truth text against Marker.

| Setup                         | Alone | Reranked | Sparse and reranked |
| ----------------------------- | ----- | -------- | ------------------- |
| Text dense (Voyage)           | 84.0% | 89.5%    | 91.1%               |
| Image dense (Cohere)          | 85.8% | 91.5%    | 92.6%               |
| Text multi-vector (Jina)      | 87.9% | 91.3%    | 91.9%               |
| Image multi-vector (Colnomic) | 91.4% | 93.5%    | 93.8%               |
| Best combination              | -     | -        | 94.0%               |

## Findings

Embedding page images beat embedding parsed text, for dense and multi-vector embedders alike. Even the dataset's ground-truth text lifted Voyage only to 86.4%.

Reranking added 2.1 to 9.2 points to every embedder, taking Gemini on text from 76.6% to 85.8%. Sparse retrieval helped every setup, but a second embedder added only 0.2 points and costs more to query.

A cheap parser was enough. With Voyage, [Contextual AI](https://contextual.ai/blog/document-parser-for-rag/) scored 84.2% and [Landing AI](https://landing.ai/agentic-document-extraction) 82.9%, against Marker's 84.0%, at roughly 10 to 13 times the cost. Finance was the hardest domain, where the best combination reached 88.1%.

Per-domain [results](https://github.com/gpahal/pdf-rag-embed-bench/tree/main/results) cover every setup, and the [precomputed embeddings](https://huggingface.co/datasets/gpahal/pdf-rag-embed-bench) are about 14.5GB zipped.
