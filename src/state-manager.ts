import { Boundary } from '@tjenkinson/boundary';
import { wrap, makeReadonly } from './utils';
import { ChangeTracker, PropertyPath } from './change-tracker';

export { PropertyPath } from './change-tracker';

export type HasChanged = (...propertyPath: PropertyPath) => boolean;

export type StateManagerOpts<TState> = {
  beforeUpdate?: BeforeUpdateFn<TState>;
  afterUpdate?: AfterUpdateFn<TState>;
  Proxy?: ProxyConstructor;
};

export type Listener<TState> = (
  hasChanged: HasChanged,
  state: Readonly<TState>
) => void;
export type ListenerHandle = {
  remove: () => void;
};
export type UpdateFn<TState, TReturn> = (state: TState) => TReturn;
export type BeforeUpdateFn<TState> = (state: TState) => void;
export type AfterUpdateFn<TState> = (
  afterUpdateInput: AfterUpdateInput<TState>
) => void;
export type AfterUpdateInput<TState> = {
  state: Readonly<TState>;
  exceptionOccurred: boolean;
  retrieveExceptions: () => any[];
};

type ListenerWithChanges<TState> = {
  changes: ChangeTracker;
  listener: Listener<TState>;
  removed: boolean;
};

/**
 * This provides a controlled way of managing a state object, and being notified when
 * parts of it have changed. It ensures that state updates are atomic, meaning subscribers
 * are only notified of changes when the state has been updated completely.
 *
 * - To update the state use the `update()` method.
 * - To subscribe to state changes use the `subscribe()` method.
 *
 * @example
 * ```ts
 * const stateManager = new StateManager({ a: 1, b: 2, c: { d: 3 }, e: 4 });
 * stateManager.subscribe((hasChanged, state) => {
 *   // `hasChanged` is a function which takes a property path. It returns true if something at
 *   // or below the provided path has changed since the subscriber was last invoked.
 *   // The subscriber is allowed to do something which may update the state.
 *   // Subscribers will always get accurate information at the time they are invoked.
 *   // The current `state` is provided as the second argument.
 *   console.log('a changed?', hasChanged('a'));
 *   console.log('b changed?', hasChanged('b'));
 *   console.log('c changed?', hasChanged('b', 'c'));
 *   console.log('e changed?', hasChanged('e'));
 * });
 *
 * stateManager.update((state) => {
 *   state.a = 2;
 *   state.b.c = 3;
 * });
 *
 * // just before reaching this point the following would be logged:
 * // - a changed? true
 * // - b changed? true
 * // - c changed? true
 * // - e changed? false
 * ```
 *
 * There is also a `beforeUpdate` option, which is a callback that will run before any `update()`
 * callbacks are executed, and is allowed to update the state.
 *
 * @example
 * ```ts
 * const stateManager = new StateManager({ a: 1, b: 2, time: 0 }, {
 *   beforeUpdate: (state) => {
 *     console.log('updating time');
 *     state.time = 2000;
 *   }
 * }});
 *
 * stateManager.subscribe((hasChanged, state) => {
 *   console.log('a changed?', hasChanged('a'));
 * });
 *
 * stateManager.update((state) => {
 *   state.a = 2;
 * });
 * // just before reaching this point there would have been a console log with:
 * // - updating time
 * // - a changed? true
 * ```
 *
 * And there is an `afterUpdate` option, which is a callback that will run after any `update()`
 * callbacks are executed and all subscribers have been finished. If an exception occurred in
 * a subscriber you are able to handle that here.
 *
 * @example
 * ```ts
 * const stateManager = new StateManager({ a: 1, b: 2 }, {
 *   afterUpdate: ({ state, exceptionOccurred, retrieveExceptions }) => {
 *     console.log('after update');
 *   }
 * }});
 *
 * stateManager.subscribe((hasChanged, state) => {
 *   console.log('a changed?', hasChanged('a'));
 * });
 *
 * stateManager.update((state) => {
 *   state.a = 2;
 * });
 * // just before reaching this point there would have been a console log with:
 * // - a changed? true
 * // - after update
 * ```
 */
