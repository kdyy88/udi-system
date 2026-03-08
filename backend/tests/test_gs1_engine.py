from app.services.gs1_engine import (
    FNC1_SEPARATOR,
    build_gs1_element_string,
    calculate_gs1_check_digit,
    ensure_valid_gtin14,
)


def test_calculate_gtin14_check_digit() -> None:
    assert calculate_gs1_check_digit("0950600013435") == "2"


def test_validate_gtin14() -> None:
    assert ensure_valid_gtin14("09506000134352") == "09506000134352"


def test_build_element_string_with_fnc1() -> None:
    value = build_gs1_element_string(
        di="09506000134352",
        lot="LOT202603",
        expiry="280229",
        serial="SN0001",
    )
    assert value == f"01095060001343521728022910LOT202603{FNC1_SEPARATOR}21SN0001"
