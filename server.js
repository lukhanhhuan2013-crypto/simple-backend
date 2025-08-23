@@ -2,7 +2,7 @@
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const moment = require("moment-timezone"); // thêm thư viện moment-timezone
const moment = require("moment-timezone"); // dùng moment-timezone để fix múi giờ

const app = express();
app.use(express.json());
@@ -32,6 +32,11 @@
  res.send("✅ Backend đang chạy!");
});

// Route test múi giờ (dùng để kiểm tra nhanh sau khi deploy)
app.get("/time-test", (req, res) => {
  res.send("⏰ Giờ Việt Nam hiện tại: " + getTimeVN());
});

// API ghi log khi có học sinh đăng nhập
app.post("/log-login", (req, res) => {
  const { user } = req.body;
@@ -62,40 +67,40 @@
    req.headers["x-forwarded-for"]?.toString().split(",")[0].trim() ||
    req.socket.remoteAddress;

  // luôn dùng giờ server VN, không lấy startTime/endTime từ client gửi lên
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