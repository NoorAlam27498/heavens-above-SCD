// run.js
const express = require("express");
const fs = require("fs");
const path = require("path");
const satellite = require("./src/satellite");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_PATH = path.join(__dirname, "public/data/satellite25544/iss.json");

// Ensure public/data folder exists
if (!fs.existsSync(path.dirname(DATA_PATH))) {
    fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
}

// Run the data-fetch once on startup
satellite.getTable({
    target: 25544,
    pages: 5,
    root: path.join(__dirname, "public/data/")
});

// Serve static files from public/
app.use(express.static("public"));

// Index route: render table if JSON exists
app.get("/", (req, res) => {
    if (!fs.existsSync(DATA_PATH)) {
        res.send("<h1>Heavens Above data generation in progress...</h1><p>Please refresh in a few moments.</p>");
        return;
    }

    const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"));

    let html = `<h1>ISS Passes</h1>
    <table border="1" cellpadding="5" cellspacing="0">
      <tr>
        <th>Date</th>
        <th>Brightness</th>
        <th>Pass Type</th>
        <th>Link</th>
      </tr>`;

    data.forEach(pass => {
        html += `<tr>
            <td>${pass.date}</td>
            <td>${pass.brightness}</td>
            <td>${pass.passType}</td>
            <td><a href="${pass.url}" target="_blank">Details</a></td>
        </tr>`;
    });

    html += "</table>";
    res.send(html);
});

app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});
