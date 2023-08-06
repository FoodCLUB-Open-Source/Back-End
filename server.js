/* Backend Config */
import { createServer } from "http";

import app from "./app.js";

import initSocket from "./socketconfig.js";

/* Server Config */
const server = createServer(app);

/* Socket Config */
initSocket(server);

/* Server Start */
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));