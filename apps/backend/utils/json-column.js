/**
 * Colonnes JSON lues comme du texte (MariaDB : JSON = LONGTEXT ; le pilote rend une chaîne).
 * Sans conversion, `{ ...metadata }` étale la chaîne caractère par caractère et corrompt la donnée.
 * `jsonColumn(nom)` fournit un accesseur qui rend toujours un objet (ou null).
 */
export function parseJson(value) {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value !== "string") return value;
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}

/** Retire les clés « 0 », « 1 »… laissées par une corruption passée (chaîne étalée en objet). */
export function stripSpreadGarbage(obj) {
    if (!obj || typeof obj !== "object" || Array.isArray(obj) || !("0" in obj)) return obj;
    return Object.fromEntries(Object.entries(obj).filter(([k]) => !/^\d+$/.test(k)));
}

export const jsonColumn = (field) => ({
    get() {
        return stripSpreadGarbage(parseJson(this.getDataValue(field)));
    },
});
