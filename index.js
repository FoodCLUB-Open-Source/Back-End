const express = require("express")
require('dotenv').config()

const app = express()
const port = process.env.PORT || 5000

/*  Middleware  */
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

/*  Routes  */
const loginRoutes = require("./routes/login")
const postsRoutes = require("./routes/posts")

app.use("/api/login", loginRoutes)
app.use("/api/posts", postsRoutes)


app.listen(port, () =>{
    console.log(`Server has started on port ${port}`)
})