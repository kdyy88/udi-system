from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest
from fastapi import HTTPException

from app.api.helpers import (
    get_owned_record_or_404,
    require_admin,
    to_label_history_response,
)
from app.core.auth_deps import CurrentUser
from app.db.models import LabelTemplate


@pytest.mark.anyio
async def test_get_owned_record_or_404_hides_wrong_owner_as_404() -> None:
    result = Mock()
    result.scalar_one_or_none.return_value = None

    db = AsyncMock()
    db.execute.return_value = result

    with pytest.raises(HTTPException, match="template not found") as exc:
        await get_owned_record_or_404(
            db=db,
            model=LabelTemplate,
            record_id=10,
            owner_id="1",
            object_name="template",
            forbidden_detail="access denied",
        )

    assert exc.value.status_code == 404


@pytest.mark.anyio
async def test_get_owned_record_or_404_allows_correct_owner() -> None:
    record = SimpleNamespace(id=10, owner_id="1")
    result = Mock()
    result.scalar_one_or_none.return_value = record

    db = AsyncMock()
    db.execute.return_value = result

    found = await get_owned_record_or_404(
        db=db,
        model=LabelTemplate,
        record_id=10,
        owner_id="1",
        object_name="template",
        forbidden_detail="access denied",
    )
    assert found is record


@pytest.mark.anyio
async def test_get_owned_record_or_404_raises_404() -> None:
    result = Mock()
    result.scalar_one_or_none.return_value = None

    db = AsyncMock()
    db.execute.return_value = result

    with pytest.raises(HTTPException) as exc:
        await get_owned_record_or_404(
            db=db,
            model=LabelTemplate,
            record_id=999,
            owner_id="1",
            object_name="template",
            forbidden_detail="access denied",
        )

    assert exc.value.status_code == 404


def test_to_label_history_response_maps_fields() -> None:
    row = SimpleNamespace(
        id=1,
        owner_id="2",
        batch_id=3,
        gtin="09506000134352",
        batch_no="LOT001",
        expiry_date="260101",
        serial_no="SN001",
        production_date="250101",
        remarks="ok",
        full_string="010950600013435210LOT001",
        hri="(01)09506000134352(10)LOT001",
        created_at="2026-03-14T00:00:00Z",
    )

    mapped = to_label_history_response(row)

    assert mapped.id == row.id
    assert mapped.owner_id == row.owner_id
    assert mapped.batch_id == row.batch_id
    assert mapped.gtin == row.gtin
    assert mapped.batch_no == row.batch_no
    assert mapped.hri == row.hri


@pytest.mark.anyio
async def test_require_admin_returns_current_user() -> None:
    """require_admin is a thin wrapper — it just passes through the admin user."""
    admin = CurrentUser(id="42", username="boss", role="admin", email="boss@co.com")
    result = await require_admin(admin)
    assert result is admin