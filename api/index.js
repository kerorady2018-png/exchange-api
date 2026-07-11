const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();

app.get("/rates", (req, res) => {
    try {
        const filePath = path.join(process.cwd(), "rates.json");
        const rawData = fs.readFileSync(filePath, "utf8");
        const jsonData = JSON.parse(rawData);

        res.setHeader("Content-Type", "application/json");
        res.status(200).json(jsonData);
    } catch (error) {
        console.error("Error reading rates.json:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

module.exports = app;
