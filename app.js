import bodyParser from "body-parser";
import cors from "cors";
import express, { Router } from "express";

import requestLogging from "./middleware/logging.js";

import { commentsRouter, likesViewRouter, loginRouter, postsRouter, profileRouter } from "./routes/index.js";

const app = express();
const router = Router();

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
router.use("/login", loginRouter);
router.use("/posts", postsRouter);
router.use("/comments", commentsRouter);
router.use("/likes_views", likesViewRouter);
router.use("/profile_page", profileRouter);

const BASE_PATH = process.env.BASE_PATH;
app.use(BASE_PATH, router);


export default app;