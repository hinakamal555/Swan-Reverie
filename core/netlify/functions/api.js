require("dotenv").config();
const serverless = require("serverless-http");
const { createApp } = require("../../server/app");

const app = createApp({ serveStatic: false });
exports.handler = serverless(app);
