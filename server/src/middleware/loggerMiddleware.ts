import { Request, Response, NextFunction } from 'express';

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    const { method, originalUrl, body, query } = req;

    // Log request details
    console.log(`------------------------------------------------------------------`);
    console.log(`📝 [REQUEST] ${method} ${originalUrl}`);

    // Only log body if not empty and omit sensitive fields if necessary
    if (body && Object.keys(body).length > 0) {
        // Deep copy to avoid mutating request
        const logBody = { ...body };
        // Redact keywords for sensitive fields if they existed, e.g. password
        // if (logBody.password) logBody.password = '***';

        const bodyStr = JSON.stringify(logBody);
        const truncatedBody = bodyStr.length > 500 ? bodyStr.substring(0, 500) + '... (truncated)' : bodyStr;
        console.log(`📦 [BODY]: ${truncatedBody}`);
    }

    if (query && Object.keys(query).length > 0) {
        console.log(`🔍 [QUERY]: ${JSON.stringify(query)}`);
    }

    // Intercept response to log status and duration
    // We hook into 'finish' event of response
    res.on('finish', () => {
        const duration = Date.now() - start;
        const status = res.statusCode;

        // Use error logging for 4xx and 5xx
        const logFn = status >= 400 ? console.error : console.log;
        const icon = status >= 400 ? '❌' : '✅';

        logFn(`${icon} [RESPONSE] ${status} ${method} ${originalUrl} - ⏱️ ${duration}ms`);
        console.log(`------------------------------------------------------------------`);
    });

    next();
};
