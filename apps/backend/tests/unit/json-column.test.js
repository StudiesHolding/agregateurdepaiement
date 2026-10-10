import { parseJson, stripSpreadGarbage } from "../../utils/json-column.js";

/** Colonnes JSON rendues en texte par MariaDB : toujours un objet, jamais une chaîne étalée. */
describe("colonnes JSON", () => {
    it("convertit le texte, garde les objets, tolère le vide et l'invalide", () => {
        expect(parseJson('{"a":1}')).toEqual({ a: 1 });
        expect(parseJson({ a: 1 })).toEqual({ a: 1 });
        expect(parseJson("")).toBeNull();
        expect(parseJson("{oups")).toBeNull();
    });
    it("retire les clés laissées par une chaîne étalée", () => {
        expect(stripSpreadGarbage({ 0: "{", 1: "\"", fees: { card: {} } })).toEqual({ fees: { card: {} } });
        expect(stripSpreadGarbage({ fees: 1 })).toEqual({ fees: 1 });
    });
});
