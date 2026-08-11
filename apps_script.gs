// =============================================
// けんしの腐世界生活 - スプレッドシート管理スクリプト
// =============================================
// ★ 以下2関数はBL既読リストのスプレッドシートにバインドされたスクリプトにコピーして使う

function fillMissingImageUrls() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const lastRow = sheet.getLastRow();
  const folder = DriveApp.getFolderById("1mA7LNSRtsDKpgYvkffdNu7KZW728cOnE");
  let count = 0;

  for (let i = 2; i <= lastRow; i++) {
    const title = sheet.getRange(i, 1).getValue();
    const currentUrl = sheet.getRange(i, 6).getValue();
    if (!title || currentUrl) continue;

    const files = folder.getFilesByName(title + ".JPG");
    if (files.hasNext()) {
      const file = files.next();
      const url = "https://drive.google.com/thumbnail?id=" + file.getId() + "&sz=w200";
      sheet.getRange(i, 6).setValue(url);
      count++;
    }
  }
  Browser.msgBox(count + "件の画像URLを追加しました！");
}

function updateEscapeJourney() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const lastRow = sheet.getLastRow();
  const data = sheet.getRange(1, 1, lastRow, 1).getValues();

  for (let i = 0; i < data.length; i++) {
    if (data[i][0] === "エスケープジャーニー") {
      const row = i + 1;
      sheet.getRange(row, 9).setValue("大学生,再会,元カレ");
      sheet.getRange(row, 10).setValue("シリアス");
      sheet.getRange(row, 11).setValue("コミュ障,一途,同級生");
      sheet.getRange(row, 12).setValue("チャラ男,コミュ力高,強がり");
      break;
    }
  }
  Browser.msgBox("エスケープジャーニーのタグを更新しました！");
}

// =============================================
// けんしの腐世界生活 - お便り受信スクリプト
// =============================================
var MAIL_TO = "kenkenkenshi365@gmail.com";

// =============================================
// メインの受信処理
// =============================================
function doPost(e) {
  try {
    var raw = (e.parameter && e.parameter.payload) ? e.parameter.payload : e.postData.contents;
    var data = JSON.parse(raw);
    var type = data.type; // "letter" / "talk" / "recommend"

    if (type === "letter") {
      saveLetter(data);
      sendLetterMail(data);
    } else if (type === "talk") {
      saveTalk(data);
      sendTalkMail(data);
    } else if (type === "recommend") {
      saveRecommend(data);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ status: "ok" }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// 絵文字（サロゲートペア）をHTMLエンティティに変換
function toHtmlSafe(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, function(pair) {
      var high = pair.charCodeAt(0);
      var low  = pair.charCodeAt(1);
      var cp   = 0x10000 + (high - 0xD800) * 0x400 + (low - 0xDC00);
      return '&#' + cp + ';';
    });
}

// =============================================
// 腐便り：スプレッドシート保存
// =============================================
function saveLetter(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("腐便り");
  if (!sheet) {
    sheet = ss.insertSheet("腐便り");
    sheet.appendRow(["送信日時", "ラジオネーム", "カテゴリ", "本文", "使用可否"]);
  }
  sheet.appendRow([
    new Date(),
    data.radioName || "（匿名）",
    data.categories || "",
    data.body,
    data.radioOk === "yes" ? "使用OK" : data.radioOk === "no" ? "使用NG" : "未選択"
  ]);
}

// =============================================
// 腐便り：Gmail通知
// =============================================
function sendLetterMail(data) {
  var radioName  = data.radioName || "（匿名）";
  var categories = data.categories || "―";
  var radioOk    = data.radioOk === "yes" ? "使用OK" : data.radioOk === "no" ? "使用NG" : "未選択";

  var subject = "【腐便り】" + radioName + " さんからお便りが届いたよ";
  var lines = [
    "ラジオネーム：" + radioName,
    "カテゴリ：" + categories,
    "使用可否：" + radioOk,
    "",
    "━━━━━━━━━━━━━━━━",
    data.body,
    "━━━━━━━━━━━━━━━━",
    "",
    "送信日時：" + new Date().toLocaleString("ja-JP")
  ];
  var body     = lines.join("\n");
  var htmlBody = lines.map(toHtmlSafe).join("<br>");

  GmailApp.sendEmail(MAIL_TO, subject, body, { htmlBody: htmlBody });
}

// =============================================
// 語りたい：スプレッドシート保存
// =============================================
function saveTalk(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("語りたい");
  if (!sheet) {
    sheet = ss.insertSheet("語りたい");
    sheet.appendRow(["送信日時", "ラジオネーム", "作品名", "作者名", "対象", "内容"]);
  }
  sheet.appendRow([
    new Date(),
    data.radioName || "（匿名）",
    data.title  || "",
    data.author || "",
    data.target || "",
    data.body   || ""
  ]);
}

// =============================================
// 語りたい：Gmail通知
// =============================================
function sendTalkMail(data) {
  var radioName = data.radioName || "（匿名）";
  var target    = data.target || "未選択";

  var subject = "【語りたい】" + (data.title || data.author || "作品/作者") + " について届いたよ";
  var lines = [
    "ラジオネーム：" + radioName,
    "作品名：" + (data.title || "―"),
    "作者名：" + (data.author || "―"),
    "対象：" + target,
    "",
    "━━━━━━━━━━━━━━━━",
    data.body || "（本文なし）",
    "━━━━━━━━━━━━━━━━",
    "",
    "送信日時：" + new Date().toLocaleString("ja-JP")
  ];
  var body     = lines.join("\n");
  var htmlBody = lines.map(toHtmlSafe).join("<br>");

  GmailApp.sendEmail(MAIL_TO, subject, body, { htmlBody: htmlBody });
}

// =============================================
// おすすめ：スプレッドシート保存のみ
// =============================================
function saveRecommend(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("おすすめ");
  if (!sheet) {
    sheet = ss.insertSheet("おすすめ");
    sheet.appendRow(["送信日時", "作品名", "作者名"]);
  }
  sheet.appendRow([
    new Date(),
    data.title  || "",
    data.author || ""
  ]);
}
