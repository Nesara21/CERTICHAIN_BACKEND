const winston = require('winston');
const { v4: uuidv4 } = require('uuid');

// Create a custom format that includes the correlation ID if present
const correlationFormat = winston.format((info) => {
    if (info.correlationId) {
        info.message = `[${info.correlationId}] ${info.message}`;
    }
    return info;
});

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        correlationFormat(),
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                correlationFormat(),
                winston.format.colorize(),
                winston.format.simple()
            )
        }),
        // Add file transport for persistent logs
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' })
    ]
});

// Middleware to attach correlation ID to request and logger
const requestLogger = (req, res, next) => {
    const correlationId = req.headers['x-correlation-id'] || uuidv4();
    req.correlationId = correlationId;

    // Attach a child logger to the request with the correlation ID pre-bound
    req.log = logger.child({ correlationId });

    // Log the request
    req.log.info(`${req.method} ${req.url}`);

    // Log response on finish
    res.on('finish', () => {
        req.log.info(`Response status: ${res.statusCode}`);
    });

    next();
};

module.exports = { logger, requestLogger };