export class StateManager<TState extends object> {
  private readonly _state: TState;
  private readonly _wrappedState: TState;
  private readonly _readonlyState: Readonly<TState>;
  private readonly _changes: ChangeTracker;
  private readonly _listeners: ListenerWithChanges<TState>[] = [];
  private readonly _beforeUpdateFn: BeforeUpdateFn<TState> | null;
  private readonly _afterUpdateFn: AfterUpdateFn<TState> | null;
  private readonly _boundary: Boundary;
  private _exitDetector?: object;
  private _listenerExceptions: any[] = [];

  /**
   * Provide the initial state as the first argument. You must not mutate this state directly.
   * You can get a reference to a read-only version using the `getState()` method.
   *
   * The second argument is an optional object which can contain the following properties:
   * - beforeUpdate: This is called after the first `update()` call but before the callback.
   *                 It receives the state as the first argument and you are allowed to update
   *                 it.
   * - afterUpdate: This is called after an update occurs after the last subscriber has
   *                finished. It receives an object in the first argument with the following:
   *                - state: A `Proxy` to the current state (read-only).
   *                - exceptionOccurred: This is a boolean which is `true` if an exception
   *                                     occured in one or more of the subscribers.
   *                - retrieveExceptions: This returns an array of exceptions that occurred
   *                                      in one of more of the subscribers. If you do not call
   *                                      this function the exceptions will be thrown
   *                                      asynchronously when the current stack ends. If you
   *                                      do call this function the exceptions will not be
   *                                      thrown and it's up to you to handle them.
   * - proxy: An implementation of [`Proxy`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy/Proxy).
   *          Defaults to the native `Proxy` if available.
   */
  constructor(
    state: TState,
    {
      beforeUpdate,
      afterUpdate,
      Proxy: ProxyImpl = Proxy,
    }: StateManagerOpts<TState> = {}
  ) {
    if (typeof Proxy === 'undefined' && !ProxyImpl) {
      throw new Error(
        'An implementation of `Proxy` is required. Polyfill it or provide one on the `Proxy` option.'
      );
    }
    this._state = state;
    this._readonlyState = makeReadonly(ProxyImpl, this._state);
    this._wrappedState = wrap(ProxyImpl, state, {
      afterChange: (propertyPath, oldValue, newValue) => {
        if (oldValue === newValue) {
          return;
        }
        [
          this._changes,
          ...this._listeners.map(({ changes }) => changes),
        ].forEach((changes) => {
          const existing = changes.get(propertyPath);
          if (existing === ChangeTracker.missing) {
            changes.set(propertyPath, oldValue);
          } else if (newValue === existing) {
            changes.delete(propertyPath);
          }
        });
      },
    });
    this._beforeUpdateFn = beforeUpdate || null;
    this._afterUpdateFn = afterUpdate || null;
    this._boundary = new Boundary({
      onEnter: () => this._onEnter(),
      onExit: () => this._onExit(),
    });
    this._changes = new ChangeTracker();
  }

  /**
   * Returns a read-only version of the state.
   * This is not a snapshot.
   * The object you get back is a `Proxy` to the original state.
   * Properties to plain objects are also `Proxy`'s.
   */
  public getState(): Readonly<TState> {
    return this._readonlyState;
  }

  /**
   * Informs you if the thing at the given property path or below has changed.
   * This can be useful when you are subscribing if you want to catch up with changes
   * you missed.
   */
  public hasChanged(...propertyPath: PropertyPath): boolean {
    return this._changes.hasPrefix(propertyPath);
  }

  /**
   * This is how you update the state.
   *
   * The first argument takes a function that will be invoked synchronously and
   * provided with a `Proxy` to the current state as the first argument. To make changes
   * to the state just update the object. It is possible to have multiple nested update
   * calls and the subscribers will only be invoked when all calls have completed.
   *
   * The return value is passed through.
   *
   * It is possible to omit function, which is only useful if `beforeUpdate` makes
   * changes to the state.
   *
   * @example
   * ```ts
   * stateManager.update((state) => {
   *  state.a = 2;
   * });
   * ```
   *
   * The return value is passed through.
   */
  public update(): undefined;
  public update<T>(fn: UpdateFn<TState, T>): T;
  public update<T>(fn?: UpdateFn<TState, T>): T | undefined {
    if (!fn) {
      this._boundary.enter();
      return;
    }
    return this._boundary.enter(() => fn(this._wrappedState));
  }

