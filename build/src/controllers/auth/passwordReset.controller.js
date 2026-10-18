import{hash as c,token as u}from"subatom";import p from"../../models/usersData.js";import a from"../../config/envConfig.js";import m from"../../emails/sendAlertMessage.js";const f=async e=>{const{userName:n,emailId:t}=e.body;try{if(!n&&!t)return e.helper.bad_request("Either username or email is required for login.");const s=t?{emailId:t}:{userName:n},o=await p.findOne(s);if(!o)return e.helper.not_found("Requested user does not exists.");const r=u.sign({userId:o._id},a.JWT_ACCESS_SECRET,{expiresIn:"15m"}),l=`${a.CLIENT_URL}/reset-password/${o._id}/${r}`;try{const i=await m(o.emailId,"Password Reset Request - AI-Resume",`
  <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #0f172a;">Password Reset Request</h2>
  <p style="margin: 0 0 14px 0; color: #475569;">Hello ${o.userName||"there"},</p>
  <p style="margin: 0 0 24px 0; color: #475569;">We received a request to reset your password. Click the button below to set a new password. This link is valid for <strong>15 minutes</strong>.</p>

  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 28px 0;">
    <tr>
      <td align="center">
        <a href="${l}" target="_blank" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; padding: 13px 32px; border-radius: 8px;">
          Reset Password
        </a>
      </td>
    </tr>
  </table>

  <p style="margin: 24px 0 0 0; font-size: 13px; color: #64748b;">If you did not request a password reset, you can safely ignore this email.</p>
  `,a.SMTP_BUSINESS_EMAIL);if(!i.success)return console.error("Failed to send password reset email:",i.details),e.helper.internal_server_error("Unable to send email, Please try again later.")}catch(i){return console.error("Failed to send password reset email:",i.message),e.helper.internal_server_error("Unable to send email, Please try again later.")}return e.helper.success("Password reset link has been sended to the register email address.")}catch(s){return console.error("Something went wrong.",s.message),e.helper.internal_server_error(s.message)}},w=async e=>{const{userId:n,accessToken:t}=e.params,{password:s,confirmPassword:o}=e.body;try{if(!n||!t)return e.helper.bad_request("All parameters are require to proceed!");if(s!==o)return e.helper.bad_request("Password and confirm password must be same.");const r=await p.findById(n);if(!r)return e.helper.not_found("User does not exist associating with given user id.");try{u.verify(t,a.JWT_ACCESS_SECRET)}catch(d){return e.helper.unprocessable_content(`${d.message}`)}const l=c.password(s,{keylen:32});if(!await p.findByIdAndUpdate(r._id,{$set:{password:l}}))return e.helper.not_implemented("Unable to update password, please try again.");try{await m(r.emailId,"Password Successfully Reset - AI-Resume",`
  <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #0f172a;">Password Changed Successfully</h2>
  <p style="margin: 0 0 14px 0; color: #475569;">Hello ${r.fullName||r.userName||"there"},</p>
  <p style="margin: 0 0 16px 0; color: #475569;">The password for your AI-Resume account was successfully updated.</p>
  <div style="background-color: #fff1f2; border-left: 4px solid #f43f5e; padding: 12px 16px; border-radius: 0 8px 8px 0; margin-top: 20px;">
    <p style="margin: 0; font-size: 13px; color: #9f1239;">
      <strong>Security Alert:</strong> If you did not make this change, please contact support at <a href="mailto:${a.SMTP_BUSINESS_EMAIL||"team@ai-resume.download"}" style="color: #9f1239; font-weight: 600;">${a.SMTP_BUSINESS_EMAIL||"team@ai-resume.download"}</a> immediately.
    </p>
  </div>
  `,a.SMTP_BUSINESS_EMAIL)}catch(d){console.error("\u26A0\uFE0F Failed to send confirmation email:",d.message)}return e.helper.success("Password has been successfully reset.")}catch(r){return e.helper.internal_server_error(r.message)}};export{w as resetForgottenPassword,f as sendPasswordResetLinkController};
//# sourceMappingURL=passwordReset.controller.js.map
