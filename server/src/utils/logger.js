/**
 * Simple color-coded console logger with timestamps.
 * Provides info, warn, error, and debug methods.
 */

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

function timestamp() {
  return new Date().toISOString();
}

const logger = {
  info(message, ...args) {
    console.log(
      `${colors.gray}[${timestamp()}]${colors.reset} ${colors.green}INFO${colors.reset}  ${message}`,
      ...args
    );
  },

  warn(message, ...args) {
    console.warn(
      `${colors.gray}[${timestamp()}]${colors.reset} ${colors.yellow}WARN${colors.reset}  ${message}`,
      ...args
    );
  },

  error(message, ...args) {
    console.error(
      `${colors.gray}[${timestamp()}]${colors.reset} ${colors.red}ERROR${colors.reset} ${message}`,
      ...args
    );
  },

  debug(message, ...args) {
    if (process.env.NODE_ENV === 'development') {
      console.debug(
        `${colors.gray}[${timestamp()}]${colors.reset} ${colors.cyan}DEBUG${colors.reset} ${message}`,
        ...args
      );
    }
  },
};

export default logger;
