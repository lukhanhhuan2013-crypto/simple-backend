const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const moment = require("moment-timezone"); // dùng moment-timezone để fix múi giờ

const app = express();
app.use(express.json());
app.use(cors());

// Tạo thư mục logs nếu chưa có
const LOG_DIR = path.join(__dirname, "logs");
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR);

function prependLog(line) {
  const file = path.join(LOG_DIR, "logins.txt");
  let oldContent = "";
  if (fs.existsSync(file)) {
    oldContent = fs.readFileSync(file, "utf8");
  }
  const newContent = line + oldContent; // chèn log mới lên đầu
  fs.writeFileSync(file, newContent, { encoding: "utf8" });
}

// Hàm lấy thời gian VN chuẩn
function getTimeVN(date = new Date()) {
  return moment(date).tz("Asia/Ho_Chi_Minh").format("HH:mm:ss DD/MM/YYYY");
}

// Trang mặc định
app.get("/", (req, res) => {
  res.send("✅ Backend đang chạy!");
});

// Route test múi giờ (dùng để kiểm tra nhanh sau khi deploy)
app.get("/time-test", (req, res) => {
  res.send("⏰ Giờ Việt Nam hiện tại: " + getTimeVN());
});

// API ghi log khi có học sinh đăng nhập
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
    res.json({ ok: true });
  } catch (e) {
    console.error("❌ Lỗi ghi log:", e);
    res.status(500).json({ ok: false, error: "write_failed" });
  }
});

// API ghi log khi học sinh báo cáo kết quả
app.post("/log-submit", (req, res) => {
  const { user, unit, correct, total, score } = req.body;
  const ip =
    req.headers["x-forwarded-for"]?.toString().split(",")[0].trim() ||
    req.socket.remoteAddress;

  // Dùng giờ server VN cho start & end
  const startVN = getTimeVN();
  const endVN = getTimeVN();

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
