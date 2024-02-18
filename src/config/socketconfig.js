/* Socket Configuration */
import { Server } from "socket.io";

import chatSockets from "../socket/chat.js";

/**
 * Initializes a socket server
 * 
 * @param {*} server - Server to be initialized
 */
const initSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: "*", // Replace this with your client's origin or an array of allowed origins
      methods: ["GET", "POST"],
    },
  });

  /* Establishes connection with the socket */
  io.on("connection", (socket) => {
    console.log("User connected");

    /* Handle socket events */
    chatSockets(socket);

    /* Handle user disconnect */
    socket.on("disconnect", () => {
      console.log("User disconnected");
    });
  });
}

export default initSocket;