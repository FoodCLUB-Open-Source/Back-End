const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const requestLogging = require("./middleware/logging");

const app = express();
const router = express.Router();

const SOCKET_ADDRESS = process.env.SOCKET_ADDRESS;

/*  Middleware  */
if (process.env.NODE_ENV !== "production") {
  app.use(requestLogging);
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
  origin: [SOCKET_ADDRESS],
  credentials: true
}));
app.use(bodyParser.urlencoded({ extended: true }));

/*  All Routes  */
router.use("/login", require("./routes/login"));
router.use("/posts", require("./routes/posts"));
router.use("/comments", require("./routes/comments"));
router.use("/likes_views", require("./routes/likes_views"));

const BASE_PATH = process.env.BASE_PATH;
app.use(BASE_PATH, router);

module.exports = app;