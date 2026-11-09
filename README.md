# AI Cloud Lecture Organizer & Search Platform

> **AI 雲端講義整理與搜尋平台 (Phase 2 MVP)**  
> 依據《Phase1v5.6 需求分析與系統架構規劃書》開發之多格式個人學習與知識管理系統。

---

## 專案核心技術架構

- **前端 (Frontend)**：React 18 + Vite (Vanilla CSS)
- **後端 (Backend)**：Node.js (v26+) + Express (ES Modules)
- **資料庫 (Database)**：PostgreSQL 15+ (原生 `pg` 連線池，無 ORM)
- **搜尋引擎 (Search)**：PostgreSQL Full-Text Search + 中文 2-gram 分詞 + GIN 索引
- **檔案解析 (Parsers)**：多格式 Parser Adapter (PDF.js, Office XML, CSV, TXT/MD)
- **AI 整合 (AI Integration)**：OpenAI-compatible Provider Adapter
- **雲端部署 (Deployment)**：Render Web Service + Render PostgreSQL

---

## 目錄結構說明

```
d:\雲端專題\
├── .github/workflows/ci.yml       # GitHub Actions 基礎 CI 流程
├── backend/                       # 後端 Node.js + Express 服務
│   ├── src/
│   │   ├── config/                # 環境變數與全域設定 (dotenv)
│   │   ├── db/                    # pg.Pool 資料庫連線與 Migration 腳本
│   │   ├── middlewares/           # 全域錯誤處理、日誌脫敏與 Auth 中介層
│   │   ├── routes/                # 各業務模組 API 路由
│   │   ├── utils/                 # API 統一回應格式與通用工具
│   │   ├── app.js                 # Express 應用設定
│   │   └── index.js               # 伺服器啟動入口
│   ├── tests/                     # 自動化單元與整合測試
│   ├── .env.example               # 後端環境變數範例
│   └── package.json               # 後端依賴與腳本定義
├── frontend/                      # 前端 React + Vite 應用
│   ├── public/                    # 靜態資源目錄
│   ├── src/
│   │   ├── components/            # 可重複使用之 UI 組件
│   │   ├── App.jsx                # 前端主入口組件
│   │   ├── main.jsx               # React DOM 渲染入口
│   │   └── index.css              # 全域樣式 (Vanilla CSS)
│   ├── index.html                 # 應用入口 HTML
│   ├── vite.config.js             # Vite 配置 (含 /api 反向代理)
│   └── package.json               # 前端依賴與腳本定義
├── .gitignore                     # Git 忽略清單
└── README.md                      # 專案總覽文件
```

---

## 快速啟動指南

### 1. 後端設定與啟動
```bash
cd backend
npm install
cp .env.example .env
# 請編輯 .env 設定您的 DATABASE_URL
npm run db:migrate # 執行資料庫 Migration 建表
npm run dev        # 啟動開發伺服器 (預設 Port 5000)
```

### 2. 前端設定與啟動
```bash
cd frontend
npm install
npm run dev        # 啟動 Vite 開發伺服器 (預設 Port 5173)
```

### 3. 執行後端測試
```bash
cd backend
npm test
```
