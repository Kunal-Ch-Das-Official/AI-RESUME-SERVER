import { IController } from "subatom";
import { clientContactSchema } from "../../schema/contactUs.schema.js";
import ContactEnquiryModel from "../../models/contactUs.js";
import sendAlertMessage from "../../emails/sendAlertMessage.js";
import envConfig from "../../config/envConfig.js";

const clientContactFormController: IController<
  typeof clientContactSchema
> = async (ctx) => {
  const { fullName, emailId, subject, message } = ctx.body;

  try {
    // 1. Persist the enquiry (Model.create() automatically saves the document)
    const storedEnquiry = await ContactEnquiryModel.create({
      fullName,
      emailId,
      subject,
      message,
    });

    if (!storedEnquiry) {
      return ctx.helper.internal_server_error(
        "Unable to save enquiry. Please try again later.",
      );
    }

    // 2. Format and dispatch internal notification email
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #334155;">
        <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #0f172a;">New Contact Inquiry: ${subject}</h2>
        <p style="margin: 0 0 8px 0;"><strong>From:</strong> ${fullName} (&lt;${emailId}&gt;)</p>
        <p style="margin: 0 0 16px 0;"><strong>Subject:</strong> ${subject}</p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
        <p style="margin: 0 0 8px 0; font-weight: 600;">Message:</p>
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; white-space: pre-wrap;">${message}</div>
      </div>
    `;

    try {
      const mailResult = await sendAlertMessage(
        "team@airesume.download",
        `[New Inquiry] ${subject}`,
        emailHtml,
        envConfig.SMTP_BUSINESS_EMAIL,
      );

      if (!mailResult.success) {
        console.error(
          "Failed to send contact inquiry alert:",
          mailResult.details,
        );
      }
    } catch (mailError: unknown) {
      const err =
        mailError instanceof Error ? mailError.message : "Unknown error";
      console.error("Error occurred while sending contact inquiry alert:", err);
      // Non-blocking: We log the failure but do not prevent the client from receiving success,
      // because the inquiry has already been recorded in the database.
    }

    return ctx.helper.success(
      "Your message was received successfully. We will get back to you shortly.",
    );
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Internal Server Error";
    console.error(
      "Unhandled error in clientContactFormController:",
      errorMessage,
    );

    return ctx.helper.internal_server_error(
      "An unexpected error occurred. Please try again later.",
    );
  }
};

export default clientContactFormController;
