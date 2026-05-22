// /api/send-email.js — sends transactional emails via Resend
// Frontend calls this with { type, to, data } — function picks the right template.
//
// Setup needed: sign up at resend.com, get API key, add to Vercel env as RESEND_API_KEY.
// Without the key, function returns ok:false but doesn't crash — frontend handles gracefully.

const RESEND_API = "https://api.resend.com/emails";

// Brand colors (matching landing page)
const C = {
  burgundy: "#4a1f3d",
  gold: "#c8a84e",
  cream: "#faf3e7",
  creamDark: "#f5ede2",
  text: "#3a2333",
  textMute: "#7a5a6d",
  border: "rgba(200,168,78,0.25)",
};

// Sender address — using your verified domain via Resend
const FROM = "SKINARIO <noreply@skinario.app>";

// Site URL — used in CTAs back to the platform
const SITE_URL = process.env.SITE_URL || "https://skinario.app";

// ═══ BASE EMAIL WRAPPER ═══
// All emails share this branded shell. Subject + content vary by type.
function wrapEmail({ preview, content }) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>SKINARIO</title>
</head>
<body style="margin:0;padding:0;background:${C.creamDark};font-family:Georgia,'Times New Roman',serif;color:${C.text};">
<!-- Preheader (shows in inbox preview, hidden in email body) -->
<div style="display:none;font-size:1px;color:${C.creamDark};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preview || ""}</div>

<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${C.creamDark};padding:30px 0;">
  <tr>
    <td align="center">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 4px 20px rgba(74,31,61,0.08);">

        <!-- HEADER -->
        <tr>
          <td style="background:${C.burgundy};padding:28px 30px;text-align:center;">
            <div style="font-size:24px;font-family:Georgia,serif;letter-spacing:4px;color:${C.creamDark};font-weight:300;">SKINARIO</div>
            <div style="font-size:11px;color:${C.gold};letter-spacing:2px;text-transform:uppercase;font-weight:600;margin-top:4px;font-family:Arial,sans-serif;">Professional Aesthetic Community</div>
          </td>
        </tr>

        <!-- Gold accent strip -->
        <tr><td style="height:3px;background:linear-gradient(90deg,${C.gold},#d4b558,${C.gold});"></td></tr>

        <!-- CONTENT -->
        <tr>
          <td style="padding:36px 36px 30px;color:${C.text};font-family:Georgia,serif;font-size:15px;line-height:1.7;">
            ${content}
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="background:${C.cream};padding:26px 36px;border-top:1px solid ${C.border};text-align:center;font-family:Arial,sans-serif;">
            <div style="font-size:12px;color:${C.textMute};line-height:1.6;margin-bottom:12px;">
              <a href="${SITE_URL}" style="color:${C.burgundy};text-decoration:none;font-weight:600;">SKINARIO</a>
              &nbsp;·&nbsp; By Absolute Institute &nbsp;·&nbsp; India
            </div>
            <div style="font-size:11px;color:${C.textMute};line-height:1.6;">
              You received this because you're a SKINARIO member.<br/>
              <a href="${SITE_URL}/?page=me" style="color:${C.textMute};text-decoration:underline;">Manage email preferences</a>
            </div>
            <div style="font-size:10px;color:${C.textMute};margin-top:14px;">A professional community for licensed medical practitioners only.</div>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

// ═══ TEMPLATES — by type ═══

function templateWelcome({ name, accountType }) {
  const firstName = (name || "").split(" ")[0] || "Doctor";
  const typeMsg = {
    doctor: "Welcome to a community of verified aesthetic medicine doctors across India.",
    pharma: "Welcome — we're glad to have your team's expertise in our community.",
    institute: "Welcome — your educational programs will reach motivated learners here.",
    vendor: "Welcome — looking forward to your contributions to the community.",
  }[accountType] || "Welcome to SKINARIO.";

  const content = `
    <div style="font-size:13px;color:${C.gold};letter-spacing:3px;text-transform:uppercase;font-weight:600;margin-bottom:18px;font-family:Arial,sans-serif;">Welcome to SKINARIO</div>
    <h1 style="font-size:28px;font-weight:400;color:${C.burgundy};margin:0 0 22px;font-family:Georgia,serif;line-height:1.2;">Hello ${firstName} ✦</h1>
    <p style="margin:0 0 18px;color:${C.text};">${typeMsg}</p>
    <p style="margin:0 0 18px;color:${C.text};">Your account is now active. Here's what you can do next:</p>
    <ul style="padding-left:22px;margin:0 0 26px;color:${C.text};">
      <li style="margin-bottom:8px;"><b style="color:${C.burgundy};">Take today's quiz</b> — a new clinical question is published every day at 10am IST.</li>
      <li style="margin-bottom:8px;"><b style="color:${C.burgundy};">Join the forum</b> — ask peers about challenging cases.</li>
      <li style="margin-bottom:8px;"><b style="color:${C.burgundy};">Read latest research</b> — PubMed, FDA alerts and clinical trials, curated.</li>
      <li style="margin-bottom:8px;"><b style="color:${C.burgundy};">Earn points & climb tiers</b> — redeem for rewards.</li>
    </ul>
    <div style="text-align:center;margin:30px 0;">
      <a href="${SITE_URL}" style="display:inline-block;background:${C.burgundy};color:${C.creamDark};text-decoration:none;padding:14px 32px;border-radius:999px;font-size:14px;letter-spacing:1.5px;font-weight:700;font-family:Arial,sans-serif;">VISIT SKINARIO →</a>
    </div>
    <p style="margin:30px 0 0;color:${C.textMute};font-size:13px;font-style:italic;">Learn. Discuss. Lead the field.</p>
  `;
  return { subject: `Welcome to SKINARIO, ${firstName}`, preview: typeMsg, html: wrapEmail({ preview: typeMsg, content }) };
}

