import type { RouteContext } from "@internal/core";
import { getGoogleStore } from "../store.js";
import type { GbpLocation } from "../entities.js";

const LOCATION_FIELD_MAP: Record<string, keyof GbpLocation> = {
  name: "name",
  title: "title",
  storeCode: "store_code",
  languageCode: "language_code",
  phoneNumbers: "phone_numbers",
  categories: "categories",
  storefrontAddress: "storefront_address",
  websiteUri: "website_uri",
  regularHours: "regular_hours",
  specialHours: "special_hours",
  serviceArea: "service_area",
  labels: "labels",
  latlng: "latlng",
  openInfo: "open_info",
  metadata: "metadata",
  profile: "profile",
  relationshipData: "relationship_data",
  moreHours: "more_hours",
  serviceItems: "service_items",
  adWordsLocationExtensions: "ad_words_location_extensions",
};

function toApiLocation(loc: GbpLocation, readMask?: string | null): Record<string, unknown> {
  const all: Record<string, unknown> = {
    name: loc.name,
    title: loc.title,
    storeCode: loc.store_code ?? undefined,
    languageCode: loc.language_code,
    phoneNumbers: loc.phone_numbers ?? undefined,
    categories: loc.categories ?? undefined,
    storefrontAddress: loc.storefront_address ?? undefined,
    websiteUri: loc.website_uri ?? undefined,
    regularHours: loc.regular_hours ?? undefined,
    specialHours: loc.special_hours ?? undefined,
    serviceArea: loc.service_area ?? undefined,
    labels: loc.labels ?? undefined,
    latlng: loc.latlng ?? undefined,
    openInfo: loc.open_info ?? undefined,
    metadata: loc.metadata ?? undefined,
    profile: loc.profile ?? undefined,
    relationshipData: loc.relationship_data ?? undefined,
    moreHours: loc.more_hours ?? undefined,
    serviceItems: loc.service_items ?? undefined,
    adWordsLocationExtensions: loc.ad_words_location_extensions ?? undefined,
  };

  if (!readMask) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(all)) if (v !== undefined) out[k] = v;
    return out;
  }

  const fields = readMask.split(",").map((s) => s.trim()).filter(Boolean);
  const out: Record<string, unknown> = { name: loc.name };
  for (const f of fields) {
    const top = f.split(".")[0];
    if (top in all && all[top] !== undefined) out[top] = all[top];
  }
  return out;
}

function applyUpdateMask(loc: GbpLocation, body: Record<string, unknown>, updateMask: string): Partial<GbpLocation> {
  const patch: Partial<GbpLocation> = {};
  const fields = updateMask.split(",").map((s) => s.trim()).filter(Boolean);
  for (const f of fields) {
    const top = f.split(".")[0];
    const key = LOCATION_FIELD_MAP[top];
    if (!key) continue;
    const value = (body as Record<string, unknown>)[top];
    (patch as Record<string, unknown>)[key] = value ?? null;
  }
  return patch;
}

