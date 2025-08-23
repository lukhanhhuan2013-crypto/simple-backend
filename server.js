const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const moment = require("moment-timezone");
const { google } = require("googleapis");

const app = express();
app.use(express.json());
app.use(cors());

// =================== Cấu hình Google Drive ===================
const SCOPES = ["https://www.googleapis.com/auth/drive.file"];
const FOLDER_ID = "1AN893uuTEf_8DjOfZRWLk_fGwRv1HuzN";

// Nhúng credentials trực tiếp
const credentials = {
  type: "service_account",
  project_id: "studentlogdrive",
  private_key_id: "7bf9e340d066a699928b7ee03482584249341e1c",
  private_key: "-----BEGIN PRIVATE KEY-----\\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDlTw0SDwv0cqKd\\nLb5sspKSOwSV3FCrBXhVnS0Sfo5/+WLC2PQPv/CUQDftISvSwmEdDqKskkyk+r7S\\ntSQQ+j65AhsToJ5/rsk7qyJxlnx9FDguhRc4U+fi32DjspHF32lFyEMkarJcVSDC\\nN71jiMSK1mrpuCrCfeSe1M2ZzowNw1wE++/u24RURCjAnVg/5se/QxV6H/h6fFEv\\nZLNlABBVzo3/K5HawwWoOS4IN2zttLAAoOtWUwtZAHPg2l3nOyFTkftDPWRPCnNX\\nu1HoIZIWBF5xEIMIxCACC3XCRouLH7K7AfoshSXMVvI0DrvddkGW4P3PkDQnijPo\\nS88de2/hAgMBAAECggEARxdQ+A5OKIT5wT0TUmOyaT9+1m8tWzgg7HoEJT2zNB2+\\n7qWQVOmuzmdyb0PfcEHvFbEZ4eKhfGx4iJ68Bb9vfrAWcOlU+kTYAnW2Af0jryt7\\nl4CPiFkLBR03zp/n7a6r1oSVvE6P6WxC8bOSNa+LL3f2QWtlZlLddBiJfWu5o/Ic\\n0OgD+Hv3OQYSWrCW6/H27yyUVhOYWbs2F+MlmolGm+Qc0XgRBvcBEouV3y7GEPWL\\nGiHliqutRu4/lUMpa2CJDVWuqAphVFc3V5DCqE3z9i1xTq1oXI0GWt0EcwJb3QZM\\nlh899+pinkV75rXxuyNXqfJezIgmlZG9NvzC8j77WQKBgQD82TWW8F/hkG4Z7IXh\\nx/ndys9VNXjWstZke8XFOkTJH4UPjssbRrUp/cv0X1wJqAuIlc1N7btRN468XBWN\\ndHR/8+DBJq7oHeNW5dj6u/7TrcRZQJdt6kgmnw4bmveTgrIVY5ehRwTwL8d5jD/E\\nyjZzKctH8Sq04POEjoATzqU+mwKBgQDoKrssXBlpmbY2vBCWl0MiicodhctDLW8K\\n7U/JIL3Vhe7eQImOmwI9nwc9AF26ai30JAd0Ocg8h47QzLqMrjjAsr1y455EkWhH\\n1AjERaequZNpTgXVNs8yNmuB0SRLoHqY4DmI9lRbGZKx1JB9jOXpBTZ1zPjF8C0Q\\nj4Vms3vVMwKBgEa0Hm4krUsP7hnFr/JgzxgcHDoBh9bRj23txnHOR2nOLJEbJuRr\\ns0EYvS2KdNwmZ4M8EHrYHWcql/lH7qbth543/gNE4+f4Y5frEe+bHjjnAF7M1wtf\\nVemm1HUXsl9HTrD4dnAcwd7AHZF5jGNlADDX4QYvA/gsZywMBPiE8mQ9AoGARzG7\\nXhoMDO7/Cn/XUmamRrQcT7tUnpATKjWlrtakgBLnMi52QE3WfREERjeThnPDDcfy\\npTiG59DmAa+WUUenzafCIrYcNYilgslJuu5lQRxRUQyFC2IYXZyEkTWSPMLEdZbk\\n7dQkAB+ydWfquyV252Ma1Tr62rAREbABR4IoqjMCgYEAnhA+p5J7qoH1j3zaF2Hz\\nKQXZsbP2yZaW7zUZk1l3a/a5OO/QL7gLjkv8Ncrkyw6KRQZxe2/txrXrIRuu8oyf\\nnreWIlNbCi0aCnWlUivyV+d7QlAh5fJThM1OAjyekTLO9u6swzfEQizfK7sKUA+8\\nfjfGvdZicRwzCxEjjw/r4mg=\\n-----END PRIVATE KEY-----\\n",
  client_email: "student-logger@studentlogdrive.iam.gserviceaccount.com",
  client_id: "101463262477754521378",
  token_uri: "https://oauth2.googleapis.com/token"
};

