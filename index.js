/* Backend Config */

const express = require("express")
require('dotenv').config()
const http = require("http");
const mongoDB = require('./mongoDB');


const app = express()
const port = process.env.PORT || 5000
const server = http.createServer(app);

/*  Middleware  */
app.use(express.json())
app.use(express.urlencoded({ extended: true }))


//mongoDB()

/*  All Routes  */
const loginRoutes = require("./routes/login")
const postsRoutes = require("./routes/posts")

app.use("/api/login", loginRoutes)
app.use("/api/posts", postsRoutes)

/* Socket Config */
const socket = require("./socketconfig");
socket.init(server);

/* Server Listener */
server.listen(port, () =>{
    console.log(`Server has started on port ${port}`)
})