// Jest setupFiles entry (runs after `dotenv/config`, see jest.config.js) —
// forces the structured logger silent during test runs. Without this,
// every request a test suite makes emits a full JSON log line (pino-pretty
// is deliberately skipped under Jest — see AppModule's LoggerModule setup
// — so it's raw JSON, not even readable), drowning out Jest's own
// pass/fail output. Test assertions are what matters here, not the log
// stream.
process.env.LOG_LEVEL = 'silent';
