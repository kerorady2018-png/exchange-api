const fs = require('fs');
const path = require('path');

export default async function handler(req, res) {
  try {
    const filePath = path.join(process.cwd(), 'public/data/rates.json');
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'Data file not found' });
    }

    const fileContent = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(fileContent);
    
    res.json(data);
  } catch (error) {
    console.error('Error reading static data:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}
