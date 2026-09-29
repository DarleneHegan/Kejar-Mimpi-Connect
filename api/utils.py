"""
Utilitas umum: generate QR code base64.
"""
import base64
import io

import qrcode


def generate_qr_base64(data: str) -> str:
    """Generate QR code dari string `data`, return sebagai base64 PNG (data URI)."""
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=8,
        border=4,
    )
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#C8102E", back_color="white")

    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    encoded = base64.b64encode(buffer.getvalue()).decode("utf-8")
    return f"data:image/png;base64,{encoded}"
