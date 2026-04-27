# Querva - AI SQL Assistant

An intelligent SQL query assistant powered by AI that converts natural language questions into accurate SQL queries. Upload your database schema and chat naturally to generate queries.

## Features

✨ **Schema Support**
- SQL (CREATE TABLE statements)
- JSON (structured schema objects)  
- CSV (exported database schemas)

🤖 **AI-Powered Query Generation**
- Groq API integration for fast inference
- Conversation history for context
- Query explanations with "Explain" feature

🔐 **User Authentication**
- JWT-based authentication
- Session persistence
- Secure password hashing

💾 **Conversation Management**
- Save up to 5 conversations per user
- Retrieve and resume conversations
- Full message history

⚡ **Rate Limiting**
- 5 requests per minute per user
- 6,000 tokens per minute limit
- Sliding window enforcement

## Tech Stack

**Frontend**
- React 18 with Vite
- TailwindCSS for styling
- React Router for navigation
- Lucide React icons

**Backend**
- Node.js 18 with Express
- PostgreSQL database
- JWT authentication
- Groq API for AI

**DevOps**
- Docker & Docker Compose
- AWS EC2 (t2.micro)
- Nginx reverse proxy
- Jenkins CI/CD
- GitHub branch protection

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 15+
- Docker & Docker Compose (for containerized setup)

### Local Development

```bash
# 1. Clone repository
git clone https://github.com/NitinMoturu72/Querva.git
cd querva

# 2. Setup frontend
npm install
npm run dev

# 3. In another terminal, setup backend
cd backend
npm install
cp .env.example .env
# Edit .env with your database credentials
npm run dev
```

**Access:**
- Frontend: http://localhost:5173
- Backend: http://localhost:5000

### Docker Setup (Recommended)

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f
```

**Access:**
- Frontend: http://localhost:5173
- Backend: http://localhost:5000
- Database: postgres:5432

See [DEPLOYMENT.md](./DEPLOYMENT.md) for full local Docker guide.

## Project Structure

```
querva/
├── src/                           # Frontend (React)
│   ├── pages/                     # Page components
│   ├── components/                # Reusable components
│   ├── context/                   # React context (auth, conversations)
│   ├── lib/                       # Utilities (API, parsing)
│   └── App.jsx
├── backend/                       # Backend (Node.js/Express)
│   ├── src/
│   │   ├── routes/                # API endpoints
│   │   ├── middleware/            # Auth, rate limiting
│   │   ├── lib/                   # Database, JWT, password
│   │   ├── __tests__/             # Test suites
│   │   └── index.js               # Entry point
│   ├── Dockerfile                 # Backend container
│   └── package.json
├── docker-compose.yml             # Multi-container setup
├── Dockerfile.frontend            # Frontend container
├── Jenkinsfile                    # CI/CD pipeline
├── DEPLOYMENT.md                  # Full deployment guide
└── README.md
```

## Testing

### Run All Tests
```bash
cd backend
npm test
```

**Test Coverage:**
- **Schema Parser** (42 tests) - SQL, JSON, CSV parsing
- **Auth** (21 tests) - Registration, login, token validation
- **Conversations** (26 tests) - CRUD operations, limits, isolation

Total: **89 tests** - all passing ✅

### Run Specific Suite
```bash
npm test -- --testPathPattern="schemaParser"      # Parser tests
npm test -- --testPathPattern="auth.integration"  # Auth tests
npm test -- --testPathPattern="conversations"     # Conversation tests
```

See [backend/src/__tests__/README.md](./backend/src/__tests__/README.md) for detailed testing guide.

## API Endpoints

### Authentication
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user (protected)

### Conversations
- `POST /api/conversations` - Create conversation
- `GET /api/conversations` - List user's conversations
- `GET /api/conversations/:id` - Get conversation with messages
- `DELETE /api/conversations/:id` - Delete conversation

### Query Generation
- `POST /api/query` - Generate SQL query from question
- `POST /api/explain` - Explain a SQL query

## Deployment

### AWS EC2 Deployment

Complete end-to-end deployment with Docker, Jenkins, and GitHub integration.

**Quick setup:**
1. Create AWS account and set $1 billing alert
2. Launch EC2 t2.micro with security groups
3. Install Docker, Jenkins, Nginx, PM2
4. Configure Jenkins pipeline
5. Set GitHub branch protection
6. Push to main → automatic deployment! 🚀

**Full guide:** See [DEPLOYMENT.md](./DEPLOYMENT.md)

### Docker Compose (Development)

```bash
# Start everything
docker-compose up -d

# Stop everything
docker-compose down

