FNC1_SEPARATOR = "\x1d"


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


def build_gs1_element_string(di: str, lot: str | None, expiry: str | None, serial: str | None) -> str:
    """Build GS1 element string with AIs and FNC1 separators.

    - AI(01): fixed 14
    - AI(17): fixed 6 (YYMMDD)
    - AI(10): variable (lot/batch)
    - AI(21): variable (serial)
    """
    gtin14 = ensure_valid_gtin14(di)

    elements: list[tuple[str, str, bool]] = [("01", gtin14, False)]
    if expiry:
        if len(expiry) != 6 or not expiry.isdigit():
            raise ValueError("PI expiry must be YYMMDD (6 digits)")
        elements.append(("17", expiry, False))
    if lot:
        elements.append(("10", lot, True))
    if serial:
        elements.append(("21", serial, True))

    if len(elements) == 1:
        raise ValueError("At least one PI value is required: lot, expiry, or serial")

    parts: list[str] = []
    for idx, (ai, value, variable_length) in enumerate(elements):
        parts.append(f"{ai}{value}")
        has_next = idx < len(elements) - 1
        if variable_length and has_next:
            parts.append(FNC1_SEPARATOR)

    return "".join(parts)


def build_hri_string(di: str, lot: str | None, expiry: str | None, serial: str | None) -> str:
    """Human readable interpretation string with parentheses."""
    hri_parts = [f"(01){ensure_valid_gtin14(di)}"]
    if expiry:
        hri_parts.append(f"(17){expiry}")
    if lot:
        hri_parts.append(f"(10){lot}")
    if serial:
        hri_parts.append(f"(21){serial}")
    return "".join(hri_parts)
