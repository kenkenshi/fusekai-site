# けんしの腐世界生活 webサイト制作 引き継ぎファイル
作成日：2026-04-17（v3更新）

---

## プロジェクト概要

**目的**
- BL既読リストの公開（視聴者がおすすめ前に確認できる）
- お便りフォーム（ポッドキャスト用）
- 将来的に独立したwebサイトとして公開予定

---

## 確定ページ構成（5ページ）

1. **about**：サイトの使い方説明
2. **BL既読リスト**：検索機能つき
3. **作品をおすすめする**
4. **お便りを送る**
5. **プレゼントを送る**（私書箱住所・10日以上かかる注意書き・SNSリンク）

---

## デザインイメージ（確定）

- ロゴ：「けんしの腐世界生活」（fusekai_top.htmlに実装済み）
- 検索バー：「作者名または作品名」プレースホルダー
- **既読作品カード**：作品画像・既読巻数・ちょろっと感想・動画腐教済みか・♡ボタン
- **未読作品カード**：「まだ読んでない！まって読んでないんだがオススメしておくれ！」＋なにかしらの質問＋オススメするボタン・プレゼントするボタン
- 検索したらページ遷移せずその場で下にスッと結果が出る

---

## 公開URL・リポジトリ情報

- **公開URL**：https://kenkenshi.github.io/fusekai-site/fusekai_top.html
- **GitHubリポジトリ**：https://github.com/kenkenshi/fusekai-site
- **スプレッドシートID**：17YXkAsB10E5jdWgUQytFS9QoMTcoFUExaLPX-XMe5Nc

---

## 作成済みファイル

- `fusekai_site.html`：5ページ構成のサイトモック
- `fusekai_top.html`：けんしデザイン案再現・ロゴ埋め込み済み・API連携・検索・画像表示まで実装済み

---

## トップページコピー（確定）

```
「腐世界生活の時間だ！」
視聴者おすすめのBL作品をけんしが読んで腐教します！
腐女子・腐男子さんの恋愛事情・仕事・日常の失敗談をショート動画で発信中・・・。
いつかポッドキャストやってみたい！
```

---

## Googleスプレッドシート（完成・稼働中）

**スプレッドシート情報**
- 名前：BL既読リスト
- URL：https://docs.google.com/spreadsheets/d/17YXkAsB10E5jdWgUQytFS9QoMTcoFUExaLPX-XMe5Nc/edit?gid=0#gid=0
- アカウント：kenkenkenshi365@gmail.com
- 列構成：A=作品名 / B=作者名 / C=既読巻数 / D=一言メモ / E=動画済み / F=画像URL / G=入手方法

**現状**
- 30作品入力済み
- F列：画像URL自動入力済み（Apps Scriptで生成）

---

## Googleドライブ画像管理（完成・稼働中）

- アカウント：kenkenkenshi365@gmail.com
- フォルダ名：BL表紙画像
- ファイル命名規則：作品名.JPG（例：セックスドロップ.JPG）
- iPhoneカメラ設定：互換性優先（JPG）に変更済み
- 現在：30作品分の画像アップロード済み

---

## Apps Script（完成・稼働中）

**場所**：スプレッドシート→拡張機能→Apps Script

**コード内容**：BL表紙画像フォルダのファイル名とA列を照合してF列にURLを自動入力

```javascript
function fillImageUrls() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var folder = DriveApp.getFoldersByName("BL表紙画像").next();
  var files = folder.getFiles();
  
  var fileMap = {};
  while (files.hasNext()) {
    var file = files.next();
    var name = file.getName().replace(/\.[^/.]+$/, "");
    fileMap[name] = "https://drive.google.com/uc?export=view&id=" + file.getId();
  }
  
  var lastRow = sheet.getLastRow();
  for (var i = 2; i <= lastRow; i++) {
    var title = sheet.getRange(i, 1).getValue();
    if (fileMap[title]) {
      sheet.getRange(i, 6).setValue(fileMap[title]);
    }
  }
  
  Logger.log("完了！");
}
```

**今後の運用（新作追加時）**
1. 本を撮影（JPG）
2. ドライブ「BL表紙画像」フォルダに作品名.JPGで保存
3. スプレッドシートにA〜E列を入力
4. Apps Scriptを実行（▶ボタン1回）
5. F列に自動でURLが入る

---

## 完成済み機能（2026-04-17時点）

- ✅ Google Sheets API連携
- ✅ 検索機能（作品名・作者名）
- ✅ 既読カード表示（画像・巻数・メモ・動画済みバッジ）
- ✅ GitHub Pagesで公開
- ✅ 画像表示

---

## 感想列の方針（PENDING・未決定）

候補A：タグ方式（「切ない」「エロ多め」「純愛」など）
候補B：星評価
候補C：一言だけ（けんしの素の反応）

---

## 次にやること（優先順）

1. **「おすすめする」ページの実装**
2. 残り50作品のデータ入力・撮影
3. デザイン調整
4. おすすめシステム設計（下記参照）

---

## 検索機能の仕様（実装済み）

- 検索したらページ遷移せずその場で下にスッと結果が出る
- **既読作品カード**：作品画像・既読巻数・ちょろっと感想・動画腐教済みか・♡ボタン
- **未読作品カード**：「まだ読んでない！」＋賛同♡ボタン＋累計おすすめ数
- 検索結果下部に「続けて検索する」導線

---

## おすすめシステム設計（未実装）

- **パターンA（検索経由）**：♡ボタン一個で賛同・累計可視化
- **パターンB（直接おすすめ）**：作品名入力→既読照合→未読なら登録
- 本番環境はSupabase等のDB連携が必要

---

## その他PENDING

- 感想列の方針決定
- おすすめフォームの項目確定
- ポッドキャスト配信先の決定（Spotify・Apple Podcast・stand.fm候補）

---

## Chromeプロファイル情報

- けんしアカウント：kenkenkenshi365@gmail.com（Kenshiプロファイル）
- 藤本アカウント：bipod0803@gmail.com（デフォルト）
- スプレッドシート・ドライブ・Apps Scriptはすべてkenshiアカウントで統一
