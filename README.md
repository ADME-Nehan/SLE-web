# 📰 Sri Lanka News Aggregator

AI-powered news aggregator using Groq AI + Firebase + React.

---

## 🔐 Admin Security (2-layer)

1. **Secret URL** — Admin page is hidden at a custom path,``` e.g. `/manage-news-XXXX` ```
2. **Password popup** — Even if someone finds the URL, they need the password

No login page, no Firebase Auth needed.

---

## ⚡ Quick Start

### 1. Firebase Setup
1. [console.firebase.google.com](https://console.firebase.google.com) → New project
2. Enable **Firestore Database** (production mode)
3. Project Settings → Service Accounts → **Generate new private key** → save as `backend/serviceAccountKey.json`

### 2. Groq API Key
- [console.groq.com](https://console.groq.com) → API Keys → Create key

### 3. Backend

```bash
cd backend
cp .env.example .env
# Fill in .env:
#   GROQ_API_KEY=gsk_...
#   FIREBASE_DATABASE_URL=https://your-project.firebaseio.com
#   ADMIN_SECRET_KEY=your-admin-password
npm install
node server.js
```

### 4. Frontend

```bash
cd frontend
cp .env.example .env
# Fill in .env:
#   REACT_APP_API_URL=http://localhost:5000/api
#   REACT_APP_ADMIN_PATH=/your-secret-path   ← change this!
#   REACT_APP_FIREBASE_* = your firebase web config
npm install
npm start
```

---

## 🔑 Environment Variables

### backend/.env
| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default 5000) |
| `GROQ_API_KEY` | From console.groq.com |
| `FIREBASE_DATABASE_URL` | From Firebase project settings |
| `ADMIN_SECRET_KEY` | Your admin password (anything you choose) |

### frontend/.env
| Variable | Description |
|----------|-------------|
| `REACT_APP_API_URL` | Backend URL |
| `REACT_APP_ADMIN_PATH` | Secret admin URL path e.g. `/manage-news-2024` |
| `REACT_APP_FIREBASE_*` | Firebase web app config values |

---

## 🤖 How It Works

1. Admin adds a **URL only** (e.g. `https://www.dailymirror.lk`)
2. Groq AI auto-detects site name, finds RSS feed, scrapes articles
3. Each article gets AI **summary**, **category**, **tags**, **sentiment**
4. Same story from multiple sites → **merged** with all sources shown
5. Auto-refreshes every **2 hours**

---

## 🚀 Deploy

**Backend** → [Railway.app](https://railway.app): Upload backend folder, set env vars in dashboard

**Frontend** → Build + Netlify/Vercel:
```bash
cd frontend && npm run build
# Deploy the /build folder
# Set REACT_APP_API_URL to your Railway backend URL
```
