const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());
app.use(cors());

// Tạo thư mục logs nếu chưa có
const LOG_DIR = path.join(__dirname, "logs");
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR);

function appendLog(line) {
  const file = path.join(LOG_DIR, "logins.txt");
  fs.appendFileSync(file, line, { encoding: "utf8" });
}

// Trang mặc định
app.get("/", (req, res) => {
  res.send("✅ Backend đang chạy!");
});

// API ghi log khi có học sinh đăng nhập
app.post("/log-login", (req, res) => {
  const { user } = req.body;
  const ip =
    req.headers["x-forwarded-for"]?.toString().split(",")[0].trim() ||
    req.socket.remoteAddress;

  // Ghi log: chỉ thời gian, tên học sinh, IP
  const logLine = 
`🕒 Thời gian: ${new Date().toLocaleString("vi-VN")}
👤 Học sinh: ${user}
🌐 IP: ${ip}
----------------------------------------
`;

  try {
    appendLog(logLine);
    res.json({ ok: true });
  } catch (e) {
    console.error("❌ Lỗi ghi log:", e);
    res.status(500).json({ ok: false, error: "write_failed" });
  }
});

// API: xem log trên trình duyệt
app.get("/get-logs", (req, res) => {
  const file = path.join(LOG_DIR, "logins.txt");
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, "utf8");
    res.type("text/plain").send(content);
  } else {
    res.type("text/plain").send("Chưa có log nào.");
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Server chạy ở cổng ${PORT}`);
});
