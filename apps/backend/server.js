import { app } from "./app.js"
import { connectDB } from "./db/sequelise.js"
app.listen(3000, async() => {
    console.log("Server is running on port 3000")
    await connectDB()
})