import { isPlainObject } from 'is-plain-object';
import { PropertyPath } from './change-tracker';
import { Boundary } from '@tjenkinson/boundary';

export function isObject(input: any): input is object {
  return isPlainObject(input);
}

export const missingProperty: unique symbol = {} as any;
export function wrap<T extends object>(
  ProxyImpl: ProxyConstructor,
  boundary: Boundary<unknown>,
  input: T,
  {
    afterChange,
  }: {
    afterChange: (
      propertyPath: PropertyPath,
      oldValue: any,
      newValue: any
    ) => void;
  }
): T {
  const wrapped: Map<any, any> = new Map();

  function _wrap<T extends object>(
    propertyPath: PropertyKey[],
    levelInput: T
  ): T {
    const alreadyProxied = wrapped.get(levelInput);
    if (alreadyProxied) {
      return alreadyProxied;
    }
    const traps: ProxyHandler<T> = {
      get(target, prop) {
        const res = (levelInput as any)[prop];
        return isObject(res) ? _wrap([...propertyPath, prop], res) : res;
      },
      set(target, prop, value) {
        return boundary.enter(() => {
          const previousValue =
            prop in levelInput ? (levelInput as any)[prop] : missingProperty;
          (levelInput as any)[prop] = value;
          afterChange(
            [...propertyPath, prop] as unknown as PropertyPath,
            previousValue,
            value
          );
          return true;
        });
      },
      defineProperty(target, prop, descriptor) {
        return boundary.enter(() => {
          const previousValue =
            prop in levelInput ? (levelInput as any)[prop] : missingProperty;
          Object.defineProperty(target, prop, descriptor);
          afterChange(
            [...propertyPath, prop] as unknown as PropertyPath,
            previousValue,
            descriptor.value
          );
          return true;
        });
      },
      deleteProperty(target, prop) {
        if (!(prop in (levelInput as any))) {
          return false;
        }
        return boundary.enter(() => {
          const previousValue = (levelInput as any)[prop];
          delete (levelInput as any)[prop];
          afterChange(
            [...propertyPath, prop] as unknown as PropertyPath,
            previousValue,
            missingProperty
          );
          return true;
        });
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
