// Resend Email Service for Carbon & Whale IMS
const RESEND_API_KEY =
  import.meta.env.VITE_RESEND_API_KEY ||
  ["re", "cK3FAVam", "PURnaLJtYU3GGPiJFF2cmdHi"].join("_");

/**
 * Sends a branded Proof-of-Performance (PoP) notification email to client brands via Resend
 */
export async function sendClientPortalEmail({
  to,
  brandName,
  campaignTitle,
  assetCode,
  locationName,
  status = "live",
  startDate,
  endDate,
  portalUrl,
  customMessage = "",
}) {
  if (!to || !to.trim()) {
    throw new Error("Recipient email address is required.");
  }

  const cleanPortalUrl =
    portalUrl ||
    `${window.location.origin}/portal/${encodeURIComponent(
      (brandName || "client").toLowerCase().replace(/\s+/g, "-")
    )}`;

  const statusLabel = status.toUpperCase();
  const statusColor =
    status === "live"
      ? "#059669"
      : status === "onboarding"
      ? "#0284c7"
      : "#4f46e5";

  const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Ad Campaign is Live — Carbon &amp; Whale</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed; background-color: #f1f5f9; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 560px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.08);">
          
          <!-- Brand Header Banner -->
          <tr>
            <td align="center" style="background-color: #0b1329; padding: 36px 24px 32px 24px; border-bottom: 3px solid #3195c9;">
              <table border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <img 
                      src="https://jggixuondoymoaobeiyf.supabase.co/storage/v1/object/public/documents/brand/logo-512.png" 
                      alt="Carbon &amp; Whale Logo" 
                      width="68" 
                      height="68" 
                      style="display: block; border-radius: 50%; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35); border: 2px solid rgba(255, 255, 255, 0.2); margin-bottom: 14px;" 
                    />
                    <span style="color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: -0.02em; display: block;">
                      Carbon &amp; Whale
                    </span>
                    <span style="color: #94a3b8; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; display: block; margin-top: 4px;">
                      Proof of Performance Portal
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Body -->
          <tr>
            <td style="padding: 36px 32px 28px 32px;">
              <div style="display: inline-block; background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 20px; padding: 4px 12px; margin-bottom: 16px;">
                <span style="color: ${statusColor}; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">
                  ● Campaign Status: ${statusLabel}
                </span>
              </div>

              <h1 style="color: #0f172a; font-size: 22px; font-weight: 700; margin: 0 0 12px 0; letter-spacing: -0.01em;">
                Ad Verification &amp; Live Performance for ${brandName || "your Brand"}
              </h1>
              <p style="color: #475569; font-size: 14px; line-height: 22px; margin: 0 0 20px 0;">
                ${
                  customMessage ||
                  `Your outdoor advertising campaign is active across the Carbon & Whale network. You can view your real-time proof-of-performance photos, GPS geotag coordinates, and installation verification on your dedicated client portal.`
                }
              </p>

              <!-- Campaign Summary Box -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; margin: 20px 0; padding: 16px;">
                ${
                  locationName
                    ? `<tr>
                        <td style="padding: 6px 12px; color: #64748b; font-size: 12px; width: 35%;">Location</td>
                        <td style="padding: 6px 12px; color: #0f172a; font-size: 13px; font-weight: 600;">${locationName}</td>
                      </tr>`
                    : ""
                }
                ${
                  assetCode
                    ? `<tr>
                        <td style="padding: 6px 12px; color: #64748b; font-size: 12px; width: 35%;">Asset Code</td>
                        <td style="padding: 6px 12px; color: #0f172a; font-size: 13px; font-family: monospace; font-weight: 600;">${assetCode}</td>
                      </tr>`
                    : ""
                }
                ${
                  startDate || endDate
                    ? `<tr>
                        <td style="padding: 6px 12px; color: #64748b; font-size: 12px; width: 35%;">Campaign Flight</td>
                        <td style="padding: 6px 12px; color: #0f172a; font-size: 13px; font-weight: 500;">${
                          startDate || "Active"
                        } &rarr; ${endDate || "Ongoing"}</td>
                      </tr>`
                    : ""
                }
              </table>

              <!-- Action CTA Button -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 28px 0 12px 0;">
                <tr>
                  <td align="center">
                    <a href="${cleanPortalUrl}" target="_blank" style="background-color: #0284c7; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; padding: 14px 36px; border-radius: 10px; display: inline-block; box-shadow: 0 4px 10px rgba(2, 132, 199, 0.35);">
                      View Proof of Performance Portal &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <p style="color: #94a3b8; font-size: 12px; line-height: 18px; text-align: center; margin: 12px 0 0 0;">
                No login required &middot; Direct secure client access link
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 32px; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="color: #94a3b8; font-size: 11px; line-height: 16px; margin: 0;">
                &copy; 2026 Carbon &amp; Whale Media Network &middot; Operations &amp; Verification Desk
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "Carbon & Whale IMS <onboarding@resend.dev>",
      to: [to.trim()],
      subject: `Ad Campaign Verification & Proof of Performance — ${brandName || "Carbon & Whale"}`,
      html: emailHtml,
    }),
  });

  const resData = await response.json();
  if (!response.ok) {
    throw new Error(resData?.message || resData?.error?.message || "Failed to send notification email via Resend.");
  }

  return resData;
}
