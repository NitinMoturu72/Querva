# Querva Test Suite

## Overview

This test suite covers three main areas of the Querva application:

1. **Schema Parser Unit Tests** (42 tests) - Testing SQL, JSON, and CSV file parsing
2. **Auth Integration Tests** (21 tests) - Testing authentication flows and token validation
3. **Conversations Integration Tests** (26 tests) - Testing session management and conversation lifecycle

**Total: 89 tests - all passing ✓**

## Running Tests

### Install Dependencies
```bash
cd backend
npm install
```

### Run All Tests
```bash
npm test
```

### Run Specific Test Suite
```bash
# Schema parser unit tests only
npm test -- --testPathPattern="schemaParser"

# Auth integration tests only
npm test -- --testPathPattern="auth.integration"

# Conversations integration tests only
npm test -- --testPathPattern="conversations.integration"
```

### Watch Mode (re-run on file changes)
```bash
npm run test:watch
```

### Coverage Report
```bash
npm run test:coverage
```

## Test Categories

### 1. Schema Parser Unit Tests (`schemaParser.unit.test.js`)

**Purpose**: Validate schema parsing from three file formats

**Coverage**:
- **SQL Format** (14 tests)
  - Simple CREATE TABLE statements
  - Multiple tables
  - Constraints (PRIMARY KEY, UNIQUE, NOT NULL, FOREIGN KEY)
  - Types (INT, VARCHAR, DECIMAL, TIMESTAMP, JSON, etc.)
  - Default values and constraints with backticks
  
- **JSON Format** (10 tests)
  - Array of tables
  - Object keyed by table name
  - Alternate column name fields (table_name, column_name, field)
  - Foreign key references
  - Primary key boolean flags
  - Nullable fields

- **CSV Format** (12 tests)
  - Basic CSV parsing with headers
  - Multiple tables
  - DECIMAL precision handling (doesn't split on parentheses)
  - FK references with dot notation
  - Empty values and quoted fields
  - Nullable string parsing ("false", "0")
  
- **Edge Cases** (6 tests)
  - Whitespace handling
  - Case-insensitive SQL keywords
  - Alternate column name conventions
  - Column order preservation
  - Unique ID generation

### 2. Auth Integration Tests (`auth.integration.test.js`)

**Purpose**: Test authentication flows end-to-end with database

**Coverage**:
- **Registration** (7 tests)
  - Successful registration with email/password
  - Default name handling (uses email)
  - Custom name handling
  - Duplicate email rejection
  - Missing field validation
  - Database persistence with hashed passwords

- **Login** (7 tests)
  - Successful login with correct credentials
  - Wrong password rejection
  - Non-existent email rejection
  - Missing field validation
  - Valid JWT token generation
  - Case-sensitive email matching

- **Token Validation** (5 tests)
  - Valid token acceptance
  - Missing Authorization header rejection
  - Malformed Authorization header rejection
  - Invalid token rejection
  - Token isolation between users

- **End-to-End** (2 tests)
  - Full register → login → access protected route flow
  - Password security verification

### 3. Conversations Integration Tests (`conversations.integration.test.js`)

**Purpose**: Test conversation lifecycle and data persistence

**Coverage**:
- **Create Conversations** (7 tests)
  - Minimal conversation creation
  - Full schema with multiple tables
  - Authentication requirement
  - Required field validation (name, dialect)
  - 5-conversation limit enforcement
  - Schema persistence with columns

- **List Conversations** (5 tests)
  - List all user conversations
  - Message count calculation
  - User isolation (can't see other users' conversations)
  - Authentication requirement
  - Empty list for new users

- **Retrieve Conversations** (5 tests)
  - Fetch with schema and messages
  - Empty messages array for new conversations
  - User isolation enforcement
  - Non-existent conversation handling
  - Authentication requirement

- **Delete Conversations** (5 tests)
  - Successful deletion
  - Cascade deletion of schema and messages
  - User isolation enforcement
  - Non-existent conversation handling
  - Authentication requirement

- **Conversation Limit Enforcement** (3 tests)
  - Allows exactly 5 conversations
  - Prevents 6th conversation
  - Allows new conversation after deletion

## Database Setup

Tests automatically:
1. Create test database tables on startup (via `beforeAll` hook)
2. Clear test data after each test (via `afterEach` hook)
3. Close database connection after all tests (via `afterAll` hook)

**Required**: PostgreSQL database running with credentials in `.env`:
```
DB_HOST=localhost
DB_PORT=5433
DB_NAME=Querva
DB_USER=postgres
DB_PASSWORD=your_password
```

## Key Testing Patterns

### 1. Integration Testing with Real Database
```javascript
beforeAll(async () => {
  await setupTestDatabase()
})

afterEach(async () => {
  await pool.query('TRUNCATE users CASCADE')
})
```

### 2. User Isolation Testing
```javascript
// Create another user and verify they can't access other's data
const otherUserRes = await request(app)
  .post('/api/auth/register')
  .send({ email: 'other@example.com', password: 'Pass123!' })

const response = await request(app)
  .get(`/api/conversations/${conversationId}`)
  .set('Authorization', `Bearer ${otherUserRes.body.token}`)

expect(response.status).toBe(404)
```

### 3. Business Rule Enforcement
```javascript
// Create exactly 5 conversations
for (let i = 0; i < 5; i++) {
  await request(app).post('/api/conversations')...
}

// 6th should be rejected
const response = await request(app).post('/api/conversations')...
expect(response.status).toBe(400)
expect(response.body.code).toBe('CONVERSATION_LIMIT')
```

## Expected Test Results

```
Test Suites: 3 passed, 3 total
Tests:       89 passed, 89 total
Time:        ~10 seconds
```

## Troubleshooting

### Database Connection Issues
- Ensure PostgreSQL is running on configured host/port
- Verify `.env` credentials are correct
- Check that the database user has CREATE TABLE permissions

### Test Failures
- Run with `npm test -- --verbose` for detailed output
- Check `jest.config.js` for timeout settings (default 10 seconds)
- Tests may fail if database tables already have data (run `TRUNCATE` manually)

### Performance
- First run (~10s) creates database tables
- Subsequent runs are faster since tables exist
- Each test clears data after completion

## Files

- `setup.js` - Database setup and teardown utilities
- `schemaParser.unit.test.js` - Parser logic tests
- `auth.integration.test.js` - Authentication flow tests
- `conversations.integration.test.js` - Conversation CRUD tests
- `jest.config.js` - Jest configuration
