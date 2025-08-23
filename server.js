const express = require("express");
const bodyParser = require("body-parser");
const moment = require("moment-timezone");
const { google } = require("googleapis");
const cors = require("cors");
const stream = require("stream");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// === Bộ nhớ tạm trên server để xem logs qua API ===
let allLogs = [];

// === Config Google Drive ===
const SCOPES = ["https://www.googleapis.com/auth/drive.file"];
const FOLDER_ID = "1AN893uuTEf_8DjOfZRWLk_fGwRv1HuzN";

// Service Account credentials
const credentials = {
  type: "service_account",
  project_id: "studentlogdrive",
  private_key_id: "7bf9e340d066a699928b7ee03482584249341e1c",
  private_key: `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDlTw0SDwv0cqKd
... (toàn bộ private key của bạn) ...
-----END PRIVATE KEY-----`,
  client_email: "student-logger@studentlogdrive.iam.gserviceaccount.com",
  client_id: "101463262477754521378",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/student-logger%40studentlogdrive.iam.gserviceaccount.com",
  universe_domain: "googleapis.com"
};

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: SCOPES,
});
const drive = google.drive({ version: "v3", auth });

// === Hàm lưu log vào Google Drive ===
async function saveLogToDrive(username, logText) {
  const safeName = `${username}.txt`;

  const res = await drive.files.list({
    q: `'${FOLDER_ID}' in parents and name='${safeName}' and trashed=false`,
    fields: "files(id, name)",
  });

  if (res.data.files.length > 0) {
    const fileId = res.data.files[0].id;

    // Lấy nội dung cũ
    const contentRes = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "stream" }
    );

    let oldContent = "";
    await new Promise((resolve, reject) => {
      contentRes.data.on("data", (chunk) => (oldContent += chunk.toString()));
      contentRes.data.on("end", resolve);
      contentRes.data.on("error", reject);
    });

    // Thêm log mới lên đầu
    const newContent = logText + "\n" + oldContent;
    const bufferStream = new stream.PassThrough();
    bufferStream.end(Buffer.from(newContent, "utf-8"));

    await drive.files.update({
      fileId,
      media: {
        mimeType: "text/plain",
        body: bufferStream,
      },
    });
  } else {
    // Tạo mới file
    const bufferStream = new stream.PassThrough();
    bufferStream.end(Buffer.from(logText, "utf-8"));

    const fileMetadata = { name: safeName, parents: [FOLDER_ID] };
    await drive.files.create({
      resource: fileMetadata,
      media: {
        mimeType: "text/plain",
        body: bufferStream,
      },
      fields: "id",
    });
  }
}

// === API log đăng nhập ===
app.post("/log-login", async (req, res) => {
  const { user } = req.body;
  const clientIp = req.headers["x-forwarded-for"]?.split(",")[0] || req.ip;
  const timeVN = moment().tz("Asia/Ho_Chi_Minh").format("HH:mm:ss DD/MM/YYYY");

  const logLine = `📌 Học sinh ${user} đăng nhập thành công\n🕒 Lúc: ${timeVN}\n🌐 IP: ${clientIp}\n`;

  try {
    await saveLogToDrive(user, logLine);
    allLogs.unshift({ type: "login", user, timeVN, ip: clientIp, log: logLine });
    res.json({ ok: true, message: "Đã ghi log vào Google Drive" });
  } catch (err) {
    console.error("❌ Lỗi khi ghi Drive:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// === API log báo cáo điểm ===
app.post("/log-submit", async (req, res) => {
  const { user, unit, correct, total, score, startTime, endTime, details } = req.body;
  const clientIp = req.headers["x-forwarded-for"]?.split(",")[0] || req.ip;
  const timeVN = moment().tz("Asia/Ho_Chi_Minh").format("HH:mm:ss DD/MM/YYYY");

  const logLine = `📘 Unit: ${unit}\n👤 Học sinh: ${user}\n🕒 Từ ${startTime} → ${endTime} (ghi lúc ${timeVN})\n✅ Kết quả: ${correct}/${total} (${score})\n🧾 Chi tiết: ${details}\n🌐 IP: ${clientIp}\n-------------------------\n`;

  try {
    await saveLogToDrive(user, logLine);
    allLogs.unshift({ type: "submit", user, unit, timeVN, ip: clientIp, log: logLine });
    res.json({ ok: true, message: "Đã ghi báo cáo vào Google Drive" });
  } catch (err) {
    console.error("❌ Lỗi khi ghi Drive:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// === API xem toàn bộ logs (từ RAM) ===
app.get("/get-logs", (req, res) => {
  res.json({ ok: true, logs: allLogs });
});

// === Khởi động server ===
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Server chạy ở cổng ${PORT}`);
});
