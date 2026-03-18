from __future__ import annotations

import logging
from importlib import import_module
from typing import TYPE_CHECKING

from app.core.config import settings

if TYPE_CHECKING:
    from fastapi import Request

logger = logging.getLogger(__name__)

_BASE_TEMPLATE = """\
<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:32px 16px;">
      <table width="480" cellpadding="0" cellspacing="0"
             style="background:#fff;border-radius:8px;border:1px solid #e4e4e7;overflow:hidden;">
        <tr><td style="background:#18181b;padding:20px 32px;">
          <span style="color:#fff;font-size:18px;font-weight:600;">GS1 UDI System</span>
        </td></tr>
        <tr><td style="padding:32px;">
          {body}
        </td></tr>
        <tr><td style="padding:16px 32px;background:#fafafa;border-top:1px solid #e4e4e7;">
          <p style="margin:0;font-size:12px;color:#71717a;">
            此邮件由系统自动发送，请勿回复。<br>
            如果您没有注册此账号，请忽略本邮件。
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
"""

_VERIFY_BODY = """\
<h2 style="margin:0 0 12px;font-size:20px;color:#18181b;">验证您的邮箱</h2>
<p style="margin:0 0 24px;color:#52525b;line-height:1.6;">
  感谢注册 GS1 UDI System。请点击下方按钮激活您的账号。链接 <strong>24小时</strong>内有效。
</p>
<a href="{url}" style="display:inline-block;padding:12px 24px;background:#18181b;color:#fff;
   border-radius:6px;text-decoration:none;font-weight:600;">验证邮箱</a>
<p style="margin:24px 0 0;font-size:12px;color:#a1a1aa;">
  如果按钮无法点击，请复制以下链接到浏览器：<br>
  <a href="{url}" style="color:#6366f1;">{url}</a>
</p>
"""

_RESET_BODY = """\
<h2 style="margin:0 0 12px;font-size:20px;color:#18181b;">重置您的密码</h2>
<p style="margin:0 0 24px;color:#52525b;line-height:1.6;">
  我们收到了重置密码的请求。请点击下方按钮设置新密码。链接 <strong>1小时</strong>内有效。
</p>
<a href="{url}" style="display:inline-block;padding:12px 24px;background:#18181b;color:#fff;
   border-radius:6px;text-decoration:none;font-weight:600;">重置密码</a>
<p style="margin:24px 0 0;font-size:12px;color:#a1a1aa;">
  如果您未发起此请求，请忽略本邮件，您的密码不会被更改。
</p>
"""


def _frontend_base(request: "Request | None") -> str:
    """Resolve the frontend origin from the incoming request.

    Priority:
    1. ``Origin`` request header  (set by browsers on cross-origin POST)
    2. ``Referer`` request header (fallback for some clients)
    3. ``settings.FRONTEND_URL`` (env-var / hardcoded fallback)

    This makes email deep-links work correctly regardless of which domain the
    frontend is deployed to — no config change needed when the domain changes.
    """
    if request is not None:
        origin = request.headers.get("origin") or ""
        if origin.startswith(("http://", "https://")):
            return origin.rstrip("/")
        referer = request.headers.get("referer") or ""
        if referer.startswith(("http://", "https://")):
            # Strip path — keep scheme + host only
            from urllib.parse import urlparse
            parts = urlparse(referer)
            return f"{parts.scheme}://{parts.netloc}"
    return settings.FRONTEND_URL.rstrip("/")


def _build_email(body: str) -> str:
    return _BASE_TEMPLATE.format(body=body)


def _send_email(to: str, subject: str, html: str, log_context: str, url: str) -> None:
    if not settings.RESEND_API_KEY:
        logger.info("[DEV EMAIL] %s for %s: %s", log_context, to, url)
        return

    try:
        resend = import_module("resend")
        resend.api_key = settings.RESEND_API_KEY
        resend.Emails.send({
            "from": settings.RESEND_FROM_EMAIL,
            "to": [to],
            "subject": subject,
            "html": html,
        })
    except (ImportError, AttributeError):
        logger.exception("Resend SDK is not available")


async def send_verification_email(to: str, token: str, request: "Request | None" = None) -> None:
    base = _frontend_base(request)
    url = f"{base}/verify-email?token={token}"
    html = _build_email(_VERIFY_BODY.format(url=url))
    _send_email(to, "GS1 UDI System — 验证您的邮箱", html, "Verification link", url)


async def send_reset_email(to: str, token: str, request: "Request | None" = None) -> None:
    base = _frontend_base(request)
    url = f"{base}/reset-password?token={token}"
    html = _build_email(_RESET_BODY.format(url=url))
    _send_email(to, "GS1 UDI System — 重置密码", html, "Password reset link", url)
