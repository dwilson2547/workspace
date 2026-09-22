"""Normalize DigiKey ValueText strings into canonical numbers for curated params.

DigiKey returns unit-bearing strings ("10 kOhms", "±0.1%", "5.25 MHz", "65 pA").
For curated categories we convert these to canonical numbers in the schema's
declared unit so `inv search`/`alt` can filter numerically. The target unit comes
from the param spec, which disambiguates SI prefixes (e.g. "m" = milli on volts,
"M" = mega on hertz)."""
from __future__ import annotations

import re

_NUM = r"[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?"

# SI prefixes (prefix char is case-sensitive: k/K kilo, M mega, m milli)
_SI = {"p": 1e-12, "n": 1e-9, "u": 1e-6, "µ": 1e-6, "μ": 1e-6, "m": 1e-3,
       "": 1.0, "k": 1e3, "K": 1e3, "M": 1e6, "G": 1e9, "T": 1e12}

# canonical unit name -> the unit symbol that carries an SI prefix in the value
_PREFIXED = {"ohm": "Ohm", "farad": "F", "volt": "V", "ampere": "A", "watt": "W", "hertz": "Hz"}

# enum value maps, keyed by param key
_VALUE_MAPS = {
    "mounting": {"through hole": "tht", "surface mount": "smd",
                 "chassis mount": "chassis", "panel mount": "panel"},
}

_EMPTY = {None, "", "-"}


def _first_number(text: str) -> float | None:
    m = re.search(_NUM, text)
    return float(m.group()) if m else None


def _prefixed(text: str, unit: str) -> float | None:
    """Parse '<number><prefix><symbol>' for a prefix-bearing unit family."""
    symbol = _PREFIXED[unit]
    m = re.search(r"(" + _NUM + r")\s*([pnuµμmkKMGT]?)" + symbol, text)
    if m:
        return float(m.group(1)) * _SI.get(m.group(2), 1.0)
    return _first_number(text)  # value with no explicit unit -> assume base unit


def to_canonical(value_text, spec: dict, key: str | None = None):
    """Convert a DigiKey ValueText to the stored value for a param `spec`.

    Returns None when the value is blank/'-' or cannot be mapped (the caller
    treats None as "skip this param")."""
    if value_text in _EMPTY:
        return None
    text = str(value_text).strip()
    typ = spec.get("type", "string")
    unit = spec.get("unit")

    if typ == "integer":
        n = _first_number(text)
        return int(n) if n is not None else None
    if typ == "number":
        if unit in _PREFIXED:
            return _prefixed(text, unit)
        return _first_number(text.lstrip("±"))  # percent, ppm_per_c, celsius, v_per_us, ...
    if typ == "boolean":
        return text.lower() in ("yes", "true", "adjustable")
    if typ == "enum":
        mapped = _VALUE_MAPS.get(key, {}).get(text.lower())
        if mapped:
            return mapped
        candidate = text.lower().replace(" ", "_")
        return candidate if candidate in (spec.get("values") or []) else None
    return text  # string
