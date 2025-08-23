const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const moment = require("moment-timezone");

const app = express();
app.use(cors());
app.use(express.json());

const LOG_DIR = path.join(__dirname, "logs");
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR);

// Hàm trả giờ VN
function getTimeVN() {
  return moment().tz("Asia/Ho_Chi_Minh").format("YYYY-MM-DD HH:mm:ss");
}

// Ghi thêm log vào đầu file
function prependLog(filename, text) {
  const file = path.join(LOG_DIR, filename);
  let old = "";
  if (fs.existsSync(file)) old = fs.readFileSync(file, "utf8");
  fs.writeFileSync(file, text + old, "utf8");
}

// API: đăng nhập
app.post("/log-login", (req, res) => {
  const { user } = req.body;
  if (!user) return res.status(400).json({ ok: false, error: "missing_user" });

  const ip =
    req.headers["x-forwarded-for"]?.toString().split(",")[0].trim() ||
    req.socket.remoteAddress;

  const time = getTimeVN();
  const line = `🔑 Học sinh ${user} đăng nhập lúc ${time} từ IP ${ip}\n`;

  try {
    prependLog("logins.txt", line);
    prependLog(`${user}.txt`, line);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false });
  }
});

// API: báo cáo điểm
app.post("/log-report", (req, res) => {
  const { user, unit, correct, total, score } = req.body;
  if (!user) return res.status(400).json({ ok: false, error: "missing_user" });

  const ip =
    req.headers["x-forwarded-for"]?.toString().split(",")[0].trim() ||
    req.socket.remoteAddress;

  const time = getTimeVN();
  const line = `📊 Học sinh ${user} báo cáo: Thẻ ${unit}, ${correct}/${total} câu, ${score} điểm, lúc ${time}, IP ${ip}\n`;

  try {
    prependLog("logins.txt", line);
    prependLog(`${user}.txt`, line);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false });
  }
});

// API: xem toàn bộ logs
app.get("/get-logs", (req, res) => {
  const file = path.join(LOG_DIR, "logins.txt");
  if (fs.existsSync(file)) {
    res.type("text/plain").send(fs.readFileSync(file, "utf8"));
  } else {
    res.type("text/plain").send("Chưa có log nào.");
  }
});

// API: xem log cá nhân
app.get("/:user.txt", (req, res) => {
  const file = path.join(LOG_DIR, `${req.params.user}.txt`);
  if (fs.existsSync(file)) {
    res.type("text/plain").send(fs.readFileSync(file, "utf8"));
  } else {
    res.type("text/plain").send(`Chưa có log cho ${req.params.user}`);
  }
});

// Cổng server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Server chạy ở cổng ${PORT}`);
});
