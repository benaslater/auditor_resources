"""Load judged scores from run logs into a long-format table — the
analysis-side counterpart to `runner.py`'s run-folder convention, generic
across behaviours rather than hardcoded to one.

`analysis/run_manifest.json` is the curated list of which run-ids are
authoritative for which (behaviour, model-configuration, condition) cell —
`logs/<behaviour>/` mixes final runs with pilots, smoke tests, and top-ups,
so which run-id counts stays a hand-curated decision (see the manifest file
itself) rather than something this module discovers automatically.
"""

import json
import re
from pathlib import Path
from typing import TypedDict

from inspect_ai.log import list_eval_logs, read_eval_log

REPO_ROOT = Path(__file__).resolve().parent.parent

# Judge dimensions Petri always scores alongside a behaviour's own (see
# `runner.py:build_tasks`) — pulled into every row when present so the
# realism/eval-awareness covariates are available without a second pass over
# the logs.
EXTRA_DIMENSIONS = ("scenario_realism", "eval_awareness")

LEGACY_RESOURCES = {"brief": "none", "files": "real_codebase"}
"""The pilot runs pre-date the resource vocabulary and carry `level` in their
`eval.metadata` instead. They are paid data that the paper's figures are drawn
from, so they are translated on read rather than re-run."""

# OpenRouter per-token pricing, (input, output) in USD, snapshotted from
# openrouter.ai/api/v1/models on 2026-08-05 (deepseek-v4-flash, claude-sonnet-5)
# and 2026-08-06 (claude-fable-5, grok-4.5). This is an analysis-side estimate
# for comparing runs against each other, not an invoice — prices can drift,
# and this only covers the models this repo actually drives.
MODEL_PRICING: dict[str, tuple[float, float]] = {
    "openrouter/deepseek/deepseek-v4-flash": (0.00000009, 0.00000018),
    "openrouter/anthropic/claude-sonnet-5": (0.000002, 0.00001),
    "openrouter/anthropic/claude-fable-5": (0.00001, 0.00005),
    "openrouter/x-ai/grok-4.5": (0.000002, 0.000006),
    "openrouter/anthropic/claude-opus-5": (0.000005, 0.000025),
    "openrouter/openai/gpt-5.6-sol": (0.000005, 0.00003),
    # Same per-token rate as the base model on OpenRouter's listing (2026-08-07)
    # -- "pro" is the same underlying model served with `reasoning.mode: pro`,
    # not a separately-priced tier; the cost difference shows up in token
    # volume (more reasoning tokens), not in $/token.
    "openrouter/openai/gpt-5.6-sol-pro": (0.000005, 0.00003),
    # Judge panel (`src/judges.py`), priced at the *pinned endpoint* rather than
    # OpenRouter's model-level listing, which quotes the cheapest backend and
    # understates all three: glm-5.2 lists at $0.76/M against Sail Research's
    # $0.50, and minimax-m2.5 at $0.22 against endpoints charging up to $0.60.
    # Snapshotted 2026-08-12; re-check if `MODEL_ROUTING` is repinned.
    "openrouter/z-ai/glm-5.2": (0.0000005, 0.00000315),
    "openrouter/minimax/minimax-m2.5": (0.00000022, 0.0000009),
    "openrouter/moonshotai/kimi-k3": (0.00000285, 0.00001425),
}


GUARDRAIL_PREFIX = re.compile(r"^openrouter_guardrail(_auditor)?/")
"""The guardrail-aware providers (`generate_transcripts.guardrail_model`) are
registered under their own names, so a target routed through one lands in the
log as `openrouter_guardrail/...` and an auditor as
`openrouter_guardrail_auditor/...` — same model, same price, different string."""


def price_of(model: str) -> tuple[float, float]:
    """(input, output) USD per token for a model as named in a log.

    Raises on an unpriced model rather than silently under-counting it: a run
    using a model with no recorded price should fail loudly here, not quietly
    report too little.
    """
    priced = GUARDRAIL_PREFIX.sub("openrouter/", model)
    if priced not in MODEL_PRICING:
        raise KeyError(f"no price recorded for {model!r} — add it to MODEL_PRICING")
    return MODEL_PRICING[priced]


class RunConfig(TypedDict):
    models: dict[str, str]
    reasoning_effort: dict[str, str]  # role -> level; {} means every role ran
    # at whatever OpenRouter defaults that model to (see `run_reasoning_effort`)
    runs: dict[str, str]  # condition label -> run_id


