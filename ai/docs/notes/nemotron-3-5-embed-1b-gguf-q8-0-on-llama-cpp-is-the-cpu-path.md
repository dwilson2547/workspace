---
title: Nemotron-3.5-Embed-1B: GGUF Q8_0 on llama.cpp is the CPU path, images included
date: 2026-11-04
tags: embeddings,nemotron,gguf,llama-cpp,cpu-inference,benchmark
domains: tools,media
---

Bench 2026-11-04 on the WSL desktop (Ryzen 7 5800X3D, CPU only), against the HF fp32 reference (sentence-transformers, nvidia/Nemotron-3.5-Embed-1B-BF16). Test set was small (8 queries, 10 passages, 1 synthetic invoice image): it measures quant drift, not retrieval quality on real docs.

- **NVFP4 checkpoint**: vLLM-only, needs Blackwell. Not on CPU, not on the ainode 3080 (Ampere). The desktop's RTX 5080 is Blackwell (untested). BF16 and NVFP4 share one embedding space.
- **Use GGUF on llama.cpp, not PyTorch, for CPU.** W4D/Nemotron-3.5-Embed-1B-GGUF + its BF16 mmproj, llama.cpp 3de52ac:
  | quant | cos vs ref (query min) | top-1 | query latency | RAM w/ mmproj |
  |---|---|---|---|---|
  | Q8_0 (1.2 GB) | 0.9996 | 8/8 | ~60 ms | 3.3 GB |
  | Q6_K (944 MB) | 0.9977 | 8/8 | ~75 ms | 3.1 GB |
  | Q4_K_S (723 MB) | 0.985 | 8/8 | ~43 ms | 3.3 GB |
  PyTorch fp32 was 240 ms/query and 9.6 GB. Pick Q8_0: essentially lossless. Q4 scores drift up to 0.02.
- **Image and image+text documents work on llama-server `/v1/embeddings`.** Use `--mmproj`, and send content blocks `[text "passage: ", image_url, text " caption"]` to match the HF template (`passage: [IMG] caption`). Image vectors match ref at 0.9999 (Q8_0). The W4D card's "image not supported yet" is stale.
- **Images on CPU are ~28 s per page** at the default 1120 px, whatever the quant (BF16 mmproj; 21.5 s in PyTorch fp32). Index on a GPU, embed queries on CPU. Don't downscale document pages: a 560 px invoice lost the match (sim 0.565 -> 0.213).
- **Gotchas:**
  - GGUF metadata says context 262144: pass `--ctx-size` (8192 used).
  - PyTorch on CPU: 8 threads (physical cores), not 16. SMT threads made queries ~6x slower and jittery.
  - bf16 on Zen 3 CPU (no avx512_bf16) is slower than fp32; it only saves RAM.
  - GGUF has add_bos/add_eos false, mean pooling, non-causal: matches the HF template.
  - Prompts are plain prefixes: `query: <text>` / `passage: <text>`.
  - Outputs 2048-dim: pgvector HNSW caps `vector` at 2000 dims, so store a Matryoshka truncation (1024/512, re-normalise).
- **Fit:** trained on document pages (ViDoRe: text, tables, charts, screenshots); queries are text-only. Better candidate for invoices and datasheets (inventory-tracker) than for replacing siglip2 on natural photos (photo-dump). Licence OpenMDW-1.1, commercial OK.
- Status: tabled 2026-11-04. Next would be GPU indexing timing and a real test on DigiKey invoice pages.
