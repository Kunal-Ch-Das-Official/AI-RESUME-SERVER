import infer from "subatom-infer";

export const clientContactSchema = {
  body: {
    fullName: infer.string().min(1),
    emailId: infer.string().email(),
    subject: infer.string().min(8),
    message: infer.string().min(12),
  },
};

export const getClientContactSchema = {
  params: {
    enqueryId: infer.string().optional(),
  },
};
