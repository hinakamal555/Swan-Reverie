const express = require("express");
const multer = require("multer");
const { getDb, describeDbError } = require("../lib/db");
const { toObjectId, getUserId, requireUser } = require("../lib/auth");
const { publicId } = require("../lib/ids");
const { defaultContent, TEMPLATE_ID, TEMPLATE_VERSION } = require("../lib/defaults");
const { sanitizeContent } = require("../lib/validate");
const { storeUpload } = require("../lib/media");

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const DEFAULT_INVITATION_LABEL = "Unnamed invitation";

function serialize(doc, extras = {}) {
  return {
    id: String(doc._id),
    publicId: doc.publicId,
    ownerId: String(doc.ownerId),
    title: doc.title || "",
    templateId: doc.templateId,
    templateVersion: doc.templateVersion,
    status: doc.status,
    content: doc.content,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    publicUrl: `/i/${doc.publicId}`,
    ...extras,
  };
}

function sanitizeTitle(value) {
  return String(value || "").trim().slice(0, 80);
}

function invitationLabel(doc) {
  const title = sanitizeTitle(doc?.title);
  if (title) return title;
  return DEFAULT_INVITATION_LABEL;
}

function coupleLabel(content) {
  const bride = content?.couple?.brideName?.trim();
  const groom = content?.couple?.groomName?.trim();
  if (bride && groom) return `${bride} & ${groom}`;
  if (bride || groom) return bride || groom;
  return "";
}

function invitationExtras(doc) {
  return {
    label: invitationLabel(doc),
    coupleLabel: coupleLabel(doc.content),
  };
}

async function loadOwned(req, res) {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Please sign in to continue." });
    return null;
  }

  const id = toObjectId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "That invitation could not be found." });
    return null;
  }

  const db = await getDb();
  const doc = await db.collection("invitations").findOne({ _id: id });
  if (!doc) {
    res.status(404).json({ error: "That invitation could not be found." });
    return null;
  }
  if (String(doc.ownerId) !== userId) {
    res.status(403).json({ error: "You do not have access to this invitation." });
    return null;
  }

  return { db, doc, userId };
}

async function rsvpCounts(db, invitationIds) {
  if (!invitationIds.length) return {};
  const rows = await db.collection("rsvps").aggregate([
    { $match: { invitationId: { $in: invitationIds } } },
    { $group: { _id: "$invitationId", count: { $sum: 1 } } },
  ]).toArray();
  return Object.fromEntries(rows.map((row) => [String(row._id), row.count]));
}

router.get("/", requireUser, async (req, res) => {
  try {
    const db = await getDb();
    const docs = await db
      .collection("invitations")
      .find({ ownerId: req.userId })
      .sort({ updatedAt: -1 })
      .limit(50)
      .toArray();

    const counts = await rsvpCounts(db, docs.map((doc) => doc._id));
    res.json({
      invitations: docs.map((doc) => serialize(doc, {
        ...invitationExtras(doc),
        rsvpCount: counts[String(doc._id)] || 0,
      })),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: describeDbError(error, "Could not load invitations.") });
  }
});

router.post("/", requireUser, async (req, res) => {
  try {
    const db = await getDb();
    const now = new Date();
    const doc = {
      publicId: publicId(),
      ownerId: req.userId,
      title: "",
      templateId: TEMPLATE_ID,
      templateVersion: TEMPLATE_VERSION,
      status: "draft",
      content: defaultContent(),
      createdAt: now,
      updatedAt: now,
    };
    const result = await db.collection("invitations").insertOne(doc);
    doc._id = result.insertedId;
    res.status(201).json({
      invitation: serialize(doc, {
        ...invitationExtras(doc),
        rsvpCount: 0,
      }),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: describeDbError(error, "Could not create an invitation.") });
  }
});

router.get("/:id", requireUser, async (req, res) => {
  try {
    const loaded = await loadOwned(req, res);
    if (!loaded) return;
    const countRows = await rsvpCounts(loaded.db, [loaded.doc._id]);
    res.json({
      invitation: serialize(loaded.doc, {
        ...invitationExtras(loaded.doc),
        rsvpCount: countRows[String(loaded.doc._id)] || 0,
      }),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not load the invitation." });
  }
});

router.put("/:id", requireUser, async (req, res) => {
  try {
    const loaded = await loadOwned(req, res);
    if (!loaded) return;
    const { content, errors } = sanitizeContent(req.body && req.body.content);
    if (errors.length) return res.status(400).json({ error: errors[0], errors });

    const templateId = loaded.doc.templateId || TEMPLATE_ID;
    const templateVersion = loaded.doc.templateVersion || TEMPLATE_VERSION;
    const title = req.body && req.body.title !== undefined
      ? sanitizeTitle(req.body.title)
      : (loaded.doc.title || "");
    const updatedAt = new Date();

    await loaded.db.collection("invitations").updateOne(
      { _id: loaded.doc._id },
      { $set: { content, title, templateId, templateVersion, updatedAt } }
    );

    const updated = { ...loaded.doc, content, title, updatedAt };
    res.json({
      invitation: serialize(updated, invitationExtras(updated)),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not save the invitation." });
  }
});

router.post("/:id/publish", requireUser, async (req, res) => {
  try {
    const loaded = await loadOwned(req, res);
    if (!loaded) return;
    const incoming = req.body && req.body.content ? sanitizeContent(req.body.content) : null;
    if (incoming && incoming.errors.length) {
      return res.status(400).json({ error: incoming.errors[0], errors: incoming.errors });
    }

    const content = incoming ? incoming.content : loaded.doc.content;
    const title = sanitizeTitle(req.body && req.body.title !== undefined ? req.body.title : loaded.doc.title);
    const updatedAt = new Date();
    await loaded.db.collection("invitations").updateOne(
      { _id: loaded.doc._id },
      { $set: { content, title, status: "published", updatedAt } }
    );

    const updated = { ...loaded.doc, content, title, status: "published", updatedAt };
    const invitation = serialize(updated, invitationExtras(updated));
    res.json({ invitation });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not publish the invitation." });
  }
});

router.delete("/:id", requireUser, async (req, res) => {
  try {
    const loaded = await loadOwned(req, res);
    if (!loaded) return;

    await loaded.db.collection("rsvps").deleteMany({ invitationId: loaded.doc._id });
    await loaded.db.collection("invitations").deleteOne({ _id: loaded.doc._id });
    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not delete the invitation." });
  }
});

router.get("/:id/rsvps", requireUser, async (req, res) => {
  try {
    const loaded = await loadOwned(req, res);
    if (!loaded) return;
    const rsvps = await loaded.db
      .collection("rsvps")
      .find({ invitationId: loaded.doc._id })
      .sort({ createdAt: -1 })
      .limit(200)
      .toArray();
    res.json({
      rsvps: rsvps.map((item) => ({
        id: String(item._id),
        guestName: item.guestName,
        attending: item.attending,
        message: item.message,
        createdAt: item.createdAt,
      })),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not load RSVPs." });
  }
});

router.post("/:id/media", requireUser, upload.single("file"), async (req, res) => {
  try {
    const loaded = await loadOwned(req, res);
    if (!loaded) return;
    if (!req.file) return res.status(400).json({ error: "Choose an image or audio file to upload." });
    const url = await storeUpload(req.file, loaded.userId);
    res.json({ url });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: error.message || "Upload failed." });
  }
});

module.exports = router;
