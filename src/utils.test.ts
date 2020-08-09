import { wrap, missingProperty, makeReadonly } from './utils';

describe('Utils', () => {
  describe('wrap()', () => {
    it('correctly proxies the object', () => {
      const source: any = {};
      const wrapped = wrap(Proxy, source, {});
      expect(source).toStrictEqual({});
      expect(wrapped).toStrictEqual({});
      wrapped.test = 1;
      expect(source).toStrictEqual({ test: 1 });
      expect(wrapped).toStrictEqual({ test: 1 });
      wrapped.test = 2;
      expect(source).toStrictEqual({ test: 2 });
      expect(wrapped).toStrictEqual({ test: 2 });
      delete wrapped.test;
      expect(source).toStrictEqual({});
      expect(wrapped).toStrictEqual({});
      wrapped.test = { test2: 1 };
      expect(source).toStrictEqual({ test: { test2: 1 } });
      expect(wrapped).toStrictEqual({ test: { test2: 1 } });
      wrapped.test.test2 = 2;
      expect(source).toStrictEqual({ test: { test2: 2 } });
      expect(wrapped).toStrictEqual({ test: { test2: 2 } });
      Object.defineProperty(wrapped, 'test3', {
        value: 3,
        writable: false,
        enumerable: true,
      });
      expect(source).toStrictEqual({ test: { test2: 2 }, test3: 3 });
      expect(wrapped).toStrictEqual({ test: { test2: 2 }, test3: 3 });
    });

    describe('beforeChange', () => {
      it('calls beforeChange before property added', () => {
        const source = {} as any;
        const wrapped = wrap(Proxy, source, {
          beforeChange: () => {
            expect(source.test).toBeUndefined();
          },
        });
        wrapped.test = 1;
      });

      it('calls beforeChange before property removed', () => {
        const source = { test: 1 } as any;
        const wrapped = wrap(Proxy, source, {
          beforeChange: () => {
            expect(source.test).toBe(1);
          },
        });
        delete wrapped.test;
      });

      it('calls beforeChange before property updated', () => {
        const source = { test: 1 } as any;
        const wrapped = wrap(Proxy, source, {
          beforeChange: () => {
            expect(source.test).toBe(1);
          },
        });
        wrapped.test = 2;
      });

      it('calls beforeChange before `Object.defineProperty`', () => {
        const source = {} as any;
        const wrapped = wrap(Proxy, source, {
          beforeChange: () => {
            expect(source.test).toBeUndefined();
          },
        });
        Object.defineProperty(wrapped, 'test', {
          value: 1,
          writable: false,
          enumerable: true,
        });
      });
    });

    describe('afterChange', () => {
      it('calls afterChange after property added with correct input', () => {
        const source = { root: {} } as any;
        const wrapped = wrap(Proxy, source, {
          afterChange: (breadcrumbs, oldValue, newValue) => {
            expect(source.root.test).toBe(1);
            expect(breadcrumbs).toStrictEqual(['root', 'test']);
            expect(oldValue).toBe(missingProperty);
            expect(newValue).toBe(1);
          },
        });
        wrapped.root.test = 1;
      });

      it('calls afterChange after property removed with correct input', () => {
        const source = { root: { test: 1 } } as any;
        const wrapped = wrap(Proxy, source, {
          afterChange: (breadcrumbs, oldValue, newValue) => {
            expect('test' in source.root).toBe(false);
            expect(breadcrumbs).toStrictEqual(['root', 'test']);
            expect(oldValue).toBe(1);
            expect(newValue).toBe(missingProperty);
          },
        });
        delete wrapped.root.test;
      });

      it('calls afterChange after property updated with correct input', () => {
        const source = { root: { test: 1 } } as any;
        const wrapped = wrap(Proxy, source, {
          afterChange: (breadcrumbs, oldValue, newValue) => {
            expect(source.root.test).toBe(2);
            expect(breadcrumbs).toStrictEqual(['root', 'test']);
            expect(oldValue).toBe(1);
            expect(newValue).toBe(2);
          },
        });
        wrapped.root.test = 2;
      });

      it('calls afterChange after `Object.defineProperty`', () => {
        const source = { root: {} } as any;
        const wrapped = wrap(Proxy, source, {
          afterChange: (breadcrumbs, oldValue, newValue) => {
            expect(source.root.test).toBe(1);
            expect(breadcrumbs).toStrictEqual(['root', 'test']);
            expect(oldValue).toBe(missingProperty);
            expect(newValue).toBe(1);
          },
        });
        Object.defineProperty(wrapped.root, 'test', {
          value: 1,
          writable: false,
          enumerable: true,
        });
      });

      it('does not call afterChange if fails to update', () => {
        const source = { root: {} } as any;
        Object.defineProperty(source.root, 'test', {
          value: 1,
          writable: false,
          enumerable: true,
        });
        const fn = jest.fn();
        const wrapped = wrap(Proxy, source, {
          afterChange: fn,
        });
        expect(() => {
          wrapped.root.test = 2;
        }).toThrowError();
        expect(fn).not.toHaveBeenCalled();
      });
    });
  });

  describe('makeReadonly()', () => {
    it('prevents changes to the object', () => {
      const source = { root: { test: 1 } } as any;
      const wrapped = makeReadonly(Proxy, source);
      expect(() => {
        wrapped.root.test = 2;
      }).toThrowError('This is readonly.');
      expect(source.root.test).toBe(1);
      expect(() => {
        wrapped.root.newProp = 1;
      }).toThrowError('This is readonly.');
      expect('newProp' in source.root).toBe(false);
      expect(() => {
        delete wrapped.root.test;
      }).toThrowError('This is readonly.');
      expect(source.root.test).toBe(1);
      expect(() => {
        Object.defineProperty(wrapped.root, 'newProp', {
          value: 1,
          writable: false,
          enumerable: true,
        });
      }).toThrowError('This is readonly.');
      expect('newProp' in source.root).toBe(false);
    });
  });
});
