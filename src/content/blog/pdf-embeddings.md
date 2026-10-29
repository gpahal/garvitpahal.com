---
title: Which embedding setup works best for PDF retrieval
description: I benchmarked text, multimodal and multi-vector embedders with sparse retrieval and reranking on PDF pages, and the best combination reached 94.0% NDCG@5
publishedOn: 20/07/2025
tags: [ai, rag, embeddings, search]
---

The best setup I tested reached 94.0% NDCG@5 at finding the right PDF page. It combined Cohere's multimodal embedder on page images, Colnomic's multi-vector embedder, BGE-M3 sparse retrieval and Voyage's reranker. The best dense text embedder on parsed pages, on its own, reached 84.0%.

A simpler setup came close. Colnomic alone, with sparse retrieval and a reranker, reached 93.8%.

## Why build it

Much of the world's private knowledge lives in PDFs: contracts, reports, filings, manuals and papers. Adobe [estimates](https://blog.adobe.com/en/publish/2023/06/15/celebrating-30-years-of-digital-transformation-with-adobe-acrobat) there are more than 3 trillion of them, and an [IDC study for Box](https://www.box.com/resources/transform-unstructured-data-with-box-ai) puts 90% of an organisation's data as unstructured. Most of it was never on the public web, so models weren't trained on it. To use it, you have to be able to search it.

A RAG system over PDFs has to find the right page before a model can answer from it. There are many ways to do that: parse the PDF and embed the text, embed page images directly, use multi-vector models, add sparse retrieval or rerank. Each choice adds cost and latency, so I wanted numbers on which ones pay off.

## How it works

I used a subset of the PDFs in [OHR-Bench](https://huggingface.co/datasets/opendatalab/OHR-Bench), across seven domains: academic, administration, finance, law, manuals, news and textbooks. Each setup returns its top five pages for a query, scored with NDCG@5.

I compared:

- Text embedders on pages parsed by [Marker](https://github.com/datalab-to/marker): Voyage `voyage-3.5`, Cohere `embed-v4` and Gemini `gemini-embedding-001`
- Multimodal embedders on page images: Voyage `voyage-multimodal-3`, Cohere `embed-v4` and Jina `jina-embeddings-v4`
- Multi-vector embedders: Jina `jina-embeddings-v4` on text and on images, and `colnomic-embed-multimodal-3b` on images
- Sparse retrieval with BGE-M3 on the parsed text
- Reranking with Voyage `rerank-2`
- Combinations of two embedders with sparse retrieval and the reranker
- Parsers: Marker against [Contextual AI](https://contextual.ai/blog/document-parser-for-rag/), [Landing AI](https://landing.ai/agentic-document-extraction) and the dataset's ground-truth text

The best of each kind:

| Setup                         | Alone | Reranked | Sparse and reranked |
| ----------------------------- | ----- | -------- | ------------------- |
| Text dense (Voyage)           | 84.0% | 89.5%    | 91.1%               |
| Image dense (Cohere)          | 85.8% | 91.5%    | 92.6%               |
| Text multi-vector (Jina)      | 87.9% | 91.3%    | 91.9%               |
| Image multi-vector (Colnomic) | 91.4% | 93.5%    | 93.8%               |
| Best combination              | -     | -        | 94.0%               |

## Outcome

1. **Always rerank.** Reranking lifted every embedder, by 2.1 to 9.2 points. It took the weakest, Gemini on text, from 76.6% to 85.8%.
2. **Embed the page, not only its text.** Cohere on page images scored 85.8%, against 84.0% for the best text embedder. Even Voyage on the dataset's ground-truth text reached only 86.4%. Images help most with figures, tables and charts.
3. **Combining helps, with diminishing returns.** Sparse retrieval raised every setup. A second embedder helped less: the best combination beat Colnomic alone by only 0.2 points and costs more. Multi-vector models are also the slowest and priciest to query.
4. **A cheap parser is enough.** With Voyage, Contextual AI scored 84.2% and Landing AI 82.9%, against 84.0% for Marker. Both cost roughly 10 to 13 times as much.

Finance was the hardest domain throughout: even the best combination reached only 88.1% there. Voyage, Cohere and Marker were the most reliable providers. Jina and Landing AI returned many server errors, so some runs had to be repeated.

## Resources

- [pdf-rag-embed-bench](https://github.com/gpahal/pdf-rag-embed-bench), the benchmark code and full tables
- [Results](https://github.com/gpahal/pdf-rag-embed-bench/tree/main/results), with NDCG@5 and recall@5 per domain
- [Precomputed embeddings](https://huggingface.co/datasets/gpahal/pdf-rag-embed-bench), about 14.5GB zipped
- [OHR-Bench](https://huggingface.co/datasets/opendatalab/OHR-Bench), the source PDFs
