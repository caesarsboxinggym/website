// =====================================================================
// send-email — Supabase Edge Function
//
// Called by a Database Webhook whenever a row is added to `members`, and
// sends that person a welcome email through Resend.
//
// Secrets it needs (Supabase dashboard -> Edge Functions -> Secrets):
//   RESEND_API_KEY   the Resend key, sending access only
//   WEBHOOK_SECRET   any long random string; the webhook sends the same
//                    value in an `x-webhook-secret` header, so nobody else
//                    can make this function send email
//
// Deploy with JWT verification switched OFF — the webhook is not a signed-in
// user, and the shared secret above is what guards the function instead.
// =====================================================================

const FROM = "Caesar's Boxing Gym <donotreply@caesarsboxing.co.uk>"
const REPLY_TO = 'contact@caesarsboxing.co.uk'
const SITE = 'https://caesarsboxing.co.uk'

type WebhookPayload = {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  schema: string
  record: Record<string, unknown> | null
  old_record: Record<string, unknown> | null
}

type Email = { to: string; subject: string; html: string; text: string }

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

/** Names come from a public form, so they are never trusted as HTML. */
const esc = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const looksLikeEmail = (v: unknown): v is string =>
  typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())

// ---------------------------------------------------------------------
// The emails
// ---------------------------------------------------------------------

/** One shared frame so every email from the gym looks the same. */
function layout(heading: string, bodyHtml: string) {
  return `<!doctype html>
<html lang="en-GB">
<body style="margin:0;padding:0;background:#120E0A;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#120E0A;">
<tr><td align="center" style="padding:32px 16px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
    <tr><td align="center" style="padding:0 0 22px;font-family:Georgia,'Times New Roman',serif;font-size:13px;letter-spacing:4px;text-transform:uppercase;color:#B0824A;">
      Caesar&rsquo;s Boxing Gym
    </td></tr>
    <tr><td style="background:#1E1813;border:1px solid #33281F;border-top:2px solid #B0824A;border-radius:4px;padding:30px 28px;">
      <h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-weight:normal;font-size:24px;line-height:1.25;letter-spacing:1px;text-transform:uppercase;color:#F4EEE3;">${heading}</h1>
      <div style="font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:16px;line-height:1.65;color:#EAE1D3;">
        ${bodyHtml}
      </div>
    </td></tr>
    <tr><td align="center" style="padding:20px 8px 0;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:12px;line-height:1.6;color:#A2907C;">
      266A Shaftmoor Lane, Birmingham B28 8ST &middot; 07568 402875<br>
      This address is not monitored. To reach us, email
      <a href="mailto:${REPLY_TO}" style="color:#E3BC80;">${REPLY_TO}</a> or ring the gym.
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`
}

const button = (href: string, label: string) =>
  `<p style="margin:24px 0 6px;"><a href="${href}" style="display:inline-block;background:#B0824A;color:#1A1109;text-decoration:none;font-weight:bold;font-size:13px;letter-spacing:1.5px;text-transform:uppercase;padding:14px 24px;border-radius:3px;">${label}</a></p>`

