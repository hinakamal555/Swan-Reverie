const buckets = new Map();

function rateLimit({ key, limit, windowMs }) {
  const now = Date.now();
  const entry = buckets.get(key) || [];
  const recent = entry.filter((time) => now - time < windowMs);
  if (recent.length >= limit) return false;
  recent.push(now);
  buckets.set(key, recent);
  return true;
}

function clientKey(req) {
  return req.ip || req.headers["x-forwarded-for"] || "unknown";
}

module.exports = { rateLimit, clientKey };
