# autoclipper-ui

Frontend untuk [AutoClipper](https://github.com/danielfebrian012/autoclipper-py) — tool yang generate short-form clips dari video YouTube menggunakan AI.

## Stack

- Next.js 16 (App Router)
- React 19
- Tailwind CSS 4
- TypeScript

## Fitur

- Generate clip timestamps dari YouTube URL menggunakan LLM + heatmap engagement
- Preview video lokal langsung di browser
- Edit start/end time tiap clip sebelum render
- Include/exclude clip yang tidak ingin dirender
- Render mode: **Single** (satu speaker) atau **Split Screen** (dua speaker)
- Real-time render log via Server-Sent Events
- Gallery output dengan inline preview dan download

## Prasyarat

Backend [autoclipper-py](https://github.com/danielfebrian012/autoclipper-py) harus sudah running di `http://localhost:8000`.

## Setup

```bash
pnpm install
cp .env.example .env.local
# Edit .env.local jika backend berjalan di port berbeda
pnpm dev
```

Buka [http://localhost:3000](http://localhost:3000).

## Environment Variables

| Variable                | Default                  | Keterangan                    |
| ----------------------- | ------------------------ | ----------------------------- |
| `NEXT_PUBLIC_API_URL`   | `http://localhost:8000`  | Base URL backend AutoClipper  |
