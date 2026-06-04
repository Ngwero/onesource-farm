export interface EmailPayload {
  to: string;
  toName: string;
  subject: string;
  title: string;
  body: string;
  highlightText?: string;
  highlightSubtext?: string;
  bullets?: string[];
  ctaLabel?: string;
  ctaUrl?: string;
  footerNote?: string;
  heroImageUrl?: string;
}

const BRAND_NAVY = '#001d6e';
const BRAND_FOOTER = '#1a237e';
const BRAND_FOOTER_DEEP = '#0d1440';
const ACCENT_BLUE = '#1565c0';
const HIGHLIGHT_BORDER = '#90caf9';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function displayName(name: string): string {
  return escapeHtml(name).toUpperCase();
}

export interface EmailInlineCids {
  logoCid: string;
  heroCid: string;
}

export function buildBrandedEmailHtml(
  payload: EmailPayload,
  appUrl: string,
  inline?: EmailInlineCids
): string {
  const logoUrl = inline?.logoCid ? `cid:${inline.logoCid}` : `${appUrl}/rukapay-logo-white.png`;
  const heroUrl = inline?.heroCid
    ? `cid:${inline.heroCid}`
    : payload.heroImageUrl || `${appUrl}/email-hero.png`;
  const portalUrl = payload.ctaUrl || appUrl;
  const safeName = displayName(payload.toName || 'Colleague');

  const highlightMain = payload.highlightText
    ? escapeHtml(payload.highlightText)
    : escapeHtml(payload.title);

  const highlightSub = payload.highlightSubtext
    ? `<p style="margin:10px 0 0;font-size:13px;color:#546e7a;line-height:1.5;">
         ${escapeHtml(payload.highlightSubtext)}
       </p>`
    : '';

  const highlightCta =
    payload.ctaUrl && payload.ctaLabel
      ? `<p style="margin:16px 0 0;">
           <a href="${escapeHtml(payload.ctaUrl)}"
              style="display:inline-block;background:${BRAND_NAVY};color:#ffffff;text-decoration:none;
                     padding:10px 24px;border-radius:4px;font-size:13px;font-weight:700;
                     letter-spacing:0.04em;text-transform:uppercase;">
             ${escapeHtml(payload.ctaLabel)}
           </a>
         </p>`
      : '';

  const bullets = payload.bullets?.length
    ? payload.bullets
        .map(
          (item, i) =>
            `<tr>
              <td style="padding:0 8px 10px 0;vertical-align:top;color:#78909c;font-size:13px;width:18px;">
                ${String.fromCharCode(97 + i)}.
              </td>
              <td style="padding:0 0 10px;font-size:13px;color:#546e7a;line-height:1.55;">
                ${item}
              </td>
            </tr>`
        )
        .join('')
    : '';

  const bulletBlock = bullets
    ? `<table cellpadding="0" cellspacing="0" style="margin:20px 0 0;width:100%;">${bullets}</table>`
    : '';

  const footerNote = payload.footerNote
    ? `<p style="margin:16px 0 0;font-size:12px;color:#90a4ae;line-height:1.5;">${payload.footerNote}</p>`
    : '';

  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(payload.subject)}</title>
</head>
<body style="margin:0;padding:0;background:#eceff1;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#eceff1;padding:20px 10px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" role="presentation"
               style="max-width:600px;width:100%;background:#ffffff;border:1px solid #cfd8dc;">

          <!-- Header -->
          <tr>
            <td style="background:${BRAND_NAVY};padding:14px 20px;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td width="120" style="vertical-align:middle;">
                    <img src="${logoUrl}" alt="RukaPay" width="100" height="auto"
                         style="display:block;border:0;max-height:36px;width:auto;" />
                  </td>
                  <td align="center" style="vertical-align:middle;">
                    <span style="color:#ffffff;font-size:15px;font-weight:700;letter-spacing:0.02em;">
                      RukaPay e-Memo
                    </span>
                  </td>
                  <td width="120" align="right" style="vertical-align:middle;">
                    <a href="${escapeHtml(portalUrl)}"
                       style="color:#ffffff;font-size:10px;font-weight:700;text-decoration:none;
                              letter-spacing:0.08em;text-transform:uppercase;white-space:nowrap;">
                      Go to portal
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Hero -->
          <tr>
            <td style="padding:0;line-height:0;font-size:0;">
              <img src="${escapeHtml(heroUrl)}" alt="RukaPay — Get paid faster, run your business smarter"
                   width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;" />
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:28px 32px 24px;color:#263238;font-size:14px;line-height:1.6;">
              <p style="margin:0 0 14px;font-size:16px;font-weight:700;color:#212121;">
                Hi ${safeName},
              </p>

              <div style="margin:0 0 18px;color:#455a64;font-size:14px;line-height:1.65;">
                ${payload.body}
              </div>

              <!-- Highlight box (OTP-style) -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto;">
                <tr>
                  <td align="center">
                    <table cellpadding="0" cellspacing="0" role="presentation"
                           style="border:2px dashed ${HIGHLIGHT_BORDER};border-radius:8px;
                                  background:#fafcff;min-width:280px;max-width:420px;">
                      <tr>
                        <td align="center" style="padding:22px 28px;">
                          <p style="margin:0;font-size:14px;color:${ACCENT_BLUE};font-weight:600;
                                    letter-spacing:0.02em;">
                            ${highlightMain}
                          </p>
                          ${highlightSub}
                          ${highlightCta}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              ${bulletBlock}
              ${footerNote}

              <p style="margin:28px 0 0;font-size:14px;font-weight:700;color:#212121;">
                Regards,<br/>
                RukaPay e-Memo Admin
              </p>
            </td>
          </tr>

          <!-- Footer links -->
          <tr>
            <td style="background:${BRAND_FOOTER};padding:14px 20px;text-align:center;">
              <a href="mailto:support@rukapay.co.ug"
                 style="color:#ffffff;font-size:11px;font-weight:700;text-decoration:none;
                        letter-spacing:0.06em;text-transform:uppercase;margin:0 12px;">
                Contact us
              </a>
              <span style="color:#7986cb;">|</span>
              <a href="${escapeHtml(appUrl)}"
                 style="color:#ffffff;font-size:11px;font-weight:700;text-decoration:none;
                        letter-spacing:0.06em;text-transform:uppercase;margin:0 12px;">
                Privacy
              </a>
              <span style="color:#7986cb;">|</span>
              <a href="${escapeHtml(appUrl)}"
                 style="color:#ffffff;font-size:11px;font-weight:700;text-decoration:none;
                        letter-spacing:0.06em;text-transform:uppercase;margin:0 12px;">
                Terms
              </a>
            </td>
          </tr>

          <!-- Copyright bar -->
          <tr>
            <td style="background:${BRAND_FOOTER_DEEP};padding:12px 20px;text-align:center;">
              <table cellpadding="0" cellspacing="0" role="presentation" align="center">
                <tr>
                  <td style="padding-right:8px;vertical-align:middle;">
                    <img src="${logoUrl}" alt="" width="56" height="auto"
                         style="display:block;border:0;opacity:0.9;" />
                  </td>
                  <td style="vertical-align:middle;">
                    <p style="margin:0;font-size:11px;color:#b0bec5;line-height:1.4;">
                      © ${year} Rhino Payment Services Limited. All Rights Reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
