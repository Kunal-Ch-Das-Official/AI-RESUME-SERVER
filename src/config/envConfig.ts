/// <reference types="node" />
import { configEnv } from "subatom";
configEnv();

const environment = {
  MONGO_CONNECTION_STRING:
    (process.env.MONGO_CONNECTION_STRING as string) || "",
  NODE_ENV: (process.env.NODE_ENV as string) || "",
  PORT: Number(process.env.PORT) || 8080,
  HOST: (process.env.HOST as string) || "localhost",
  REDIS_URL: (process.env.REDIS_URL as string) || "",
  REDIS_KEY_PREFIX: (process.env.REDIS_KEY_PREFIX as string) || "",
  REDIS_REQUIRED: (process.env.REDIS_REQUIRED as string) || "",
  REDIS_CONNECT_TIMEOUT_MS:
    (process.env.REDIS_CONNECT_TIMEOUT_MS as string) || "",
  REDIS_SHUTDOWN_TIMEOUT_MS:
    (process.env.REDIS_SHUTDOWN_TIMEOUT_MS as string) || "",
  REDIS_DEBUG: (process.env.REDIS_DEBUG as string) || "",
  JWT_ACCESS_SECRET: (process.env.JWT_ACCESS_SECRET as string) || "",
  JWT_REFRESH_SECRET: (process.env.JWT_REFRESH_SECRET as string) || "",
  CLIENT_URL: (process.env.CLIENT_URL as string) || "http://localhost:3000",

  SMTP_PROTOCOL: (process.env.SMTP_PROTOCOL as string) || "",
  SMTP_PORT: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 465,
  SMTP_SENDER: (process.env.SMTP_SENDER as string) || "",
  SMTP_PASS: (process.env.SMTP_PASS as string) || "",
  SMTP_BUSINESS_EMAIL: (process.env.SMTP_BUSINESS_EMAIL as string) || "",

  CLOUDINARY_CLOUD_NAME: (process.env.CLOUDINARY_CLOUD_NAME as string) || "",
  CLOUDINARY_API_KEY: (process.env.CLOUDINARY_API_KEY as string) || "",
  CLOUDINARY_CLOUD_SECRET:
    (process.env.CLOUDINARY_CLOUD_SECRET as string) || "",

  RAZORPAY_KEY_ID:   (process.env.RAZORPAY_KEY_ID as string) || "",
  RAZORPAY_KEY_SECRET:(process.env.RAZORPAY_KEY_SECRET as string) || "",
  RAZORPAY_WEBHOOK_SECRET: (process.env.RAZORPAY_WEBHOOK_SECRET as string) || "",
};
const envConfig = Object.freeze(environment);
export default envConfig;
