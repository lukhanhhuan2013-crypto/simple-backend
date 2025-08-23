const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const moment = require("moment-timezone");

const app = express();
app.use(express.json());
app.use(cors());
app.set("trust proxy", true);

// Tạo thư mục logs nếu chưa có
const LOG_DIR = path.join(__dirname, "logs");
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR);

// ===== Ghi log tổng (prepend) =====
function prependLog(line) {
  const file = path.join(LOG_DIR, "logins.txt");
  let oldContent = "";
  if (fs.existsSync(file)) oldContent = fs.readFileSync(file, "utf8");
  const newContent = line + oldContent;
  fs.writeFileSync(file, newContent, { encoding: "utf8" });
}

// ===== Ghi log cá nhân (append) =====
function safeUsername(u) {
  return (u ?? "")
    .toString()
    .trim()
    .replace(/[^a-zA-Z_]/g, ""); // chỉ giữ chữ cái + dấu _
}
function appendUserLog(user, line) {
  const name = safeUsername(user);
  if (!name) return;
  const file = path.join(LOG_DIR, `${name}.txt`);
  fs.appendFileSync(file, line, { encoding: "utf8" });
}

// ===== Giờ VN =====
function getTimeVN(date = new Date()) {
  return moment(date).tz("Asia/Ho_Chi_Minh").format("HH:mm:ss DD/MM/YYYY");
}

// Health check
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", time: new Date().toISOString() });
});

// Trang mặc định
app.get("/", (req, res) => {
  res.send("✅ Backend đang chạy!");
});

// Test giờ
app.get("/time-test", (req, res) => {
  res.send("⏰ Giờ Việt Nam hiện tại: " + getTimeVN());
});

// ===== /log-login =====
app.post("/log-login", (req, res) => {
  const { user } = req.body;
  const ip =
    req.headers["x-forwarded-for"]?.toString().split(",")[0].trim() ||
    req.socket.remoteAddress;

  const logLine =
`📌 Học sinh ${user} vừa đăng nhập thành công
🕒 Lúc: ${getTimeVN()}
🌐 IP: ${ip}
----------------------------------------
`;

  try {
    prependLog(logLine);
    appendUserLog(user, logLine);
    res.json({ ok: true });
  } catch (e) {
    console.error("❌ Lỗi ghi log:", e);
    res.status(500).json({ ok: false, error: "write_failed" });
  }
});

// ===== /log-submit =====
app.post("/log-submit", (req, res) => {
  const { user, unit, correct, total, score, startTime, endTime } = req.body;
  const ip =
    req.headers["x-forwarded-for"]?.toString().split(",")[0].trim() ||
    req.socket.remoteAddress;

  const startVN = moment.tz(startTime, "Asia/Ho_Chi_Minh").format("HH:mm:ss DD/MM/YYYY");
  const endVN = moment.tz(endTime, "Asia/Ho_Chi_Minh").format("HH:mm:ss DD/MM/YYYY");

  const logLine =
`✅ Học sinh ${user} vừa báo cáo:
📝 Thẻ: ${unit}
📊 Thực hành: ${correct}/${total} câu đạt ${score} điểm
🕒 Đăng nhập: ${startVN} kết thúc lúc ${endVN}
🌐 IP: ${ip}
----------------------------------------
`;

  try {
    prependLog(logLine);
    appendUserLog(user, logLine);
    res.json({ ok: true });
  } catch (e) {
    console.error("❌ Lỗi ghi log:", e);
    res.status(500).json({ ok: false, error: "write_failed" });
  }
});

// ===== /get-logs =====
app.get("/get-logs", (req, res) => {
  const file = path.join(LOG_DIR, "logins.txt");
  res.type("text/plain; charset=utf-8");
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, "utf8");
    res.send(content);
  } else {
    res.send("Chưa có log nào.");
  }
});

// ===== /:username.txt =====
app.get("/:username.txt", (req, res) => {
  const name = safeUsername(req.params.username);
  const file = path.join(LOG_DIR, `${name}.txt`);
  res.type("text/plain; charset=utf-8");
  if (!name) return res.status(404).send("Tên học sinh không hợp lệ.");
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, "utf8");
    res.send(content);
  } else {
    res.send(`Chưa có log nào cho ${name}.`);
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server chạy ở cổng ${PORT}`);
});
