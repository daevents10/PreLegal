"""Integrity tests for the legal template dataset (catalog.json + templates/)."""

import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TEMPLATES_DIR = ROOT / "templates"
CATALOG_PATH = ROOT / "catalog.json"
REQUIRED_FIELDS = ("name", "description", "filename")


class CatalogTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
        cls.entries = cls.catalog["templates"]

    def test_has_entries(self):
        self.assertGreater(len(self.entries), 0)

    def test_entries_have_required_non_empty_fields(self):
        for entry in self.entries:
            for field in REQUIRED_FIELDS:
                with self.subTest(entry=entry.get("filename"), field=field):
                    self.assertIsInstance(entry.get(field), str)
                    self.assertTrue(entry[field].strip())

    def test_names_and_filenames_unique(self):
        for field in ("name", "filename"):
            values = [e[field] for e in self.entries]
            self.assertEqual(len(values), len(set(values)), f"duplicate {field}")

    def test_every_catalog_file_exists_and_is_non_empty_markdown(self):
        for entry in self.entries:
            path = TEMPLATES_DIR / entry["filename"]
            with self.subTest(filename=entry["filename"]):
                self.assertEqual(path.suffix, ".md")
                self.assertTrue(path.is_file(), f"missing {path}")
                self.assertTrue(path.read_text(encoding="utf-8").lstrip().startswith("#"))

    def test_every_markdown_template_is_catalogued(self):
        on_disk = {p.name for p in TEMPLATES_DIR.glob("*.md")}
        catalogued = {e["filename"] for e in self.entries}
        self.assertEqual(on_disk, catalogued)

    def test_license_file_declares_cc_by_4(self):
        text = (TEMPLATES_DIR / "LICENSE.txt").read_text(encoding="utf-8")
        self.assertIn("CC BY 4.0", text)
        self.assertIn("creativecommons.org/licenses/by/4.0", text)
        self.assertEqual(self.catalog.get("license"), "CC BY 4.0")


if __name__ == "__main__":
    unittest.main()
