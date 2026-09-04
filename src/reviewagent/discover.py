import os
from pathlib import Path
from typing import List, Optional
import pathspec

DEFAULT_IGNORED_DIRS = {
    ".git",
    "venv",
    ".venv",
    "env",
    ".env",
    "__pycache__",
    "node_modules",
    ".tox",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
    "build",
    "dist",
    "site-packages",
}


def load_gitignore(base_dir: Path) -> Optional[pathspec.PathSpec]:
    gitignore_path = base_dir / ".gitignore"
    if not gitignore_path.is_file():
        return None
    try:
        lines = gitignore_path.read_text(encoding="utf-8").splitlines()
        return pathspec.PathSpec.from_lines("gitwildmatch", lines)
    except OSError:
        return None


def discover_python_files(root_dir: str) -> List[Path]:
    base_path = Path(root_dir).resolve()
    if not base_path.exists():
        return []

    spec = load_gitignore(base_path)
    discovered: List[Path] = []

    for root, dirs, files in os.walk(base_path):
        current_dir = Path(root)
        
        # Prune ignored directories in-place so os.walk doesn't descend into them
        dirs[:] = [
            d for d in dirs
            if d not in DEFAULT_IGNORED_DIRS and not d.endswith(".egg-info")
        ]

        for filename in files:
            if not filename.endswith(".py"):
                continue

            file_path = current_dir / filename
            rel_path_str = str(file_path.relative_to(base_path)).replace("\\", "/")

            if spec and spec.match_file(rel_path_str):
                continue

            discovered.append(file_path)

    # Sort deterministically by relative path
    return sorted(discovered, key=lambda p: str(p.relative_to(base_path)))
