// run.js
const express = require("express");
const satellite = require("./src/satellite");
// const iridium = require("./src/iridium"); // uncomment when you need it

const app = express();
const PORT = process.env.PORT || 3000;

// Run the data-fetch once on startup (keeps behavior you had before)
satellite.getTable({
    target: 25544,
    pages: 4,
    root: "./public/data/"
}); // ISS

// Serve the generated files from public/ so you can view them in browser
app.use(express.static("public"));

// Simple index route
app.get("/", (req, res) => {
    res.send("Heavens Above data generation scheduled — server is running.");
});

app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});

