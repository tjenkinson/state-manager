import { calculateChanges } from './calculate-changes';

describe('CalculateChanges', () => {
  let mock: {
    a: number;
    b: boolean;
    c: string;
    j?: number | { k: number };
    d: () => void;
    e: {
      f: number;
      g: {
        h: null;
        i: undefined;
      };
    };
  };
  beforeEach(() => {
    const fn = () => {};
    mock = {
      a: 0,
      b: false,
      c: 'test',
      d: fn,
      e: { f: 2, g: { h: null, i: undefined } },
    };
  });

  it('returns null when no difference', () => {
    expect(calculateChanges(mock, mock, Infinity)).toStrictEqual(null);
  });

  it('handles a non-object', () => {
    expect(calculateChanges(1, 2, Infinity)).toBe(true);
    expect(calculateChanges(1, 1, Infinity)).toStrictEqual(null);
  });

  it('handles a change at the top level', () => {
    const mockNew = { ...mock, a: 1 };

    expect(calculateChanges(mockNew, mock, Infinity)).toEqual({ a: true });
  });

  it('handles a change at the second level', () => {
    const mockNew = { ...mock, e: { ...mock.e, f: 0 } };

    expect(calculateChanges(mockNew, mock, Infinity)).toEqual({
      e: { f: true },
    });
  });

  it('handles a change at the first and second level', () => {
    const mockNew = { ...mock, a: 1, e: { ...mock.e, f: 0 } };

    expect(calculateChanges(mockNew, mock, Infinity)).toEqual({
      a: true,
      e: { f: true },
    });
  });

  it('handles a property appearing', () => {
    const mockNew = { ...mock, j: { k: 1 } };

    expect(calculateChanges(mockNew, mock, Infinity)).toEqual({
      j: { k: true },
    });
  });

  it('handles a property disappearing', () => {
    const mockOld = { ...mock, j: { k: 1 } };

    expect(calculateChanges(mock, mockOld, Infinity)).toEqual({ j: true });
  });

  it('handles an undefined property appearing', () => {
    const mockOld = {
      ...mock,
      e: { ...mock.e, g: { h: null } },
    };

    expect(calculateChanges(mock, mockOld, Infinity)).toEqual({
      e: { g: { i: true } },
    });
  });

  it('handles an undefined property disappearing', () => {
    const mockNew = {
      ...mock,
      e: { ...mock.e, g: { h: null } },
    };

    expect(calculateChanges(mockNew, mock, Infinity)).toEqual({
      e: { g: { i: true } },
    });
  });

  it('returns frozen objects', () => {
    const mockNew = { ...mock, a: 1, e: { ...mock.e, f: 0 } };

    const changes = calculateChanges(mockNew, mock, Infinity);
    expect(changes && Object.isFrozen(changes)).toBe(true);
    expect(changes?.e && Object.isFrozen(changes.e)).toBe(true);
  });

  describe('when there is recursion', () => {
    it('returns correct value when new and old recursion does not align', () => {
      const newItem = {
        a: {
          b: undefined as any,
        },
      };
      newItem.a.b = newItem;

      const oldItem = {
        a: {
          b: {
            a: undefined as any,
          },
        },
      };
      oldItem.a.b.a = oldItem;

      expect(calculateChanges(newItem, oldItem, Infinity)).toEqual({
        a: { b: { a: { a: true } } },
      });
    });

    it('returns null with new and old recursion that lines up', () => {
      const newItem = {
        a: {
          b: undefined as any,
        },
      };
      newItem.a.b = newItem;

      const oldItem = {
        a: {
          b: {
            a: {
              b: undefined as any,
            },
          },
        },
      };
      oldItem.a.b.a.b = oldItem;

      expect(calculateChanges(newItem, oldItem, Infinity)).toStrictEqual(null);
    });
  });

  describe('with depth', () => {
    it('ignores properties lower than the depth', () => {
      const mockNew = { ...mock, a: 1, e: { ...mock.e, f: 0 } };

      expect(calculateChanges(mockNew, mock, 2)).toEqual({
        a: true,
      });
    });
  });
});
