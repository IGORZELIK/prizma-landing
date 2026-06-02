// Contact form -> Telegram notification.
//
// Hardening (2026-06-02):
//  - Honeypot field ("website"): real users never fill it; bots do -> silently dropped.
//  - Strict validation: real email + a name that contains at least one letter and is
//    not just punctuation (kills the junk "." / "-" submissions from scanners).
//  - parse_mode "HTML" with escaping instead of legacy "Markdown": legit leads whose
//    name/email/message contain _ * [ no longer get rejected by Telegram and lost.
//  - console.log on every accept/reject so submissions are visible in Vercel logs.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Escape the 5 characters that are unsafe inside Telegram HTML parse_mode. */
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** A value is "real" only if it contains at least one letter (any language). */
function hasLetter(value) {
  return /\p{L}/u.test(String(value || ""));
}

export default async function handler(req, res) {
  // Only POST allowed
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

  if (!BOT_TOKEN || !CHAT_ID) {
    return res.status(500).json({ error: "Server misconfigured" });
  }

  try {
    const { name, email, company, message, website } = req.body || {};

    // Honeypot: hidden field that humans leave empty. If it's filled, it's a bot.
    // Pretend success so the bot doesn't retry, but send nothing.
    if (website) {
      console.log("[contact] dropped: honeypot filled");
      return res.status(200).json({ ok: true });
    }

    const cleanName = (name || "").trim();
    const cleanEmail = (email || "").trim();

    // Validation: name must look like a real name, email must look like a real email.
    if (!cleanName || !hasLetter(cleanName) || cleanName.length < 2) {
      console.log(`[contact] dropped: bad name=${JSON.stringify(name)}`);
      return res.status(400).json({ error: "Invalid name" });
    }
    if (!cleanEmail || !EMAIL_RE.test(cleanEmail)) {
      console.log(`[contact] dropped: bad email=${JSON.stringify(email)}`);
      return res.status(400).json({ error: "Invalid email" });
    }

    const text =
      `🚀 <b>Новая заявка с PRIZMA</b>\n\n` +
      `👤 <b>Имя:</b> ${escapeHtml(cleanName)}\n` +
      `📧 <b>Email:</b> ${escapeHtml(cleanEmail)}\n` +
      `🏢 <b>Компания:</b> ${escapeHtml((company || "").trim()) || "—"}\n` +
      `💬 <b>Сообщение:</b> ${escapeHtml((message || "").trim()) || "—"}`;

    const tgRes = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: "HTML" }),
      }
    );

    if (!tgRes.ok) {
      const detail = await tgRes.text().catch(() => "");
      console.error(`[contact] telegram error ${tgRes.status}: ${detail}`);
      return res.status(502).json({ error: "Failed to send message" });
    }

    console.log(`[contact] sent: ${cleanEmail}`);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(`[contact] internal error: ${err}`);
    return res.status(500).json({ error: "Internal error" });
  }
}
