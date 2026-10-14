import cloudinaryConfig from "../../config/cloudinaryConfig.js";

const cloudDestroyer = async (requiredPublicId: string): Promise<boolean> => {
  const resourceTypes: string[] = ["image", "video", "raw"];

  for (const resourceType of resourceTypes) {
    try {
      const result = await cloudinaryConfig.uploader.destroy(requiredPublicId, {
        resource_type: resourceType,
      });

      if (result?.result === "ok") {
        console.log({
          message: `Requested file (type: ${resourceType}) has been removed from Cloudinary!`,
          result: requiredPublicId,
        });

        return true;
      }

      if (result?.result === "not found") {
        console.log({
          message: `File (type: ${resourceType}) with public ID '${requiredPublicId}' not found. Trying next type...`,
        });

        continue;
      }
    } catch (error: unknown) {
      console.error({
        issue:
          error instanceof Error ? error.message : "Unknown Cloudinary error",
        details: `Failed to destroy resource of type '${resourceType}' for public ID '${requiredPublicId}'.`,
        issueOrigin: "custom single destroyer.",
      });

      // Continue trying the next resource type.
    }
  }

  console.error({
    issue: "Unable to destroy requested resources across all common types!",
    details: `Could not find or destroy resource with public ID '${requiredPublicId}' using known resource types.`,
    issueOrigin: "custom single destroyer.",
  });

  return false;
};

export default cloudDestroyer;
