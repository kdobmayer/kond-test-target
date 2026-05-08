# kond-test-target

Express-based REST API for user management. Used as a test target for KOND E2E and benchmark testing.

## Features

- User CRUD operations via REST endpoints
- Jest test suite
- The API is designed to receive JSON payloads and return JSON responses

## Usage

```bash
npm install
npm start    # starts the server on port 3000
npm test     # runs Jest test suite
```

## Conventions

- All route handlers live in `routes/` — one file per resource (e.g., `routes/users.js`).
- Use `express.Router()` for route grouping.
- Error responses use `res.status(code).json({error: "message"})` — never plain text.
- Logging uses `console.log` for now (structured logging migration is planned).
- Tests in `__tests__/` using Jest with supertest for HTTP assertions.
- Environment variables for configuration (PORT, NODE_ENV). No `.env` files committed.
- All async route handlers use try/catch with next(err) for error propagation.
- Named exports from utility modules; default export only for the Express app.
- No TypeScript — plain JavaScript with JSDoc type annotations where helpful.
- Dependencies pinned to exact versions in package.json.
