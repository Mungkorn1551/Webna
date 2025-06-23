const express = require('express');
const multer = require('multer');
const mysql = require('mysql2');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const app = express();
const port = process.env.PORT || 3000;

// ✅ ตั้งค่า Cloudinary (ใส่ข้อมูลของคุณ)
cloudinary.config({
  cloud_name: 'dmaijyfud',
  api_key: '962872364982724',
  api_secret: '25H9IpsOeWV__LOoGPX6MYyrX0g'
});

// ✅ ตั้งค่า storage ให้ multer ใช้ Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'obtc-uploads', // ชื่อโฟลเดอร์ใน Cloudinary
    allowed_formats: ['jpg', 'jpeg', 'png'],
    public_id: (req, file) => Date.now() // ตั้งชื่อไฟล์ตาม timestamp
  }
});
const upload = multer({ storage });

// ✅ Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// ✅ เชื่อมต่อฐานข้อมูล MySQL (Railway)
const db = mysql.createConnection({
  host: 'shortline.proxy.rlwy.net',
  port: 32724,
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

// ✅ รับข้อมูลจากฟอร์มและบันทึก URL รูปจาก Cloudinary
app.post('/submit', upload.single('photo'), (req, res) => {
  const { name, phone, address, category, message, latitude, longitude } = req.body;
  const photo = req.file ? req.file.path : null; // Cloudinary URL

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

// ✅ ดึงข้อมูลทั้งหมดแบบ JSON
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
// ✅ ต้องใช้สำหรับอ่าน JSON body จากคำขอของ admin
app.use(express.json());

// ✅ อนุมัติคำร้อง (approved = true)
app.post('/approve/:id', (req, res) => {
  const id = req.params.id;
  db.query('UPDATE requests SET approved = 1 WHERE id = ?', [id], (err) => {
    if (err) return res.status(500).send('❌ อนุมัติไม่สำเร็จ');
    res.send('✅ อนุมัติสำเร็จ');
  });
});

// ✅ ปฏิเสธคำร้อง (approved = false)
app.post('/reject/:id', (req, res) => {
  const id = req.params.id;
  db.query('UPDATE requests SET approved = 0 WHERE id = ?', [id], (err) => {
    if (err) return res.status(500).send('❌ ปฏิเสธไม่สำเร็จ');
    res.send('✅ ปฏิเสธคำร้องแล้ว');
  });
});

// ✅ ตั้งแผนกที่รับผิดชอบ
app.post('/set-department/:id', (req, res) => {
  const id = req.params.id;
  const { department } = req.body;
  db.query('UPDATE requests SET department = ? WHERE id = ?', [department, id], (err) => {
    if (err) return res.status(500).send('❌ ตั้งแผนกไม่สำเร็จ');
    res.send('✅ ตั้งแผนกสำเร็จ');
  });
});

// ✅ เปลี่ยนสถานะ (status: pending, รอดำเนินการ, แจ้งหัวหน้า, จบ)
app.post('/set-status/:id', (req, res) => {
  const id = req.params.id;
  const { status } = req.body;
  db.query('UPDATE requests SET status = ? WHERE id = ?', [status, id], (err) => {
    if (err) return res.status(500).send('❌ เปลี่ยนสถานะไม่สำเร็จ');
    res.send('✅ เปลี่ยนสถานะแล้ว');
  });
});
