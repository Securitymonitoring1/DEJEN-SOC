"""Incremental reader for newline-delimited Linux log files."""

from pathlib import Path


class LogReader:
    def __init__(self, path: str):
        self.path = Path(path)
        self._offset = 0
        self._identity = None
        self._mtime_ns = None

    def start_at_end(self) -> None:
        """Skip existing content and monitor only new log entries."""
        try:
            file_stat = self.path.stat()
        except FileNotFoundError:
            return
        self._identity = (file_stat.st_dev, file_stat.st_ino)
        self._offset = file_stat.st_size
        self._mtime_ns = file_stat.st_mtime_ns

    def read_new_lines(self) -> list[str]:
        try:
            with self.path.open("rb") as stream:
                file_stat = self.path.stat()
                identity = (file_stat.st_dev, file_stat.st_ino)
                if (
                    self._identity != identity
                    or file_stat.st_size < self._offset
                    or (
                        file_stat.st_size == self._offset
                        and self._mtime_ns is not None
                        and file_stat.st_mtime_ns != self._mtime_ns
                    )
                ):
                    self._offset = 0
                self._identity = identity
                stream.seek(self._offset)
                data = stream.read()
                last_newline = data.rfind(b"\n")
                if last_newline < 0:
                    self._mtime_ns = file_stat.st_mtime_ns
                    return []
                complete = data[: last_newline + 1]
                self._offset += last_newline + 1
                self._mtime_ns = file_stat.st_mtime_ns
                return complete.decode("utf-8", errors="replace").splitlines()
        except FileNotFoundError:
            return []
        except PermissionError:
            raise PermissionError(
                f"Cannot read log file: {self.path}. "
                "Check the file path and your account permissions."
            ) from None