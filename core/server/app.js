const path = require("path");
const express = require("express");
const cookieParser = require("cookie-parser");
const { clerkMiddleware } = require("@clerk/express");
const authRoutes = require("./routes/auth");
const invitationRoutes = require("./routes/invitations");
const { router: publicRoutes } = require("./routes/public");
const meta = require("./lib/template-meta");

function createApp({ serveStatic = true } = {}) {
  const app = express();
  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(express.json({ limit: "512kb" }));
  app.use(cookieParser());
  app.use(clerkMiddleware());

  const api = express.Router();
  api.get("/config", (_req, res) => {
    res.json({
      clerkPublishableKey: process.env.CLERK_PUBLISHABLE_KEY || "",
      brandName: meta.brandName || "Invitation Editor",
      siteTitle: meta.siteTitle || meta.name,
    });
  });
  api.use("/auth", authRoutes);
  api.use("/invitations", invitationRoutes);
  api.use("/public", publicRoutes);
  api.get("/health", async (_req, res) => {
    try {
      await require("./lib/db").getDb();
      res.json({ ok: true, templateId: meta.templateId });
    } catch (error) {
      const { describeDbError } = require("./lib/db");
      res.status(503).json({ ok: false, error: describeDbError(error, error.message) });
    }
  });
  api.get("/templates", (_req, res) => {
    res.json({
      templates: [{
        templateId: meta.templateId,
        name: meta.name,
        version: meta.version,
        status: "active",
        editor: meta.editor,
      }],
    });
  });

  app.use("/api", api);
  app.use("/.netlify/functions/api", api);

  if (serveStatic) {
    const publicDir = path.join(__dirname, "..", "public");
    app.use(express.static(publicDir));
    app.get(["/i/:publicId", "/preview/:id"], (_req, res) => {
      res.sendFile(path.join(publicDir, "invitation.html"));
    });
    app.get("/editor/:id", (_req, res) => {
      res.sendFile(path.join(publicDir, "editor.html"));
    });
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api") || req.path.startsWith("/.netlify")) return next();
      res.sendFile(path.join(publicDir, "index.html"));
    });
  }

  app.use((error, _req, res, _next) => {
    if (error && error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "Files must be 10MB or smaller." });
    }
    console.error(error);
    res.status(500).json({ error: "Something went wrong." });
  });

  return app;
}

module.exports = { createApp };
