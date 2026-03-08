import base64
from io import BytesIO

import treepoem


def _render_svg_from_treepoem(barcode_type: str, data: str, options: dict[str, str | bool]) -> str:
    image = treepoem.generate_barcode(
        barcode_type=barcode_type,
        data=data,
        options=options,
    ).convert("L")

    width, height = image.size
    pixels = image.load()

    svg_lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
        f'<rect width="{width}" height="{height}" fill="white"/>',
    ]

    for y in range(height):
        for x in range(width):
            if pixels[x, y] < 128:
                svg_lines.append(f'<rect x="{x}" y="{y}" width="1" height="1" fill="black"/>')

    svg_lines.append("</svg>")
    return "\n".join(svg_lines)


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


def render_gs1_datamatrix_svg(gs1_ai_string: str) -> str:
    return _render_svg_from_treepoem(
        barcode_type="gs1datamatrix",
        data=gs1_ai_string,
        options={"parsefnc": "true"},
    )


def render_gs1_128_svg(gs1_ai_string: str) -> str:
    return _render_svg_from_treepoem(
        barcode_type="gs1-128",
        data=gs1_ai_string,
        options={"parsefnc": "true", "includetext": False},
    )
