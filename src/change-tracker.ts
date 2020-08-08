function validatePropertyPath(propertyPath: PropertyKey[]): void {
  if (!propertyPath.length) {
    throw new Error('Must be at least one item.');
  }
}

export class ChangeTracker {
  public static readonly missing: unique symbol = {} as any;

  private readonly _changes: Array<[PropertyKey[], unknown]> = [];

  public keys(): PropertyKey[][] {
    return this._changes.map(([propertyPath]) => propertyPath);
  }

  public get(propertyPath: PropertyKey[]): unknown {
    validatePropertyPath(propertyPath);
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

  public hasPrefix(propertyPath: PropertyKey[]): boolean {
    return this._changes.some(([currentPropertyPath]) => {
      return propertyPath.every(
        (breadcrumb, i) => currentPropertyPath[i] === breadcrumb
      );
    });
  }

  public set(propertyPath: PropertyKey[], value: unknown): void {
    validatePropertyPath(propertyPath);
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

  public delete(propertyPath: PropertyKey[]): void {
    this._changes.some(([currentPropertyPath], i) => {
      if (this._match(currentPropertyPath, propertyPath)) {
        this._changes.splice(i, 1);
        return true;
      }
      return false;
    });
  }

  private _match(a: PropertyKey[], b: PropertyKey[]): boolean {
    return a.length === b.length && a.every((entry, i) => entry === b[i]);
  }
}
