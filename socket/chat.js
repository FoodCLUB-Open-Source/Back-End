/*Socket Routes for chat functionality */

function chatSockets(socket) {

   /* Testing chat socket */
    socket.on("chat/testing", (data) => {
       console.log(`This test is Working! ${data.message}`);
    });
  }

  
  module.exports = chatSockets;