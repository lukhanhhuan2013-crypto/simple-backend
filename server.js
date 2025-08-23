const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const moment = require("moment-timezone"); // dùng moment-timezone để fix múi giờ

const app = express();
app.use(express.json());
app.use(cors());
app.set("trust proxy", true); // lấy IP qua x-forwarded-for chính xác hơn

// Tạo thư mục logs nếu chưa có
const LOG_DIR = path.join(__dirname, "logs");
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR);

// --- Giữ nguyên: log tổng prepend lên đầu file ---
function prependLog(line) {
  const file = path.join(LOG_DIR, "logins.txt");
  let oldContent = "";
  if (fs.existsSync(file)) {
    oldContent = fs.readFileSync(file, "utf8");
  }
  const newContent = line + oldContent; // chèn log mới lên đầu
  fs.writeFileSync(file, newContent, { encoding: "utf8" });
}

// --- MỚI: ghi log riêng cho từng học sinh (append) ---
function safeUsername(u) {
  return (u ?? "").toString().trim().replace(/[^a-zA-Z0-9_-]/g, "");
}
function appendUserLog(user, line) {
  const name = safeUsername(user);
  if (!name) return; // không tạo file khi tên trống
  const file = path.join(LOG_DIR, `${name}.txt`);
  fs.appendFileSync(file, line, { encoding: "utf8" });
}

// Hàm lấy thời gian VN chuẩn
function getTimeVN(date = new Date()) {
  return moment(date).tz("Asia/Ho_Chi_Minh").format("HH:mm:ss DD/MM/YYYY");
}

// Health check (giúp Render xác nhận service sẵn sàng)
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", time: new Date().toISOString() });
});

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
    prependLog(logLine);         // log tổng (prepend)
    appendUserLog(user, logLine); // log riêng (append)
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
    prependLog(logLine);          // log tổng (prepend)
    appendUserLog(user, logLine); // log riêng (append)
    res.json({ ok: true });
  } catch (e) {
    console.error("❌ Lỗi ghi log:", e);
    res.status(500).json({ ok: false, error: "write_failed" });
  }
});

// API: xem log tổng trên trình duyệt
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

// --- MỚI: xem log riêng của học sinh, path dạng /TenHocSinh.txt ---
app.get("/:username.txt", (req, res) => {
  const safeName = safeUsername(req.params.username);
  const file = path.join(LOG_DIR, `${safeName}.txt`);
  res.type("text/plain; charset=utf-8");
  if (!safeName) return res.status(404).send("Tên học sinh không hợp lệ.");
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, "utf8");
    res.send(content);
  } else {
    res.send(`Chưa có log nào cho ${safeName}.`);
  }
});

const PORT = process.env.PORT || 10000;
// ràng buộc 0.0.0.0 để chắc chắn Render bắt được cổng lắng nghe
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server chạy ở cổng ${PORT}`);
});
