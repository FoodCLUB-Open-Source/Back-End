/* Backend Config */
const http = require("http");
const app = require("./app");
const socket = require("./socketconfig");

/* Server Config */
const server = http.createServer(app);

/* Socket Config */
socket.init(server);

/* Server Start */
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));