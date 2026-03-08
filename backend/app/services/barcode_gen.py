import base64
from io import BytesIO

import treepoem


def render_gs1_datamatrix_png(gs1_ai_string: str) -> bytes:
    image = treepoem.generate_barcode(
        barcode_type="gs1datamatrix",
        data=gs1_ai_string,
        options={"parsefnc": "true"},
    )

    buffer = BytesIO()
    image.convert("RGB").save(buffer, format="PNG")
    return buffer.getvalue()


def png_bytes_to_base64(png_bytes: bytes) -> str:
    return base64.b64encode(png_bytes).decode("utf-8")


def render_gs1_datamatrix_base64(gs1_ai_string: str) -> str:
    return png_bytes_to_base64(render_gs1_datamatrix_png(gs1_ai_string))


def render_gs1_128_base64(gs1_ai_string: str) -> str:
    image = treepoem.generate_barcode(
        barcode_type="gs1-128",
        data=gs1_ai_string,
        options={"parsefnc": "true", "includetext": False},
    )

    buffer = BytesIO()
    image.convert("RGB").save(buffer, format="PNG")
    return png_bytes_to_base64(buffer.getvalue())
