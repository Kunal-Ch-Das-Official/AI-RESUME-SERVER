import nodemailer from "nodemailer";
import envConfig from "../config/envConfig.js";

export interface MailResult {
  success: boolean;
  message: string;
  details?: string;
}

const sendAlertMessage = async (
  sendTo: string,
  senderId: string,
  mailSubject: string,
  emailTemplate: string,
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

    const info = await transporter.sendMail({
      from: `AI-Resume <${senderId}>`,
      to: sendTo,
      subject: mailSubject,
      html: emailTemplate,
    });

    console.log("Email sent:", info.response);

    return {
      success: true,
      message: "Email alert has been sent successfully!",
      details: info.response,
    };
  } catch (error: unknown) {
    console.error("Error sending email:", error);

    return {
      success: false,
      message: "Failed to send email.",
      details: (error as Error).message,
    };
  }
};

export default sendAlertMessage;
