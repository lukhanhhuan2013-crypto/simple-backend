const express = require("express");
const bodyParser = require("body-parser");
const moment = require("moment-timezone");
const { google } = require("googleapis");
const path = require("path");

const app = express();
app.use(bodyParser.json());

// === Cấu hình Google Drive ===
const KEYFILEPATH = path.join(__dirname, "credentials.json"); // file JSON key
const SCOPES = ["https://www.googleapis.com/auth/drive.file"];
const FOLDER_ID = "1AN893uuTEf_8DjOfZRWLk_fGwRv1HuzN"; // Folder ID Google Drive

const auth = new google.auth.GoogleAuth({
  keyFile: KEYFILEPATH,
  scopes: SCOPES,
});
const drive = google.drive({ version: "v3", auth });

// === Hàm lưu log vào Drive ===
async function saveLogToDrive(username, logText) {
  const safeName = `${username}.txt`;

  // Kiểm tra file đã tồn tại chưa
  const res = await drive.files.list({
    q: `'${FOLDER_ID}' in parents and name='${safeName}' and trashed=false`,
    fields: "files(id, name)",
  });

  if (res.data.files.length > 0) {
    const fileId = res.data.files[0].id;

    // Lấy nội dung cũ
    const contentRes = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "text" }
    );
    const oldContent = contentRes.data || "";

    // Ghi thêm log mới (prepend lên đầu)
    const newContent = logText + "\n" + oldContent;
    const media = {
      mimeType: "text/plain",
      body: newContent,
    };
    await drive.files.update({
      fileId,
      media,
    });
  } else {
    // Nếu chưa có file thì tạo mới
    const fileMetadata = {
      name: safeName,
      parents: [FOLDER_ID],
    };
    const media = {
      mimeType: "text/plain",
      body: logText,
    };
    await drive.files.create({
      resource: fileMetadata,
      media,
      fields: "id",
    });
  }
}

// === API log đăng nhập ===
app.post("/log-login", async (req, res) => {
  const { user, ip } = req.body;
  const timeVN = moment().tz("Asia/Ho_Chi_Minh").format("HH:mm:ss DD/MM/YYYY");
  const logLine = `📌 Học sinh ${user} đăng nhập thành công\n🕒 Lúc: ${timeVN}\n🌐 IP: ${ip}\n`;

  try {
    await saveLogToDrive(user, logLine);
    res.json({ ok: true, message: "Đã ghi log vào Google Drive" });
  } catch (err) {
    console.error("❌ Lỗi khi ghi Drive:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// === Khởi động server ===
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Server chạy ở cổng ${PORT}`);
});
