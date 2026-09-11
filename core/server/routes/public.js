const express = require("express");
const { getDb } = require("../lib/db");
const { rateLimit, clientKey } = require("../lib/rate-limit");
const { sanitizeRsvpInput } = require("../lib/validate");

const router = express.Router();

function publicInvitation(doc) {
  const content = { ...doc.content };
  if (content.rsvp) {
    content.rsvp = {
      enabled: content.rsvp.enabled,
      deadline: content.rsvp.deadline,
      attendanceOptions: content.rsvp.attendanceOptions,
    };
  }
  return {
    publicId: doc.publicId,
    templateId: doc.templateId,
    templateVersion: doc.templateVersion,
    status: doc.status,
    content,
  };
}

router.get("/:publicId", async (req, res) => {
  try {
    const db = await getDb();
    const doc = await db.collection("invitations").findOne({ publicId: String(req.params.publicId) });
    if (!doc || doc.status !== "published") {
      return res.status(404).json({ error: "This invitation is not available." });
    }
    res.json({ invitation: publicInvitation(doc) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not load the invitation." });
  }
});

router.post("/:publicId/rsvp", async (req, res) => {
  try {
    if (!rateLimit({ key: `rsvp:${clientKey(req)}`, limit: 8, windowMs: 10 * 60 * 1000 })) {
      return res.status(429).json({ error: "Please wait a moment before sending another reply." });
    }

    const db = await getDb();
    const doc = await db.collection("invitations").findOne({ publicId: String(req.params.publicId) });
    if (!doc || doc.status !== "published") {
      return res.status(404).json({ error: "This invitation is not available." });
    }
    if (!doc.content || !doc.content.rsvp || doc.content.rsvp.enabled === false) {
      return res.status(400).json({ error: "RSVP is not open for this invitation." });
    }

    const allowed = new Set(doc.content.rsvp.attendanceOptions || ["yes", "no"]);
    const parsed = sanitizeRsvpInput(req.body);
    if (parsed.errors.length) return res.status(400).json({ error: parsed.errors[0] });
    if (!allowed.has(parsed.rsvp.attending)) {
      return res.status(400).json({ error: "Please choose a valid attendance option." });
    }

    const record = {
      invitationId: doc._id,
      publicId: doc.publicId,
      guestName: parsed.rsvp.guestName,
      attending: parsed.rsvp.attending,
      message: parsed.rsvp.message,
      createdAt: new Date(),
    };

    await db.collection("rsvps").insertOne(record);

    res.status(201).json({
      ok: true,
      message: "Thank you — your reply has been received.",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not save your RSVP. Please try again." });
  }
});

module.exports = { router, publicInvitation };
