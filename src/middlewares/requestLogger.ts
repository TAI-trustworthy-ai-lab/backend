import type { ServerResponse } from 'node:http';
import type { RequestHandler } from 'express';
import pino, { type LevelWithSilent } from 'pino';

enum LogLevel {
  Fatal = 'fatal',
  Error = 'error',
  Warn = 'warn',
  Info = 'info',
  Debug = 'debug',
  Trace = 'trace',
  Silent = 'silent',
}

const customLogLevel = (res: ServerResponse, err?: Error): LevelWithSilent => {
  if (err || res.statusCode >= 500) return LogLevel.Error;
  if (res.statusCode >= 400) return LogLevel.Warn;
  if (res.statusCode >= 300) return LogLevel.Info;
  return LogLevel.Info;
};

const logger = pino({
  level: 'info',
  timestamp: pino.stdTimeFunctions.isoTime,
  base: null,
});

const requestLogger: RequestHandler = (req, res, next) => {
  const startTime = process.hrtime();

  res.on('finish', () => {
    const [seconds, nanoseconds] = process.hrtime(startTime);
    const duration = (seconds * 1000 + nanoseconds / 1e6).toFixed(2); // durée en ms

    const level = customLogLevel(res);
    if (level === LogLevel.Silent) return;

    logger[level](`${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
  });

  next();
};

export default requestLogger;