function welcomeEmail(member: Record<string, unknown>): Email | null {
  if (!looksLikeEmail(member.email)) return null

  const first = typeof member.first_name === 'string' ? member.first_name.trim() : ''
  const hello = first ? `Welcome, ${esc(first)}` : 'Welcome to the gym'

  // Four digits, set by the database when the member is added.
  const memberNo =
    typeof member.member_no === 'number' && member.member_no >= 1000 && member.member_no <= 9999
      ? String(member.member_no)
      : null

  const numberHtml = memberNo
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 18px;">
         <tr><td align="center" style="background:#120E0A;border:1px solid #7A5A31;border-radius:4px;padding:16px 12px;">
           <div style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#B0824A;">Your member number</div>
           <div style="font-family:Georgia,'Times New Roman',serif;font-size:38px;line-height:1.2;letter-spacing:8px;color:#F4EEE3;padding-left:8px;">${memberNo}</div>
           <div style="font-size:13px;color:#A2907C;">Keep this. Type it in when you book and there is nothing else to fill in.</div>
         </td></tr>
       </table>`
    : ''

  const html = layout(
    hello,
    `<p style="margin:0 0 14px;">You&rsquo;re on the system at Caesar&rsquo;s Boxing Gym. Good to have you.</p>
     ${numberHtml}
     <p style="margin:0 0 14px;">Here is what you need to know:</p>
     <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 6px;font-size:15px;line-height:1.6;color:#EAE1D3;">
       <tr><td style="padding:0 14px 8px 0;color:#B0824A;white-space:nowrap;vertical-align:top;">When</td><td style="padding:0 0 8px;">Monday to Thursday evenings</td></tr>
       <tr><td style="padding:0 14px 8px 0;color:#B0824A;white-space:nowrap;vertical-align:top;">Where</td><td style="padding:0 0 8px;">266A Shaftmoor Lane, Birmingham B28 8ST</td></tr>
       <tr><td style="padding:0 14px 8px 0;color:#B0824A;white-space:nowrap;vertical-align:top;">Cost</td><td style="padding:0 0 8px;">&pound;3 a session for kids, &pound;5 for everyone else, or &pound;10 for the whole week</td></tr>
       <tr><td style="padding:0 14px 8px 0;color:#B0824A;white-space:nowrap;vertical-align:top;">Paying</td><td style="padding:0 0 8px;">On the night, cash or card. Nothing to pay in advance.</td></tr>
     </table>
     <p style="margin:10px 0 0;">Pick your sessions online${memberNo ? ' with your member number' : ''} and a coach will confirm your place.</p>
     ${button(`${SITE}/book/`, 'Book a session')}`
  )

  const text = [
    first ? `Welcome, ${first}.` : 'Welcome to the gym.',
    '',
    "You're on the system at Caesar's Boxing Gym. Good to have you.",
    '',
    ...(memberNo
      ? [`Your member number: ${memberNo}`, 'Keep this. Type it in when you book and there is nothing else to fill in.', '']
      : []),
    'When: Monday to Thursday evenings',
    'Where: 266A Shaftmoor Lane, Birmingham B28 8ST',
    'Cost: £3 a session for kids, £5 for everyone else, or £10 for the whole week',
    'Paying: on the night, cash or card. Nothing to pay in advance.',
    '',
    `Book a session: ${SITE}/book/`,
    '',
    `This address is not monitored. To reach us, email ${REPLY_TO} or ring 07568 402875.`,
  ].join('\n')

  return {
    to: member.email.trim(),
    subject: "Welcome to Caesar's Boxing Gym",
    html,
    text,
  }
}

/** Decide which email, if any, a database change should send. */
function emailFor(payload: WebhookPayload): Email | null {
  if (payload.schema !== 'public' || !payload.record) return null

  if (payload.table === 'members' && payload.type === 'INSERT') {
    return welcomeEmail(payload.record)
  }

  return null
}

// ---------------------------------------------------------------------
// The handler
// ---------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  const secret = Deno.env.get('WEBHOOK_SECRET')
  const apiKey = Deno.env.get('RESEND_API_KEY')

  if (!secret || !apiKey) {
    console.error('WEBHOOK_SECRET or RESEND_API_KEY is not set')
    return json({ error: 'Function is not configured' }, 500)
  }

  if (req.headers.get('x-webhook-secret') !== secret) {
    return json({ error: 'Not authorised' }, 401)
  }

  let payload: WebhookPayload
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'Body is not JSON' }, 400)
  }

  const email = emailFor(payload)

  // Nothing to send is a normal outcome (no email address on file, or a
  // table this function does not care about), not a failure.
  if (!email) return json({ sent: false, reason: 'No email to send for this change' })

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: FROM,
      to: [email.to],
      reply_to: REPLY_TO,
      subject: email.subject,
      html: email.html,
      text: email.text,
    }),
  })

  const result = await res.json().catch(() => null)

  if (!res.ok) {
    console.error('Resend refused the email', res.status, result)
    return json({ sent: false, error: 'Email provider refused the message' }, 502)
  }

  return json({ sent: true, id: (result as { id?: string } | null)?.id ?? null })
})
