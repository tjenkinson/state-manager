import { isObject } from './utils';

export type Changes<T> = T extends object
  ? { [P in keyof T]?: Readonly<Changes<T[P]>> }
  : true;

const missing: unique symbol = Object.create(null) as any; // cheap Symbol polyfill
export function calculateChanges<T>(
  newItem: T,
  oldItem: T,
  depth: number
): Readonly<Changes<T>> | null {
  return _calculateChanges(newItem, oldItem, depth, new Map());
}
function _calculateChanges<T>(
  newItem: T,
  oldItem: T | typeof missing,
  depth: number,
  itemsSeenTogether: Map<unknown, Set<unknown>>
): Readonly<Changes<T>> | null {
  if (depth === 0) {
    return null;
  }
  if (newItem === oldItem) {
    return null;
  }
  if (!isObject(newItem)) {
    return true as Changes<T>;
  }

  const itemsSeenWithThisOne = new Set(itemsSeenTogether.get(newItem));
  itemsSeenTogether.set(newItem, itemsSeenWithThisOne);
  if (itemsSeenWithThisOne.has(oldItem)) {
    return null;
  }
  itemsSeenWithThisOne.add(oldItem);

  const changes: Changes<T> = Object.create(null);
  if (oldItem === missing) {
    for (const key in newItem) {
      const newValue = newItem[key];
      const nestedChanges = _calculateChanges(
        newValue,
        missing,
        depth - 1,
        new Map(itemsSeenTogether)
      );
      if (nestedChanges) {
        (changes as any)[key] = nestedChanges;
      }
    }
  } else {
    const seenKeys: string[] = [];
    for (const key in newItem) {
      seenKeys.push(key);
      const newValue = newItem[key];
      const oldValue = key in oldItem ? oldItem[key] : missing;
      const nestedChanges = _calculateChanges(
        newValue,
        oldValue,
        depth - 1,
        new Map(itemsSeenTogether)
      );
      if (nestedChanges) {
        (changes as any)[key] = nestedChanges;
      }
    }
    for (const key in oldItem) {
      if (seenKeys.indexOf(key) === -1) {
        (changes as any)[key] = true;
      }
    }
  }
  if (Object.keys(changes).length) {
    return Object.freeze(changes);
  } else {
    return null;
  }
}
