export type PropertyPath = readonly [PropertyKey, ...(readonly PropertyKey[])];

export type InternalPropertyPath = readonly [
  string | symbol,
  ...(readonly (string | symbol)[])
];

export function toInternalPropertyPath(
  propertyPath: PropertyPath
): InternalPropertyPath {
  return propertyPath.map((part) =>
    typeof part === 'number' ? `${part}` : part
  ) as unknown as InternalPropertyPath;
}

export class ChangeTracker {
  public static readonly missing: unique symbol = {} as any;

  private readonly _changes: Array<[InternalPropertyPath, unknown]> = [];

  public keys(): InternalPropertyPath[] {
    return this._changes.map(([propertyPath]) => propertyPath);
  }

  public get(propertyPath: InternalPropertyPath): unknown {
    let res: unknown = ChangeTracker.missing;
    this._changes.some(([currentPropertyPath, value]) => {
      if (this._match(currentPropertyPath, propertyPath)) {
        res = value;
        return true;
      }
      return false;
    });
    return res;
  }

  public hasPrefix(propertyPath: InternalPropertyPath): boolean {
    return this._changes.some(([currentPropertyPath]) => {
      return propertyPath.every(
        (breadcrumb, i) => currentPropertyPath[i] === breadcrumb
      );
    });
  }

  public set(propertyPath: InternalPropertyPath, value: unknown): void {
    const exists = this._changes.some((entry) => {
      if (this._match(entry[0], propertyPath)) {
        entry[1] = value;
        return true;
      }
      return false;
    });
    if (!exists) {
      this._changes.push([propertyPath, value]);
    }
  }

  public delete(propertyPath: InternalPropertyPath): void {
    this._changes.some(([currentPropertyPath], i) => {
      if (this._match(currentPropertyPath, propertyPath)) {
        this._changes.splice(i, 1);
        return true;
      }
      return false;
    });
  }

  private _match(a: InternalPropertyPath, b: InternalPropertyPath): boolean {
    return a.length === b.length && a.every((entry, i) => entry === b[i]);
  }
}
