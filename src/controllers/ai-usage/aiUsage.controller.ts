import { type IController } from "subatom";
import mongoose, { type mongo } from "mongoose";
import {
  finalizeResumeAiSchema,
  getAiUsageParamSchema,
  trackAiFeatureSchema,
} from "../../schema/aiUsage.schema.js";
import { RedisClient } from "../../redis/redis-client.js";
import { RedisLockError } from "../../redis/redis.errors.js";
import { ResumeAiUsage } from "../../models/resumeAiUsage.js";
import UserModel from "../../models/usersData.js";

const RESUME_REDIS_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
const FINALIZE_LOCK_TTL_MS = 15_000;

const USERS_COLLECTION = "users";

const FEATURE_KEYS = [
  "oldResumeUploadFeat",
  "profileSummaryFeat",
  "experienceFeat",
  "projectFeat",
  "achievementsFeat",
  "openSourceFeat",
  "atsCheckFeat",
  "resumePolish",
] as const;
type FeatureKey = (typeof FEATURE_KEYS)[number];
type FeatureCounts = Record<FeatureKey, number>;

const OBJECT_ID_RE = /^[a-f\d]{24}$/i;
const DRAFT_ID_RE = /^[\w-]{1,64}$/;

const getAiLedgerKey = (userId: string, resumeId: string): string =>
  `resume:ai_ledger:${userId}:${resumeId}`;

const emptyFeatures = (): FeatureCounts =>
  Object.fromEntries(FEATURE_KEYS.map((k) => [k, 0])) as FeatureCounts;

function parseLedger(raw: Record<string, string> | null | undefined) {
  const features = emptyFeatures();
  for (const k of FEATURE_KEYS) features[k] = Number(raw?.[k] ?? 0) || 0;
  return { features, totalCalls: Number(raw?.totalCalls ?? 0) || 0 };
}

/** Matches the user across _id (ObjectId), _id (string), id, or userId fields. */
function userFilter(userId: string): Record<string, unknown> {
  const orConditions: Record<string, unknown>[] = [
    { _id: userId },
    { id: userId },
    { userId: userId },
  ];

  if (OBJECT_ID_RE.test(userId)) {
    try {
      orConditions.unshift({ _id: new mongoose.Types.ObjectId(userId) });
    } catch {
      /* ignore invalid objectId */
    }
  }

  return { $or: orConditions };
}

/** Locates user across Mongoose registered models and common collection names. */
async function findUserDoc(
  db: mongo.Db,
  filter: Record<string, unknown>,
): Promise<{ collection: mongo.Collection<mongo.Document>; doc: mongo.Document | null }> {
  // 1. Check registered Mongoose model collection if present
  const registeredModels = [
    UserModel,
    mongoose.models.User,
    mongoose.models.user,
    mongoose.models.Users,
    mongoose.models.Account,
    mongoose.models.auth_user,
    mongoose.models.users_data,
  ];
  for (const model of registeredModels) {
    if (!model?.collection) continue;
    try {
      const doc = await model.collection.findOne(filter as mongo.Filter<mongo.Document>);
      if (doc) return { collection: model.collection, doc };
    } catch {
      /* continue */
    }
  }

  // 2. Check explicitly configured USERS_COLLECTION
  const primaryColl = db.collection(USERS_COLLECTION);
  try {
    const doc = await primaryColl.findOne(filter as mongo.Filter<mongo.Document>);
    if (doc) return { collection: primaryColl, doc };
  } catch {
    /* continue */
  }

  // 3. Fallback across singular/plural collection naming conventions
  const fallbackNames = ["auth_users", "users_data", "user", "users", "Users", "User", "accounts", "profiles"].filter(
    (n) => n !== USERS_COLLECTION,
  );
  for (const name of fallbackNames) {
    try {
      const coll = db.collection(name);
      const doc = await coll.findOne(filter as mongo.Filter<mongo.Document>);
      if (doc) return { collection: coll, doc };
    } catch {
      /* continue */
    }
  }

  return { collection: primaryColl, doc: null };
}

