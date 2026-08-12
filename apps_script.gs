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

// ★「腐世界お便りBOX」スプレッドシートのID
var SPREADSHEET_ID = "1OAcUhNCdSCPtG5V1x1uX9yACcamlZH93Q9V8Zi0qfBY";

// 腐便り・語りたいを1本化する統合タブ
var UNIFIED_SHEET_NAME = "お便り一覧";
var UNIFIED_HEADERS = ["番号", "送信日時", "種別", "ラジオネーム", "作品名", "作者名", "対象", "カテゴリ", "本文", "使用可否"];

// =============================================
// メインの受信処理
// =============================================
function doPost(e) {
  try {
    var raw = (e.parameter && e.parameter.payload) ? e.parameter.payload : e.postData.contents;
    var data = JSON.parse(raw);
    var type = data.type; // "letter" / "talk" / "recommend"

    // 保存とメール送信を個別にtry/catchすることで、片方が失敗しても
    // もう片方は実行される（＝サイレントに両方消える事故を防ぐ）
    if (type === "letter") {
      safeRun_(function () { saveLetter(data); }, "letter/save", raw);
      safeRun_(function () { sendLetterMail(data); }, "letter/mail", raw);
    } else if (type === "talk") {
      safeRun_(function () { saveTalk(data); }, "talk/save", raw);
      safeRun_(function () { sendTalkMail(data); }, "talk/mail", raw);
    } else if (type === "recommend") {
      safeRun_(function () { saveRecommend(data); }, "recommend/save", raw);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ status: "ok" }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    logError_("doPost", err, e && e.postData ? e.postData.contents : "");
    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// 関数を実行し、失敗してもエラーログに記録して処理を継続する
function safeRun_(fn, label, rawPayload) {
  try {
    fn();
  } catch (err) {
    logError_(label, err, rawPayload);
  }
}

// エラーログシートに記録（ログ自体の失敗は握りつぶす＝doPostの応答を止めない）
function logError_(label, err, rawPayload) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName("エラーログ");
    if (!sheet) {
      sheet = ss.insertSheet("エラーログ");
      sheet.appendRow(["発生日時", "箇所", "エラー内容", "生データ"]);
    }
    sheet.appendRow([new Date(), label, err && err.message, rawPayload]);
  } catch (e2) {
    // 何もしない
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

// 語りたいの「対象」を読みやすい表記に変換
function formatTarget_(target) {
  if (target === "この作品") return "既読（この作品について）";
  if (target === "未読作品") return "未読（作品紹介）";
  return target || "";
}

// 「―」を空欄に統一
function normalizeDash_(v) {
  return (v === "―" || v === "-") ? "" : (v || "");
}

// 統合タブを取得（なければ作成。ヘッダー行は毎回書き直して常に最新の列構成に揃える）
function getUnifiedSheet_() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(UNIFIED_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(UNIFIED_SHEET_NAME);
  }
  sheet.getRange(1, 1, 1, UNIFIED_HEADERS.length).setValues([UNIFIED_HEADERS]);
  return sheet;
}

// =============================================
// 腐便り：スプレッドシート保存（お便り一覧タブに統合保存）
// =============================================
function saveLetter(data) {
  var sheet = getUnifiedSheet_();
  var num = sheet.getLastRow(); // ヘッダー行数を引いた既存件数+1と一致する
  sheet.appendRow([
    num,
    new Date(),
    "腐便り",
    data.radioName || "（匿名）",
    "", "", "",
    data.categories || "",
    data.body || "",
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
// 語りたい：スプレッドシート保存（お便り一覧タブに統合保存）
// =============================================
function saveTalk(data) {
  var sheet = getUnifiedSheet_();
  var num = sheet.getLastRow();
  sheet.appendRow([
    num,
    new Date(),
    "語りたい",
    data.radioName || "（匿名）",
    data.title  || "",
    data.author || "",
    formatTarget_(data.target),
    "",
    data.body || "",
    ""
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
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
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

// =============================================
// 復旧用：Gmailに残っている全履歴から「お便り一覧」タブを作り直す
// ★ スプレッドシートのメニュー「拡張機能 > Apps Script」のエディタで
//    この関数を選択して▶ボタンを押すと実行できる（何度実行しても安全。
//    毎回ヘッダー以外を全部クリアしてから、番号1番から振り直す）
// =============================================
function rebuildFromGmail() {
  var sheet = getUnifiedSheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, UNIFIED_HEADERS.length).clearContent();
  }

  var rows = [];
  rows = rows.concat(searchAndParse_('subject:"【腐便り】"', "letters"));
  rows = rows.concat(searchAndParse_('subject:"【語りたい】"', "talks"));

  // 送信日時の古い順に並べてから、1番から番号を振る
  rows.sort(function (a, b) { return a[0] - b[0]; });
  var numberedRows = rows.map(function (r, idx) { return [idx + 1].concat(r); });

  if (numberedRows.length > 0) {
    sheet.getRange(2, 1, numberedRows.length, UNIFIED_HEADERS.length).setValues(numberedRows);
  }

  try {
    Browser.msgBox("Gmailから" + numberedRows.length + "件を復元しました！（腐便り＋語りたい合計）");
  } catch (e) {
    // スクリプトエディタから直接実行するとポップアップが出せないことがある。
    // ここまでの書き込みはもう完了しているので、失敗しても無視してOK。
  }
}

// Gmail検索してヒットした全メッセージ本文をパースする（100件ずつページング）
function searchAndParse_(query, kind) {
  var results = [];
  var start = 0;
  var pageSize = 100;
  while (true) {
    var threads = GmailApp.search(query, start, pageSize);
    if (threads.length === 0) break;
    for (var i = 0; i < threads.length; i++) {
      var messages = threads[i].getMessages();
      for (var j = 0; j < messages.length; j++) {
        var text = messages[j].getPlainBody();
        results.push(kind === "letters" ? parseLetterText_(text) : parseTalkText_(text));
      }
    }
    if (threads.length < pageSize) break;
    start += pageSize;
  }
  return results;
}

function parseLetterText_(text) {
  var radioName  = extractField_(text, "ラジオネーム");
  var categories = extractField_(text, "カテゴリ");
  var radioOk    = extractField_(text, "使用可否");
  var body       = extractBody_(text);
  var dateStr    = extractField_(text, "送信日時");
  return [
    parseDate_(dateStr),
    "腐便り",
    radioName || "（匿名）",
    "", "", "",
    normalizeDash_(categories),
    body,
    radioOk || "未選択"
  ];
}

function parseTalkText_(text) {
  var radioName = extractField_(text, "ラジオネーム");
  var title     = normalizeDash_(extractField_(text, "作品名"));
  var author    = normalizeDash_(extractField_(text, "作者名"));
  var target    = extractField_(text, "対象");
  var body      = extractBody_(text);
  var dateStr   = extractField_(text, "送信日時");
  return [
    parseDate_(dateStr),
    "語りたい",
    radioName || "（匿名）",
    title,
    author,
    formatTarget_(target),
    "",
    body,
    ""
  ];
}

// 本文中の「ラベル：値」の値部分を1行分だけ取り出す
function extractField_(text, label) {
  var re = new RegExp(label + "[：:]\\s*(.*)");
  var m = text.match(re);
  return m ? m[1].trim() : "";
}

// ━━━━の区切り線に挟まれた本文ブロックを取り出す
function extractBody_(text) {
  var m = text.match(/━+\s*\n([\s\S]*?)\n━+/);
  return m ? m[1].trim() : "";
}

// 「送信日時：2026/8/11 12:48:04」形式の文字列をDateに変換（失敗時は現在時刻）
function parseDate_(dateStr) {
  var d = new Date(dateStr);
  return isNaN(d.getTime()) ? new Date() : d;
}
