const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const moment = require("moment-timezone");
const axios = require("axios");

const app = express();
app.use(express.json());
app.use(cors());
app.set("trust proxy", true);

// ===== Config =====
const LOG_DIR = path.join(__dirname, "logs");
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR);

const GITHUB_REPO = "lukhanhhuan2013-crypto/logs-store"; // repo chứa logs (tạo sẵn)
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

// ===== Helpers: username handling =====
function normalizeUser(u) {
  return (u ?? "").toString().trim();
}
// Bỏ 3 số cuối nếu có: Huan092 -> Huan
function shortenUser(u) {
  return normalizeUser(u).replace(/\d{3}$/, "");
}
// filename-safe: giữ chữ, số, underscore; loại bỏ ký tự khác
function safeUsernameForFile(u) {
  return (u ?? "").toString().trim().replace(/[^a-zA-Z0-9_]/g, "");
}

// ===== Helpers: time handling =====
// Trả về chuỗi giờ VN, nếu input hợp lệ thì dùng input, nếu không thì fallback giờ hiện tại
function formatVNMaybe(input) {
  const now = moment();
  if (!input) {
    return now.tz("Asia/Ho_Chi_Minh").format("HH:mm:ss DD/MM/YYYY");
  }
  const m = moment(input);
  if (!m.isValid()) {
    return now.tz("Asia/Ho_Chi_Minh").format("HH:mm:ss DD/MM/YYYY");
  }
  return m.tz("Asia/Ho_Chi_Minh").format("HH:mm:ss DD/MM/YYYY");
}
// Lấy giờ VN hiện tại
function getTimeVN(date = new Date()) {
  return moment(date).tz("Asia/Ho_Chi_Minh").format("HH:mm:ss DD/MM/YYYY");
}

// ===== GitHub sync =====
async function saveLogsToGitHub(filename, content) {
  if (!GITHUB_TOKEN) {
    console.warn("⚠️ Chưa có GITHUB_TOKEN — bỏ qua đồng bộ GitHub:", filename);
    return;
  }

  const apiUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/${encodeURI(filename)}`;
  const headers = { Authorization: `token ${GITHUB_TOKEN}`, "User-Agent": "simple-backend" };
  const encoded = Buffer.from(content, "utf8").toString("base64");

  let sha;
  try {
    const res = await axios.get(apiUrl, { headers });
    sha = res.data && res.data.sha ? res.data.sha : undefined;
  } catch (err) {
    // file chưa tồn tại -> sẽ tạo mới (sha undefined)
    sha = undefined;
  }

  try {
    await axios.put(
      apiUrl,
      {
        message: `Update ${filename}`,
        content: encoded,
        sha,
      },
      { headers }
    );
    console.log(`✅ Đồng bộ GitHub thành công: ${filename}`);
  } catch (err) {
    console.error(`❌ Lỗi đồng bộ GitHub (${filename}):`, err.response?.data || err.message);
  }
}

// ===== Logging functions =====
// Tổng: prepend (log mới lên đầu)
function prependLog(line) {
  const file = path.join(LOG_DIR, "logins.txt");
  let oldContent = "";
  if (fs.existsSync(file)) oldContent = fs.readFileSync(file, "utf8");
  const newContent = line + oldContent;
  fs.writeFileSync(file, newContent, { encoding: "utf8" });
  // đồng bộ vào folder logs/ trên GitHub
  saveLogsToGitHub("logs/logins.txt", newContent).catch((e) => console.error(e.message));
}

// Cá nhân: gom theo tên rút gọn (bỏ 3 số cuối), append (thêm xuống cuối)
function appendUserLog(originalUser, line) {
  const short = shortenUser(originalUser); // bỏ 3 số cuối nếu có
  const safe = safeUsernameForFile(short);
  if (!safe) return;
  const file = path.join(LOG_DIR, `${safe}.txt`);
  let old = "";
  if (fs.existsSync(file)) old = fs.readFileSync(file, "utf8");
  // Trong file cá nhân, dùng tên rút gọn (short) thay vì originalUser để không lộ 3 số
  const lineForPersonal = line.replace(new RegExp(originalUser, "g"), short);
  const newContent = old + lineForPersonal;
  fs.writeFileSync(file, newContent, { encoding: "utf8" });
  saveLogsToGitHub(`logs/${safe}.txt`, newContent).catch((e) => console.error(e.message));
}

// ===== Routes =====
app.get("/health", (req, res) => res.json({ status: "ok", time: new Date().toISOString() }));
app.get("/", (req, res) => res.send("✅ Backend đang chạy (auto-handles times + personal shortnames)."));
app.get("/time-test", (req, res) => res.send("⏰ Giờ Việt Nam hiện tại: " + getTimeVN()));

// /log-login: giữ nguyên tên trong log tổng; personal log dùng tên rút gọn
app.post("/log-login", (req, res) => {
  try {
    const { user } = req.body;
    const ip = req.headers["x-forwarded-for"]?.toString().split(",")[0].trim() || req.socket.remoteAddress;
    const nowVN = getTimeVN();

    const logLine = `📌 Học sinh ${user} vừa đăng nhập thành công
🕒 Lúc: ${nowVN}
🌐 IP: ${ip}
----------------------------------------
`;

    prependLog(logLine);
    appendUserLog(user, logLine);
    res.json({ ok: true });
  } catch (e) {
    console.error("❌ /log-login error:", e);
    res.status(500).json({ ok: false, error: "write_failed" });
  }
});

// /log-submit: dùng startTime/endTime nếu frontend gửi hợp lệ, ngược lại fallback về giờ server (VN)
// log tổng ghi original user; log cá nhân gom theo tên rút gọn và hiển thị tên rút gọn trong nội dung cá nhân
app.post("/log-submit", (req, res) => {
  try {
    const { user, unit, correct, total, score, startTime, endTime } = req.body;
    const ip = req.headers["x-forwarded-for"]?.toString().split(",")[0].trim() || req.socket.remoteAddress;

    const startVN = formatVNMaybe(startTime);
    const endVN = formatVNMaybe(endTime);

    const logLine = `✅ Học sinh ${user} vừa báo cáo:
📝 Thẻ: ${unit}
📊 Thực hành: ${correct}/${total} câu đạt ${score} điểm
🕒 Đăng nhập: ${startVN} kết thúc lúc ${endVN}
🌐 IP: ${ip}
----------------------------------------
`;

    prependLog(logLine);        // tổng: giữ nguyên user
    appendUserLog(user, logLine); // cá nhân: gom theo tên rút gọn, hiển thị shortname trong file cá nhân
    res.json({ ok: true });
  } catch (e) {
    console.error("❌ /log-submit error:", e);
    res.status(500).json({ ok: false, error: "write_failed" });
  }
});

// /get-logs: trả log tổng (local)
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

// /:username.txt -> chuyển request thành shortname, trả nội dung file cá nhân
app.get("/:username.txt", (req, res) => {
  const raw = req.params.username || "";
  const short = shortenUser(raw);
  const safe = safeUsernameForFile(short);
  const file = path.join(LOG_DIR, `${safe}.txt`);
  res.type("text/plain; charset=utf-8");
  if (!safe) return res.status(404).send("Tên học sinh không hợp lệ.");
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, "utf8");
    res.send(content);
  } else {
    res.send(`Chưa có log nào cho ${safe}.`);
  }
});

// ===== Start =====
const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server chạy ở cổng ${PORT}`);
});