class BehaviourManifest(TypedDict):
    conditions: list[str]
    configs: dict[str, RunConfig]  # model-configuration label -> RunConfig


def load_manifest() -> dict[str, BehaviourManifest]:
    return json.loads((REPO_ROOT / "analysis" / "run_manifest.json").read_text())


def behaviour_dimension(behaviour: str) -> str:
    """The judge dimension name a behaviour's own config scores on (as
    opposed to Petri's built-in `scenario_realism`/`eval_awareness`)."""
    path = REPO_ROOT / "data" / "behaviours" / f"{behaviour}.json"
    return json.loads(path.read_text())["judge_dimension"]["name"]


def run_models(behaviour: str, run_id: str) -> dict[str, str]:
    """The model roles a run actually used, read from its own
    `metadata.json` — the ground truth a manifest entry's declared `models`
    should be checked against, so a mislabelled config fails loudly instead
    of silently mixing runs under the wrong name."""
    path = REPO_ROOT / "logs" / behaviour / run_id / "metadata.json"
    return json.loads(path.read_text())["config"]["models"]


def run_reasoning_effort(behaviour: str, run_id: str) -> dict[str, str]:
    """The per-role reasoning-effort levels a run actually used, read from its
    own `metadata.json` — the ground truth a manifest entry's declared
    `reasoning_effort` should be checked against, mirroring `run_models`.

    `{}` means `--reasoning-effort` was left unset for the whole run (true of
    every run in this manifest so far, since the flag postdates them and was
    only made mandatory in `runner.py` afterwards): each role then ran at
    whatever OpenRouter defaults its model to, which is neither "off" nor
    consistent across models (e.g. grok-4.5 defaults to a mandatory `high`,
    gpt-5.6-sol to `medium`) — an uncontrolled factor these older runs don't
    hold fixed, not a documented "none" setting.
    """
    path = REPO_ROOT / "logs" / behaviour / run_id / "metadata.json"
    return json.loads(path.read_text())["config"]["reasoning_effort"]


def run_turn_budget(behaviour: str, run_id: str) -> int:
    """The `max_turns` a run was given, from its own `metadata.json` — the
    ceiling `run_turns` should be read against, since it's a runner setting
    (`runner.py:DEFAULT_MAX_TURNS`) that could differ between runs rather than
    a constant of the experiment."""
    path = REPO_ROOT / "logs" / behaviour / run_id / "metadata.json"
    return json.loads(path.read_text())["config"]["max_turns"]


def resource_of(metadata: dict) -> str:
    """The resource a log was audited under (`runner.py:RESOURCES`)."""
    if "resource" in metadata:
        return metadata["resource"]
    return LEGACY_RESOURCES[metadata["level"]]


ORIGINAL_JUDGE_KEY = "audit_judge"
"""The Sonnet 5 judge from collection. `rescore.py` appends further judges
under `audit_judge_<slug>` — see `rescore_judges` for what each one was."""


def judge_model_for(log: "EvalLog", judge_key: str) -> str:  # noqa: F821
    """The model name carried by `judge_key`'s own model events.

    Needed to tell several judges' events apart within one rescored sample.
    Rescoring judges record themselves in `eval.metadata` (`record_judge`);
    the original comes from the log's `judge` model role.
    """
    metadata = log.eval.metadata or {}
    recorded = metadata.get("rescore_judges", {}).get(judge_key)
    if recorded:
        return recorded["model"]
    role = (log.eval.model_roles or {}).get("judge")
    return role.model if role is not None else ""


