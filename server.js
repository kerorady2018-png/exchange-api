const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();

app.get("/rates", (req, res) => {
    try {
        const filePath = path.join(__dirname, "rates.json");
        const data = fs.readFileSync(filePath, "utf8");
        res.status(200).json(JSON.parse(data));
    } catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});

module.exports = app;
