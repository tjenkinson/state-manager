export function isObject(input: any): input is object {
  return input !== null && typeof input === 'object';
}

export function clone<T>(input: T, depth: number, freeze: boolean): T {
  if (depth === 0 || !isObject(input)) {
    return input;
  }
  const result: T = Object.create(null);
  for (const key in input) {
    result[key] = clone(input[key], depth - 1, freeze);
  }
  if (freeze) {
    Object.freeze(result);
  }
  return result;
}
