from app.services.gs1_engine import (
    FNC1_SEPARATOR,
    build_gs1_element_string,
    build_hri_string,
    calculate_gs1_check_digit,
    ensure_valid_gtin14,
)
import pytest


# ─── calculate_gs1_check_digit ────────────────────────────────────────────────

def test_calculate_gtin14_check_digit() -> None:
    assert calculate_gs1_check_digit("0950600013435") == "2"


def test_calculate_check_digit_all_zeros() -> None:
    # 0000000000000 → sum=0, check=(10-0)%10=0
    assert calculate_gs1_check_digit("0000000000000") == "0"


def test_calculate_check_digit_raises_wrong_length() -> None:
    with pytest.raises(ValueError, match="13 numeric digits"):
        calculate_gs1_check_digit("123")


def test_calculate_check_digit_raises_non_numeric() -> None:
    with pytest.raises(ValueError, match="13 numeric digits"):
        calculate_gs1_check_digit("ABCDEFGHIJKLM")


# ─── ensure_valid_gtin14 ──────────────────────────────────────────────────────

def test_validate_gtin14_ok() -> None:
    assert ensure_valid_gtin14("09506000134352") == "09506000134352"


def test_validate_gtin14_wrong_check_digit() -> None:
    with pytest.raises(ValueError, match="check digit"):
        ensure_valid_gtin14("09506000134353")  # last digit off by 1


def test_validate_gtin14_non_numeric() -> None:
    with pytest.raises(ValueError):
        ensure_valid_gtin14("0950600013435X")


def test_validate_gtin14_wrong_length() -> None:
    with pytest.raises(ValueError):
        ensure_valid_gtin14("0950600013435")  # 13 digits only


# ─── build_gs1_element_string ─────────────────────────────────────────────────

def test_build_element_string_with_fnc1() -> None:
    """FNC1 separators must appear after variable-length AIs when a following AI exists."""
    value = build_gs1_element_string(
        di="09506000134352",
        lot="LOT202603",
        expiry="28/02/29",
        serial="SN0001",
        production_date="16/01/01",
    )
    assert value == f"0109506000134352111601011728022910LOT202603{FNC1_SEPARATOR}21SN0001"


def test_build_element_string_no_fnc1_on_last_variable() -> None:
    """Last variable-length AI must NOT be followed by FNC1."""
    value = build_gs1_element_string(
        di="09506000134352",
        lot="LOT001",
        expiry=None,
        serial=None,
    )
    assert not value.endswith(FNC1_SEPARATOR)
    assert value == "0109506000134352" + "10LOT001"


def test_build_element_string_no_pi_raises() -> None:
    with pytest.raises(ValueError, match="At least one PI"):
        build_gs1_element_string(
            di="09506000134352",
            lot=None,
            expiry=None,
            serial=None,
            production_date=None,
        )


def test_build_element_string_serial_only() -> None:
    value = build_gs1_element_string(
        di="09506000134352",
        lot=None,
        expiry=None,
        serial="S001",
    )
    assert value == "010950600013435221S001"


# ─── build_hri_string ─────────────────────────────────────────────────────────

def test_build_hri_string_full() -> None:
    hri = build_hri_string(
        di="09506000134352",
        lot="LOT202603",
        expiry="28/02/29",
        serial="SN0001",
        production_date="16/01/01",
    )
    assert hri == "(01)09506000134352(11)160101(17)280229(10)LOT202603(21)SN0001"


def test_build_hri_string_minimal_lot_only() -> None:
    hri = build_hri_string(
        di="09506000134352",
        lot="LOT001",
        expiry=None,
        serial=None,
    )
    assert hri == "(01)09506000134352(10)LOT001"
    # Must not contain empty AI groups
    assert "(17)" not in hri
    assert "(21)" not in hri


def test_build_hri_string_ai_order() -> None:
    """AI order must be: 01 → 11 → 17 → 10 → 21."""
    hri = build_hri_string(
        di="09506000134352",
        lot="L1",
        expiry="26/12/31",
        serial="S1",
        production_date="24/01/01",
    )
    pos_01 = hri.index("(01)")
    pos_11 = hri.index("(11)")
    pos_17 = hri.index("(17)")
    pos_10 = hri.index("(10)")
    pos_21 = hri.index("(21)")
    assert pos_01 < pos_11 < pos_17 < pos_10 < pos_21


# ─── date normalisation (via build_hri_string) ────────────────────────────────

def test_date_normalise_yy_mm_dd() -> None:
    hri = build_hri_string(di="09506000134352", lot=None, expiry="29/02/28", serial="S")
    assert "(17)290228" in hri


def test_date_normalise_yyyy_mm_dd() -> None:
    hri = build_hri_string(di="09506000134352", lot=None, expiry="2029-02-28", serial="S")
    assert "(17)290228" in hri


def test_date_normalise_yymmdd_passthrough() -> None:
    hri = build_hri_string(di="09506000134352", lot=None, expiry="290228", serial="S")
    assert "(17)290228" in hri
