// =============================================
// けんしの腐世界生活 - プレゼント予約スクリプト
// =============================================
// ★ 予約用スプレッドシートにバインドしたスクリプトに貼り付け、ウェブアプリとして公開する
// ★ お便りのスクリプトとは別物。個人情報は受け取らない（名前欄なし）

/**
 * @OnlyCurrentDoc
 */

var SHEET_NAME = "予約";
var HEADERS = ["予約番号", "予約日時", "作品名", "巻", "状態", "持ち主キー", "照合キー"];
var STATE_ON = "予約中";
var STATE_OFF = "取り消し";
var EXPIRE_DAYS = 30;
var MAX_TITLE = 100;
var MAX_ITEMS = 10;        // 1回で予約できる作品数
var MAX_PER_OWNER = 30;    // 1人が同時に持てる予約数
var MAX_ACTIVE = 2000;     // 全体で同時に持てる予約数
var RATE_LIMIT = 40;       // 10分あたりの予約作品数（いたずらの歯止め）
var NEAR_MIN = 3;          // 近い名前の判定に使う最小の文字数
var TOKEN_RE = /^[0-9a-fA-F-]{36}$/;
var VOL_RE = /^(全巻|[0-9０-９〜~・,、\- ]{1,20}巻)$/;

// =============================================
// 受信
// =============================================
function doGet(e) {
  try {
    var p = (e && e.parameter) || {};
    if (p.action === "check") return json_(check_(p.q));
    if (p.action === "mine") return json_(mine_(p.token));
    return json_({ ok: false, error: "invalid" });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: "busy" });
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    if (!lock.tryLock(10000)) return json_({ ok: false, error: "busy" });
    var data = JSON.parse(e.parameter.payload);
    if (data.hp) return json_({ ok: true, token: "", items: [] }); // 見えない入力欄が埋まっていたらロボットとして無視
    if (data.type === "reserve") return json_(reserve_(data));
    if (data.type === "cancel") return json_(cancel_(data));
    return json_({ ok: false, error: "invalid" });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: "busy" });
  } finally {
    lock.releaseLock();
  }
}

// =============================================
// 処理
// =============================================
// 探された作品名が予約済みかを答える。一覧は返さず、持ち主キーも返さない
function check_(q) {
  var key = normKey_(q);
  var res = { ok: true, same: [], near: [] };
  if (!key || String(q).length > MAX_TITLE) return res;
  activeRows_().forEach(function (r) {
    var item = { title: r.title, vol: r.vol };
    if (r.key === key) res.same.push(item);
    else if (isNear_(r.key, key)) res.near.push(item);
  });
  res.same = res.same.slice(0, 5);
  res.near = res.near.slice(0, 5);
  return res;
}

function mine_(token) {
  if (!TOKEN_RE.test(String(token))) return { ok: false, error: "invalid" };
  return { ok: true, items: itemsOf_(token) };
}

function reserve_(data) {
  var list = Array.isArray(data.items) ? data.items : [];
  if (!list.length || list.length > MAX_ITEMS) return { ok: false, error: "invalid" };
  var token = TOKEN_RE.test(String(data.token)) ? String(data.token) : Utilities.getUuid();
  var rows = [];
  for (var i = 0; i < list.length; i++) {
    var title = String(list[i].title || "").trim();
    var vol = String(list[i].vol || "").trim();
    if (!normKey_(title) || title.length > MAX_TITLE || !VOL_RE.test(vol)) return { ok: false, error: "invalid" };
    rows.push({ title: title, vol: vol, key: normKey_(title) });
  }
  if (!countUp_(rows.length)) return { ok: false, error: "busy" };

  var active = activeRows_();
  var own = active.filter(function (r) { return r.token === token; });
  rows = rows.filter(function (r) {
    return !own.some(function (o) { return o.key === r.key && o.vol === r.vol; });
  });
  if (own.length + rows.length > MAX_PER_OWNER || active.length + rows.length > MAX_ACTIVE) {
    return { ok: false, error: "busy" };
  }
  var now = new Date();
  rows.forEach(function (r) {
    sheet_().appendRow([text_(Utilities.getUuid()), now, text_(r.title), text_(r.vol), STATE_ON, text_(token), text_(r.key)]);
  });
  return { ok: true, token: token, items: itemsOf_(token) };
}

function cancel_(data) {
  if (!TOKEN_RE.test(String(data.token))) return { ok: false, error: "invalid" };
  var sheet = sheet_();
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(data.id) && String(values[i][5]) === String(data.token)) {
      sheet.getRange(i + 1, 5).setValue(STATE_OFF);
      break;
    }
  }
  return { ok: true, items: itemsOf_(data.token) };
}

// =============================================
// 共通
// =============================================
function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// 期限内で取り消されていない予約だけを返す（期限切れは消さずに無視する）
function activeRows_() {
  var values = sheet_().getDataRange().getValues();
  var limit = Date.now() - EXPIRE_DAYS * 86400000;
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var v = values[i];
    var at = new Date(v[1]).getTime();
    if (v[4] !== STATE_ON || !(at > limit)) continue;
    rows.push({ id: String(v[0]), at: at, title: String(v[2]), vol: String(v[3]), token: String(v[5]), key: String(v[6]) });
  }
  return rows;
}

function itemsOf_(token) {
  return activeRows_()
    .filter(function (r) { return r.token === String(token); })
    .map(function (r) {
      var left = Math.ceil((r.at + EXPIRE_DAYS * 86400000 - Date.now()) / 86400000);
      return { id: r.id, title: r.title, vol: r.vol, left: left };
    });
}

// サイト側の検索と同じ考え方で表記をそろえる
function normKey_(s) {
  return String(s == null ? "" : s).normalize("NFKC").toLowerCase()
    .replace(/[ァ-ヶ]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0x60); })
    .replace(/[\s・、。,.!?！？「」『』()（）〜~\-ー:：♡☆★]/g, "");
}

// 片方がもう片方を含めば「近い名前」。短い題名は関係ない作品まで当たるので対象にしない
function isNear_(a, b) {
  var short = a.length < b.length ? a : b;
  var long = a.length < b.length ? b : a;
  return short.length >= NEAR_MIN && long.indexOf(short) !== -1;
}

function countUp_(n) {
  var cache = CacheService.getScriptCache();
  var key = "rate" + Math.floor(Date.now() / 600000);
  var count = Number(cache.get(key) || 0) + n;
  if (count > RATE_LIMIT) return false;
  cache.put(key, String(count), 700);
  return true;
}

// 先頭に「'」を付けて文字として保存する（=や+で始まる入力が計算式として動かないように）
function text_(v) {
  return "'" + String(v);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
