# Windows：從 ZIP 啟動 MAG 學習室

這是可在自己電腦執行的原始碼，不是已上線的網站。截圖展示的是明確標示的離線互動測試，不代表真實模型或全雙工語音已驗證。

1. 安裝 Node.js 22.19 或更新版本（含 npm）。
2. 將整個 ZIP 解壓縮。在 `mag-aiteacher-source` 資料夾空白處選擇「在終端機中開啟」，使用 PowerShell。
3. 執行：

```powershell
npm ci --cache "$env:LOCALAPPDATA\npm-cache"
$env:MAG_MODE = "fixture"
npm run dev
```

4. 在同一台 Windows 電腦瀏覽器開啟 `http://127.0.0.1:5173`。
5. 選「從零理解 TypeScript」，或匯入自己的 UTF-8 `.txt` / `.md`。開始教學後按「這裡不懂」，再按「接著剛才的位置」。
6. 停止服務：回到終端機按 Ctrl+C。

PowerShell 若攔截 npm.ps1，可將上面的 `npm` 改成 `npm.cmd`；不需要變更系統執行原則。

## 正式建置（PowerShell）

```powershell
npm run build
$env:NODE_ENV = "production"
$env:MAG_MODE = "fixture"
node --env-file-if-exists=.env --import tsx server/index.ts
```

`npm start` 腳本使用 Unix 環境變數語法；Windows 請使用上方命令。測試腳本中的 Chromium 路徑也需換成自己電腦已安裝瀏覽器的執行檔路徑（`CHROMIUM_PATH`）。

## 真實模型

離線模式不需要金鑰，且不會理解問題或生成新教學。真實模式要使用自己既有且授權的模型憑證；請依 README 在安全的環境設定或本機忽略版本控制的 `.env` 私下設定，勿貼到聊天。移除 `MAG_MODE=fixture` 或改為 `live` 後重新啟動。一般供應商用量費用仍適用。此交付未新增帳號、訂閱或設定長期存取。

目前驗證環境沒有可用模型憑證。實體麥克風、實際播放、全雙工即時音訊和精準聲音／白板同步均未宣稱驗證成功。