  /**
   * This is how you are notified of changes to the state.
   *
   * The first argument taked a function which is invoked with 2 arguments:
   * - hasChanged: This is a function which takes a property path. It returns `true`
   *               if something at or below the provided path has changed since the
   *               subscriber was last invoked. E.g. `hasChanged('a', 'b')` for
   *               checking `state.a.b`.
   * - state: This is a `Proxy` to the current state (read-only).
   *
   * You are allowed to update the state again from your subscriber, but it needs to be from
   * an `update` call.
   *
   * Subscribers are invoked in the order they were registered. If a subscriber changes the
   * state the first subscriber will be invoked again. This means later subscribers will see
   * fewer changes as they see the combined changes of the earlier listeners.
   *
   * An object is returned that contains a `remove` function. Call this to unsubscribe.
   *
   * If your subscriber throws an error it will not prevent other subscribers being invoked.
   * The `afterUpdate` function will have an oppurtunity to handle the exception, or it will
   * be rethrown asynchronously.
   */
  public subscribe(listener: Listener<TState>): ListenerHandle {
    const listenerWithChanges = {
      listener,
      removed: false,
      changes: new ChangeTracker(),
    };
    this._listeners.push(listenerWithChanges);

    return {
      remove: () => {
        if (listenerWithChanges.removed) {
          return;
        }
        listenerWithChanges.removed = true;
        this._listeners.splice(this._listeners.indexOf(listenerWithChanges), 1);
      },
    };
  }

  private _onEnter(): void {
    if (this._beforeUpdateFn) {
      this._beforeUpdateFn(this._wrappedState);
    }
  }

  private _onExit(): void {
    this._exitDetector = Object.create(null);
    const exitDetector = this._exitDetector;
    const finishedListeners = this._listeners
      .slice() // listeners may remove themselves. `some` would jump over items if the array changes beneath it
      .every((listenerWithState) => {
        if (listenerWithState.removed) {
          return false;
        }
        try {
          this._updateListener(listenerWithState);
        } catch (e) {
          this._listenerExceptions.push(e);
        }
        return this._exitDetector === exitDetector;
      });
    if (finishedListeners) {
      this._afterUpdate();
    }
  }

  private _updateListener(
    listenerWithChanges: ListenerWithChanges<TState>
  ): void {
    const { listener, changes } = listenerWithChanges;
    const allPropertyPaths = changes.keys();
    if (allPropertyPaths.length) {
      listenerWithChanges.changes = new ChangeTracker();
      const hasChanged: HasChanged = (...propertyPath: PropertyPath): boolean =>
        changes.hasPrefix(propertyPath);
      listener(hasChanged, this._readonlyState);
    }
  }

  private _afterUpdate(): void {
    const listenerExceptions = this._listenerExceptions;
    this._listenerExceptions = [];
    const exceptionOccurred = !!listenerExceptions.length;
    let exceptionsHandled = !exceptionOccurred;
    let afterUpdateExceptionOccurred = false;
    let afterUpdateException: any;
    if (this._afterUpdateFn) {
      try {
        this._afterUpdateFn({
          state: this._readonlyState,
          exceptionOccurred,
          retrieveExceptions: () => {
            exceptionsHandled = true;
            return listenerExceptions;
          },
        });
      } catch (e) {
        afterUpdateExceptionOccurred = true;
        afterUpdateException = e;
      }
    }
    if (!exceptionsHandled) {
      this._throwAsync(listenerExceptions);
    }
    if (afterUpdateExceptionOccurred) {
      throw afterUpdateException;
    }
  }

  private _throwAsync(exceptions: any[]): void {
    exceptions.forEach((error) => {
      setTimeout(() => {
        throw error;
      }, 0);
    });
  }
}
