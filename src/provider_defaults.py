"""Shared `inspect_ai.eval` provider-resilience defaults.

Used by `runner.py` and `generate_transcripts/__main__.py` — both drive
`inspect_eval` directly against flaky provider APIs and hit the same failure
modes.
"""

# Provider calls have been observed hanging for tens of minutes; time them out
# and retry rather than let one stalled request block a whole run.
PROVIDER_TIMEOUT = 600
PROVIDER_MAX_RETRIES = 8  # ride out transient provider errors
PROVIDER_RETRY_ON_ERROR = 3  # retry individual failed samples

# OpenRouter routes each request to whichever backend is free, and backends can
# silently serve a different quantization of "the same" model, so an unpinned
# comparison can pick up provider drift rather than the effect being measured
# (https://www.lesswrong.com/posts/KsyoSAyBRXtwzSugg/not-pinning-your-openrouter-provider-might-invalidate-your).
# `allow_fallbacks=False` fails loudly instead of rerouting to an untested
# backend.
#
# Do not add `require_parameters=True` here. It leaves zero eligible endpoints
# for any request carrying a forced tool call, which 404s — and Petri's judge
# forces `answer()` on every sample, so each one pays for a full rollout and
# then dies at scoring. Confirmed on all four roster models.
PROVIDER_ROUTING = {"allow_fallbacks": False}

# Pinning the backend only means anything for an open-weights model, and
# DeepSeek v4 Flash is the only one here: OpenRouter serves it from 20
# endpoints across three quantizations (9 fp8, 4 fp4, 7 undeclared), so an
# unpinned request can land on materially different weights. The closed models
# have one set of weights however they route.
#
# CoreWeave rather than any other fp8 backend because it accepts a forced
# `tool_choice`; most do not (only OpenInference otherwise), which matters
# whenever DeepSeek is the judge — not in the paper's roster, but `DEFAULT_MODEL`
# puts it in every role. OpenInference is the tested alternate: swap it in
# deliberately rather than listing both, so a run is never split across two.
# The `rescore.py` judges are open-weights too, and served across many
# endpoints and quantizations, so they are pinned on the same grounds.
#
# Pins are chosen by *testing* a forced `tool_choice` — which Petri's judge
# issues on every sample — not by reading `supported_parameters`, which
# overstates it badly: only 4 of 13 glm-5.2, 3 of 13 kimi-k3 and 1 of 10
# minimax-m2.5 endpoints actually accept one. The rest 404 as "No endpoints
# found". Endpoint metadata also drifts (Wafer's kimi-k3 endpoint was declared
# fp8, then `unknown`, within a day), so re-test before trusting a pin.
MODEL_ROUTING = {
    "deepseek/deepseek-v4-flash": {
        **PROVIDER_ROUTING,
        "order": ["coreweave"],
        "quantizations": ["fp8"],
    },
    # kimi-k3 is the one judge whose quantization is NOT pinned, deliberately.
    # Its only fp8 endpoint taking a forced tool call (BaseTen) is rate-limited
    # upstream to unusable (0-1 of 5 probes over several hours, even at
    # concurrency 1), and the fp4 alternative (Sail Research) went the same way.
    # DigitalOcean is stable (5/5) but declares no quantization, so the weights
    # served are an uncontrolled axis for this judge alone. `allow_fallbacks`
    # still fixes the *provider*, and `record_judge` writes the routing into
    # each log, so it is reported rather than assumed — see `collection_status.md`.
    "moonshotai/kimi-k3": {**PROVIDER_ROUTING, "order": ["digitalocean"]},
    # Alternates: glm-5.2 StreamLake or Fireworks. minimax-m2.5 has none.
    "z-ai/glm-5.2": {**PROVIDER_ROUTING, "order": ["sail-research"], "quantizations": ["fp8"]},
    "minimax/minimax-m2.5": {**PROVIDER_ROUTING, "order": ["inceptron"], "quantizations": ["fp8"]},
}
"""Keyed by the bare OpenRouter model id, matched as a substring so both
`openrouter/deepseek/...` and a `Model`'s own name resolve."""


def routing_for(model: object) -> dict:
    """OpenRouter `provider` block for `model` — pinned where it matters,
    `PROVIDER_ROUTING` otherwise. Pass to `get_model(provider=...)`."""
    name = model if isinstance(model, str) else str(getattr(model, "name", model))
    for pinned, routing in MODEL_ROUTING.items():
        if pinned in name:
            return routing
    return PROVIDER_ROUTING
