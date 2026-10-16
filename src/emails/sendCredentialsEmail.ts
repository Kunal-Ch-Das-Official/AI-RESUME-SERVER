import nodemailer from "nodemailer";
import envConfig from "../config/envConfig.js";

export interface MailResult {
  success: boolean;
  message: string;
  details?: string;
}

const sendCredentialsEmail = async (
  userEmail: string,
  userPassword: string,
  businessEmail: string = envConfig.SMTP_BUSINESS_EMAIL ||
    "team@ai-resume.download",
): Promise<MailResult> => {
  try {
    const transporter = nodemailer.createTransport({
      host: envConfig.SMTP_PROTOCOL || "smtp.gmail.com",
      port: Number(envConfig.SMTP_PORT || 465),
      secure: true,
      auth: {
        user: envConfig.SMTP_SENDER || "rsc12162025@gmail.com",
        pass: envConfig.SMTP_PASS,
      },
    });

    const mailSubject = "Your AI-Resume Portal Access Credentials";

    const emailTemplate = `
      <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
      <html xmlns="http://www.w3.org/1999/xhtml">
        <head>
          <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>${mailSubject}</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f1f5f9; padding: 40px 15px;">
            <tr>
              <td align="center">
                <!-- Main Container -->
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);">

                  <!-- Logo Header -->
                  <tr>
                    <td align="center" style="padding: 36px 30px 24px 30px; background-color: #0f172a;">
                      <img src="https://res.cloudinary.com/dtlwabk09/image/upload/v1792162485/resume_craft_logo_tkfekw.webp" alt="AI-Resume Logo" width="160" style="display: block; border: 0; outline: none; text-decoration: none; max-width: 160px; height: auto;" />
                    </td>
                  </tr>

                  <!-- Hero Title & Body -->
                  <tr>
                    <td style="padding: 36px 32px 20px 32px; color: #1e293b;">
                      <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 700; color: #0f172a; line-height: 1.3;">
                        Welcome to AI-Resume!
                      </h1>
                      <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #475569;">
                        Your account has been created. Here are your temporary system-generated login credentials to access your workspace and resume dashboard:
                      </p>

                      <!-- Credentials Card -->
                      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; margin: 24px 0;">
                        <tr>
                          <td style="padding: 16px 20px; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #64748b; font-weight: 600;">
                            Login Email
                          </td>
                          <td style="padding: 16px 20px; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #0f172a; font-family: monospace; font-weight: 600;" align="right">
                            ${userEmail}
                          </td>
                        </tr>
                        <tr>
                          <td style="padding: 16px 20px; font-size: 14px; color: #64748b; font-weight: 600;">
                            Temporary Password
                          </td>
                          <td style="padding: 16px 20px; font-size: 14px; color: #2563eb; font-family: monospace; font-weight: 700; letter-spacing: 0.5px;" align="right">
                            ${userPassword}
                          </td>
                        </tr>
                      </table>

                      <!-- Action Button -->
                      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 28px 0 10px 0;">
                        <tr>
                          <td align="center">
                            <a href="${envConfig.CLIENT_URL || "https://ai-resume.download"}" target="_blank" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; padding: 13px 32px; border-radius: 8px;">
                              Sign In to Workspace
                            </a>
                          </td>
                        </tr>
                      </table>

                      <!-- Advisory Note -->
                      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 24px; background-color: #fffbeb; border-left: 4px solid #f59e0b; border-radius: 0 8px 8px 0;">
                        <tr>
                          <td style="padding: 12px 16px; font-size: 13px; color: #92400e; line-height: 1.5;">
                            <strong>Security Tip:</strong> Please store your password safely and update it under account settings immediately after your first sign-in.
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="padding: 24px 32px 32px 32px; border-top: 1px solid #f1f5f9; text-align: center; color: #94a3b8; font-size: 12px; line-height: 1.5;">
                      <p style="margin: 0 0 6px 0;">This email was sent by <strong>AI-Resume</strong>.</p>
                      <p style="margin: 0;">&copy; 2026 AI-Resume. All rights reserved.</p>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;

    const info = await transporter.sendMail({
      from: `"AI-Resume" <${businessEmail}>`,
      replyTo: businessEmail,
      to: userEmail,
      subject: mailSubject,
      html: emailTemplate,
    });

    return {
      success: true,
      message: "Login credentials email sent successfully!",
      details: info.response,
    };
  } catch (error: unknown) {
    console.error("Error sending credentials email:", error);
    return {
      success: false,
      message: "Failed to send credentials email.",
      details: (error as Error).message,
    };
  }
};

export default sendCredentialsEmail;
