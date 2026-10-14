import nodemailer from "nodemailer";
import envConfig from "../config/envConfig.js";

export interface MailResult {
  success: boolean;
  message: string;
  details?: string;
}

/**
 * Sends auto-generated login credentials to a newly registered or logged-in user on AI Resume.
 *
 * @param userEmail - The recipient's email address
 * @param userPassword - The auto-generated secure password
 * @param senderId - Optional sender email override (defaults to SMTP_SENDER from env)
 */
const sendCredentialsEmail = async (
  userEmail: string,
  userPassword: string,
  senderId: string = envConfig.SMTP_SENDER,
): Promise<MailResult> => {
  try {
    const transporter = nodemailer.createTransport({
      host: envConfig.SMTP_PROTOCOL,
      port: Number(envConfig.SMTP_PORT || 465),
      secure: true,
      auth: {
        user: senderId,
        pass: envConfig.SMTP_PASS,
      },
      authMethod: "PLAIN",
    });

    const mailSubject = "Your AI-Resume Portal Access Credentials";

    // High-security responsive HTML email template
    const emailTemplate = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #334155; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
            .header { background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 30px; text-align: center; color: #ffffff; }
            .header h1 { margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.025em; }
            .content { padding: 32px; }
            .credential-box { background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 8px; padding: 20px; margin: 20px 0; font-family: monospace; font-size: 14px; color: #0f172a; }
            .credential-item { margin-bottom: 8px; }
            .credential-item:last-child { margin-bottom: 0; }
            .warning-box { background: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 0 8px 8px 0; font-size: 12px; color: #92400e; margin-top: 20px; }
            .footer { padding: 20px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #f1f5f9; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to AI-Resume!</h1>
            </div>
            <div class="content">
              <p>Hello,</p>
              <p>Your secure account has been created successfully on the <strong>AI-Resume</strong> portal. Below are your temporary system-generated login credentials:</p>

              <div class="credential-box">
                <div class="credential-item"><strong>Email / User ID:</strong> ${userEmail}</div>
                <div class="credential-item"><strong>Password:</strong> ${userPassword}</div>
              </div>

              <p>You can use these credentials to sign in to your workspace, build ATS-optimized resumes, and manage your documents securely.</p>

              <div class="warning-box">
                <strong>Security Notice:</strong> Please save this password in a secure password manager immediately. For your security, we recommend changing your password right after your first login.
              </div>
            </div>
            <div class="footer">
              &copy; 2026 AI-Resume Portal. All rights reserved. This is an automated security transmission.
            </div>
          </div>
        </body>
      </html>
    `;

    const info = await transporter.sendMail({
      from: `AI-Resume Security <${senderId}>`,
      to: userEmail,
      subject: mailSubject,
      html: emailTemplate,
    });

    console.log("Credentials email sent successfully:", info.response);

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
