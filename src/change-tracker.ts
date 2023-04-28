export type PropertyPath = readonly [PropertyKey, ...(readonly PropertyKey[])];

export class ChangeTracker {
  public static readonly missing: unique symbol = {} as any;

  private readonly _changes: Array<[PropertyPath, unknown]> = [];

  public keys(): PropertyPath[] {
    return this._changes.map(([propertyPath]) => propertyPath);
  }

  public get(propertyPath: PropertyPath): unknown {
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

  public hasPrefix(propertyPath: PropertyPath): boolean {
    return this._changes.some(([currentPropertyPath]) => {
      return propertyPath.every(
        (breadcrumb, i) => currentPropertyPath[i] === breadcrumb
      );
    });
  }

  public set(propertyPath: PropertyPath, value: unknown): void {
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

  public delete(propertyPath: PropertyPath): void {
    this._changes.some(([currentPropertyPath], i) => {
      if (this._match(currentPropertyPath, propertyPath)) {
        this._changes.splice(i, 1);
        return true;
      }
      return false;
    });
  }

  private _match(a: PropertyPath, b: PropertyPath): boolean {
    return a.length === b.length && a.every((entry, i) => entry === b[i]);
  }
}
