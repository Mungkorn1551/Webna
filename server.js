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
  params: {
    folder: 'obtc-uploads',
    allowed_formats: ['jpg', 'jpeg', 'png'],
    public_id: () => Date.now()
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

// ✅ ------------------- ADMIN LOGIN SYSTEM -------------------

const ADMIN_PASSWORD = '123456';

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

app.post('/submit', upload.single('photo'), (req, res) => {
  const { name, phone, address, category, message, latitude, longitude } = req.body;
  const photo = req.file ? req.file.path : null;

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

// ✅ สำหรับ admin.html: ดึงคำร้องที่ยังไม่ processed
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
    if (err) {
      return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูล' });
    }
    res.json(results);
  });
});

// ✅ สำหรับหน้า admin-sp: แสดงรายการที่อนุมัติแล้วและ processed แล้ว
app.get('/data-approved', (req, res) => {
  const department = req.query.department;

  if (!department) {
    return res.status(400).json({ error: 'กรุณาระบุแผนก' });
  }

  const sql = `
    SELECT * FROM requests 
    WHERE department = ? AND approved = 1 AND processed = true
    ORDER BY id DESC
  `;

  db.query(sql, [department], (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูล' });
    }
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
    if (err) {
      return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูล' });
    }
    res.json(results);
  });
});

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

app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});
