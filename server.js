const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000; // ✅ ต้องใช้แบบนี้บน Render

// ตั้งค่าการเก็บไฟล์ด้วย Multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // โฟลเดอร์ปลายทาง
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// รับข้อมูลจากฟอร์ม
app.post('/submit', upload.single('photo'), (req, res) => {
  const formData = {
    name: req.body.name,
    phone: req.body.phone,
    address: req.body.address,
    category: req.body.category,
    message: req.body.message,
    latitude: req.body.latitude,
    longitude: req.body.longitude,
    photo: req.file ? req.file.filename : null,
  };

  const existingData = fs.existsSync('data.json')
    ? JSON.parse(fs.readFileSync('data.json'))
    : [];

  existingData.push(formData);

  fs.writeFileSync('data.json', JSON.stringify(existingData, null, 2));

  res.send(`
    <h2>✅ ส่งคำร้องสำเร็จ</h2>
    <p>ขอบคุณ ${formData.name}</p>
    <p><a href="/">🔙 กลับหน้าหลัก</a></p>
  `);
});

// แสดงข้อมูลทั้งหมด
app.get('/data', (req, res) => {
  const data = fs.existsSync('data.json')
    ? JSON.parse(fs.readFileSync('data.json'))
    : [];

  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(data, null, 2));
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
