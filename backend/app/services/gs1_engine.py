FNC1_SEPARATOR = "\x1d"


def _normalize_date_to_yymmdd(value: str, field_name: str) -> str:
    raw = value.strip()

    if len(raw) == 8 and raw[2] == "/" and raw[5] == "/":
        yy, mm, dd = raw.split("/")
        if not (yy.isdigit() and mm.isdigit() and dd.isdigit()):
            raise ValueError(f"{field_name} must be YY/MM/DD")
        if int(mm) < 1 or int(mm) > 12 or int(dd) < 1 or int(dd) > 31:
            raise ValueError(f"{field_name} has invalid month/day")
        return f"{yy}{mm}{dd}"

    if len(raw) == 6 and raw.isdigit():
        mm = int(raw[2:4])
        dd = int(raw[4:6])
        if mm < 1 or mm > 12 or dd < 1 or dd > 31:
            raise ValueError(f"{field_name} has invalid month/day")
        return raw

    if len(raw) == 10 and raw[4] == "-" and raw[7] == "-":
        yyyy, mm, dd = raw.split("-")
        if not (yyyy.isdigit() and mm.isdigit() and dd.isdigit()):
            raise ValueError(f"{field_name} must be YY/MM/DD")
        if int(mm) < 1 or int(mm) > 12 or int(dd) < 1 or int(dd) > 31:
            raise ValueError(f"{field_name} has invalid month/day")
        return f"{yyyy[-2:]}{mm}{dd}"

    raise ValueError(f"{field_name} must be YY/MM/DD")


def calculate_gs1_check_digit(gtin_without_check_digit: str) -> str:
    """Calculate GS1 Mod-10 check digit for GTIN-14 body (13 digits)."""
    if not gtin_without_check_digit.isdigit() or len(gtin_without_check_digit) != 13:
        raise ValueError("GTIN-14 body must be exactly 13 numeric digits")

    total = 0
    for idx, value in enumerate(reversed(gtin_without_check_digit), start=1):
        total += int(value) * (3 if idx % 2 == 1 else 1)
    return str((10 - (total % 10)) % 10)


def ensure_valid_gtin14(di: str) -> str:
    """Validate GTIN-14 and return canonical 14-digit string."""
    if not di.isdigit() or len(di) != 14:
        raise ValueError("DI must be a 14-digit GTIN")

    expected = calculate_gs1_check_digit(di[:-1])
    if di[-1] != expected:
        raise ValueError("Invalid GTIN-14 check digit")
    return di


def build_gs1_element_string(
    di: str,
    lot: str | None,
    expiry: str | None,
    serial: str | None,
    production_date: str | None = None,
) -> str:
    """Build GS1 element string with AIs and FNC1 separators.

    - AI(01): fixed 14
    - AI(11): fixed 6 (YYMMDD)
    - AI(17): fixed 6 (YYMMDD)
    - AI(10): variable (lot/batch)
    - AI(21): variable (serial)
    """
    gtin14 = ensure_valid_gtin14(di)

    elements: list[tuple[str, str, bool]] = [("01", gtin14, False)]
    if production_date:
        elements.append(("11", _normalize_date_to_yymmdd(production_date, "PI production_date"), False))
    if expiry:
        elements.append(("17", _normalize_date_to_yymmdd(expiry, "PI expiry"), False))
    if lot:
        elements.append(("10", lot, True))
    if serial:
        elements.append(("21", serial, True))

    if len(elements) == 1:
        raise ValueError("At least one PI value is required: lot, production_date, expiry, or serial")

    parts: list[str] = []
    for idx, (ai, value, variable_length) in enumerate(elements):
        parts.append(f"{ai}{value}")
        has_next = idx < len(elements) - 1
        if variable_length and has_next:
            parts.append(FNC1_SEPARATOR)

    return "".join(parts)


def build_hri_string(
    di: str,
    lot: str | None,
    expiry: str | None,
    serial: str | None,
    production_date: str | None = None,
) -> str:
    """Human readable interpretation string with parentheses."""
    hri_parts = [f"(01){ensure_valid_gtin14(di)}"]
    if production_date:
        hri_parts.append(f"(11){_normalize_date_to_yymmdd(production_date, 'PI production_date')}")
    if expiry:
        hri_parts.append(f"(17){_normalize_date_to_yymmdd(expiry, 'PI expiry')}")
    if lot:
        hri_parts.append(f"(10){lot}")
    if serial:
        hri_parts.append(f"(21){serial}")
    return "".join(hri_parts)
