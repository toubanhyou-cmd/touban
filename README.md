# 当番表メーカー

名前を入れるだけで、係ごとの当番を公平にランダム割り当てし、1年分のカレンダーをA4で印刷・CSVで出力できるWebツールです。
ブラウザだけで動き、入力した名前などは外部に送信されません（ブラウザ内に保存）。

## できること

- 係ごとに「1日に何人」を設定して自動で割り当て
- 担当回数の均等化（月ごと・係ごと。前の月の回数をふまえて翌月以降で調整）
- 土日・祝日（振替休日を含む）・曜日・任意の日付（年末年始など）の除外
- 個人ごとの不可曜日・不可日、担当できる係の制限
- 組ませないペア（同じ日の同じ係に入れない）
- 同じ人を続けて当番にしない
- カレンダー上で担当者を手で入れ替え（ルール違反は赤で表示）
- A4横の印刷・PDF保存（1ヶ月ずつ／12ヶ月分まとめて）、CSV出力
- 自動保存（localStorage）と、JSONファイルへの書き出し・読み込み

## GitHub Pagesでの公開手順（コマンド操作なし）

1. GitHubにログインし、右上の「＋」→「New repository」
   - Repository name：`touban`
   - **Public** を選ぶ
   - 「Create repository」
2. 作成後の画面で「uploading an existing file」のリンクをクリック
3. パソコンの `touban` フォルダを開き、**中身**（`index.html`、`css`、`js`、`img`、`README.md`）をまとめてドラッグ＆ドロップ
   - `touban` フォルダそのものではなく、中のファイル・フォルダを入れてください
4. 下の「Commit changes」を押す
5. 「Settings」→ 左メニューの「Pages」
   - Source：**Deploy from a branch**
   - Branch：**main** ／ **/(root)** →「Save」
6. 1〜数分待って `https://（あなたのユーザー名）.github.io/touban/` を開く

### 公開後にやること（任意）

`index.html` の次の行を、自分のURLに書き換えると、SNSやLINEでリンクを送ったときに画像が出やすくなります。

```html
<meta property="og:image" content="img/ogp.png">
↓
<meta property="og:image" content="https://（ユーザー名）.github.io/touban/img/ogp.png">
```

GitHubの画面でファイルを開き、鉛筆アイコンから直接編集して「Commit changes」で保存できます。

## 修正したいとき

- パソコンのファイルを直して、GitHubの画面から同じ場所にアップロード（上書き）→ Commit
- 小さな修正なら、GitHub上でファイルを開いて鉛筆アイコンで直接編集
- 数分でサイトに反映されます（反映されないときはブラウザを再読み込み）

## ファイル構成

```
index.html        画面全体
css/style.css     画面のデザイン
css/print.css     印刷用（A4横）
js/main.js        画面操作・タブ・出力
js/settings.js    ① 設定タブ
js/scheduler.js   割り当てロジック（均等化・ルールチェック）
js/calendar.js    カレンダー・一覧・集計表の描画
js/holidays.js    日本の祝日の計算
js/storage.js     保存（localStorage・JSON）
js/export.js      CSV出力
js/utils.js       共通の関数
img/              ファビコン・OGP画像
```

## 祝日について

祝日は `js/holidays.js` で計算しています（毎年のデータ更新は不要）。
祝日法が改正された場合や、臨時の祝日ができた場合は、このファイルを修正してください。

## 割り当ての考え方

当番日ごとに、条件を満たす人の中から次の順で回数が少ない人を選び、同じならランダムで決めます。

1. その月のその係の回数
2. その月の合計回数
3. その係の年間累計
4. 全係の年間累計

これを30通り試し、未割り当て・偏りが一番少ない結果を採用します。

## 手元で動作確認するとき

`js` を ES Modules で読み込んでいるため、`index.html` をダブルクリックで開くと動きません。
GitHub Pagesに公開すれば動きます（手元で確かめたい場合は、VS Codeの「Live Server」拡張などを使ってください）。
