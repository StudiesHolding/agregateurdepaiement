export const generateLinks = (token, hostname) => {
    const link = `${hostname}/payment/confirm?token=${token}`;
    return link;
}