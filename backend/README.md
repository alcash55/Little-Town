# Little Town Backend API

A Node.js/Express backend API for the Little Town application with authentication, role-based access control, and OSRS hiscore integration.

## Features

- 🔐 JWT-based authentication with role-based access control
- 🛡️ Security middleware (Helmet, CORS, Rate Limiting)
- 📊 OSRS hiscore data fetching and processing
- 🎯 Bingo game management (admin routes)
- 🚀 Google Cloud Functions compatible
- 📝 TypeScript with strict type checking
- 🧪 Comprehensive error handling and validation

## Quick Start

### Prerequisites

- Node.js 20+
- Bun (recommended) or npm

### Installation

1. Install dependencies:

```bash
bun install
# or
npm install
```

2. Copy environment file:

```bash
cp env.example .env
```

3. Update `.env` with your configuration

4. Build the project:

```bash
bun run build
# or
npm run build
```

5. Start development server:

```bash
bun run dev
# or
npm run dev
```

The server will start on `http://localhost:8081`

## API Endpoints

### Authentication

- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user (protected)
- `POST /api/auth/logout` - User logout (protected)

### Hiscores

- `GET /api/hiscores/:player` - Get player hiscores (protected)
- `PUT /api/hiscores/:player` - Update player hiscores (protected)
- `GET /api/hiscores/skills/list` - Get available skills

### Admin (Admin/Moderator only)

- `POST /api/admin/bingo` - Create new bingo
- `GET /api/admin/bingo` - List all bingos (admin only)
- `GET /api/admin/bingo/:id` - Get specific bingo
- `PUT /api/admin/bingo/:id` - Update bingo
- `DELETE /api/admin/bingo/:id` - Delete bingo (admin only)

### Legacy Routes (for backward compatibility)

- `GET /api/skills` - Get skills data
- `GET /api/activities` - Get activities info

## Authentication

The API uses JWT tokens for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

### Default Users (for development)

- **Admin**: username: `admin`, password: `password`
- **User**: username: `user`, password: `password`

## Environment Variables

| Variable         | Description           | Default                 |
| ---------------- | --------------------- | ----------------------- |
| `NODE_ENV`       | Environment mode      | `development`           |
| `PORT`           | Server port           | `8081`                  |
| `FRONTEND_URL`   | Frontend URL for CORS | `http://localhost:5173` |
| `JWT_SECRET`     | JWT signing secret    | `fallback-secret`       |
| `JWT_EXPIRES_IN` | JWT expiration time   | `24h`                   |

## Project Structure

```
src/
├── middleware/          # Express middleware
│   ├── auth.ts         # Authentication & authorization
│   └── errorHandler.ts # Error handling
├── routes/             # API route handlers
│   ├── auth.ts         # Authentication routes
│   ├── hiscores.ts     # Hiscores routes
│   └── admin.ts        # Admin routes
├── types/              # TypeScript type definitions
│   └── index.ts        # Main type definitions
├── utils/              # Utility functions
│   ├── getHiscoresData.ts
│   └── responseList.ts
├── hiscores.ts         # Hiscores processing logic
├── createBingo.ts      # Bingo creation logic
└── index.ts            # Main application entry point
```

## Development

### Scripts

- `bun run build` - Build TypeScript to JavaScript
- `bun run start` - Start production server
- `bun run dev` - Start development server with hot reload

### Code Quality

- TypeScript strict mode enabled
- ESLint configuration (when added)
- Prettier formatting (when added)

## Security Features

- **Helmet**: Security headers
- **CORS**: Cross-origin resource sharing
- **Rate Limiting**: API abuse prevention
- **Input Validation**: Request data validation
- **Error Handling**: Secure error responses
- **JWT**: Secure token-based authentication

## Deployment

### Google Cloud Functions

The API is compatible with Google Cloud Functions. Deploy using:

```bash
gcloud functions deploy littletown-api \
  --runtime nodejs20 \
  --trigger-http \
  --allow-unauthenticated \
  --entry-point LittleTownFunctions
```
