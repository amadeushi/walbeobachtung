from __future__ import annotations

import json
import re
from pathlib import Path

SOURCE = Path("lib/data/kommunalwahlen-hildesheim-wikitext.json")
TARGET = Path("selfhost/data/archive-ortsrats-2011.json")


def clean(value: str) -> str:
    value = re.sub(r"\{\{FN\|[^}]+\}\}", "", value)
    value = value.rsplit("|", 1)[-1]
    return re.sub(r"\s+", " ", value).strip()


def table(section: str, marker: str) -> tuple[list[str], list[list[str]]]:
    start = section.index(marker)
    raw = section[section.index("{|", start) : section.index("|}", start)]
    headers = [clean(line[1:]) for line in raw.splitlines() if line.startswith("!")]
    rows = []
    for block in re.split(r"\|-\s*", raw)[1:]:
        cells = [clean(line[1:]) for line in block.splitlines() if line.startswith("|") and not line.startswith("|}")]
        if cells:
            rows.append(cells)
    return headers, rows


def number(value: str) -> float | None:
    value = re.sub(r"[^0-9,.-]", "", value)
    if not value or value == "-":
        return None
    return float(value.replace(",", "."))


def canonical(name: str) -> str:
    return {
        "Grüne": "GRÜNE",
        "Linke": "DIE LINKE",
        "D U.": "Unabhängige",
    }.get(name, name)


source = json.loads(SOURCE.read_text())["parse"]["wikitext"]["*"]
body = source.split("== Ortsratswahlen ==", 1)[1].split("== Weblinks ==", 1)[0]
sections = re.split(r"^=== (.+?) ===\s*$", body, flags=re.M)
elections = {}
aliases = {
    "Marienburger Höhe/Galgenberg": "Marienburger Höhe-Galgenberg",
    "Moritzberg/Bockfeld": "Moritzberg und Bockfeld",
    "Neuhof/Hildesheimer Wald/Marienrode": "Neuhof-Hildesheimer Wald-Marienrode",
    "Oststadt/Stadtfeld": "Oststadt und Stadtfeld",
    "Stadtmitte/Neustadt": "Stadtmitte Neustadt",
}

for i in range(1, len(sections), 2):
    source_name, section = sections[i], sections[i + 1]
    share_headers, share_rows = table(section, "Stimmenanteile")
    seat_headers, seat_rows = table(section, "Sitzverteilung")
    share_row = next((r for r in share_rows if r and r[0].startswith("2011")), None)
    seat_row = next((r for r in seat_rows if r and r[0].startswith("2011")), None)
    if not share_row:
        continue
    name = aliases.get(source_name, source_name)
    parties = []
    totals = {"gebiet-name": f"Ortsrat {name}", "gebiet-nr": "0", "D": "100", "max-schnellmeldungen": "1", "anz-schnellmeldungen": "1"}
    seats = {}
    for header, raw in zip(share_headers[2:], share_row[2:]):
        value = number(raw)
        if value is None:
            continue
        field = f"D{len(parties) + 1}"
        party = canonical(header)
        parties.append({"feld": field, "wert": party})
        totals[field] = str(value)
    if seat_row:
        for header, raw in zip(seat_headers[2:], seat_row[2:]):
            value = number(raw)
            if value is not None:
                seats[canonical(header)] = int(value)
    election = f"Ortsratswahl ({name})"
    elections[name] = {
        "year": "2011",
        "wahl": election,
        "metadata": {"csvs": [], "dateifelder": [{"name": election, "parteien": parties}]},
        "rows": [],
        "total": totals,
        "level": "Historisches Gesamtergebnis",
        "areaLevel": "gesamt",
        "sources": ["https://de.wikipedia.org/wiki/Ergebnisse_von_Kommunalwahlen_in_Hildesheim"],
        "retrieved": "Historische Vergleichsdaten 2011",
        "archived": True,
        "valueMode": "share",
        "turnout": number(share_row[1]),
        "seats": seats,
        "warning": "2011: historische Stimmenanteile und Sitzverteilung; absolute Stimmen und Ergebnisse einzelner Wahlbezirke sind in der verfügbaren Quelle nicht enthalten.",
    }

if len(elections) != 14:
    raise SystemExit(f"Erwartet: 14 Ortsräte, gefunden: {len(elections)}")
TARGET.write_text(json.dumps({"elections": elections}, ensure_ascii=False, separators=(",", ":")))
print(f"{len(elections)} Ortsratsdatensätze geschrieben")