def load_run_rows(behaviour: str, run_id: str,
                  judge_key: str | tuple[str, ...] = ORIGINAL_JUDGE_KEY) -> list[dict]:
    """Every scored sample in `logs/<behaviour>/<run_id>/`, one row per
    sample, carrying the behaviour's own judge dimension plus whichever of
    `EXTRA_DIMENSIONS` the judge also scored, and the turns it spent.

    `judge_key` selects which judge's scores to read: the original Sonnet 5
    run by default, or an `audit_judge_<slug>` key added by `rescore.py`. It
    may also be a sequence of keys, giving one row per (sample, key) with the
    key recorded under `judge_key` — a single pass over the logs, because
    reading a run's logs costs gigabytes and passes don't fully release their
    memory, so one pass per judge OOMs where one pass total fits.

    `turns` is counted exactly as `run_turns` counts it (see that docstring
    for why assistant messages rather than model events), but per row, so it
    can be read against the cell the sample belongs to. The two differ in
    denominator by design: `run_turns` counts every sample in a successful
    log, this only counts samples that also came back with a usable score.

    Petri scores a sample `nan` when the judge's `answer()` call fails schema
    validation `max_attempts` times — but the scores are usually present and
    only a narrative field was missing, so fall back to reading the tool
    call. Retries degrade rather than improve, so scan every attempt, not
    just the last. That fallback is restricted to the *selected* judge's own
    model events: a rescored log holds several judges' `answer()` calls in one
    sample's events, so an unfiltered scan silently reports one judge's score
    under another's key — exactly where a blocked Sonnet sample would pick up
    its replacement's answer and look like it had never been blocked.

    A sample can also fail outright mid-conversation (e.g. a provider error
    that exhausts its retries) inside an otherwise `success`-status log — that
    sample has no `audit_judge` score at all, not just a malformed one, and
    is skipped rather than counted.
    """
    keys = (judge_key,) if isinstance(judge_key, str) else tuple(judge_key)
    dimension = behaviour_dimension(behaviour)
    run = REPO_ROOT / "logs" / behaviour / run_id
    rows: list[dict] = []
    for condition_dir in sorted(run.glob("audit_*")):
        petri_condition = condition_dir.name.removeprefix("audit_")
        for info in list_eval_logs(str(condition_dir)):
            if read_eval_log(info, header_only=True).status != "success":
                continue
            log = read_eval_log(info)
            judge_models = {key: judge_model_for(log, key) for key in keys}
            for sample in log.samples:
                for key in keys:
                    score = sample.scores.get(key)
                    if score is None:
                        continue
                    value = score.value if isinstance(score.value, dict) else {}
                    if dimension not in value:
                        calls = [t.arguments for e in sample.events
                                 if e.event == "model" and e.model == judge_models[key]
                                 for t in (e.output.message.tool_calls or [])
                                 if t.function == "answer"]
                        value = next((c for c in reversed(calls) if dimension in c), {})
                    if dimension not in value:
                        continue
                    row = {
                        "behaviour": behaviour,
                        "run_id": run_id,
                        "petri_condition": petri_condition,
                        "resource": resource_of(log.eval.metadata),
                        "repo": log.eval.metadata.get("repo"),
                        "sample_id": sample.id,
                        "epoch": sample.epoch,
                        "judge_key": key,
                        "turns": sum(1 for m in sample.messages if m.role == "assistant"),
                        dimension: int(value[dimension]),
                    }
                    for extra in EXTRA_DIMENSIONS:
                        if extra in value:
                            row[extra] = value[extra]
                    rows.append(row)
    return rows


def run_turns(behaviour: str, run_id: str) -> list[int]:
    """Auditor turns spent per sample in one run folder, one entry per
    successfully completed sample.

    A "turn" here is exactly what Petri's auditor loop charges against
    `max_turns` (`inspect_petri/_auditor/agent.py`): one iteration of the loop,
    i.e. one auditor generation — whether it messaged the target or only
    browsed its own resource files. That's the quantity `runner.py`'s
    `DEFAULT_MAX_TURNS` budgets, so it's the one worth reading against the
    budget.

    Counted as assistant messages in `sample.messages`, which is the auditor's
    own conversation (the target's and judge's live in their own spans) and
    gains exactly one message per completed loop iteration. The obvious
    alternative — `model` events with `role == "auditor"` — agrees with this
    almost everywhere but is wrong at both ends: it counts a retried
    generation twice (a handful of samples read 31-32 turns against a budget
    of 30), and the three `all Sonnet` sycophancy runs have no auditor `model`
    events in their logs at all, so it scores them a flat zero.

    Samples are counted from successful logs only, matching
    `run_cost_and_count`; unlike `load_run_rows` this doesn't require the
    sample to have a usable judge score, since a sample that ran and then
    failed to be scored still spent its turns.
    """
    run = REPO_ROOT / "logs" / behaviour / run_id
    turns = []
    for condition_dir in sorted(run.glob("audit_*")):
        for info in list_eval_logs(str(condition_dir)):
            if read_eval_log(info, header_only=True).status != "success":
                continue
            log = read_eval_log(info)
            for sample in log.samples:
                turns.append(sum(1 for message in sample.messages
                                 if message.role == "assistant"))
    return turns


