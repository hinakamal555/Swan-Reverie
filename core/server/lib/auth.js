const { ObjectId } = require("mongodb");
const { getAuth } = require("@clerk/express");

function toObjectId(id) {
  try {
    return new ObjectId(String(id));
  } catch {
    return null;
  }
}

function getUserId(req) {
  const { userId } = getAuth(req);
  return userId || null;
}

function requireUser(req, res, next) {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: "Please sign in to continue." });
  }
  req.userId = userId;
  next();
}

module.exports = {
  toObjectId,
  getUserId,
  requireUser,
};
