---
name: intel
description: global-intelダッシュボードの蓄積データを照会する。経済指標、OSINT、ニュース記事、週次分析を取得。
user_invocable: true
---

# global-intel データ照会スキル

global-intel (https://global-intel-silk.vercel.app/) に蓄積された経済指標・OSINT・ニュース・分析データをAPI経由で取得し、ユーザーの質問に回答する。

## API仕様

ベースURL: `https://global-intel-silk.vercel.app/api/data`
認証: `?secret=${CRON_SECRET}` をクエリに付与（環境変数 CRON_SECRET を使用）

### エンドポイント

| クエリ | 説明 |
|---|---|
| `?type=summary` | 最新日付・データ件数・ソース別件数の概要 |
| `?type=osint` | OSINT全データポイント（フィルタ可能） |
| `?type=osint&source=fred` | FREDのみ |
| `?type=osint&source=boj` | 日銀APIのみ |
| `?type=osint&country=JPN` | 日本のみ |
| `?type=osint&country=USA` | 米国のみ |
| `?type=osint&category=price` | 物価指標のみ |
| `?type=osint&category=finance` | 金融指標のみ |
| `?type=osint&q=CPI` | ラベル・指標名でキーワード検索 |
| `?type=osint&indicator=FEDFUNDS` | 特定シリーズID指定 |
| `?type=osint&date=2026-04-07` | 特定日付のデータ |
| `?type=articles` | 最新の分析済みニュース記事 |
| `?type=deepdive` | 最新の週次ディープダイブ |
| `?type=memory` | インテリジェンス・メモリ（トレンド追跡） |

フィルタは組み合わせ可能: `?type=osint&source=fred&country=USA&category=price`

### 利用可能なソース
- `fred`: 米国FRED（CPI, PPI, PCE, 雇用, GDP, 住宅, 貿易 等35シリーズ）
- `boj`: 日銀API（短観DI, 企業物価, M2, 政策金利, 経常収支, 貿易収支）
- `estat`: e-Stat（日本CPI, 賃金）
- `edinet`: EDINET（有報提出数）
- `dbnomics`: World Bank（6ヶ国マクロ指標）
- `fao`: FAO食料価格指数
- `usgs`: 地震データ
- `opensanctions`: 制裁リスト
- `comtrade`: 国際貿易
- `gfw`: 海上活動
- `ucdp`: 武力紛争

### 利用可能な国コード
USA, JPN, EUR, GBR, CHN, DEU, IND, BRA

### 利用可能なカテゴリ
macro, finance, price, trade, conflict, filing, disaster, military, sanctions, maritime

## 実行手順

1. ユーザーの質問に応じて適切なフィルタを組み立てる
2. WebFetch または Bash (curl) でAPIを呼ぶ
3. 結果を分析し、数値を引用しながら回答する

### 例

ユーザー: 「最近の米国インフレ指標は？」
→ `?type=osint&country=USA&category=price&secret=...`

ユーザー: 「日銀短観の推移を見せて」
→ `?type=osint&source=boj&q=短観&secret=...`

ユーザー: 「今週のニュースまとめ」
→ `?type=articles&secret=...`

## 注意事項
- CRON_SECRETは /home/sawad/global-intel/.env.local または Vercel環境変数から取得
- データは日次Cron（JST 4:00/5:00）で自動更新される
- 返却はJSON形式。data_points配列内の各要素にsource, indicator, label, value, date, country, unitが含まれる
