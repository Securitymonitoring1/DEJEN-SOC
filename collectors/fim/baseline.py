import json
import os
import tempfile
from pathlib import Path
from typing import Any


class BaselineError(RuntimeError):
    pass


class BaselineStore:
    def __init__(self, path: str | Path) -> None:
        self.path = Path(path)

    @property
    def exists(self) -> bool:
        return self.path.is_file()

    def load(self) -> dict[str, dict[str, Any]]:
        if not self.exists:
            return {}
        try:
            with self.path.open(encoding="utf-8") as source:
                data = json.load(source)
        except (OSError, json.JSONDecodeError) as error:
            raise BaselineError(f"cannot load baseline {self.path}: {error}") from error
        if not isinstance(data, dict):
            raise BaselineError("baseline must be a JSON object")
        for file_path, entry in data.items():
            if not isinstance(file_path, str) or not isinstance(entry, dict):
                raise BaselineError("baseline entries must map file paths to objects")
            if not isinstance(entry.get("sha256"), str):
                raise BaselineError(f"baseline entry for {file_path} has no SHA-256 hash")
        return data

    def save(self, entries: dict[str, dict[str, Any]]) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        descriptor, temporary_path = tempfile.mkstemp(
            prefix=f".{self.path.name}.",
            dir=self.path.parent,
            text=True,
        )
        try:
            if hasattr(os, "fchmod"):
                os.fchmod(descriptor, 0o600)
            with os.fdopen(descriptor, "w", encoding="utf-8") as target:
                json.dump(entries, target, sort_keys=True, indent=2)
                target.write("\n")
                target.flush()
                os.fsync(target.fileno())
            os.replace(temporary_path, self.path)
            try:
                self.path.chmod(0o600)
            except OSError:
                pass
        except OSError as error:
            try:
                os.unlink(temporary_path)
            except OSError:
                pass
            raise BaselineError(f"cannot save baseline {self.path}: {error}") from error