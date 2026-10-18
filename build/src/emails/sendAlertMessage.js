import n from"nodemailer";import e from"../config/envConfig.js";const i=async(s,r,a,o=e.SMTP_BUSINESS_EMAIL||"team@ai-resume.download")=>{try{const t=n.createTransport({host:e.SMTP_PROTOCOL||"smtp.gmail.com",port:Number(e.SMTP_PORT||465),secure:!0,auth:{user:e.SMTP_SENDER||"rsc12162025@gmail.com",pass:e.SMTP_PASS}}),l=`
      <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
      <html xmlns="http://www.w3.org/1999/xhtml">
        <head>
          <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>${r}</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f1f5f9; padding: 40px 15px;">
            <tr>
              <td align="center">
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);">

                  <!-- Logo Header -->
                  <tr>
                    <td align="center" style="padding: 36px 30px 24px 30px; background-color: #0f172a;">
                      <img src="https://res.cloudinary.com/dtlwabk09/image/upload/v1792162485/resume_craft_logo_tkfekw.webp" alt="AI-Resume Logo" width="160" style="display: block; border: 0; outline: none; text-decoration: none; max-width: 160px; height: auto;" />
                    </td>
                  </tr>

                  <!-- Dynamic Content Body -->
                  <tr>
                    <td style="padding: 36px 32px; color: #1e293b; font-size: 15px; line-height: 1.6;">
                      ${a}
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="padding: 24px 32px 32px 32px; border-top: 1px solid #f1f5f9; text-align: center; color: #94a3b8; font-size: 12px; line-height: 1.5;">
                      <p style="margin: 0 0 6px 0;">Automated notification from <strong>AI-Resume</strong>.</p>
                      <p style="margin: 0;">&copy; 2026 AI-Resume. All rights reserved.</p>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;return{success:!0,message:"Email alert has been sent successfully!",details:(await t.sendMail({from:`"AI-Resume" <${o}>`,replyTo:o,to:s,subject:r,html:l})).response}}catch(t){return console.error("Error sending email:",t),{success:!1,message:"Failed to send email.",details:t.message}}};var m=i;export{m as default};
//# sourceMappingURL=sendAlertMessage.js.map
