const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
    try {
        const filePath = path.join(process.cwd(), 'rates.json');
        const data = fs.readFileSync(filePath, 'utf8');
        
        res.setHeader('Content-Type', 'application/json');
        res.status(200).json(JSON.parse(data));
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
};