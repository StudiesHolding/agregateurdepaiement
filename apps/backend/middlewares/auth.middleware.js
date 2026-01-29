import express from 'express';
export const authMiddleware = (req, res, next) => {
    const authHeader = req.headers["X-studies-holding-auth-id"];
    if (!authHeader) {
        return res.status(401).json({ message: 'Authorization header missing' });
    } else if (authHeader !== process.env.STUDIES_HOLDING_AUTH_ID) {
        return res.status(403).json({ message: 'Forbidden: Invalid authorization ID' });
    }
    next();
}

export const CheckSignatureHmac = () => {
    //
}