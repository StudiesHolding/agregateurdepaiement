import { describe, it, expect } from '@jest/globals';
import { jwtSecret } from '../jwt-secret.js';

describe('jwtSecret (ADR-0018, D5) — aucun secret de repli devinable', () => {
  it('production : refuse un secret absent ou court', () => {
    expect(() => jwtSecret({ NODE_ENV: 'production' })).toThrow(/JWT_SECRET/);
    expect(() => jwtSecret({ NODE_ENV: 'production', JWT_SECRET: 'court' })).toThrow(/JWT_SECRET/);
  });
  it('production : accepte un secret de 32 caractères ou plus', () => {
    const s = 'x'.repeat(40);
    expect(jwtSecret({ NODE_ENV: 'production', JWT_SECRET: s })).toBe(s);
  });
  it('développement : secret aléatoire stable pour le processus, jamais « fallback »', () => {
    const a = jwtSecret({ NODE_ENV: 'development' });
    expect(a).toBe(jwtSecret({ NODE_ENV: 'development' }));
    expect(a).not.toMatch(/fallback/);
    expect(a.length).toBeGreaterThanOrEqual(32);
  });
});
