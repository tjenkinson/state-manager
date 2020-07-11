import isPlainObject from 'is-plain-object';

export function isObject(input: any): input is object {
  return isPlainObject(input);
}

export function replace<T>(
  input: T,
  find: unknown,
  replacement: unknown,
  depth: number
): void {
  if (depth === 0 || !isObject(input)) {
    return;
  }
  for (const key in input) {
    if (input[key] === find) {
      input[key] = replacement as any;
    } else {
      replace(input[key], find, replacement, depth - 1);
    }
  }
}

export function clone<T>(input: T, depth: number, freeze: boolean): T {
  return _clone(input, depth, freeze, new Map());
}

function _clone<T>(
  input: T,
  depth: number,
  freeze: boolean,
  clonedItems: Map<unknown, unknown>
): T {
  if (depth === 0 || !isObject(input)) {
    return input;
  }
  const result: T = {} as T;
  for (const key in input) {
    const source = input[key];
    const alreadyCloned = clonedItems.get(source);
    if (!alreadyCloned) {
      result[key] = _clone(source, depth - 1, freeze, clonedItems);
      clonedItems.set(source, result[key]);
    } else {
      result[key] = alreadyCloned as any;
    }
  }
  if (freeze) {
    Object.freeze(result);
  }
  return result;
}