# View logs
docker-compose logs -f
```

### Manual Deployment

```bash
# On production server
git clone https://github.com/yourusername/querva.git
cd querva
docker-compose up -d
```

## Environment Variables

Copy `.env.example` to `.env` and update:

```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=Querva
DB_USER=postgres
DB_PASSWORD=your_password

# Authentication
JWT_SECRET=your_jwt_secret_key

# AI/API
GROQ_API_KEY=your_groq_api_key

# Frontend
VITE_API_URL=http://localhost:5000/api
```

## Database Schema

**Tables:**
- `users` - User accounts with hashed passwords
- `conversations` - User chat sessions
- `schema_tables` - Database schema tables
- `columns` - Table columns with types and constraints
- `column_references` - Foreign key relationships
- `messages` - Chat history with generated queries
- `rate_limit_log` - Request tracking for rate limiting

## Features In Detail

### Schema Parsing
Supports three input formats:
- **SQL**: `CREATE TABLE users (id INT PRIMARY KEY, ...)`
- **JSON**: `[{ name: "users", columns: [...] }]`
- **CSV**: Comma-separated with headers

### Authentication Flow
1. Register/Login → JWT token issued
2. Token stored in localStorage
3. API calls include `Authorization: Bearer <token>`
4. `/api/auth/me` restores session on app load
5. Protected routes require valid token

### Rate Limiting
- Sliding window (60-second intervals)
- Per-user: 5 requests/minute, 6,000 tokens/minute
- Groq API token tracking
- 429 response when limit exceeded

### Conversation Limits
- Max 5 conversations per user
- Delete conversations to free up slots
- Full schema and message history persisted
- User isolation enforced at database level

## CI/CD Pipeline

Push to main → Jenkins automatically:
1. ✅ Installs dependencies
2. ✅ Runs all tests
3. ✅ Builds Docker images
4. ✅ Pushes to registry (optional)
5. ✅ Deploys to EC2
6. ✅ Health checks

PRs can't merge without passing pipeline! 🔒

## Performance Optimizations

- 💾 PostgreSQL query optimization with indexes
- 🔄 Conversation history limited to 5 messages for context
- 📦 Rate limiting prevents abuse

## Security Features

- 🔐 Password hashing with bcrypt
- 🎫 JWT token-based auth
- 🚫 Rate limiting on API endpoints
- 👤 User isolation on database queries
- 🔑 Environment variable secrets
- 📝 SQL prepared statements (parameterized queries)

## Troubleshooting

### Backend won't connect to database
```bash
# Check PostgreSQL is running
docker-compose ps

# Check connection in logs
docker-compose logs backend
```

### Tests failing
```bash
# Make sure test database exists
docker-compose up postgres -d

# Run tests with verbose output
cd backend && npm test -- --verbose
```

### Nginx returns 502 Bad Gateway
```bash
# Check backend is running
curl http://localhost:5000/health

# Check Nginx logs
sudo tail -f /var/log/nginx/error.log
```

See [DEPLOYMENT.md Troubleshooting](./DEPLOYMENT.md#troubleshooting) for more.

## Contributing

1. Fork repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

Pull requests require:
- ✅ Tests passing (Jest)
- ✅ Linting pass
- ✅ Code review approval
- ✅ Branch protection enforced

## Development Workflow

```bash
# Start local development
npm run dev              # Frontend (port 5173)
cd backend && npm run dev # Backend (port 5000)

# Run tests
cd backend && npm test

# Run tests in watch mode
cd backend && npm run test:watch

# Build for production
npm run build

# Build Docker images
docker-compose build

# Deploy to AWS
# Push to main, Jenkins handles rest
git push origin main
```

## Monitoring

### Local Development
- Frontend: http://localhost:5173
- Backend: http://localhost:5000/health
- Database: postgres:5432

### Production (AWS)
- Website: http://your-ec2-ip/
- API: http://your-ec2-ip/api/health
- Jenkins: http://your-ec2-ip:8080
- Logs: `ssh to EC2, docker-compose logs -f`

## Roadmap

- [ ] HTTPS/SSL with Let's Encrypt
- [ ] User profiles and preferences
- [ ] Query history and favorites
- [ ] Real-time collaboration
- [ ] Database connection testing
- [ ] Advanced query suggestions
- [ ] Slack bot integration
- [ ] API documentation (Swagger)
- [ ] Performance analytics

## License

MIT License - see LICENSE file

## Support

- 📖 [Full Deployment Guide](./DEPLOYMENT.md)
- 🧪 [Testing Guide](./backend/src/__tests__/README.md)
- 💬 Open an issue for bugs
- 🚀 Discussions for features

---

**Built with ❤️ by the Querva team**

Latest commit: `git log -1 --oneline`

Docker ready • Tested • Production-grade CI/CD
