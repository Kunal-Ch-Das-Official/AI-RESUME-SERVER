import { type IController } from "subatom";
import UserModel from "../../models/usersData.js";
import { Resume } from "../../models/resumeInfo.js";
import cloudDestroyer from "../../middlewares/blob-operations/cloudDestroyer.js";
import cloudDestroyerMany from "../../middlewares/blob-operations/cloudDestroyerMany.js";

const deleteResumeController: IController = async (ctx) => {
  const { resumeId } = ctx.params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { id } = ctx.user as any;

  if (!id && !resumeId) {
    return ctx.helper.bad_request("User id or resume id is missing.");
  }

  // 1. User exist ?
  const isValidUser = await UserModel.findById(id);

  if (!isValidUser)
    return ctx.helper.not_found(
      "User does not exist associating with given user id.",
    );

  // 2. Resume exist ?
  const isValidResume = await Resume.findById(resumeId);

  if (!isValidResume)
    return ctx.helper.not_found(
      "Resume was not found. Please check the credential and try again.",
    );

  // Extract Blob Keys safely supporting both Maps and plain objects
  const avatarKey = isValidResume.avatar?.key;

  const certificationKeys: string[] = [];
  const certs = isValidResume.certifications?.certificates;
  if (certs) {
    const certValues =
      certs instanceof Map ? Array.from(certs.values()) : Object.values(certs);
    for (const cert of certValues) {
      if (cert && typeof cert === "object" && "certificateContent" in cert) {
        const content = (cert as { certificateContent?: { key?: string } })
          .certificateContent;
        if (content?.key) {
          certificationKeys.push(content.key);
        }
      }
    }
  }

  const publicationKeys: string[] = [];
  const pubs = isValidResume.publications?.publications;
  if (pubs) {
    const pubValues =
      pubs instanceof Map ? Array.from(pubs.values()) : Object.values(pubs);
    for (const pub of pubValues) {
      if (pub && typeof pub === "object" && "publicationReference" in pub) {
        const refs = (
          pub as {
            publicationReference?: Array<{ accessUrl?: { key?: string } }>;
          }
        ).publicationReference;
        if (Array.isArray(refs)) {
          for (const ref of refs) {
            if (ref?.accessUrl?.key) {
              publicationKeys.push(ref.accessUrl.key);
            }
          }
        }
      }
    }
  }

  const achievementKeys: string[] = [];
  const achievements = isValidResume.awardsAndAchievements?.achievements;
  if (achievements && Array.isArray(achievements)) {
    for (const achievement of achievements) {
      if (achievement?.documents && Array.isArray(achievement.documents)) {
        for (const doc of achievement.documents) {
          if (doc?.accessUrl?.key) {
            achievementKeys.push(doc.accessUrl.key);
          }
        }
      }
    }
  }

  // Perform Cloudinary cleanup asynchronously
  if (avatarKey) {
    await cloudDestroyer(avatarKey);
  }

  for (const key of certificationKeys) {
    await cloudDestroyer(key);
  }

  if (publicationKeys.length > 0) {
    await cloudDestroyerMany(publicationKeys);
  }

  if (achievementKeys.length > 0) {
    await cloudDestroyerMany(achievementKeys);
  }

  // Delete resume from database
  const removeData = await Resume.findByIdAndDelete(isValidResume._id);
  if (!removeData) {
    return ctx.helper.not_implemented("Unable to remove data");
  }

  return ctx.helper.success("Success.");
};

export default deleteResumeController;
