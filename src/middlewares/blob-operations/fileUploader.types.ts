interface TypeFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

// Cloudinary upload response
interface UploadedFileInstance {
  storedDataAccessUrl: string | null;
  storedDataAccessId: string | null;
}
export interface UploadResult {
  accessUrl: string;
  publicId: string;
}

interface UpdateDataI {
  imageUrl: string;
  imagePublicId: string;
}

export { TypeFile, UploadedFileInstance, UpdateDataI };
