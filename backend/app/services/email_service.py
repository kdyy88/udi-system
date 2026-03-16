"""Email service backed by Resend.

In development (RESEND_API_KEY is empty), emails are logged to stdout only.
In production, set RESEND_API_KEY + RESEND_FROM_EMAIL environment variables.
"""

from __future__ import annotations

import logging

from app.core.config import settings

logger = logging.getLogger(__name__)

# HTML email template — inline styles for maximum email client compat
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


def _build_email(body: str) -> str:
    return _BASE_TEMPLATE.format(body=body)


async def send_verification_email(to: str, token: str) -> None:
    """Send account activation email with deep-link token."""
    url = f"{settings.FRONTEND_URL}/verify-email?token={token}"
    html = _build_email(_VERIFY_BODY.format(url=url))

    if not settings.RESEND_API_KEY:
        logger.info("[DEV EMAIL] Verification link for %s: %s", to, url)
        return

    try:
        import resend  # type: ignore[import-untyped]

        resend.api_key = settings.RESEND_API_KEY
        resend.Emails.send({
            "from": settings.RESEND_FROM_EMAIL,
            "to": [to],
            "subject": "GS1 UDI System — 验证您的邮箱",
            "html": html,
        })
    except Exception:
        logger.exception("Failed to send verification email to %s", to)


async def send_reset_email(to: str, token: str) -> None:
    """Send password-reset email with deep-link token."""
    url = f"{settings.FRONTEND_URL}/reset-password?token={token}"
    html = _build_email(_RESET_BODY.format(url=url))

    if not settings.RESEND_API_KEY:
        logger.info("[DEV EMAIL] Password reset link for %s: %s", to, url)
        return

    try:
        import resend  # type: ignore[import-untyped]

        resend.api_key = settings.RESEND_API_KEY
        resend.Emails.send({
            "from": settings.RESEND_FROM_EMAIL,
            "to": [to],
            "subject": "GS1 UDI System — 重置密码",
            "html": html,
        })
    except Exception:
        logger.exception("Failed to send reset email to %s", to)