const auth = new google.auth.GoogleAuth({ credentials, scopes: SCOPES });
const drive = google.drive({ version: "v3", auth });

// Hàm lưu log vào Drive
async function saveLogToDrive(username, logText) {
  const safeName = `${username}.txt`;
  const res = await drive.files.list({
    q: `'${FOLDER_ID}' in parents and name='${safeName}' and trashed=false`,
    fields: "files(id, name)"
  });

  if (res.data.files.length > 0) {
    const fileId = res.data.files[0].id;
    const contentRes = await drive.files.get({ fileId, alt: "media" }, { responseType: "text" });
    const oldContent = contentRes.data || "";
    const newContent = logText + oldContent;
    await drive.files.update({
      fileId,
      media: { mimeType: "text/plain", body: newContent }
    });
  } else {
    const fileMetadata = { name: safeName, parents: [FOLDER_ID] };
    const media = { mimeType: "text/plain", body: logText };
    await drive.files.create({ resource: fileMetadata, media, fields: "id" });
  }
}

// =================== Cấu hình log cục bộ ===================
const LOG_DIR = path.join(__dirname, "logs");
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR);

function prependLog(line) {
  const file = path.join(LOG_DIR, "logins.txt");
  let oldContent = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  fs.writeFileSync(file, line + oldContent, { encoding: "utf8" });
}

// Hàm lấy thời gian VN
function getTimeVN(date = new Date()) {
  return moment(date).tz("Asia/Ho_Chi_Minh").format("HH:mm:ss DD/MM/YYYY");
}

// =================== API ===================
app.get("/", (req, res) => {
  res.send("✅ Backend đang chạy!");
});

app.post("/log-login", async (req, res) => {
  const { user } = req.body;
  const ip = req.headers["x-forwarded-for"]?.toString().split(",")[0].trim() || req.socket.remoteAddress;
  const logLine = `📌 Học sinh ${user} vừa đăng nhập thành công\n🕒 Lúc: ${getTimeVN()}\n🌐 IP: ${ip}\n----------------------------------------\n`;

  try {
    prependLog(logLine);
    await saveLogToDrive(user, logLine);
    res.json({ ok: true });
  } catch (e) {
    console.error("❌ Lỗi khi ghi log:", e);
    res.status(500).json({ ok: false });
  }
});

app.post("/log-submit", async (req, res) => {
  const { user, unit, correct, total, score } = req.body;
  const ip = req.headers["x-forwarded-for"]?.toString().split(",")[0].trim() || req.socket.remoteAddress;
  const startVN = getTimeVN();
  const endVN = getTimeVN();
  const logLine = `✅ Học sinh ${user} vừa báo cáo:\n📝 Thẻ: ${unit}\n📊 Thực hành: ${correct}/${total} câu đạt ${score} điểm\n🕒 Đăng nhập: ${startVN} kết thúc lúc ${endVN}\n🌐 IP: ${ip}\n----------------------------------------\n`;

  try {
    prependLog(logLine);
    await saveLogToDrive(user, logLine);
    res.json({ ok: true });
  } catch (e) {
    console.error("❌ Lỗi khi ghi log:", e);
    res.status(500).json({ ok: false });
  }
});

app.get("/get-logs", (req, res) => {
  const file = path.join(LOG_DIR, "logins.txt");
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, "utf8");
    res.type("text/plain").send(content);
  } else {
    res.type("text/plain").send("Chưa có log nào.");
  }
});

// =================== Start server ===================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Server chạy ở cổng ${PORT}`);
});
