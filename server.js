const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const moment = require("moment-timezone");

const app = express();
app.use(express.json());
app.use(cors());

// Thư mục chứa log
const LOG_DIR = path.join(__dirname, "logs");
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR);

// Hàm lấy giờ VN
function getTimeVN() {
  return moment().tz("Asia/Ho_Chi_Minh").format("YYYY-MM-DD HH:mm:ss");
}

// Ghi log (prepend: thêm vào đầu file)
function prependLog(filePath, line) {
  let oldData = "";
  if (fs.existsSync(filePath)) {
    oldData = fs.readFileSync(filePath, "utf8");
  }
  fs.writeFileSync(filePath, line + oldData, "utf8");
}

// API test
app.get("/", (req, res) => {
  res.send("✅ Backend đang chạy!");
});

// API kiểm tra giờ
app.get("/time-test", (req, res) => {
  res.send("⏰ Giờ VN hiện tại: " + getTimeVN());
});

// API ghi log khi học sinh đăng nhập/báo cáo
app.post("/log-login", (req, res) => {
  const { user, unit, correct, total, score } = req.body;

  if (!user) {
    return res.status(400).json({ ok: false, error: "missing_user" });
  }

  const ip =
    req.headers["x-forwarded-for"]?.toString().split(",")[0].trim() ||
    req.socket.remoteAddress;

  const startVN = getTimeVN();
  const endVN = getTimeVN();

  const logLine = `✅ Học sinh ${user} vừa báo cáo:
📝 Thẻ: ${unit}
📊 Thực hành: ${correct}/${total} câu đạt ${score} điểm
🕒 Đăng nhập: ${startVN} kết thúc lúc ${endVN}
🌐 IP: ${ip}
----------------------------------------
`;

  try {
    // Ghi vào log tổng
    const mainFile = path.join(LOG_DIR, "logins.txt");
    prependLog(mainFile, logLine);

    // Ghi vào log cá nhân
    const personalFile = path.join(LOG_DIR, `${user}.txt`);
    prependLog(personalFile, logLine);

    res.json({ ok: true });
  } catch (e) {
    console.error("❌ Lỗi ghi log:", e);
    res.status(500).json({ ok: false, error: "write_failed" });
  }
});

// API: xem log tổng
app.get("/get-logs", (req, res) => {
  const file = path.join(LOG_DIR, "logins.txt");
  if (fs.existsSync(file)) {
    res.type("text/plain").send(fs.readFileSync(file, "utf8"));
  } else {
    res.type("text/plain").send("Chưa có log nào.");
  }
});

// API: xem log cá nhân qua URL /tenhocsinh.txt
app.get("/:username.txt", (req, res) => {
  const username = req.params.username;
  const file = path.join(LOG_DIR, `${username}.txt`);
  if (fs.existsSync(file)) {
    res.type("text/plain").send(fs.readFileSync(file, "utf8"));
  } else {
    res.type("text/plain").send(`Chưa có log nào cho học sinh ${username}.`);
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Server chạy ở cổng ${PORT}`);
});
