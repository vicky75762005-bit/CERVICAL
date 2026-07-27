# CERVICAL Atlas

上頸椎與顱骨力學的互動式知識地圖。網站以純 HTML、CSS 與 JavaScript 製作，不需要建置工具，可直接部署至 GitHub Pages。

## 功能

- 82 個節點：上頸椎 34 個、顱骨 48 個
- 91 條樹內關聯與 7 條跨系統橋接
- 拖曳、滾輪縮放、適合畫面與縮圖導覽
- 中英文關鍵字搜尋
- 系統與節點類型篩選
- 節點詳情、上下游關聯與深連結
- 68 個節點的進階力學筆記：力學定義、連鎖反應、推理步驟、臨床連結、常見混淆與下一步
- 響應式側欄與行動裝置版面

## 本機預覽

ES modules 必須透過 HTTP 伺服器載入：

```bash
python -m http.server 8000
```

開啟 `http://localhost:8000`。

## 部署

在 GitHub repository 的 **Settings → Pages**，將來源設定為 `Deploy from a branch`，選擇 `main` 與 `/ (root)`。

## 資料與使用聲明

分類架構整理自公開的 [What's Up Anatomy 頸椎地圖](https://anatomy.whatsupanatomy.io/anatomy/tree/all)。本專案採用獨立的視覺設計與互動程式碼，未收錄來源網站的品牌素材、題庫與完整教學文案。

內容僅供學習與資訊整理，不能取代醫療診斷、治療建議或專業臨床訓練。
