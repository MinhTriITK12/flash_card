// Simple Node.js server to save and load flashcards
const express = require('express');
const fs = require('fs');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = 5000;
const DATA_FILE = 'flashcards.json';

app.use(cors());
app.use(bodyParser.json());


// Load flashcards data as object
let data = {};

// Get all flashcard data (object)
app.get('/flashcards', (req, res) => {
  // Đọc lại file mỗi khi có request để cập nhật dữ liệu mới nhất (nếu có sửa tay)
  if (fs.existsSync(DATA_FILE)) {
    try {
      data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch (e) {
      console.error('Lỗi đọc file JSON:', e);
    }
  }
  res.json(data);
});

// Save all flashcard data (object)
app.post('/flashcards', (req, res) => {
  data = req.body;
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