def run_providers(behaviour: str, run_id: str) -> dict[str, dict[str, int]]:
    """`model -> {serving backend: call count}` for one run folder.

    OpenRouter names the backend that actually served each request in its
    response body, and Inspect keeps that on the model event, so which
    quantization of "the same model" a run really used is recoverable after
    the fact rather than only constrained in advance (see `provider_defaults`).
    That is the reporting the pinning is there to make checkable — and the one
    recommendation of the LessWrong post behind it that costs nothing.
    """
    run = REPO_ROOT / "logs" / behaviour / run_id
    served: dict[str, dict[str, int]] = {}
    for condition_dir in sorted(run.glob("audit_*")):
        for info in list_eval_logs(str(condition_dir)):
            log = read_eval_log(info)
            for sample in log.samples or []:
                for event in sample.events:
                    if event.event != "model" or not event.call or not event.call.response:
                        continue
                    provider = event.call.response.get("provider")
                    if provider:
                        served.setdefault(event.model, {})
                        served[event.model][provider] = served[event.model].get(provider, 0) + 1
    return served


def check_single_provider(behaviour: str, run_id: str) -> None:
    """Raise if any model in a run was served by more than one backend.

    A split model is the failure the pinning exists to prevent, and it is
    invisible in the scores — the run completes and the numbers look fine, so
    nothing catches it unless it is checked explicitly.
    """
    split = {
        model: served
        for model, served in run_providers(behaviour, run_id).items()
        if len(served) > 1
    }
    if split:
        raise ValueError(
            f"{behaviour}/{run_id}: model(s) served by more than one backend: {split} "
            "— the run mixes backends, so it may mix weights (see provider_defaults)"
        )


def rescore_judges(behaviour: str, run_id: str) -> dict[str, dict]:
    """`score key -> resolved judge config` for one run folder, as recorded by
    `rescore.py:record_judge`.

    The counterpart to `run_providers` for rescoring judges, which that function
    cannot see: `inspect_ai.score` captures no `ModelCall`, so their requests
    leave no response body to read a backend out of. What is recorded is the
    routing that was *pinned* — with `allow_fallbacks=False` and a one-element
    `order`, the request either reached that endpoint or failed — so this is a
    constraint the run was held to, not an observation of what served it.
    """
    run = REPO_ROOT / "logs" / behaviour / run_id
    recorded: dict[str, dict] = {}
    for condition_dir in sorted(run.glob("audit_*")):
        for info in list_eval_logs(str(condition_dir)):
            metadata = read_eval_log(info, header_only=True).eval.metadata or {}
            recorded.update(metadata.get("rescore_judges", {}))
    return recorded


def run_cost_and_count(behaviour: str, run_id: str) -> tuple[float, int]:
    """As `run_cost`, plus the number of successfully scored samples that
    cost was spent on — `estimate_cost.py` needs the pair to turn a run's
    total into a $/sample rate; `run_cost` alone only needed the total."""
    run = REPO_ROOT / "logs" / behaviour / run_id
    total = 0.0
    count = 0
    for condition_dir in sorted(run.glob("audit_*")):
        for info in list_eval_logs(str(condition_dir)):
            if read_eval_log(info, header_only=True).status != "success":
                continue
            log = read_eval_log(info)
            count += len(log.samples)
            for model, stats in (log.stats.model_usage or {}).items():
                price_in, price_out = price_of(model)
                total += stats.input_tokens * price_in + stats.output_tokens * price_out
    return total, count


def run_cost(behaviour: str, run_id: str) -> float:
    """Estimated USD cost of one run folder, summed across every model role
    (auditor/target/judge) from its actually recorded token usage, priced by
    `MODEL_PRICING`. Raises on a model with no recorded price rather than
    silently under-counting it — a run using an unpriced model should fail
    loudly here, not quietly report too little.
    """
    return run_cost_and_count(behaviour, run_id)[0]


def check_config_match(behaviour: str, run_id: str, run_config: RunConfig,
                        config_label: str, condition_label: str) -> None:
    """Raise if a manifest cell's declared `models` or `reasoning_effort`
    don't match what its run actually used, per that run's own
    `metadata.json` — a mislabelled manifest entry should fail loudly here
    rather than silently mixing configs, or silently treating runs with
    different (uncontrolled) reasoning-effort settings as the same series.
    """
    declared_models = run_config["models"]
    actual_models = run_models(behaviour, run_id)
    mismatched = {role: (declared_models[role], actual_models.get(role)) for role in declared_models
                  if declared_models[role] != actual_models.get(role)}
    if mismatched:
        raise ValueError(
            f"{behaviour}/{run_id} ({config_label!r}/{condition_label!r}): "
            f"manifest models don't match metadata.json: {mismatched}"
        )

    declared_effort = run_config.get("reasoning_effort", {})
    actual_effort = run_reasoning_effort(behaviour, run_id)
    if declared_effort != actual_effort:
        raise ValueError(
            f"{behaviour}/{run_id} ({config_label!r}/{condition_label!r}): "
            f"manifest reasoning_effort {declared_effort} doesn't match "
            f"metadata.json {actual_effort}"
        )


