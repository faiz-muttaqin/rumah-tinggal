"""Independent OOXML reader for export tests; reads only synthetic test files."""

import io
import json
import posixpath
import sys
import zipfile
from xml.etree import ElementTree as ET

NS = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
REL = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"

with zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())) as archive:
    assert archive.testzip() is None, "Invalid ZIP checksum"
    # Parse every XML part, including relationships/styles/content types.
    for name in archive.namelist():
        if name.endswith((".xml", ".rels")):
            ET.fromstring(archive.read(name))
    strings = [
        "".join(item.itertext())
        for item in ET.fromstring(archive.read("xl/sharedStrings.xml"))
    ]
    relationships = {
        item.attrib["Id"]: item.attrib["Target"]
        for item in ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
    }
    result = {}
    workbook = ET.fromstring(archive.read("xl/workbook.xml"))
    for sheet in workbook.findall("s:sheets/s:sheet", NS):
        target = relationships[sheet.attrib[REL]]
        path = posixpath.normpath(posixpath.join("xl", target)).lstrip("/")
        root = ET.fromstring(archive.read(path))
        rows = []
        for row in root.findall("s:sheetData/s:row", NS):
            values = {}
            for cell in row.findall("s:c", NS):
                address = cell.attrib["r"]
                column = "".join(character for character in address if character.isalpha())
                raw = cell.findtext("s:v", None, NS)
                if raw is None:
                    value = None
                elif cell.get("t") == "s":
                    value = strings[int(raw)]
                else:
                    value = float(raw) if "." in raw or "e" in raw.lower() else int(raw)
                values[column] = value
            rows.append(values)
        headers = rows[0] if rows else {}
        pane = root.find("s:sheetViews/s:sheetView/s:pane", NS)
        result[sheet.attrib["name"]] = {
            "rows": [
                {header: row.get(column) for column, header in headers.items()}
                for row in rows[1:]
            ],
            "formulaCount": len(root.findall(".//s:f", NS)),
            "frozenRows": int(pane.get("ySplit", "0")) if pane is not None else 0,
        }
    json.dump(result, sys.stdout, ensure_ascii=False)
