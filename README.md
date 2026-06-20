# Verdict — Multi-Source AI Buying Verdict

Live data from **Anakin Wire** + free AI via **Groq (Llama 3.3 70B)**.

## Features
- **Single Verdict** — BUY / WAIT / SKIP with confidence score
- **Compare Mode** — Head-to-head product comparison with winner
- **Voice Search** — Speak your query (Web Speech API, works in Chrome)
- **Share Verdict** — Native share / clipboard copy of verdict card
- **Persistent History** — Past verdicts saved in localStorage

## Wire API Actions Used
| Source | Action | Purpose |
|--------|--------|---------|
| Amazon | `amazon.product_search` | Pricing & ratings |
| Reddit | `reddit.search` | Community sentiment |
| Google Trends | `google_trends.search` | Interest direction |

## Setup
```bash
npm install
cp .env.local.example .env.local
# Fill in ANAKIN_API_KEY + GROQ_API_KEY (free from console.groq.com)
npm run dev
```

## Deploy
Push to GitHub → Vercel import → add env vars → deploy.
