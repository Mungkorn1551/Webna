require('dotenv').config(); // ✅ โหลดค่าจาก .env เป็นบรรทัดแรก

const express = require('express');
const multer = require('multer');
const mysql = require('mysql2');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const morgan = require('morgan');
const helmet = require('helmet');

const app = express();
const port = process.env.PORT || 3000;

// ✅ Cloudinary config จาก .env
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// ✅ Cloudinary storage config
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => ({
    folder: 'obtc-uploads',
    resource_type: 'auto',
    allowed_formats: ['jpg', 'jpeg', 'png', 'mp4', 'mov', 'avi'],
    public_id: () => Date.now().toString()
  })
});
const upload = multer({ storage });

// ✅ Middleware
app.use(helmet());
app.use(morgan('dev'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));
app.use(session({
  secret: 'hi-form-secret',
  resave: false,
  saveUninitialized: false
}));

// ✅ MySQL connection จาก .env
const db = mysql.createConnection({
  host: process.env.MYSQL_HOST,
  port: process.env.MYSQL_PORT,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE
});

db.connect((err) => {
  if (err) {
    console.error('❌ ไม่สามารถเชื่อมต่อ MySQL:', err);
  } else {
    console.log('✅ เชื่อมต่อ MySQL สำเร็จ');
  }
});

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

// ✅ ------------------- ADMIN LOGIN -------------------

app.get('/admin-login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-login.html'));
});

app.post('/admin-login', (req, res) => {
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

// ✅ ------------------- ระบบคำร้อง -------------------

app.post('/submit', upload.array('mediaFiles', 10), (req, res) => {
  const { name, phone, address, category, message, latitude, longitude } = req.body;
  const files = req.files;

  const uploadedUrls = files.map(file => file.path);
  const photoUrls = uploadedUrls.join(',');

  const sql = `
    INSERT INTO requests 
    (name, phone, address, category, message, latitude, longitude, photo)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const values = [name, phone, address, category, message, latitude, longitude, photoUrls];

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

// ✅ ดึงคำร้องยังไม่ processed
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
    res.json(results);
  });
});

// ✅ แสดงรายการที่อนุมัติแล้ว
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
    res.json(results);
  });
});

// ✅ processed.html
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
    res.json(results);
  });
});

// ✅ จัดการคำร้อง
app.post('/approve/:id', (req, res) => {
  const id = req.params.id;
  db.query('UPDATE requests SET approved = 1, processed = true WHERE id = ?', [id], (err) => {
    if (err) return res.status(500).send('❌ อนุมัติไม่สำเร็จ');
    res.send('✅ อนุมัติสำเร็จ');
  });
});

app.post('/reject/:id', (req, res) => {
  const id = req.params.id;
  db.query('UPDATE requests SET approved = 0, processed = true WHERE id = ?', [id], (err) => {
    if (err) return res.status(500).send('❌ ปฏิเสธไม่สำเร็จ');
    res.send('✅ ปฏิเสธคำร้องแล้ว');
  });
});

app.post('/set-department/:id', (req, res) => {
  const id = req.params.id;
  const { department } = req.body;
  db.query('UPDATE requests SET department = ? WHERE id = ?', [department, id], (err) => {
    if (err) return res.status(500).send('❌ เปลี่ยนแผนกไม่สำเร็จ');
    res.send('✅ เปลี่ยนแผนกแล้ว');
  });
});

app.post('/set-status/:id', (req, res) => {
  const id = req.params.id;
  const { status } = req.body;
  db.query('UPDATE requests SET status = ? WHERE id = ?', [status, id], (err) => {
    if (err) return res.status(500).send('❌ เปลี่ยนสถานะไม่สำเร็จ');
    res.send('✅ เปลี่ยนสถานะแล้ว');
  });
});

app.post('/disapprove/:id', (req, res) => {
  const id = req.params.id;
  db.query('UPDATE requests SET approved = 0, processed = true WHERE id = ?', [id], (err) => {
    if (err) return res.status(500).send('เกิดข้อผิดพลาด');
    res.sendStatus(200);
  });
});

// ✅ Fallback 404
app.use((req, res) => {
  res.status(404).send('ไม่พบหน้าเว็บที่คุณเรียก');
});

// ✅ Global error handler
app.use((err, req, res, next) => {
  console.error('💥 เกิดข้อผิดพลาดไม่คาดคิด:', err.stack);
  res.status(500).send('เกิดข้อผิดพลาดในเซิร์ฟเวอร์');
});

// ✅ Start server
app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});
