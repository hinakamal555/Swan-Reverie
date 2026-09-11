const express = require("express");
const { clerkClient } = require("@clerk/express");
const { getUserId } = require("../lib/auth");

const router = express.Router();

router.get("/me", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Please sign in to continue." });
    }

    try {
      const user = await clerkClient.users.getUser(userId);
      const email = user.emailAddresses.find((item) => item.id === user.primaryEmailAddressId)?.emailAddress
        || user.emailAddresses[0]?.emailAddress
        || "";
      const name = [user.firstName, user.lastName].filter(Boolean).join(" ")
        || user.username
        || email.split("@")[0]
        || "";

      res.json({
        user: {
          id: userId,
          email,
          name,
        },
      });
    } catch {
      res.json({ user: { id: userId, email: "", name: "" } });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not load your account." });
  }
});

module.exports = router;
