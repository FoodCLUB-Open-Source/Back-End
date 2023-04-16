/* Socket Configuration */

const socketIO = require("socket.io");
const chatSockets = require("./socket/chat");

let io;

/* Initialises a socket server */
function init(server) {
  io = socketIO(server, {
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


module.exports = { init };