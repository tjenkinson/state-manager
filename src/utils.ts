import isPlainObject from 'is-plain-object';

export function isObject(input: any): input is object {
  return isPlainObject(input);
}

export function makeReadonly<T extends object>(
  ProxyImpl: ProxyConstructor,
  input: T
): Readonly<T> {
  return wrap(ProxyImpl, input, {
    beforeChange: () => {
      throw new TypeError('This is readonly.');
    },
  });
}

export const missingProperty: unique symbol = {} as any;
export function wrap<T extends object>(
  ProxyImpl: ProxyConstructor,
  input: T,
  {
    beforeChange,
    afterChange,
  }: {
    beforeChange?: () => void;
    afterChange?: (
      breadcrumbs: Array<string | number | symbol>,
      oldValue: any,
      newValue: any
    ) => void;
  }
): T {
  const wrapped: Map<any, any> = new Map();

  function _wrap<T extends object>(
    breadcrumbs: Array<string | number | symbol>,
    levelInput: T
  ): T {
    const alreadyProxied = wrapped.get(levelInput);
    if (alreadyProxied) {
      return alreadyProxied;
    }
    const traps: ProxyHandler<T> = {
      get(target, prop) {
        const res = (levelInput as any)[prop];
        return isObject(res) ? _wrap([...breadcrumbs, prop], res) : res;
      },
      set(target, prop, value) {
        beforeChange && beforeChange();
        const previousValue =
          prop in levelInput ? (levelInput as any)[prop] : missingProperty;
        (levelInput as any)[prop] = value;
        afterChange &&
          afterChange([...breadcrumbs, prop], previousValue, value);
        return true;
      },
      defineProperty(target, prop, descriptor) {
        beforeChange && beforeChange();
        const previousValue =
          prop in levelInput ? (levelInput as any)[prop] : missingProperty;
        Object.defineProperty(target, prop, descriptor);
        afterChange &&
          afterChange([...breadcrumbs, prop], previousValue, descriptor.value);
        return true;
      },
      deleteProperty(target, prop) {
        if (!(prop in (levelInput as any))) {
          return false;
        }
        beforeChange && beforeChange();
        const previousValue = (levelInput as any)[prop];
        if (delete (levelInput as any)[prop]) {
          afterChange &&
            afterChange([...breadcrumbs, prop], previousValue, missingProperty);
          return true;
        }
        return false;
      },
    };
    let proxy: T;
    try {
      proxy = new ProxyImpl(levelInput, traps);
    } catch (e) {
      // polyfill only supports `get` and `set`
      proxy = new ProxyImpl(levelInput, { get: traps.get, set: traps.set });
    }
    wrapped.set(levelInput, proxy);
    return proxy;
  }

  return _wrap([], input);
}
