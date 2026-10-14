import streamifier from "streamifier";
import { UploadApiResponse } from "cloudinary";
import sharp from "sharp";
import { TypeFile, UploadResult } from "./fileUploader.types.js";
import cloudinaryConfig from "../../config/cloudinaryConfig.js";
const SUPPORTED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/heic",
  "image/heif",
  "image/bmp",
  "image/tiff",
  "image/x-tga",
  "image/x-dds",
  "image/x-pcx",
]);
const cloudUploader = async (
  entireFile: TypeFile,
  folderName: string,
): Promise<UploadResult | null> => {
  try {
    if (!entireFile?.buffer || entireFile.buffer.length === 0) {
      throw new Error("Uploaded file buffer is empty.");
    }
    if (!entireFile.mimetype) {
      throw new Error("Uploaded file MIME type is missing.");
    }
    let fileBuffer: Buffer = entireFile.buffer;
    const isImage = entireFile.mimetype.startsWith("image/");
    const shouldConvertToWebp =
      isImage && SUPPORTED_IMAGE_MIME_TYPES.has(entireFile.mimetype);
    const resourceType = isImage ? "image" : "auto";
    /* * Convert supported images to WebP before uploading. */ if (
      shouldConvertToWebp
    ) {
      fileBuffer = await sharp(entireFile.buffer)
        .webp({ quality: 90 })
        .toBuffer();
    }
    return await new Promise<UploadResult>((resolve, reject) => {
      let settled = false;
      const fail = (error: unknown): void => {
        if (settled) {
          return;
        }
        settled = true;
        if (error instanceof Error) {
          reject(error);
          return;
        }
        reject(new Error("Cloudinary upload failed."));
      };
      const succeed = (result: UploadApiResponse): void => {
        if (settled) {
          return;
        }
        if (!result.secure_url || !result.public_id) {
          fail(
            new Error(
              "Cloudinary upload completed but secure_url or public_id is missing.",
            ),
          );
          return;
        }
        settled = true;
        resolve({ accessUrl: result.secure_url, publicId: result.public_id });
      };
      const uploadStream = cloudinaryConfig.uploader.upload_stream(
        { folder: folderName, resource_type: resourceType, timeout: 240000 },
        (error: unknown, result: UploadApiResponse | undefined) => {
          /* * Do not log `error` on every successful upload. * Cloudinary can legitimately call this with no error. */ if (
            error
          ) {
            fail(error);
            return;
          }
          if (!result) {
            fail(
              new Error("Cloudinary returned no error and no upload result."),
            );
            return;
          }
          succeed(result);
        },
      );
      /* * Catch errors emitted by the writable upload stream itself. */ uploadStream.on(
        "error",
        (error: unknown) => {
          fail(error);
        },
      );
      /* * Convert the in-memory Buffer into a readable stream * and pipe it into Cloudinary. */ const inputStream =
        streamifier.createReadStream(fileBuffer);
      inputStream.on("error", (error: unknown) => {
        fail(error);
      });
      inputStream.pipe(uploadStream);
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown Cloudinary uploader error.";
    console.error({
      status: 500,
      issue: "Cloudinary uploader error!",
      issueOrigin: "CloudinaryUploader.uploadSingle",
      message,
      fileName: entireFile?.originalname,
      mimeType: entireFile?.mimetype,
      size: entireFile?.size,
    });
    return null;
  }
};
export default cloudUploader;
