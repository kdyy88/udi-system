from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest
from fastapi import HTTPException

from app.api.helpers import (
    get_owned_record_or_404,
    get_user_or_404,
    require_admin,
    to_label_history_response,
)
from app.db.models import LabelTemplate


@pytest.mark.anyio
async def test_get_user_or_404_returns_user() -> None:
    user = SimpleNamespace(id=1, role="operator")
    result = Mock()
    result.scalar_one_or_none.return_value = user

    db = AsyncMock()
    db.execute.return_value = result

    found = await get_user_or_404(1, db)

    assert found is user


@pytest.mark.anyio
async def test_require_admin_rejects_non_admin() -> None:
    user = SimpleNamespace(id=1, role="operator")
    result = Mock()
    result.scalar_one_or_none.return_value = user

    db = AsyncMock()
    db.execute.return_value = result

    with pytest.raises(HTTPException, match="需要管理员权限") as exc:
        await require_admin(1, db)

    assert exc.value.status_code == 403


@pytest.mark.anyio
async def test_get_owned_record_or_404_rejects_wrong_owner() -> None:
    record = SimpleNamespace(id=10, user_id=2)
    result = Mock()
    result.scalar_one_or_none.return_value = record

    db = AsyncMock()
    db.execute.return_value = result

    with pytest.raises(HTTPException, match="access denied") as exc:
        await get_owned_record_or_404(
            db=db,
            model=LabelTemplate,
            record_id=10,
            user_id=1,
            object_name="template",
            forbidden_detail="access denied",
        )

    assert exc.value.status_code == 403


def test_to_label_history_response_maps_fields() -> None:
    row = SimpleNamespace(
        id=1,
        user_id=2,
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
    assert mapped.user_id == row.user_id
    assert mapped.batch_id == row.batch_id
    assert mapped.gtin == row.gtin
    assert mapped.batch_no == row.batch_no
    assert mapped.hri == row.hri