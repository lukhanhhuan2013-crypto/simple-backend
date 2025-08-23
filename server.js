const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const moment = require("moment-timezone");
const bodyParser = require("body-parser");
const { google } = require("googleapis");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// === Google Drive config ===
const SCOPES = ["https://www.googleapis.com/auth/drive.file"];
const FOLDER_ID = "1AN893uuTEf_8DjOfZRWLk_fGwRv1HuzN";

const credentials = {
  "type": "service_account",
  "project_id": "studentlogdrive",
  "private_key_id": "7bf9e340d066a699928b7ee03482584249341e1c",
  "private_key": `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDlTw0SDwv0cqKd
... (rút gọn cho dễ nhìn, bạn thay full key vào đây) ...
-----END PRIVATE KEY-----`,
  "client_email": "student-logger@studentlogdrive.iam.gserviceaccount.com",
  "client_id": "101463262477754521378",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/student-logger%40studentlogdrive.iam.gserviceaccount.com",
  "universe_domain": "googleapis.com"
};

const auth = new google.auth.GoogleAuth({ credentials, scopes: SCOPES });
const drive = google.drive({ version: "v3", auth });

// === Local logs folder ===
const LOG_DIR = path.join(__dirname, "logs");
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR);

// Ghi log ra file cục bộ
function prependLog(line) {
  const file = path.join(LOG_DIR, "logins.txt");
  let oldContent = "";
  if (fs.existsSync(file)) oldContent = fs.readFileSync(file, "utf8");
  fs.writeFileSync(file, line + oldContent, { encoding: "utf8" });
}

// Hàm giờ VN
function getTimeVN(date = new Date()) {
  return moment(date).tz("Asia/Ho_Chi_Minh").format("HH:mm:ss DD/MM/YYYY");
}

// Ghi backup lên Google Drive
async function saveLogToDrive(username, logText) {
  try {
    const safeName = `${username}.txt`;
    const res = await drive.files.list({
      q: `'${FOLDER_ID}' in parents and name='${safeName}' and trashed=false`,
      fields: "files(id, name)"
    });

    if (res.data.files.length > 0) {
      const fileId = res.data.files[0].id;
      const contentRes = await drive.files.get(
        { fileId, alt: "media" },
        { responseType: "text" }
      );
      const oldContent = contentRes.data || "";
      const newContent = logText + "\n" + oldContent;

      await drive.files.update({
        fileId,
        media: { mimeType: "text/plain", body: newContent }
      });
    } else {
      const fileMetadata = { name: safeName, parents: [FOLDER_ID] };
      const media = { mimeType: "text/plain", body: logText };
      await drive.files.create({ resource: fileMetadata, media, fields: "id" });
    }
  } catch (err) {
    console.error("⚠️ Drive ghi lỗi, bỏ qua:", err.message);
    // Không throw -> vẫn trả ok cho frontend
  }
}

// Trang mặc định
app.get("/", (req, res) => {
  res.send("✅ Backend đang chạy!");
});

// Xem log cục bộ
app.get("/get-logs", (req, res) => {
  const file = path.join(LOG_DIR, "logins.txt");
  if (fs.existsSync(file)) {
    res.type("text/plain").send(fs.readFileSync(file, "utf8"));
  } else {
    res.type("text/plain").send("Chưa có log nào.");
  }
});

// API log đăng nhập
app.post("/log-login", async (req, res) => {
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
    await saveLogToDrive(user, logLine);
    res.json({ ok: true });
  } catch {
    res.json({ ok: true }); // vẫn trả ok
  }
});

// API log báo cáo điểm
app.post("/log-submit", async (req, res) => {
  const { user, unit, correct, total, score } = req.body;
  const ip =
    req.headers["x-forwarded-for"]?.toString().split(",")[0].trim() ||
    req.socket.remoteAddress;

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
    await saveLogToDrive(user, logLine);
    res.json({ ok: true });
  } catch {
    res.json({ ok: true }); // vẫn trả ok
  }
});

// Start server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Server chạy ở cổng ${PORT}`);
});