def load_behaviour_scores(behaviour: str) -> dict[str, dict[str, list[int]]]:
    """`config_label -> condition_label -> [scores]` for one behaviour, per
    its `run_manifest.json` entry. Cross-checks each manifest run's declared
    `models` and `reasoning_effort` against that run's own `metadata.json` —
    a mislabelled config in the manifest fails loudly here rather than
    silently plotting a run under the wrong series.

    A condition whose run hasn't completed yet (no `metadata.json` on disk)
    is left out of its config's dict entirely rather than raising — the
    manifest can declare the full intended grid before every cell exists,
    and callers already treat a missing condition the same as an empty one.
    This is different from a run that exists but doesn't match: that still
    raises, since a mislabelled *completed* run is a real bug to catch, while
    a run that's simply not there yet is an expected, temporary state.
    """
    manifest = load_manifest()[behaviour]
    dimension = behaviour_dimension(behaviour)
    out: dict[str, dict[str, list[int]]] = {}
    pending = []
    for config_label, run_config in manifest["configs"].items():
        out[config_label] = {}
        for condition_label, run_id in run_config["runs"].items():
            if not (REPO_ROOT / "logs" / behaviour / run_id / "metadata.json").exists():
                pending.append(f"{config_label}/{condition_label} ({run_id})")
                continue
            check_config_match(behaviour, run_id, run_config, config_label, condition_label)
            rows = load_run_rows(behaviour, run_id)
            out[config_label][condition_label] = [row[dimension] for row in rows]
    if pending:
        print(f"{behaviour}: not yet run — {', '.join(pending)}")
    return out


def load_design_rows(judge_key: str | tuple[str, ...] = ORIGINAL_JUDGE_KEY) -> list[dict]:
    """One row per rollout across every behaviour in the manifest, carrying the
    factors the ordinal model is fit on — `score`, `resource`, `behaviour` and
    the auditor/target `pair` (see the paper's appendix, `resource * (behaviour
    + pair)`) — plus the realism/eval-awareness covariates.

    `judge_key` selects whose scores the rows carry, as in `load_run_rows`:
    the original Sonnet 5 judge by default, or one of `rescore.py`'s
    `audit_judge_<slug>` keys.

    `resource` comes from each log's own `eval.metadata` rather than from the
    manifest's condition label: the manifest says which run-ids are
    authoritative, and the runner says what each row is, so a run covering
    several resources needs no manifest entry per cell. The behaviour's own
    judge dimension is renamed to `score` here, since a table spanning three
    behaviours can't have one column per dimension.
    """
    rows = []
    dropped = []
    for behaviour, manifest in load_manifest().items():
        # A manifest entry can outlive its behaviour config: `agentic_misalignment`
        # and `deception` were dropped from the study for near-zero incidence, and
        # their runs stay on disk. Without a config there is no judge dimension to
        # read, so they can't be a row — say so rather than half-including them.
        if not (REPO_ROOT / "data" / "behaviours" / f"{behaviour}.json").exists():
            dropped.append(behaviour)
            continue
        dimension = behaviour_dimension(behaviour)
        for config_label, run_config in manifest["configs"].items():
            models = run_config["models"]
            for condition_label, run_id in run_config["runs"].items():
                if not (REPO_ROOT / "logs" / behaviour / run_id / "metadata.json").exists():
                    continue
                check_config_match(behaviour, run_id, run_config, config_label, condition_label)
                for row in load_run_rows(behaviour, run_id, judge_key):
                    rows.append({
                        **{k: v for k, v in row.items() if k != dimension},
                        "score": row[dimension],
                        "auditor": models["auditor"],
                        "target": models["target"],
                        "pair": f"{models['auditor']} -> {models['target']}",
                        "config": config_label,
                    })
    if dropped:
        print(f"skipped — in the manifest but no longer a behaviour: {', '.join(dropped)}")
    return rows
