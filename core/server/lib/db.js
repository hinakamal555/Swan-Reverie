const { MongoClient } = require("mongodb");
const meta = require("./template-meta");

let client;
let dbPromise;

async function ensureIndex(collection, keys, options = {}) {
  try {
    await collection.createIndex(keys, options);
  } catch (error) {
    if (error.code !== 86 && error.codeName !== "IndexKeySpecsConflict") throw error;
    const name = options.name || Object.keys(keys).map((key) => `${key}_${keys[key]}`).join("_");
    try {
      await collection.dropIndex(name);
      await collection.createIndex(keys, options);
    } catch (dropError) {
      if (dropError.codeName !== "IndexNotFound") throw dropError;
    }
  }
}

async function getDb() {
  if (dbPromise) return dbPromise;

  dbPromise = (async () => {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error("MONGODB_URI is not set. Add it to your .env file.");
    }

    client = new MongoClient(uri, {
      maxPoolSize: 5,
      minPoolSize: 0,
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 8000,
    });
    await client.connect();

    const dbName = process.env.MONGODB_DB || defaultDbName(uri);
    const db = client.db(dbName);

    await ensureIndex(db.collection("users"), { email: 1 }, { unique: true, sparse: true });
    await ensureIndex(db.collection("invitations"), { publicId: 1 }, { unique: true });
    await ensureIndex(db.collection("invitations"), { ownerId: 1, updatedAt: -1 });
    await ensureIndex(db.collection("rsvps"), { invitationId: 1, createdAt: -1 });
    await ensureIndex(db.collection("templates"), { templateId: 1 }, { unique: true });

    await db.collection("templates").updateOne(
      { templateId: meta.templateId },
      {
        $setOnInsert: {
          templateId: meta.templateId,
          name: meta.name,
          version: meta.version,
          status: "active",
          supportedFeatures: meta.supportedFeatures,
          createdAt: new Date(),
        },
        $set: { updatedAt: new Date() },
      },
      { upsert: true }
    );

    return db;
  })();

  try {
    return await dbPromise;
  } catch (error) {
    dbPromise = null;
    throw error;
  }
}

function defaultDbName(uri) {
  try {
    const name = new URL(uri).pathname.replace(/^\//, "").split("/")[0];
    if (!name || name.includes("=")) return "wedding-invitations";
    return name;
  } catch {
    return "wedding-invitations";
  }
}

function describeDbError(error, fallback) {
  const msg = String((error && error.message) || "");
  const name = String((error && error.name) || "");
  if (msg.includes("MONGODB_URI")) {
    return "The database is not configured. Add MONGODB_URI and MONGODB_DB in Netlify environment variables, then redeploy.";
  }
  if (/authentication failed|bad auth|not authorized/i.test(msg)) {
    return "MongoDB login failed. Check the MONGODB_URI value in Netlify environment variables.";
  }
  if (
    name === "MongoServerSelectionError" ||
    /whitelist|ENOTFOUND|ECONNREFUSED|timed out|timeout|Server selection|querySrv/i.test(msg)
  ) {
    return "Could not reach MongoDB. In Atlas → Network Access, add 0.0.0.0/0, then try again.";
  }
  return fallback;
}

module.exports = { getDb, describeDbError };
