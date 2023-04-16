/* Lets testing of socket routes without the need of a front end */

const io = require("socket.io-client");

const socket = io("http://localhost:5000"); // Replace with your server's address

socket.on("connect", () => {
  console.log("Connected to server");

  /* Emit the "chat/testing" event */
  socket.emit("chat/testing", { message: "Test message" });
});

socket.on("disconnect", () => {
  console.log("Disconnected from server");
});