type DeductResult = "ok" | "insufficient" | "not_found";

async function deductCredit(db: mongo.Db, userId: string): Promise<DeductResult> {
  const filter = userFilter(userId);
  const { collection, doc } = await findUserDoc(db, filter);
  if (!doc) return "not_found";

  const currentCredits = Number(doc.resumeCredits ?? 0);
  if (currentCredits <= 0) {
    return "insufficient";
  }

  const res = await collection.updateOne(
    { _id: doc._id, resumeCredits: { $gt: 0 } } as mongo.Filter<mongo.Document>,
    { $inc: { resumeCredits: -1 } },
  );

  return res.modifiedCount === 1 ? "ok" : "insufficient";
}

async function refundCredit(db: mongo.Db, userId: string): Promise<void> {
  const filter = userFilter(userId);
  const { collection, doc } = await findUserDoc(db, filter);
  if (doc) {
    await collection.updateOne(
      { _id: doc._id } as mongo.Filter<mongo.Document>,
      { $inc: { resumeCredits: 1 } },
    );
  }
}

async function readBalance(db: mongo.Db, userId: string): Promise<number | null> {
  const { doc } = await findUserDoc(db, userFilter(userId));
  return doc ? Number(doc.resumeCredits ?? 0) : null;
}

/**
 * 1. TRACK AI FEATURE HIT
 * POST /api/v1/resumes/track-ai
 */
export const trackAiFeatureController: IController<
  typeof trackAiFeatureSchema
> = async (ctx) => {
  const { userId, resumeId, featureKey } = ctx.body;

  if (!(FEATURE_KEYS as readonly string[]).includes(featureKey)) {
    return ctx.status(400).json({
      success: false,
      message: `Unknown featureKey "${featureKey}"`,
    });
  }

  const redis = RedisClient.getInstance();
  const redisKey = getAiLedgerKey(userId, resumeId);

  const results = await redis
    .multi()
    .hincrby(redisKey, featureKey, 1)
    .hincrby(redisKey, "totalCalls", 1)
    .expire(redisKey, RESUME_REDIS_TTL_SECONDS)
    .exec();

  const failed = results?.find(([err]) => err);
  if (!results || failed) {
    throw failed?.[0] ?? new Error("Redis transaction failed");
  }

  return ctx.status(200).json({
    success: true,
    message: `Feature ${featureKey} recorded successfully`,
    data: {
      featureKey,
      featureCount: Number(results[0][1]),
      totalCalls: Number(results[1][1]),
    },
  });
};

/**
 * 2. GET CURRENT USAGE FROM REDIS
 * GET /api/v1/resumes/:resumeId/ai-usage
 */
export const getAiUsageController: IController<
  typeof getAiUsageParamSchema
> = async (ctx) => {
  const { resumeId } = ctx.params;
  const { userId } = ctx.query;
  const redis = RedisClient.getInstance();

  const raw = await redis.hgetall<Record<string, string>>(
    getAiLedgerKey(userId as string, resumeId),
  );
  const { features, totalCalls } = parseLedger(raw);

  return ctx.status(200).json({
    success: true,
    data: { userId, resumeId, features, totalCalls, hasUsedAi: totalCalls > 0 },
  });
};

/**
 * 3. FINALIZE: persist to Mongo, deduct 1 credit (once per resume), clear Redis
 * POST /api/v1/resumes/finalize-and-deduct
 */
export const finalizeResumeAiController: IController<
  typeof finalizeResumeAiSchema
