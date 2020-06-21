import { clone, isObject } from './utils';

describe('Utils', () => {
  describe('clone()', () => {
    [true, false].forEach((freeze) => {
      describe(`when freeze option is ${freeze}`, () => {
        it('works', () => {
          const fn = () => {};
          const input = {
            a: { b: 'test', c: false, d: null, e: undefined, f: fn, g: {} },
          };
          const res = clone(input, 2, freeze);
          expect(res).not.toBe(input);
          expect(Object.isFrozen(res)).toBe(freeze);
          expect(res.a.f).toBe(fn);
          expect(res.a).not.toBe(input.a);
          expect(Object.isFrozen(res.a)).toBe(freeze);
          expect(res.a.g).toBe(input.a.g);
          expect(Object.isFrozen(res.a.g)).toBe(false);
          expect(res).toEqual(input);
        });
      });
    });
  });

  describe('isObject()', () => {
    it('works for undefined', () => {
      expect(isObject(undefined)).toBe(false);
    });
    it('works for null', () => {
      expect(isObject(null)).toBe(false);
    });
    it('works for booleans', () => {
      expect(isObject(false)).toBe(false);
    });
    it('works for numbers', () => {
      expect(isObject(1)).toBe(false);
    });
    it('works for strings', () => {
      expect(isObject('a')).toBe(false);
    });
    it('works for functions', () => {
      expect(isObject(() => {})).toBe(false);
    });
    it('works for objects', () => {
      expect(isObject({})).toBe(true);
    });
  });
});
