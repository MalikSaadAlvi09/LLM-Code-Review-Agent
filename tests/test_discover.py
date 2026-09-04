from pathlib import Path
from reviewagent.discover import discover_python_files


def test_discover_python_files_in_fixture():
    fixture_dir = Path(__file__).parent / "fixtures" / "sample_repo"
    files = discover_python_files(str(fixture_dir))

    rel_names = [f.name for f in files]

    # main.py and utils.py should be discovered
    assert "main.py" in rel_names
    assert "utils.py" in rel_names

    # temp_debug.py should be ignored because of .gitignore 'temp_*.py' rule
    assert "temp_debug.py" not in rel_names


def test_discover_empty_or_missing():
    assert discover_python_files("/path/that/does/not/exist/12345") == []
