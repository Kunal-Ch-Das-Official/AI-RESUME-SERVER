import nodemailer from "nodemailer";
import envConfig from "../config/envConfig.js";
import { getPlanById } from "../config/plans.js";
import PaymentModel from "../models/paymentData.js";
import UserModel from "../models/usersData.js";

const LOGO_URL =
  "https://res.cloudinary.com/dtlwabk09/image/upload/v1792162485/resume_craft_logo_tkfekw.webp";
const PDF_LOGO_URL =
  "https://res.cloudinary.com/dtlwabk09/image/upload/f_jpg,q_auto,w_360/v1792162485/resume_craft_logo_tkfekw.webp";

const escapeHtml = (value: unknown): string =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const pdfEscape = (value: string): string =>
  value
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");

const pdfText = (
  x: number,
  y: number,
  size: number,
  value: string,
  color = "0.12 0.16 0.25",
) =>
  `BT /F1 ${size} Tf ${color} rg 1 0 0 1 ${x} ${y} Tm (${pdfEscape(value)}) Tj ET`;

const readJpegSize = (
  jpeg: Buffer,
): { width: number; height: number } | null => {
  let offset = 2;
  while (offset < jpeg.length - 9) {
    if (jpeg[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = jpeg[offset + 1];
    const length = jpeg.readUInt16BE(offset + 2);
    if (
      [
        0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce,
        0xcf,
      ].includes(marker)
    ) {
      return {
        height: jpeg.readUInt16BE(offset + 5),
        width: jpeg.readUInt16BE(offset + 7),
      };
    }
    if (length < 2) break;
    offset += 2 + length;
  }
  return null;
};

const fetchInvoiceLogo = async (): Promise<Buffer | null> => {
  try {
    const response = await fetch(PDF_LOGO_URL, {
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    return readJpegSize(bytes) ? bytes : null;
  } catch {
    // Email and receipt delivery should still work if the logo CDN is unavailable.
    return null;
  }
};

/** Creates a branded, single-page invoice PDF with a green PAID stamp. */
const createInvoicePdf = async (data: {
  invoiceNumber: string;
  orderId: string;
  paymentId: string;
  paidAt: string;
  customerName: string;
  customerEmail: string;
  planName: string;
  planId: string;
  credits: string;
  amount: string;
  currency: string;
}): Promise<Buffer> => {
  const logo = await fetchInvoiceLogo();
  const commands: string[] = [];
  // Header panel and accent rule.
  commands.push("0.19 0.18 0.51 rg 0 744 595 98 re f");
  commands.push("0.48 0.43 0.94 rg 0 740 595 4 re f");
  if (logo) {
    // Fit the logo inside a 120 x 48 pt box without changing its aspect ratio.
    const logoDimensions = readJpegSize(logo)!;
    const maxLogoWidth = 120;
    const maxLogoHeight = 48;
    const logoScale = Math.min(
      maxLogoWidth / logoDimensions.width,
      maxLogoHeight / logoDimensions.height,
    );
    const logoWidth = logoDimensions.width * logoScale;
    const logoHeight = logoDimensions.height * logoScale;
    const logoY = 770 + (48 - logoHeight) / 2;
    commands.push(
      `q ${logoWidth.toFixed(2)} 0 0 ${logoHeight.toFixed(2)} 42 ${logoY.toFixed(2)} cm /Im1 Do Q`,
    );
  } else commands.push(pdfText(42, 790, 23, "Resume Craft", "1 1 1"));
  commands.push(pdfText(42, 756, 11, "PAYMENT INVOICE / RECEIPT", "1 1 1"));
  commands.push(pdfText(42, 708, 20, "Payment invoice", "0.12 0.16 0.25"));
  commands.push(
    pdfText(
      42,
      686,
      9,
      `Invoice reference: ${data.invoiceNumber}`,
      "0.38 0.42 0.50",
    ),
  );

  // Green PAID stamp.
  commands.push("q 0.0 0.48 0.28 RG 2 w 1 0 0 1 448 686 cm 0 0 100 38 re S Q");
  commands.push(pdfText(471, 700, 16, "PAID", "0.0 0.48 0.28"));

  commands.push(pdfText(42, 645, 10, "BILLED TO", "0.38 0.42 0.50"));
  commands.push(pdfText(42, 626, 12, data.customerName));
  commands.push(pdfText(42, 609, 9, data.customerEmail, "0.30 0.34 0.42"));
  commands.push(pdfText(340, 645, 10, "PAYMENT DETAILS", "0.38 0.42 0.50"));
  commands.push(
    pdfText(340, 626, 9, `Date (UTC): ${data.paidAt}`, "0.20 0.24 0.32"),
  );
  commands.push(
    pdfText(340, 609, 9, `Order ID: ${data.orderId}`, "0.20 0.24 0.32"),
  );
  commands.push(
    pdfText(340, 592, 9, `Payment ID: ${data.paymentId}`, "0.20 0.24 0.32"),
  );

  // Item table.
  commands.push("0.95 0.96 0.99 rg 42 542 511 28 re f");
  commands.push(pdfText(52, 552, 10, "DESCRIPTION", "0.25 0.29 0.38"));
  commands.push(pdfText(475, 552, 10, "AMOUNT", "0.25 0.29 0.38"));
  commands.push(`0.88 0.90 0.94 RG 0.7 w 42 542 m 553 542 l S`);
  commands.push(pdfText(52, 519, 11, data.planName));
  commands.push(
    pdfText(52, 501, 9, `Plan ID: ${data.planId}`, "0.38 0.42 0.50"),
  );
  commands.push(
    pdfText(
      52,
      483,
      9,
      `Includes ${data.credits} AI resume credits`,
      "0.38 0.42 0.50",
    ),
  );
  commands.push(pdfText(465, 519, 11, `${data.currency} ${data.amount}`));
  commands.push("0.88 0.90 0.94 RG 0.7 w 42 465 m 553 465 l S");
  commands.push(pdfText(52, 435, 10, "TOTAL PAID", "0.25 0.29 0.38"));
  commands.push(
    pdfText(420, 430, 19, `${data.currency} ${data.amount}`, "0.0 0.48 0.28"),
  );

  // Validity is credit-based and does not expire by calendar date.
  commands.push("0.91 0.97 0.94 rg 42 355 511 48 re f");
  commands.push(pdfText(54, 383, 10, "CREDIT VALIDITY", "0.0 0.40 0.24"));
  commands.push(
    pdfText(
      54,
      366,
      10,
      "Lifetime — credits remain available until they are used up.",
      "0.12 0.30 0.23",
    ),
  );
  commands.push(pdfText(42, 315, 10, "Payment status: PAID", "0.0 0.48 0.28"));
  commands.push(
    pdfText(
      42,
      286,
      9,
      "Thank you for choosing Resume Craft.",
      "0.30 0.34 0.42",
    ),
  );
  commands.push(
    pdfText(
      42,
      270,
      9,
      "This receipt confirms the payment recorded by Resume Craft.",
      "0.30 0.34 0.42",
    ),
  );
  commands.push("0.88 0.90 0.94 RG 0.7 w 42 65 m 553 65 l S");
  commands.push(
    pdfText(
      42,
      45,
      8,
      "Resume Craft  |  Payment receipt generated electronically",
      "0.48 0.52 0.60",
    ),
  );

  const stream = Buffer.from(commands.join("\n"), "ascii");
  const objects: Buffer[] = [];
  objects.push(Buffer.from("<< /Type /Catalog /Pages 2 0 R >>", "ascii"));
  objects.push(
    Buffer.from("<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "ascii"),
  );
  const xObjectResources = logo ? " /XObject << /Im1 6 0 R >>" : "";
  objects.push(
    Buffer.from(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >>${xObjectResources} >> /Contents 5 0 R >>`,
      "ascii",
    ),
  );
  objects.push(
    Buffer.from(
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
      "ascii",
    ),
  );
  objects.push(
    Buffer.concat([
      Buffer.from(`<< /Length ${stream.length} >>\nstream\n`, "ascii"),
      stream,
      Buffer.from("\nendstream", "ascii"),
    ]),
  );
  if (logo) {
    const dimensions = readJpegSize(logo)!;
    objects.push(
      Buffer.concat([
        Buffer.from(
          `<< /Type /XObject /Subtype /Image /Width ${dimensions.width} /Height ${dimensions.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logo.length} >>\nstream\n`,
          "ascii",
        ),
        logo,
        Buffer.from("\nendstream", "ascii"),
      ]),
    );
  }

  const chunks: Buffer[] = [
    Buffer.from("%PDF-1.4\n%Resume Craft Invoice\n", "ascii"),
  ];
  const offsets: number[] = [0];
  let byteLength = chunks[0].length;
  objects.forEach((object, index) => {
    offsets.push(byteLength);
    const wrapped = Buffer.concat([
      Buffer.from(`${index + 1} 0 obj\n`, "ascii"),
      object,
      Buffer.from("\nendobj\n", "ascii"),
    ]);
    chunks.push(wrapped);
    byteLength += wrapped.length;
  });
  const xrefOffset = byteLength;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i += 1)
    xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  chunks.push(Buffer.from(xref, "ascii"));
  return Buffer.concat(chunks);
};

/**
 * Sends one payment confirmation per paid payment. The database claim prevents
 * duplicate emails when Razorpay's webhook and browser verification race.
 * Email errors are recorded and do not undo a verified payment or its credits.
 */
const sendPaymentConfirmationEmail = async (
  paymentId: string,
): Promise<void> => {
  const claim = await PaymentModel.findOneAndUpdate(
    {
      _id: paymentId,
      status: "paid",
      $or: [
        { receiptEmailStatus: { $in: ["pending", "failed"] } },
        { receiptEmailStatus: { $exists: false } },
      ],
    },
    { $set: { receiptEmailStatus: "sending", receiptEmailError: null } },
    { new: true },
  );

  if (!claim) return;

  try {
    const [user, plan] = await Promise.all([
      UserModel.findById(claim.userId),
      Promise.resolve(getPlanById(claim.planId)),
    ]);

    if (!user?.emailId) throw new Error("Registered user email was not found.");
    if (!plan) throw new Error(`Plan configuration not found: ${claim.planId}`);
    if (!envConfig.SMTP_SENDER || !envConfig.SMTP_PASS) {
      throw new Error(
        "SMTP_SENDER and SMTP_PASS must be configured to send payment emails.",
      );
    }

    const senderEmail = envConfig.SMTP_BUSINESS_EMAIL || envConfig.SMTP_SENDER;
    const transporter = nodemailer.createTransport({
      host: envConfig.SMTP_PROTOCOL || "smtp.gmail.com",
      port: Number(envConfig.SMTP_PORT || 465),
      secure: Number(envConfig.SMTP_PORT || 465) === 465,
      auth: { user: envConfig.SMTP_SENDER, pass: envConfig.SMTP_PASS },
    });

    const amount = (claim.amount / 100).toFixed(2);
    const invoiceNumber = claim.paymentId || claim.orderId;
    const paidAt = (
      claim.updatedAt ||
      claim.createdAt ||
      new Date()
    ).toISOString();
    const invoicePdf = await createInvoicePdf({
      invoiceNumber,
      orderId: claim.orderId,
      paymentId: claim.paymentId || "N/A",
      paidAt,
      customerName: String(user.fullName || "Customer"),
      customerEmail: String(user.emailId),
      planName: String(plan.name),
      planId: String(plan.id),
      credits: String(plan.resumes),
      amount,
      currency: String(claim.currency || "INR"),
    });

    const html = `
      <div style="margin:0;background:#f1f5f9;padding:32px 12px;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
        <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden">
          <div style="background:#312e81;color:#ffffff;padding:24px 30px">
            <img src="${LOGO_URL}" alt="Resume Craft" width="112" style="display:block;width:112px;max-width:112px;height:auto;max-height:36px;object-fit:contain;border:0;margin:0 0 12px" />
            <div style="font-size:14px;color:#e0e7ff">Payment confirmed</div>
          </div>
          <div style="padding:30px">
            <h1 style="font-size:22px;margin:0 0 14px">Congratulations, ${escapeHtml(user.fullName)}!</h1>
            <p style="font-size:15px;line-height:1.7;color:#475569">Thank you for choosing Resume Craft. We have successfully received your payment for the <strong>${escapeHtml(plan.name)}</strong> plan.</p>
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:18px;margin:22px 0">
              <div style="font-size:13px;color:#64748b">Amount paid</div>
              <div style="font-size:28px;font-weight:700;color:#111827;margin:4px 0 16px">INR ${amount}</div>
              <table style="width:100%;border-collapse:collapse;font-size:14px">
                <tr><td style="padding:8px 0;color:#64748b;border-bottom:1px solid #e2e8f0">Plan</td><td style="padding:8px 0;text-align:right;font-weight:600;border-bottom:1px solid #e2e8f0">${escapeHtml(plan.name)}</td></tr>
                <tr><td style="padding:8px 0;color:#64748b;border-bottom:1px solid #e2e8f0">AI resume credits</td><td style="padding:8px 0;text-align:right;font-weight:600;border-bottom:1px solid #e2e8f0">${escapeHtml(plan.resumes)}</td></tr>
                <tr><td style="padding:8px 0;color:#64748b;border-bottom:1px solid #e2e8f0">Validity</td><td style="padding:8px 0;text-align:right;font-weight:600;border-bottom:1px solid #e2e8f0">Lifetime, until credits are used</td></tr>
                <tr><td style="padding:8px 0;color:#64748b;border-bottom:1px solid #e2e8f0">Payment reference</td><td style="padding:8px 0;text-align:right;font-size:12px;word-break:break-all;border-bottom:1px solid #e2e8f0">${escapeHtml(invoiceNumber)}</td></tr>
                <tr><td style="padding:10px 0 0;color:#64748b">Status</td><td style="padding:10px 0 0;text-align:right;color:#047857;font-weight:700">✓ PAID</td></tr>
              </table>
            </div>
            <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:12px 15px;color:#065f46;font-size:13px;line-height:1.6"><strong>Lifetime credit validity:</strong> Your purchased AI credits do not expire by date. Validity ends when all purchased credits have been used.</div>
            <p style="font-size:15px;line-height:1.7;color:#475569">Your professional invoice is attached to this email as a PDF. You can now continue creating and tailoring your resumes.</p>
            <p style="font-size:15px;line-height:1.7;color:#475569">Thanks for being with us,<br/><strong>Team Resume Craft</strong></p>
            <p style="font-size:12px;color:#94a3b8;line-height:1.6">Order ID: ${escapeHtml(claim.orderId)}<br/>Payment ID: ${escapeHtml(claim.paymentId || "N/A")}</p>
          </div>
        </div>
      </div>`;

    await transporter.sendMail({
      from: `"Resume Craft" <${senderEmail}>`,
      replyTo: senderEmail,
      to: user.emailId,
      subject: `Payment received — ${plan.name} plan | Resume Craft`,
      html,
      text: `Congratulations ${user.fullName}! Thank you for choosing Resume Craft. We received INR ${amount} for your ${plan.name} plan (${plan.resumes} AI resume credits). Validity: lifetime, until all purchased credits have been used. Payment reference: ${invoiceNumber}. Your PDF invoice is attached.`,
      attachments: [
        {
          filename: `Resume-Craft-Invoice-${String(invoiceNumber).replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`,
          content: invoicePdf,
          contentType: "application/pdf",
        },
      ],
    });

    await PaymentModel.findByIdAndUpdate(claim._id, {
      $set: {
        receiptEmailStatus: "sent",
        receiptEmailSentAt: new Date(),
        receiptEmailError: null,
      },
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown email delivery error";
    console.error("Failed to send payment confirmation email:", message);
    await PaymentModel.findByIdAndUpdate(claim._id, {
      $set: {
        receiptEmailStatus: "failed",
        receiptEmailError: message.slice(0, 500),
      },
    });
  }
};

export default sendPaymentConfirmationEmail;