> = async (ctx) => {
  const { userId, resumeId: rawResumeId } = ctx.body;
  const draftId = (ctx.body as { draftId?: string }).draftId;

  const isDraftPlaceholder =
    !rawResumeId || rawResumeId === "draft" || rawResumeId === "demo-resume-id";
  // The usage ledger is per builder/export session, not per permanent resume.
  // A saved resume can be edited in a later session and should then be charged
  // again if that later session uses AI. draftId is generated by the client and
  // remains stable for the current session until finalization succeeds.
  const resolvedResumeId = draftId
    ? `session:${draftId}`
    : isDraftPlaceholder
      ? `session:${new mongoose.Types.ObjectId().toString()}`
      : rawResumeId;

  const db = mongoose.connection.db;
  if (!db) {
    return ctx.status(500).json({
      success: false,
      message: "Database connection unavailable",
    });
  }

  const redis = RedisClient.getInstance();

  const keySet = new Set<string>();
  // New clients track by session ID; only read the legacy resume-ID ledger
  // when no session ID was supplied.
  if (rawResumeId && !draftId) keySet.add(getAiLedgerKey(userId, rawResumeId));
  if (resolvedResumeId) keySet.add(getAiLedgerKey(userId, resolvedResumeId));
  if (draftId && DRAFT_ID_RE.test(draftId)) {
    keySet.add(getAiLedgerKey(userId, `draft:${draftId}`));
  }
  const keys = Array.from(keySet);

  try {
    return await redis.withLock(
      `finalize:${userId}:${resolvedResumeId}`,
      FINALIZE_LOCK_TTL_MS,
      async () => {
        const raws = await Promise.all(
          keys.map((k) => redis.hgetall<Record<string, string>>(k)),
        );
        const features = emptyFeatures();
        let totalCalls = 0;
        for (const raw of raws) {
          const parsed = parseLedger(raw);
          totalCalls += parsed.totalCalls;
          for (const k of FEATURE_KEYS) features[k] += parsed.features[k];
        }

        const existing = await ResumeAiUsage.findOne({
          resumeId: resolvedResumeId,
        }).lean();
        if (existing && existing.userId !== userId) {
          return ctx.status(403).json({
            success: false,
            message: "This resume belongs to a different user",
          });
        }

        const alreadyCharged = Boolean(existing?.creditDeducted);

        if (totalCalls === 0) {
          await redis.del(...keys);
          return ctx.status(200).json({
            success: true,
            message: alreadyCharged
              ? "Already finalized. No new AI usage, 0 credits deducted."
              : "Resume finalized. No AI features used, 0 credits deducted.",
            data: {
              creditDeducted: false,
              alreadyCharged,
              remainingCredits: await readBalance(db, userId),
              record: existing ?? null,
            },
          });
        }

        let chargedNow = false;
        if (!alreadyCharged) {
          const result = await deductCredit(db, userId);
          if (result === "not_found") {
            return ctx.status(404).json({
              success: false,
              message: "User not found",
            });
          }
          if (result === "insufficient") {
            return ctx.status(402).json({
              success: false,
              message:
                "Insufficient resume credits to print or finalize AI-assisted resume",
            });
          }
          chargedNow = true;
        }

        let saved;
        try {
          const inc: Record<string, number> = { totalCalls };
          for (const k of FEATURE_KEYS) {
            if (features[k] > 0) inc[`features.${k}`] = features[k];
          }

          saved = await ResumeAiUsage.findOneAndUpdate(
            { resumeId: resolvedResumeId },
            {
              $set: {
                userId,
                creditDeducted: true,
                deductedAt: existing?.deductedAt ?? new Date(),
              },
              $inc: inc,
            },
            { upsert: true, new: true, setDefaultsOnInsert: false },
          );
        } catch (err) {
          if (chargedNow) await refundCredit(db, userId).catch(() => undefined);
          throw err;
        }

        await redis.del(...keys);

        return ctx.status(200).json({
          success: true,
          message: chargedNow
            ? "AI features finalized. 1 credit deducted."
            : "AI usage added to an already-finalized resume. No extra credit deducted.",
          data: {
            creditDeducted: chargedNow,
            remainingCredits: await readBalance(db, userId),
            record: saved,
          },
        });
      },
    );
  } catch (err) {
    if (err instanceof RedisLockError) {
      return ctx.status(409).json({
        success: false,
        message: "Finalization already in progress. Please retry in a moment.",
      });
    }
    throw err;
  }
};