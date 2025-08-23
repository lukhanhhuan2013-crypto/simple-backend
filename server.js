const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

// Thư mục logs
const LOG_DIR = path.join(__dirname, "logs");
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR);

// Hàm lấy giờ VN
function getTimeVN() {
  return new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
}

// Hàm prepend log (ghi mới lên đầu file)
function prependLog(line) {
  const file = path.join(LOG_DIR, "logins.txt");
  let old = "";
  if (fs.existsSync(file)) old = fs.readFileSync(file, "utf8");
  fs.writeFileSync(file, line + old, "utf8");
}

// Route kiểm tra
app.get("/", (req, res) => {
  res.send("✅ Backend đang chạy!");
});

// API ghi log khi báo cáo điểm
app.post("/log-report", (req, res) => {
  const { user, unit, correct, total, score } = req.body;
  if (!user) return res.status(400).json({ ok: false, error: "Thiếu user" });

  const ip =
    req.headers["x-forwarded-for"]?.toString().split(",")[0].trim() ||
    req.socket.remoteAddress;

  const now = getTimeVN();

  const logLine = `✅ Học sinh ${user} vừa báo cáo:
📝 Thẻ: ${unit || "N/A"}
📊 Thực hành: ${correct || "?"}/${total || "?"} đạt ${score || "?"} điểm
🕒 Thời gian: ${now}
🌐 IP: ${ip}
----------------------------------------\n`;

  try {
    prependLog(logLine);
    res.json({ ok: true, msg: "Đã ghi log thành công!" });
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

// API: log cá nhân
app.get("/:user.txt", (req, res) => {
  const { user } = req.params;
  const file = path.join(LOG_DIR, "logins.txt");
  if (fs.existsSync(file)) {
    const lines = fs
      .readFileSync(file, "utf8")
      .split("\n")
      .filter((line) => line.includes(`Học sinh ${user} `))
      .join("\n");
    res.type("text/plain").send(lines || `Không có log cho ${user}`);
  } else {
    res.type("text/plain").send("Chưa có log nào.");
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("🚀 Server chạy ở cổng " + PORT));
