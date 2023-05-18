/* Backend Config */

const express = require("express")
require('dotenv').config()
const http = require("http");
const cors = require("cors")
const bodyParser = require("body-parser");

const app = express()
const port = process.env.PORT || 5000
const server = http.createServer(app);

/*  Middleware  */
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cors({
    origin: ['http://localhost:3000'],
    credentials: true
})) 
app.use(bodyParser.urlencoded({ extended: true }))

/*  All Routes  */
const loginRoutes = require("./routes/login")
const postsRoutes = require("./routes/posts")
const commentsRoutes = require("./routes/comments")
const likesRoutes = require("./routes/likes_views")

app.use("/api/login", loginRoutes)
app.use("/api/posts", postsRoutes)
app.use("/api/comments", commentsRoutes)
app.use("/api/likes_views", likesRoutes)

/* Socket Config */
const socket = require("./socketconfig");
socket.init(server);


app.use((err, req, res, next) => {
    console.error(err.stack); 
    if (!process.env.PORT) {
        res.status(err.statusCode || 500).send({ error: err.message, stack: err.stack });
      } else {
        res.status(err.statusCode || 500).send({ error: err.message });
      }
});

/* Server Listener */
server.listen(port, () =>{
    console.log(`Server has started on port ${port}`)
})