export function gbpRoutes({ app, store }: RouteContext): void {
  // List locations for an account (Business Information API)
  app.get("/mybusinessbusinessinformation/v1/accounts/:accountId/locations", (c) => {
    const { accountId } = c.req.param();
    const readMask = c.req.query("readMask");
    const pageSize = Math.min(parseInt(c.req.query("pageSize") ?? "100", 10) || 100, 1000);
    const pageToken = parseInt(c.req.query("pageToken") ?? "0", 10) || 0;

    const gs = getGoogleStore(store);
    const acct = gs.gbpAccounts.findOneBy("account_id", accountId);
    if (!acct) return c.json({ error: { code: 404, message: `Account ${accountId} not found`, status: "NOT_FOUND" } }, 404);

    const all = gs.gbpLocations.findBy("account_id", accountId);
    const page = all.slice(pageToken, pageToken + pageSize);
    const nextToken = pageToken + pageSize < all.length ? String(pageToken + pageSize) : undefined;

    return c.json({
      locations: page.map((l) => toApiLocation(l, readMask)),
      totalSize: all.length,
      ...(nextToken ? { nextPageToken: nextToken } : {}),
    });
  });

  // Get a single location
  app.get("/mybusinessbusinessinformation/v1/locations/:locationId", (c) => {
    const { locationId } = c.req.param();
    const readMask = c.req.query("readMask");
    const gs = getGoogleStore(store);
    const loc = gs.gbpLocations.findOneBy("location_id", locationId);
    if (!loc) return c.json({ error: { code: 404, message: `Location ${locationId} not found`, status: "NOT_FOUND" } }, 404);
    return c.json(toApiLocation(loc, readMask));
  });

  // getGoogleUpdated — same payload for emulator
  app.get("/mybusinessbusinessinformation/v1/locations/:locationId\\:getGoogleUpdated", (c) => {
    const { locationId } = c.req.param();
    const readMask = c.req.query("readMask");
    const gs = getGoogleStore(store);
    const loc = gs.gbpLocations.findOneBy("location_id", locationId);
    if (!loc) return c.json({ error: { code: 404, message: `Location ${locationId} not found`, status: "NOT_FOUND" } }, 404);
    return c.json(toApiLocation(loc, readMask));
  });

  // Patch location
  app.patch("/mybusinessbusinessinformation/v1/locations/:locationId", async (c) => {
    const { locationId } = c.req.param();
    const updateMask = c.req.query("updateMask");
    if (!updateMask) return c.json({ error: { code: 400, message: "updateMask is required", status: "INVALID_ARGUMENT" } }, 400);
    const gs = getGoogleStore(store);
    const loc = gs.gbpLocations.findOneBy("location_id", locationId);
    if (!loc) return c.json({ error: { code: 404, message: `Location ${locationId} not found`, status: "NOT_FOUND" } }, 404);
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const patch = applyUpdateMask(loc, body, updateMask);
    const updated = gs.gbpLocations.update(loc.id, patch);
    return c.json(toApiLocation(updated!, null));
  });

  // VoiceOfMerchantState (verifications API)
  app.get("/mybusinessverifications/v1/locations/:locationId/VoiceOfMerchantState", (c) => {
    const { locationId } = c.req.param();
    const gs = getGoogleStore(store);
    const loc = gs.gbpLocations.findOneBy("location_id", locationId);
    if (!loc) return c.json({ error: { code: 404, message: `Location ${locationId} not found`, status: "NOT_FOUND" } }, 404);
    const hasVoice = loc.verification_state === "COMPLETED" && loc.has_voice_of_merchant;
    return c.json({
      hasVoiceOfMerchant: hasVoice,
      hasBusinessAuthority: loc.has_business_authority,
      ...(loc.verification_state !== "COMPLETED"
        ? { waitForVoiceOfMerchant: loc.verification_state === "PENDING_VERIFICATION" ? {} : undefined,
            resolveOwnershipConflict: undefined,
            verify: loc.verification_state === "UNVERIFIED" ? { hasPendingVerification: false } : undefined }
        : { complyWithGuidelines: undefined }),
    });
  });

  // List accounts (v4 Account Management surface — useful for clients that list accounts first)
  app.get("/mybusiness/v4/accounts", (c) => {
    const gs = getGoogleStore(store);
    const accounts = gs.gbpAccounts.all().map((a) => ({
      name: a.name,
      accountName: a.account_name,
      type: a.type,
    }));
    return c.json({ accounts });
  });

  // ---------- Attributes ----------

  app.get("/mybusinessbusinessinformation/v1/locations/:locationId/attributes", (c) => {
    const { locationId } = c.req.param();
    const gs = getGoogleStore(store);
    const attr = gs.gbpAttributes.findOneBy("location_name", `locations/${locationId}`);
    if (!attr) return c.json({ name: `locations/${locationId}/attributes`, attributes: [] });
    return c.json({ name: attr.name, attributes: attr.attributes });
  });

  app.patch("/mybusinessbusinessinformation/v1/locations/:locationId/attributes", async (c) => {
    const { locationId } = c.req.param();
    const updateMask = c.req.query("attributeMask"); // GBP attributes uses attributeMask
    const gs = getGoogleStore(store);
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const locName = `locations/${locationId}`;
    let attr = gs.gbpAttributes.findOneBy("location_name", locName);
    
    if (!attr) {
      attr = gs.gbpAttributes.insert({
        location_name: locName,
        name: `${locName}/attributes`,
        attributes: (body.attributes as any[]) || []
      });
    } else {
      // Basic stub: replace entirely or merge naive. We'll just replace with payload's attributes.
      attr = gs.gbpAttributes.update(attr.id, { attributes: (body.attributes as any[]) || [] })!;
    }
    return c.json({ name: attr.name, attributes: attr.attributes });
  });

  // ---------- Media ----------

  app.get("/mybusiness/v4/accounts/:accountId/locations/:locationId/media", (c) => {
    const { locationId } = c.req.param();
    const gs = getGoogleStore(store);
    const media = gs.gbpMedia.findBy("location_name", `locations/${locationId}`);
    return c.json({ mediaItems: media.map(m => ({
      name: m.name,
      mediaFormat: m.mediaFormat,
      sourceUrl: m.sourceUrl,
      thumbnailUrl: m.thumbnailUrl
    })) });
  });

  app.post("/mybusiness/v4/accounts/:accountId/locations/:locationId/media", async (c) => {
    const { accountId, locationId } = c.req.param();
    const gs = getGoogleStore(store);
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const mediaId = require("crypto").randomBytes(8).toString("hex");
    const mName = `accounts/${accountId}/locations/${locationId}/media/${mediaId}`;
    const m = gs.gbpMedia.insert({
      media_id: mediaId,
      location_name: `locations/${locationId}`,
      name: mName,
      mediaFormat: (body.mediaFormat as string) || "PHOTO",
      sourceUrl: (body.sourceUrl as string) || `https://example.com/media/${mediaId}.jpg`,
      thumbnailUrl: `https://example.com/media/${mediaId}_thumb.jpg`,
    });
    return c.json({
      name: m.name,
      mediaFormat: m.mediaFormat,
      sourceUrl: m.sourceUrl,
      thumbnailUrl: m.thumbnailUrl
    });
  });

  app.delete("/mybusiness/v4/accounts/:accountId/locations/:locationId/media/:mediaId", (c) => {
    const { mediaId } = c.req.param();
    const gs = getGoogleStore(store);
    const m = gs.gbpMedia.findOneBy("media_id", mediaId);
    if (m) gs.gbpMedia.delete(m.id);
    return c.json({});
  });

  // ---------- Reviews ----------

  app.get("/mybusiness/v4/accounts/:accountId/locations/:locationId/reviews", (c) => {
    const { locationId } = c.req.param();
    const gs = getGoogleStore(store);
    const revs = gs.gbpReviews.findBy("location_name", `locations/${locationId}`);
    return c.json({ reviews: revs });
  });

  app.get("/mybusiness/v4/accounts/:accountId/locations/:locationId/reviews/:reviewId", (c) => {
    const { reviewId } = c.req.param();
    const gs = getGoogleStore(store);
    const rev = gs.gbpReviews.findOneBy("review_id", reviewId);
    if (!rev) return c.json({ error: { code: 404, status: "NOT_FOUND" } }, 404);
    return c.json(rev);
  });

  app.put("/mybusiness/v4/accounts/:accountId/locations/:locationId/reviews/:reviewId/reply", async (c) => {
    const { reviewId } = c.req.param();
    const gs = getGoogleStore(store);
    const body = (await c.req.json().catch(() => ({}))) as any;
    const rev = gs.gbpReviews.findOneBy("review_id", reviewId);
    if (!rev) return c.json({ error: { code: 404, status: "NOT_FOUND" } }, 404);
    const updated = gs.gbpReviews.update(rev.id, {
      reviewReply: { comment: body.comment || "", updateTime: new Date().toISOString() }
    });
    return c.json(updated!.reviewReply);
  });

  app.delete("/mybusiness/v4/accounts/:accountId/locations/:locationId/reviews/:reviewId/reply", (c) => {
    const { reviewId } = c.req.param();
    const gs = getGoogleStore(store);
    const rev = gs.gbpReviews.findOneBy("review_id", reviewId);
    if (!rev) return c.json({ error: { code: 404, status: "NOT_FOUND" } }, 404);
    gs.gbpReviews.update(rev.id, { reviewReply: undefined });
    return c.json({});
  });

  // ---------- Local Posts ----------

  app.get("/mybusiness/v4/accounts/:accountId/locations/:locationId/localPosts", (c) => {
    const { locationId } = c.req.param();
    const gs = getGoogleStore(store);
    const posts = gs.gbpLocalPosts.findBy("location_name", `locations/${locationId}`);
    return c.json({ localPosts: posts });
  });

  app.post("/mybusiness/v4/accounts/:accountId/locations/:locationId/localPosts", async (c) => {
    const { accountId, locationId } = c.req.param();
    const gs = getGoogleStore(store);
    const body = (await c.req.json().catch(() => ({}))) as any;
    const postId = require("crypto").randomBytes(8).toString("hex");
    const postName = `accounts/${accountId}/locations/${locationId}/localPosts/${postId}`;
    const p = gs.gbpLocalPosts.insert({
      post_id: postId,
      location_name: `locations/${locationId}`,
      name: postName,
      languageCode: body.languageCode || "en",
      summary: body.summary || "",
      state: "LIVE",
      event: body.event,
      offer: body.offer,
      createTime: new Date().toISOString(),
      updateTime: new Date().toISOString()
    });
    return c.json(p);
  });

  app.get("/mybusiness/v4/accounts/:accountId/locations/:locationId/localPosts/:postId", (c) => {
    const { postId } = c.req.param();
    const gs = getGoogleStore(store);
    const p = gs.gbpLocalPosts.findOneBy("post_id", postId);
    if (!p) return c.json({ error: { code: 404, status: "NOT_FOUND" } }, 404);
    return c.json(p);
  });

  app.patch("/mybusiness/v4/accounts/:accountId/locations/:locationId/localPosts/:postId", async (c) => {
    const { postId } = c.req.param();
    const gs = getGoogleStore(store);
    const body = (await c.req.json().catch(() => ({}))) as any;
    const p = gs.gbpLocalPosts.findOneBy("post_id", postId);
    if (!p) return c.json({ error: { code: 404, status: "NOT_FOUND" } }, 404);
    const updated = gs.gbpLocalPosts.update(p.id, {
      summary: body.summary || p.summary,
      updateTime: new Date().toISOString()
    });
    return c.json(updated);
  });

  app.delete("/mybusiness/v4/accounts/:accountId/locations/:locationId/localPosts/:postId", (c) => {
    const { postId } = c.req.param();
    const gs = getGoogleStore(store);
    const p = gs.gbpLocalPosts.findOneBy("post_id", postId);
    if (p) gs.gbpLocalPosts.delete(p.id);
    return c.json({});
  });

  // ---------- Q&A ----------

  app.get("/mybusinessqanda/v1/locations/:locationId/questions", (c) => {
    const { locationId } = c.req.param();
    const gs = getGoogleStore(store);
    const q = gs.gbpQuestions.findBy("location_name", `locations/${locationId}`);
    return c.json({ questions: q });
  });

  app.post("/mybusinessqanda/v1/locations/:locationId/questions", async (c) => {
    const { locationId } = c.req.param();
    const gs = getGoogleStore(store);
    const body = (await c.req.json().catch(() => ({}))) as any;
    const qId = require("crypto").randomBytes(8).toString("hex");
    const qName = `locations/${locationId}/questions/${qId}`;
    const q = gs.gbpQuestions.insert({
      question_id: qId,
      location_name: `locations/${locationId}`,
      name: qName,
      author: { displayName: "Author" },
      text: body.text || "",
      createTime: new Date().toISOString(),
      updateTime: new Date().toISOString(),
      upvoteCount: 0
    });
    return c.json(q);
  });

  app.get("/mybusinessqanda/v1/locations/:locationId/questions/:questionId", (c) => {
    const { questionId } = c.req.param();
    const gs = getGoogleStore(store);
    const q = gs.gbpQuestions.findOneBy("question_id", questionId);
    if (!q) return c.json({ error: { code: 404, status: "NOT_FOUND" } }, 404);
    return c.json(q);
  });

  app.patch("/mybusinessqanda/v1/locations/:locationId/questions/:questionId", async (c) => {
    const { questionId } = c.req.param();
    const gs = getGoogleStore(store);
    const body = (await c.req.json().catch(() => ({}))) as any;
    const q = gs.gbpQuestions.findOneBy("question_id", questionId);
    if (!q) return c.json({ error: { code: 404, status: "NOT_FOUND" } }, 404);
    const updated = gs.gbpQuestions.update(q.id, {
      text: body.text || q.text,
      updateTime: new Date().toISOString()
    });
    return c.json(updated);
  });

  app.delete("/mybusinessqanda/v1/locations/:locationId/questions/:questionId", (c) => {
    const { questionId } = c.req.param();
    const gs = getGoogleStore(store);
    const q = gs.gbpQuestions.findOneBy("question_id", questionId);
    if (q) gs.gbpQuestions.delete(q.id);
    return c.json({});
  });

  app.get("/mybusinessqanda/v1/locations/:locationId/questions/:questionId/answers", (c) => {
    const { locationId, questionId } = c.req.param();
    const gs = getGoogleStore(store);
    const qName = `locations/${locationId}/questions/${questionId}`;
    const a = gs.gbpAnswers.findBy("question_name", qName);
    return c.json({ answers: a });
  });

  app.post("/mybusinessqanda/v1/locations/:locationId/questions/:questionId/answers:upsert", async (c) => {
    const { locationId, questionId } = c.req.param();
    const gs = getGoogleStore(store);
    const body = (await c.req.json().catch(() => ({}))) as any;
    const qName = `locations/${locationId}/questions/${questionId}`;
    
    // Simplistic: check if we already have an answer for this question from the merchant, or just create one
    // Real API replaces the user's/merchant's answer. Here we just take the first or create.
    let a = gs.gbpAnswers.findBy("question_name", qName)[0];
    if (a) {
      a = gs.gbpAnswers.update(a.id, {
        text: body.answer?.text || "",
        updateTime: new Date().toISOString()
      })!;
    } else {
      const aId = require("crypto").randomBytes(8).toString("hex");
      const aName = `${qName}/answers/${aId}`;
      a = gs.gbpAnswers.insert({
        answer_id: aId,
        question_name: qName,
        name: aName,
        author: { displayName: "Merchant", type: "MERCHANT" },
        text: body.answer?.text || "",
        createTime: new Date().toISOString(),
        updateTime: new Date().toISOString(),
        upvoteCount: 0
      });
    }
    return c.json(a);
  });

  app.delete("/mybusinessqanda/v1/locations/:locationId/questions/:questionId/answers:delete", (c) => {
    const { locationId, questionId } = c.req.param();
    const gs = getGoogleStore(store);
    const qName = `locations/${locationId}/questions/${questionId}`;
    // Simple stub deletes all answers for now
    const answers = gs.gbpAnswers.findBy("question_name", qName);
    for (const a of answers) gs.gbpAnswers.delete(a.id);
    return c.json({});
  });

  // ---------- Performance Metrics ----------

  app.get("/businessprofileperformance/v1/locations/:locationId\\:fetchMultiDailyMetricsTimeSeries", (c) => {
    const { locationId } = c.req.param();
    // Return a dummy time series
    return c.json({
      multiDailyMetricTimeSeries: [
        {
          dailyMetricTimeSeries: [
            {
              dailyMetric: "BUSINESS_IMPRESSIONS_DESKTOP_MAPS",
              timeSeries: {
                datedValues: [
                  { date: { year: 2026, month: 4, day: 10 }, value: "15" },
                  { date: { year: 2026, month: 4, day: 11 }, value: "22" }
                ]
              }
            }
          ]
        }
      ]
    });
  });

  app.get("/businessprofileperformance/v1/locations/:locationId/searchkeywords/impressions/monthly", (c) => {
    return c.json({
      searchKeywordsCounts: [
        { searchKeyword: "coffee shop near me", impressionsCount: "120" },
        { searchKeyword: "best cafe", impressionsCount: "45" }
      ]
    });
  });

  // ---------- Place Action Links ----------

  app.get("/mybusinessplaceactions/v1/locations/:locationId/placeActionLinks", (c) => {
    const { locationId } = c.req.param();
    const gs = getGoogleStore(store);
    const links = gs.gbpPlaceActionLinks.findBy("location_name", `locations/${locationId}`);
    return c.json({ placeActionLinks: links });
  });

  app.post("/mybusinessplaceactions/v1/locations/:locationId/placeActionLinks", async (c) => {
    const { locationId } = c.req.param();
    const gs = getGoogleStore(store);
    const body = (await c.req.json().catch(() => ({}))) as any;
    const linkId = require("crypto").randomBytes(8).toString("hex");
    const name = `locations/${locationId}/placeActionLinks/${linkId}`;
    const l = gs.gbpPlaceActionLinks.insert({
      link_id: linkId,
      location_name: `locations/${locationId}`,
      name,
      uri: body.uri,
      placeActionType: body.placeActionType,
      providerType: body.providerType || "MERCHANT",
      isEditable: true
    });
    return c.json(l);
  });

  app.patch("/mybusinessplaceactions/v1/locations/:locationId/placeActionLinks/:linkId", async (c) => {
    const { linkId } = c.req.param();
    const gs = getGoogleStore(store);
    const body = (await c.req.json().catch(() => ({}))) as any;
    const l = gs.gbpPlaceActionLinks.findOneBy("link_id", linkId);
    if (!l) return c.json({ error: { code: 404, status: "NOT_FOUND" } }, 404);
    const updated = gs.gbpPlaceActionLinks.update(l.id, {
      uri: body.uri || l.uri
    });
    return c.json(updated);
  });

  app.delete("/mybusinessplaceactions/v1/locations/:locationId/placeActionLinks/:linkId", (c) => {
    const { linkId } = c.req.param();
    const gs = getGoogleStore(store);
    const l = gs.gbpPlaceActionLinks.findOneBy("link_id", linkId);
    if (l) gs.gbpPlaceActionLinks.delete(l.id);
    return c.json({});
  });

  // ---------- Notification Settings ----------

  app.get("/mybusinessnotifications/v1/accounts/:accountId/notificationSetting", (c) => {
    const { accountId } = c.req.param();
    const gs = getGoogleStore(store);
    let s = gs.gbpNotificationSettings.findOneBy("account_id", accountId);
    if (!s) {
      s = { name: `accounts/${accountId}/notificationSetting`, pubsubTopic: "", notificationTypes: [], account_id: accountId } as any;
    }
    return c.json(s);
  });

  app.patch("/mybusinessnotifications/v1/accounts/:accountId/notificationSetting", async (c) => {
    const { accountId } = c.req.param();
    const gs = getGoogleStore(store);
    const body = (await c.req.json().catch(() => ({}))) as any;
    let s = gs.gbpNotificationSettings.findOneBy("account_id", accountId);
    if (!s) {
      s = gs.gbpNotificationSettings.insert({
        account_id: accountId,
        name: `accounts/${accountId}/notificationSetting`,
        pubsubTopic: body.pubsubTopic || "",
        notificationTypes: body.notificationTypes || []
      });
    } else {
      s = gs.gbpNotificationSettings.update(s.id, {
        pubsubTopic: body.pubsubTopic ?? s.pubsubTopic,
        notificationTypes: body.notificationTypes ?? s.notificationTypes
      })!;
    }
    return c.json(s);
  });

  // ---------- Admins ----------

  app.get("/mybusinessaccountmanagement/v1/locations/:locationId/admins", (c) => {
    const { locationId } = c.req.param();
    const gs = getGoogleStore(store);
    const admins = gs.gbpAdmins.findBy("parent_name", `locations/${locationId}`);
    return c.json({ admins });
  });

  app.post("/mybusinessaccountmanagement/v1/locations/:locationId/admins", async (c) => {
    const { locationId } = c.req.param();
    const gs = getGoogleStore(store);
    const body = (await c.req.json().catch(() => ({}))) as any;
    const adminId = require("crypto").randomBytes(8).toString("hex");
    const name = `locations/${locationId}/admins/${adminId}`;
    const a = gs.gbpAdmins.insert({
      admin_id: adminId,
      parent_name: `locations/${locationId}`,
      name,
      adminName: body.admin || "New Admin",
      role: body.role || "MANAGER",
      pendingInvitation: true
    });
    return c.json(a);
  });

  app.delete("/mybusinessaccountmanagement/v1/locations/:locationId/admins/:adminId", (c) => {
    const { adminId } = c.req.param();
    const gs = getGoogleStore(store);
    const a = gs.gbpAdmins.findOneBy("admin_id", adminId);
    if (a) gs.gbpAdmins.delete(a.id);
    return c.json({});
  });

  app.get("/mybusinessaccountmanagement/v1/accounts/:accountId/admins", (c) => {
    const { accountId } = c.req.param();
    const gs = getGoogleStore(store);
    const admins = gs.gbpAdmins.findBy("parent_name", `accounts/${accountId}`);
    return c.json({ admins });
  });
}
