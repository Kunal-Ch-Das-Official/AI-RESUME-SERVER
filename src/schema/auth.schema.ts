import infer from "subatom-infer";

const userRegistrationSchema = {
  body: {
    userName: infer.string().min(3),
    emailId: infer.string().email(),
    fullName: infer.string().min(2),
    age: infer.number().int().min(1).max(120),
    password: infer.string().optional(),
  },
};

const userLoginSchema = {
  body: {
    userName: infer.string().min(3).optional(),
    emailId: infer.string().email().optional(),
    password: infer.string(),
  },
};

const passwordUpdateSchema = {
  body: {
    currentPassword: infer.string(),
    newPassword: infer.string(),
  },
};

const passwordResetLinkSendSchema = {
  body: {
    userName: infer.string().optional(),
    emailId: infer.string().optional(),
  },
};

const resetPasswordSchema = {
  params: {
    userId: infer.string(),
    accessToken: infer.string(),
  },
  body:{
    password: infer.string(), confirmPassword: infer.string()
  },
};

const myResumeSchema = {
  body: {
    resumeInfoId: infer.string().min(3),
    userId: infer.string().min(3),
  },
};

const fetchUserSchema ={
params: {
  userId:infer.string().optional()
}
}

export {
  userRegistrationSchema,
  userLoginSchema,
  passwordUpdateSchema,
  passwordResetLinkSendSchema,
  resetPasswordSchema,
  myResumeSchema,
  fetchUserSchema
};
