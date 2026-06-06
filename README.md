# 🔥 Fénix Chat

A modern, real-time messaging platform built with a focus on community, voice, and rich media — inspired by the best of Discord and Slack.

## Tech Stack

| Layer       | Technology                         |
| ----------- | ---------------------------------- |
| **Client**  | React + Vite + Tailwind CSS        |
| **Server**  | Node.js + Express                  |
| **Database**| PostgreSQL                         |
| **Cache**   | Redis                              |
| **Realtime**| Socket.io                          |
| **Auth**    | JWT (access + refresh tokens)      |
| **Storage** | Backblaze B2                       |

## Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9
- **PostgreSQL** (Phase 2+)
- **Redis** (Phase 3+)

### 1. Clone & Install

```bash
git clone <repo-url> fenix-chat
cd fenix-chat
```

### 2. Server Setup

```bash
cd server
npm install

# Create your .env from the template
cp .env.example .env
# Edit .env with your values

# Start in development mode (with hot-reload)
npm run dev

# Or start in production mode
npm start
```

The server runs on **http://localhost:3001** by default.

### 3. Client Setup (coming soon)

```bash
cd client
npm install
npm run dev
```

The client runs on **http://localhost:5173** by default.

### 4. Verify

Hit the health endpoint to confirm the server is running:

```bash
curl http://localhost:3001/api/health
```

Expected response:

```json
{
  "status": "ok",
  "timestamp": "2026-06-06T11:00:00.000Z",
  "uptime": 12.345,
  "version": "1.0.0"
}
```

## Project Structure

```
fenix-chat/
├── client/                  # React frontend (Phase 2+)
├── server/
│   ├── src/
│   │   ├── config/          # Environment & app configuration
│   │   ├── controllers/     # Route handler functions
│   │   ├── middleware/       # Express middleware (errors, auth, etc.)
│   │   ├── models/          # Database models (Phase 2+)
│   │   ├── routes/          # API route definitions
│   │   ├── sockets/         # Socket.io event handlers (Phase 3+)
│   │   ├── voice/           # Voice channel logic (Phase 4+)
│   │   ├── utils/           # Shared utilities (logger, helpers)
│   │   └── app.js           # Express app entry point
│   ├── migrations/          # Database migrations (Phase 2+)
│   ├── seeds/               # Seed data (Phase 2+)
│   ├── .env.example         # Environment variable template
│   └── package.json
├── .env.example             # Root-level env template
└── README.md
```

## Development Roadmap

| Phase | Focus                                    | Status      |
| ----- | ---------------------------------------- | ----------- |
| 1     | Project foundation & Express server      | ✅ Complete |
| 2     | PostgreSQL, Auth (JWT), User management  | ⬜ Planned  |
| 3     | Real-time messaging with Socket.io       | ⬜ Planned  |
| 4     | Communities, channels, roles, media      | ⬜ Planned  |
| 5     | Voice channels, video, screen sharing    | ⬜ Planned  |

## API Endpoints

### Phase 1

| Method | Endpoint      | Description          |
| ------ | ------------- | -------------------- |
| GET    | `/api/health` | Server health check  |

## License

ISC
