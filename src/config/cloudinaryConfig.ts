import envConfig from "./envConfig.js";
import { v2 as cloudinary } from "cloudinary";

//! Create cloudinary config
cloudinary.config({
  cloud_name: envConfig.CLOUDINARY_CLOUD_NAME,
  api_key: envConfig.CLOUDINARY_API_KEY,
  api_secret: envConfig.CLOUDINARY_CLOUD_SECRET,
});
const cloudinaryConfig = cloudinary;
export default cloudinaryConfig;
