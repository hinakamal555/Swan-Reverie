require("dotenv").config();
const { createApp } = require("./app");

const port = Number(process.env.PORT || 8888);
const app = createApp({ serveStatic: true });

app.listen(port, () => {
  console.log(`Invitation platform running at http://localhost:${port}`);
});
