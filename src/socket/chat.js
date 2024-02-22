/*Socket Routes for chat functionality */
const chatSockets = (socket) => {
  /* Testing chat socket */
  socket.on("chat/testing", (data) => {
    console.log(`This test is Working! ${data.message}`);
  });
};

export default chatSockets;