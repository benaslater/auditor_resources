"""Download the released dataset into this checkout, at the paths the code
expects: `logs/` (the audit logs) and `data/transcripts/` (each target's
benchmark collection).

The dataset is gated on agreeing to use it only to improve the safety and
security of AI systems. Request access on its Hugging Face page, then put a
token with read access in `.env` as `HF_TOKEN` (or log in with `hf auth login`).

`REVISION` pins the release the paper's figures were produced from, so a later
update to the dataset cannot change them silently.

Usage (from the repository root):
    uv run python scripts/download_data.py
"""

import os
from pathlib import Path

from dotenv import load_dotenv
from huggingface_hub import snapshot_download
from huggingface_hub.errors import GatedRepoError, RevisionNotFoundError

REPO_ROOT = Path(__file__).resolve().parent.parent
REPO_ID = "benaslater/auditor_resources"
REVISION = "v1.0"
DATA_DIRS = ["logs", "data/transcripts"]


def main() -> None:
    load_dotenv(REPO_ROOT / ".env")
    try:
        snapshot_download(
            repo_id=REPO_ID,
            repo_type="dataset",
            revision=REVISION,
            local_dir=REPO_ROOT,
            allow_patterns=[f"{d}/**" for d in DATA_DIRS],
            token=os.environ.get("HF_TOKEN"),
        )
    except GatedRepoError as e:
        raise SystemExit(
            f"No access to the gated dataset {REPO_ID}. Request access at "
            f"https://huggingface.co/datasets/{REPO_ID}, then set HF_TOKEN in "
            f"{REPO_ROOT / '.env'} or run `hf auth login`.\n\n{e}"
        ) from e
    except RevisionNotFoundError as e:
        raise SystemExit(f"{REPO_ID} has no revision {REVISION!r}.\n\n{e}") from e

    for d in DATA_DIRS:
        n = sum(1 for p in (REPO_ROOT / d).rglob("*") if p.is_file())
        print(f"{d}/: {n} files")


if __name__ == "__main__":
    main()