function templateSubmissionApproved({ name, contentType, title }) {
  const firstName = (name || "").split(" ")[0] || "Doctor";
  const typeLabel = { event: "event", article: "article", video: "video", ad: "advertisement", news: "news item" }[contentType] || "submission";
  const preview = `Your ${typeLabel} "${title}" has been published.`;

  const content = `
    <div style="font-size:13px;color:${C.gold};letter-spacing:3px;text-transform:uppercase;font-weight:600;margin-bottom:18px;font-family:Arial,sans-serif;">✓ Approved</div>
    <h1 style="font-size:26px;font-weight:400;color:${C.burgundy};margin:0 0 22px;font-family:Georgia,serif;line-height:1.25;">Your ${typeLabel} is live</h1>
    <p style="margin:0 0 18px;color:${C.text};">Hi ${firstName},</p>
    <p style="margin:0 0 18px;color:${C.text};">Good news — your ${typeLabel} <b style="color:${C.burgundy};">"${(title || "").slice(0, 80)}"</b> has been reviewed and published on SKINARIO.</p>
    <div style="padding:18px 22px;background:${C.cream};border-left:3px solid ${C.gold};border-radius:0 8px 8px 0;margin:24px 0;">
      <div style="font-size:12px;color:${C.gold};letter-spacing:2px;text-transform:uppercase;font-weight:700;margin-bottom:6px;font-family:Arial,sans-serif;">Now visible to</div>
      <div style="color:${C.text};font-size:14px;">100+ verified doctors across India</div>
    </div>
    <p style="margin:18px 0;color:${C.text};">Doctors can now view, comment, and engage with your contribution. Watch for replies — peer engagement is where the real value happens.</p>
    <div style="text-align:center;margin:30px 0;">
      <a href="${SITE_URL}" style="display:inline-block;background:${C.burgundy};color:${C.creamDark};text-decoration:none;padding:14px 32px;border-radius:999px;font-size:14px;letter-spacing:1.5px;font-weight:700;font-family:Arial,sans-serif;">VIEW YOUR ${typeLabel.toUpperCase()} →</a>
    </div>
    <p style="margin:24px 0 0;color:${C.textMute};font-size:13px;">Thank you for contributing to the community.</p>
  `;
  return { subject: `✓ Your ${typeLabel} is live on SKINARIO`, preview, html: wrapEmail({ preview, content }) };
}

