const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const moment = require("moment-timezone"); // dùng moment-timezone để fix múi giờ

const app = express();
app.use(express.json());
app.use(cors());

// === Thư mục logs cục bộ ===
const LOG_DIR = path.join(__dirname, "logs");
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR);

// Hàm lấy giờ VN chuẩn
function getTimeVN(date = new Date()) {
  return moment(date).tz("Asia/Ho_Chi_Minh").format("HH:mm:ss DD/MM/YYYY");
}

// Ghi log lên đầu file
function prependFile(filePath, line) {
  let old = "";
  if (fs.existsSync(filePath)) {
    old = fs.readFileSync(filePath, "utf8");
  }
  fs.writeFileSync(filePath, line + old, { encoding: "utf8" });
}

// Ghi vào log tổng + log cá nhân
function writeBoth(user, line) {
  const mainFile = path.join(LOG_DIR, "logins.txt");
  const personalFile = path.join(LOG_DIR, `${user}.txt`);
  prependFile(mainFile, line);
  prependFile(personalFile, line);
}

// === Routes ===
app.get("/", (req, res) => {
  res.send("✅ Backend đang chạy!");
});

// Route test múi giờ (dùng để kiểm tra nhanh sau khi deploy)
app.get("/time-test", (req, res) => {
  res.send("⏰ Giờ Việt Nam hiện tại: " + getTimeVN());
});

// API: ghi log khi học sinh đăng nhập
app.post("/log-login", (req, res) => {
  const { user } = req.body;
  if (!user) return res.status(400).json({ ok: false, error: "missing_user" });

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
    writeBoth(user, logLine);
    res.json({ ok: true });
  } catch (e) {
    console.error("❌ Lỗi ghi log (login):", e);
    res.status(500).json({ ok: false, error: "write_failed" });
  }
});

// API: ghi log khi học sinh báo cáo điểm
app.post("/log-submit", (req, res) => {
  const { user, unit, correct, total, score, details } = req.body;
  if (!user) return res.status(400).json({ ok: false, error: "missing_user" });

  const ip =
    req.headers["x-forwarded-for"]?.toString().split(",")[0].trim() ||
    req.socket.remoteAddress;

  // Dùng giờ server VN cho start & end
  const startVN = getTimeVN();
  const endVN = getTimeVN();

  const logLine =
`✅ Học sinh ${user} vừa báo cáo:
📝 Thẻ: ${unit ?? "N/A"}
📊 Thực hành: ${correct ?? "N/A"}/${total ?? "N/A"} câu đạt ${score ?? "N/A"} điểm
🕒 Từ ${startVN} → ${endVN}
🧾 Chi tiết: ${details || "Không có"}
🌐 IP: ${ip}
----------------------------------------
`;

  try {
    writeBoth(user, logLine);
    res.json({ ok: true });
  } catch (e) {
    console.error("❌ Lỗi ghi log (submit):", e);
    res.status(500).json({ ok: false, error: "write_failed" });
  }
});

// API: xem log tổng
app.get("/get-logs", (req, res) => {
  const file = path.join(LOG_DIR, "logins.txt");
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, "utf8");
    res.type("text/plain").send(content);
  } else {
    res.type("text/plain").send("Chưa có log nào.");
  }
});

// API: xem log cá nhân qua URL /tenhocsinh.txt (vd: /Lan123.txt)
app.get("/:username.txt", (req, res) => {
  const file = path.join(LOG_DIR, `${req.params.username}.txt`);
  if (fs.existsSync(file)) {
    res.type("text/plain").send(fs.readFileSync(file, "utf8"));
  } else {
    res.type("text/plain").send(`Chưa có log nào cho học sinh ${req.params.username}.`);
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Server chạy ở cổng ${PORT}`);
});
