const express = require('express');
const multer = require('multer');
const path = require('path');
const mysql = require('mysql2');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

// ✅ ตั้งค่าอัปโหลดไฟล์
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (!fs.existsSync('uploads')) {
      fs.mkdirSync('uploads');
    }
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

// ✅ Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// ✅ เชื่อมต่อฐานข้อมูล MySQL
const db = mysql.createConnection({
  host: 'shortline.proxy.rlwy.net',
  port: 32724, // ✅ เพิ่มบรรทัดนี้
  user: 'root',
  password: 'TEwgIdrYsoKqZtnFnVeJnwgAyQSYxeLF',
  database: 'railway'
});


db.connect((err) => {
  if (err) {
    console.error('❌ ไม่สามารถเชื่อมต่อ MySQL:', err);
  } else {
    console.log('✅ เชื่อมต่อ MySQL สำเร็จ');
  }
});

// ✅ รับข้อมูลจากฟอร์มแล้วบันทึกลง MySQL
app.post('/submit', upload.single('photo'), (req, res) => {
  const { name, phone, address, category, message, latitude, longitude } = req.body;
  const photo = req.file ? req.file.filename : null;

  const sql = `
    INSERT INTO requests 
    (name, phone, address, category, message, latitude, longitude, photo)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const values = [name, phone, address, category, message, latitude, longitude, photo];

  db.query(sql, values, (err, result) => {
    if (err) {
      console.error('❌ บันทึกข้อมูลล้มเหลว:', err);
      return res.status(500).send('❌ บันทึกไม่สำเร็จ');
    }

    console.log('✅ บันทึกสำเร็จ ID:', result.insertId);
    res.send(`
      <h2>✅ ส่งคำร้องสำเร็จ</h2>
      <p>ขอบคุณ ${name}</p>
      <p><a href="/">🔙 กลับหน้าหลัก</a></p>
    `);
  });
});

// ✅ (ทางเลือก) route ดูข้อมูลแบบ JSON
app.get('/data', (req, res) => {
  db.query('SELECT * FROM requests ORDER BY id DESC', (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูล' });
    }
    res.json(results);
  });
});

// ✅ Start server
app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});
