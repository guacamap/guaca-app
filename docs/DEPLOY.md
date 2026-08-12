# Deployment

## Topology

```
Tourist phone ──QR──▶ apps/web (Vercel)      ─┐
Spotter phone ───────▶ apps/web (Vercel)      ─┼─▶ apps/api (VM, Docker)
Operator laptop ─────▶ packages/cli           ─┘        │
                                                         ▼
                                          Postgres+PostGIS, Redis, MinIO
                                                         │
                                                         ▼
                                         INFERENCE_BASE_URL (OpenAI-compatible)
                                         → vLLM / Qwen3-VL-8B on Nebius L40S
                                         → MiniMax-M3 (fallback, one env var)
```

## Inference — Qwen3-VL-8B on a Nebius L40S

Provision a **single L40S** (~48 GB). Do NOT provision an H200 — the 8B model
cannot use 141 GB and it costs ~2.9× more. The L40S is the vendor-recommended
single-GPU choice for 8B-class models; this decision is part of the
compute-efficiency pitch.

### Serving command

Verified requirements:

- `vllm>=0.11.0` (Qwen3-VL support landed there)
- `qwen-vl-utils==0.0.14`
- **`--max_model_len` is mandatory.** The model advertises a 256k context;
  without this flag vLLM aborts because the KV cache cannot hold it.

```bash
pip install "vllm>=0.11.0" qwen-vl-utils==0.0.14

vllm serve Qwen/Qwen3-VL-8B-Instruct \
  --dtype bfloat16 \
  --max_model_len 16384 \
  --max-num-batched-tokens 16384 \
  --guided-decoding-backend xgrammar
```

`--guided-decoding-backend xgrammar` is the forward-compatible path;
`extra_body.guided_json` is deprecated. No `--trust-remote-code` needed.

### Verify with one image

```bash
curl http://<l40s-host>:8000/v1/chat/completions \
  -H 'content-type: application/json' \
  -d '{
    "model": "Qwen/Qwen3-VL-8B-Instruct",
    "messages": [{
      "role": "user",
      "content": [
        {"type": "text", "text": "Describe this place."},
        {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64,..."}}
      ]
    }],
    "max_tokens": 200
  }'
```

### MiniMax-M3 failover (one line)

The fallback is the same OpenAI-compatible client, switched by
`INFERENCE_BASE_URL` alone:

```bash
INFERENCE_BASE_URL=https://api.minimax.io/v1
```

Agents never know which provider is behind the env var. Constrained decoding
is an optimisation, not the guarantee — the anti-hallucination guard (§7.3)
does not depend on provider capability.

## Production compose

`docker-compose.prod.yml` runs api + postgis + redis + minio + Caddy (TLS) on
a small VM. `apps/web` deploys to Vercel pointing at the API host.

### Verify from a phone

After deploying, scan the QR with a phone **on cellular data** (not the
laptop's WiFi): PWA camera + geolocation require HTTPS, and cellular proves
the public URLs resolve. If no domain is available, use `sslip.io` with Caddy
for automatic TLS:

```
Caddyfile: api.<ip>.sslip.io
```

## Redeploy

`infra/deploy.sh` builds the images on the VM and runs
`docker compose -f docker-compose.prod.yml up -d`. See T2.5 for the CI hook.
