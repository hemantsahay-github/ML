// Thin dev-only logger. Strips to no-op in production so no console output leaks.
/* eslint-disable no-console */
const isDev = process.env.NODE_ENV === "development";

export const logger = {
  debug: isDev ? console.debug.bind(console) : () => {},
  info: isDev ? console.info.bind(console) : () => {},
  warn: isDev ? console.warn.bind(console) : () => {},
  error: isDev ? console.error.bind(console) : () => {},
};

export default logger;
