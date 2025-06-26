const express = require('express');
const multer = require('multer');
const mysql = require('mysql2');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// ✅ ตั้งค่า Cloudinary
cloudinary.config({
  cloud_name: 'dmaijyfud',
  api_key: '962872364982724',
  api_secret: '25H9IpsOeWV__LOoGPX6MYyrX0g'
});

// ✅ ตั้งค่า storage ให้ multer ใช้ Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    return {
      folder: 'obtc-uploads',
      resource_type: 'auto',
      allowed_formats: ['jpg', 'jpeg', 'png', 'mp4', 'mov', 'avi'],
      public_id: () => Date.now().toString()
    };
  }
});
const upload = multer({ storage });

// ✅ Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));
app.use(session({
  secret: 'hi-form-secret',
  resave: false,
  saveUninitialized: false
}));

// ✅ เชื่อมต่อ MySQL
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

// ✅ รหัสผ่านแอดมิน
const ADMIN_PASSWORD = '123456';

// ------------------- ADMIN LOGIN -------------------

app.get('/admin-login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-login.html'));
});

app.post('/admin-login', (req, res) => {
  console.log('🟡 ล็อกอินแอดมิน:', req.body);
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    req.session.loggedIn = true;
    res.redirect('/admin');
  } else {
    res.redirect('/admin-login?error=1');
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/admin-login');
  });
});

app.get('/admin', (req, res) => {
  if (req.session.loggedIn) {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
  } else {
    res.redirect('/admin-login');
  }
});

// ------------------- SUBMIT FORM -------------------

app.post('/submit', upload.array('mediaFiles', 10), (req, res) => {
  console.log('📨 รับข้อมูลใหม่:', JSON.stringify(req.body, null, 2));
  console.log('🖼️ ไฟล์แนบ:', req.files.map(f => f.originalname));

  const { name, phone, address, category, message, latitude, longitude } = req.body;
  const files = req.files;

  if (!name || !phone || !address || !message) {
    return res.status(400).send('❌ ข้อมูลไม่ครบ');
  }

  const uploadedUrls = files.map(file => file.path);
  const photoUrls = uploadedUrls.join(',');

  const sql = `
    INSERT INTO requests 
    (name, phone, address, category, message, latitude, longitude, photo)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const values = [name, phone, address, category || '', message, latitude, longitude, photoUrls];

  db.query(sql, values, (err, result) => {
    if (err) {
      console.error('❌ บันทึกข้อมูลล้มเหลว:', err);
      return res.status(500).send('❌ บันทึกไม่สำเร็จ');
    }

    console.log('✅ บันทึกคำร้อง:', JSON.stringify(result, null, 2));
    res.send(`
      <h2>✅ ส่งคำร้องสำเร็จ</h2>
      <p>ขอบคุณ ${name}</p>
      <p><a href="/">🔙 กลับหน้าหลัก</a></p>
    `);
  });
});

// ------------------- API ข้อมูลคำร้อง -------------------

app.get('/data', (req, res) => {
  const department = req.query.department;
  let sql = 'SELECT * FROM requests WHERE processed = false';
  const params = [];

  if (department) {
    sql += ' AND department = ?';
    params.push(department);
  }

  sql += ' ORDER BY id DESC';

  db.query(sql, params, (err, results) => {
    if (err) return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูล' });
    console.log('📥 ดึงคำร้องใหม่:', results.length, 'รายการ');
    res.json(results);
  });
});

app.get('/data-approved', (req, res) => {
  const department = req.query.department;
  if (!department) return res.status(400).json({ error: 'กรุณาระบุแผนก' });

  const sql = `
    SELECT * FROM requests 
    WHERE department = ? AND approved = 1 AND processed = true
    ORDER BY id DESC
  `;

  db.query(sql, [department], (err, results) => {
    if (err) return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูล' });
    console.log(`✅ ดึงคำร้องที่อนุมัติ (${department}):`, results.length);
    res.json(results);
  });
});

app.get('/processed', (req, res) => {
  if (req.session.loggedIn) {
    res.sendFile(path.join(__dirname, 'public', 'processed.html'));
  } else {
    res.redirect('/admin-login');
  }
});

app.get('/data-processed', (req, res) => {
  db.query('SELECT * FROM requests WHERE processed = true ORDER BY id DESC', (err, results) => {
    if (err) return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูล' });
    console.log('📦 ดึงคำร้องที่ดำเนินการแล้ว:', results.length);
    res.json(results);
  });
});

// ------------------- อนุมัติ / ปฏิเสธ / เปลี่ยนสถานะ -------------------

app.post('/approve/:id', (req, res) => {
  const id = req.params.id;
  console.log('✅ อนุมัติคำร้อง ID:', id);
  db.query('UPDATE requests SET approved = 1, processed = true WHERE id = ?', [id], (err) => {
    if (err) return res.status(500).send('❌ อนุมัติไม่สำเร็จ');
    res.send('✅ อนุมัติสำเร็จ');
  });
});

app.post('/reject/:id', (req, res) => {
  const id = req.params.id;
  console.log('❌ ปฏิเสธคำร้อง ID:', id);
  db.query('UPDATE requests SET approved = 0, processed = true WHERE id = ?', [id], (err) => {
    if (err) return res.status(500).send('❌ ปฏิเสธไม่สำเร็จ');
    res.send('✅ ปฏิเสธคำร้องแล้ว');
  });
});

app.post('/set-department/:id', (req, res) => {
  const id = req.params.id;
  const { department } = req.body;
  console.log(`📌 เปลี่ยนแผนก ID:${id} -> ${department}`);
  db.query('UPDATE requests SET department = ? WHERE id = ?', [department, id], (err) => {
    if (err) return res.status(500).send('❌ เปลี่ยนแผนกไม่สำเร็จ');
    res.send('✅ เปลี่ยนแผนกแล้ว');
  });
});

app.post('/set-status/:id', (req, res) => {
  const id = req.params.id;
  const { status } = req.body;
  console.log(`📋 เปลี่ยนสถานะ ID:${id} -> ${status}`);
  db.query('UPDATE requests SET status = ? WHERE id = ?', [status, id], (err) => {
    if (err) return res.status(500).send('❌ เปลี่ยนสถานะไม่สำเร็จ');
    res.send('✅ เปลี่ยนสถานะแล้ว');
  });
});

app.post('/disapprove/:id', (req, res) => {
  const id = req.params.id;
  console.log('❌ ยกเลิกการอนุมัติ ID:', id);
  db.query('UPDATE requests SET approved = 0, processed = true WHERE id = ?', [id], (err) => {
    if (err) return res.status(500).send('เกิดข้อผิดพลาด');
    res.sendStatus(200);
  });
});

// ✅ 404 handler
app.use((req, res) => {
  res.status(404).send('ไม่พบหน้าเว็บที่คุณเรียก');
});

// ✅ error handler
app.use((err, req, res, next) => {
  console.error('💥 เกิดข้อผิดพลาดไม่คาดคิด:', err.stack);
  res.status(500).send('เกิดข้อผิดพลาดในเซิร์ฟเวอร์');
});

app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});
