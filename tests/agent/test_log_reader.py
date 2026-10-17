import tempfile
import unittest
from pathlib import Path

from agent.log_reader import LogReader


class LogReaderTests(unittest.TestCase):
    def test_reads_only_new_lines(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "auth.log"
            path.write_text("first line\n", encoding="utf-8")
            reader = LogReader(str(path))
            self.assertEqual(reader.read_new_lines(), ["first line"])
            with path.open("a", encoding="utf-8") as stream:
                stream.write("second line\n")
            self.assertEqual(reader.read_new_lines(), ["second line"])

    def test_waits_for_a_complete_line(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "auth.log"
            path.write_text("incomplete", encoding="utf-8")
            reader = LogReader(str(path))
            self.assertEqual(reader.read_new_lines(), [])
            with path.open("a", encoding="utf-8") as stream:
                stream.write(" line\n")
            self.assertEqual(reader.read_new_lines(), ["incomplete line"])

    def test_handles_truncation(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "auth.log"
            path.write_text("old line\n", encoding="utf-8")
            reader = LogReader(str(path))
            self.assertEqual(reader.read_new_lines(), ["old line"])
            path.write_text("new line\n", encoding="utf-8")
            self.assertEqual(reader.read_new_lines(), ["new line"])

    def test_missing_file_returns_empty_list(self):
        with tempfile.TemporaryDirectory() as directory:
            reader = LogReader(str(Path(directory) / "missing.log"))
            self.assertEqual(reader.read_new_lines(), [])

    def test_start_at_end_skips_existing_lines(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "auth.log"
            path.write_text("old line\n", encoding="utf-8")
            reader = LogReader(str(path))
            reader.start_at_end()
            self.assertEqual(reader.read_new_lines(), [])
            with path.open("a", encoding="utf-8") as stream:
                stream.write("new line\n")
            self.assertEqual(reader.read_new_lines(), ["new line"])


if __name__ == "__main__":
    unittest.main()