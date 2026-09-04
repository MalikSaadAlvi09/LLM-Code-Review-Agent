import os
import shutil
import subprocess
import tempfile
from contextlib import contextmanager
from typing import Generator, Optional


class CloneError(Exception):
    pass


class InvalidRepoURLError(CloneError):
    pass


class AuthenticationError(CloneError):
    pass


class NetworkError(CloneError):
    pass


def clone_repository(repo_url: str, target_dir: str) -> None:
    if not repo_url or not isinstance(repo_url, str):
        raise InvalidRepoURLError("Repository URL cannot be empty.")

    cmd = ["git", "clone", "--depth", "1", repo_url, target_dir]
    try:
        proc = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=False,
        )
    except FileNotFoundError:
        raise CloneError("git executable was not found on PATH.")

    if proc.returncode != 0:
        err = proc.stderr.lower()
        if "authentication failed" in err or "could not read username" in err or "permission denied" in err:
            raise AuthenticationError(f"Authentication failed for {repo_url}. Check credentials or access rights.")
        if "could not resolve host" in err or "unable to access" in err or "connection timed out" in err:
            raise NetworkError(f"Network error while cloning {repo_url}: {proc.stderr.strip()}")
        if "not found" in err or "repository not found" in err or "fatal: repository" in err:
            raise InvalidRepoURLError(f"Repository not found or invalid URL: {repo_url}")
        
        raise CloneError(f"Failed to clone repository: {proc.stderr.strip()}")


@contextmanager
def temporary_clone(repo_url: str, keep: bool = False, custom_dir: Optional[str] = None) -> Generator[str, None, None]:
    clone_path = custom_dir or tempfile.mkdtemp(prefix="reviewagent_")
    try:
        clone_repository(repo_url, clone_path)
        yield clone_path
    finally:
        if not keep and os.path.exists(clone_path):
            shutil.rmtree(clone_path, ignore_errors=True)
