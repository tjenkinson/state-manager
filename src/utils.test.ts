import { Boundary } from '@tjenkinson/boundary';
import { wrap, missingProperty } from './utils';

describe('Utils', () => {
  describe('wrap()', () => {
    it('correctly proxies the object', () => {
      const source: any = {};
      const wrapped = wrap(Proxy, new Boundary(), source, {
        afterChange: () => {},
      });
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

    it('integrates boundary properly', () => {
      for (const type of ['change', 'define', 'delete'] as const) {
        const log: string[] = [];
        const boundary = new Boundary({
          onEnter: () => {
            expect(source.value).toBe(type !== 'define' ? 0 : undefined);
            log.push('onEnter');
          },
          onExit: () => {
            expect(source.value).toBe(type !== 'delete' ? 1 : undefined);
            log.push('onExit');
          },
        });

        const source = type !== 'define' ? { value: 0 } : {};
        const wrapped = wrap(Proxy, boundary, source, {
          afterChange: () => log.push('afterChange'),
        });

        if (type === 'change') {
          wrapped.value = 1;
        } else if (type === 'define') {
          Object.defineProperty(wrapped, 'value', {
            value: 1,
            writable: false,
            enumerable: true,
          });
        } else if (type === 'delete') {
          delete wrapped.value;
        }

        expect(log).toStrictEqual(['onEnter', 'afterChange', 'onExit']);
      }
    });

    describe('afterChange', () => {
      it('calls afterChange after property added with correct input', () => {
        const source = { root: {} } as any;
        const wrapped = wrap(Proxy, new Boundary(), source, {
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
        const wrapped = wrap(Proxy, new Boundary(), source, {
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
        const wrapped = wrap(Proxy, new Boundary(), source, {
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
        const wrapped = wrap(Proxy, new Boundary(), source, {
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
        const wrapped = wrap(Proxy, new Boundary(), source, {
          afterChange: fn,
        });
        expect(() => {
          wrapped.root.test = 2;
        }).toThrowError();
        expect(fn).not.toHaveBeenCalled();
      });
    });
  });
});
