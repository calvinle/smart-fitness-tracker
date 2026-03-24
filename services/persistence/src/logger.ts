import { Logger, ILogObj } from "tslog";

// Determine if we're in production (GCP Cloud Run)
const isProduction = process.env.NODE_ENV === 'production' || !!process.env.K_SERVICE;

// Create logger instance optimized for GCP Cloud Logging
const logger: Logger<ILogObj> = new Logger({
  name: "persistence",
  type: isProduction ? "json" : "pretty",
  minLevel: process.env.LOG_LEVEL ? parseInt(process.env.LOG_LEVEL) : 2, // 0: silly, 1: trace, 2: debug, 3: info, 4: warn, 5: error, 6: fatal
  hideLogPositionForProduction: isProduction,
  prettyLogTemplate: "{{yyyy}}.{{mm}}.{{dd}} {{hh}}:{{MM}}:{{ss}}:{{ms}}\t{{logLevelName}}\t[{{name}}]\t",
});

export default logger;