function templateSubmissionRejected({ name, contentType, title, reason }) {
  const firstName = (name || "").split(" ")[0] || "Doctor";
  const typeLabel = { event: "event", article: "article", video: "video", ad: "advertisement", news: "news item" }[contentType] || "submission";
  const preview = `Update on your ${typeLabel} submission.`;

  const content = `
    <div style="font-size:13px;color:${C.gold};letter-spacing:3px;text-transform:uppercase;font-weight:600;margin-bottom:18px;font-family:Arial,sans-serif;">Submission Update</div>
    <h1 style="font-size:26px;font-weight:400;color:${C.burgundy};margin:0 0 22px;font-family:Georgia,serif;line-height:1.25;">Your ${typeLabel} needs some changes</h1>
    <p style="margin:0 0 18px;color:${C.text};">Hi ${firstName},</p>
    <p style="margin:0 0 18px;color:${C.text};">Thanks for submitting <b style="color:${C.burgundy};">"${(title || "").slice(0, 80)}"</b>. After review, we'd like you to make a few adjustments before publishing.</p>
    ${reason ? `<div style="padding:18px 22px;background:${C.cream};border-left:3px solid ${C.gold};border-radius:0 8px 8px 0;margin:24px 0;">
      <div style="font-size:12px;color:${C.gold};letter-spacing:2px;text-transform:uppercase;font-weight:700;margin-bottom:6px;font-family:Arial,sans-serif;">Admin feedback</div>
      <div style="color:${C.text};font-size:14px;font-style:italic;">"${reason}"</div>
    </div>` : ""}
    <p style="margin:18px 0;color:${C.text};">You can resubmit anytime with the changes addressed. We're here to help your contribution succeed.</p>
    <div style="text-align:center;margin:30px 0;">
      <a href="${SITE_URL}" style="display:inline-block;background:${C.burgundy};color:${C.creamDark};text-decoration:none;padding:14px 32px;border-radius:999px;font-size:14px;letter-spacing:1.5px;font-weight:700;font-family:Arial,sans-serif;">RESUBMIT →</a>
    </div>
    <p style="margin:24px 0 0;color:${C.textMute};font-size:13px;">If you have questions about the feedback, reply to this email or message us on the platform.</p>
  `;
  return { subject: `Update on your ${typeLabel} submission`, preview, html: wrapEmail({ preview, content }) };
}

function templateReply({ name, replierName, contentType, contentTitle, snippet }) {
  const firstName = (name || "").split(" ")[0] || "Doctor";
  const preview = `${replierName} replied to your ${contentType}.`;

  const content = `
    <div style="font-size:13px;color:${C.gold};letter-spacing:3px;text-transform:uppercase;font-weight:600;margin-bottom:18px;font-family:Arial,sans-serif;">New Reply</div>
    <h1 style="font-size:26px;font-weight:400;color:${C.burgundy};margin:0 0 22px;font-family:Georgia,serif;line-height:1.25;">${replierName} replied to your ${contentType}</h1>
    <p style="margin:0 0 18px;color:${C.text};">Hi ${firstName},</p>
    <p style="margin:0 0 18px;color:${C.text};"><b style="color:${C.burgundy};">${replierName}</b> commented on your ${contentType}: <b style="color:${C.burgundy};">"${(contentTitle || "").slice(0, 80)}"</b></p>
    ${snippet ? `<div style="padding:18px 22px;background:${C.cream};border-left:3px solid ${C.gold};border-radius:0 8px 8px 0;margin:24px 0;">
      <div style="color:${C.text};font-size:14px;font-style:italic;line-height:1.7;">"${snippet.slice(0, 240)}${snippet.length > 240 ? "..." : ""}"</div>
    </div>` : ""}
    <div style="text-align:center;margin:30px 0;">
      <a href="${SITE_URL}" style="display:inline-block;background:${C.burgundy};color:${C.creamDark};text-decoration:none;padding:14px 32px;border-radius:999px;font-size:14px;letter-spacing:1.5px;font-weight:700;font-family:Arial,sans-serif;">VIEW DISCUSSION →</a>
    </div>
  `;
  return { subject: `${replierName} replied to your ${contentType}`, preview, html: wrapEmail({ preview, content }) };
}

// ═══ TEMPLATE DISPATCHER ═══
function buildEmail(type, data) {
  switch (type) {
    case "welcome": return templateWelcome(data);
    case "submission_approved": return templateSubmissionApproved(data);
    case "submission_rejected": return templateSubmissionRejected(data);
    case "reply": return templateReply(data);
    default: throw new Error(`Unknown email type: ${type}`);
  }
}

// ═══ MAIN HANDLER ═══
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "POST required" });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("RESEND_API_KEY not configured — email skipped");
    return res.status(200).json({ ok: false, configured: false, message: "Email service not configured" });
  }

  try {
    const { type, to, data } = req.body || {};
    if (!type || !to) {
      return res.status(400).json({ ok: false, error: "type and to required" });
    }

    // Sanity check — don't send to empty/invalid addresses
    if (!to.includes("@") || to.length < 5) {
      return res.status(400).json({ ok: false, error: "Invalid email address" });
    }

    const { subject, html } = buildEmail(type, data || {});

    const resp = await fetch(RESEND_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [to],
        subject,
        html,
      }),
    });

    const respBody = await resp.json();
    if (!resp.ok) {
      console.error("Resend error:", resp.status, respBody);
      return res.status(200).json({ ok: false, error: respBody.message || `Resend returned ${resp.status}` });
    }

    return res.status(200).json({ ok: true, id: respBody.id });
  } catch (err) {
    console.error("send-email handler error:", err);
    return res.status(500).json({ ok: false, error: err.message || "Unknown error" });
  }
}
