import { HttpStatus } from "../enums/index.js";

export class AppError extends Error {
    constructor(message, statusCode = HttpStatus.INTERNAL_SERVER_ERROR) {
        super(message);
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
        this.isOperational = true;

        Error.captureStackTrace(this, this.constructor);
    }
}

export class BadRequestError extends AppError {
    constructor(message) {
        super(message, HttpStatus.BAD_REQUEST);
    }
}

export class NotFoundError extends AppError {
    constructor(message) {
        super(message, HttpStatus.NOT_FOUND);
    }
}

export class UnauthorizedError extends AppError {
    constructor(message) {
        super(message, HttpStatus.UNAUTHORIZED);
    }
}

export class ForbiddenError extends AppError {
    constructor(message = "Forbidden: Insufficient privileges") {
        super(message, HttpStatus.FORBIDDEN);
    }
}
