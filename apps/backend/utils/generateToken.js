import jsonwebtoken from 'jsonwebtoken';
export const generateToken = (data) => {
    const token = jsonwebtoken.sign(data, process.env.JWT_SECRET, { algorithm: 'HS256' });
    return token;
}