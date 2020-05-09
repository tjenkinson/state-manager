import { Boundary, CannotEnterError } from '@tjenkinson/boundary';
import { CannotUpdateFromBeforeUpdateError } from './state-manager-error';

export { CannotUpdateFromBeforeUpdateError } from './state-manager-error';

export type StateManagerOpts<TState> = {
  beforeUpdate?: BeforeUpdateFn<TState>;
  afterUpdate?: AfterUpdateFn<TState>;
};

export type Listener<TState> = (
  changes: Readonly<Partial<TState>>,
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

type ListenerWithState<TState> = {
  state: TState;
  listener: Listener<TState>;
  removed: boolean;
};

function clone<T extends object>(input: T): T {
  const result: T = Object.create(null);
  for (const key in input) {
    result[key] = input[key];
  }
  return result;
}

function calculateDiff<TState>(
  state: TState,
  oldState: TState
): Readonly<Partial<TState>> {
  const diff: Partial<TState> = Object.create(null);
  for (const key in state) {
    if (state[key] !== oldState[key]) {
      diff[key] = state[key];
    }
  }
  return Object.freeze(diff);
}

/**
 * This provides a controlled way of managing a state object, and being notified when
 * parts of it have changed. It ensures that state updates are atomic, meaning subscribers
 * are only notified of changes when the state has been updated completely.
 *
 * - To update the state use the update() method.
 * - To subscribe to state changes use the subscribe() method.
 *
 * @example
 * ```ts
 * const stateManager = new StateManager({ a: 1, b: 2 });
 * stateManager.subscribe((diff, state) => {
 *   // `diff` is an object which contains only the keys of the state where the values
 *   // have changed since this subscriber was last invoked. The subscriber is allowed to
 *   // do something which may update the state. Subscribers will always get accurate information
 *   // at the time they are invoked.
 *   console.log('diff', diff);
 * });
 *
 * stateManager.update((state) => {
 *   state.a = 2;
 * });
 *
 * // just before reaching this point there would have been a console log with changes `{ a: 2 }`
 * ```
 *
 * There is also a `beforeUpdate` option, which is a callback that will run before any update()
 * callbacks are executed, and is allowed to update the state.
 * It is not a allowed to call `update`.
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
 * stateManager.subscribe((changes, state) => {
 *   console.log('changes', changes);
 * });
 *
 * stateManager.update((state) => {
 *   state.a = 2;
 * });
 * // just before reaching this point there would have been a console log with:
 * // - updating time
 * // - changes { a: 2, time: 2000 }
 * ```
 *
 * And there is an `afterUpdate` option, which is a callback that will run after any update()
 * callbacks are executed and all subscribers have been finished. If an exceotion occurred in
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
 * stateManager.subscribe((changes, state) => {
 *   console.log('changes', changes);
 * });
 *
 * stateManager.update((state) => {
 *   state.a = 2;
 * });
 * // just before reaching this point there would have been a console log with:
 * // - changes { a: 2 }
 * // - after update
 * ```
 */
export class StateManager<TState extends object> {
  private readonly _initialState: TState;
  private readonly _state: TState;
  private readonly _listeners: ListenerWithState<TState>[] = [];
  private readonly _beforeUpdateFn: BeforeUpdateFn<TState> | null;
  private readonly _afterUpdateFn: AfterUpdateFn<TState> | null;
  private readonly _boundary: Boundary;
  private _exitDetector?: object;
  private _listenerExceptions: any[] = [];

  /**
   * Provide the initial state as the first argument.
   *
   * The second argument is an optional object which can contain the following properties:
   * - beforeUpdate: This is called after the first `update()` call but before the callback.
   *                 It receives the state as the first argument and you are allowed to update
   *                 it. You are not allowed to make a call to `update()` from this function.
   * - afterUpdate: This is called after an update occurs after the last subscriber has
   *                finished. It receives an object in the first argument with the following:
   *                - state: The current state (read only).
   *                - exceptionOccurred: This is a boolean which is `true` if an exception
   *                                     occured in one or more of the subscribers.
   *                - retrieveExceptions: This returns an array of exceptions that occurred
   *                                      in one of more of the subscribers. If you do not call
   *                                      this function the exceotions will be thrown
   *                                      asynchronously when the current stack ends. If you
   *                                      do call this function the exceptions will not be
   *                                      thrown and it's up to you to handle them.
   */
  constructor(
    initialState: TState,
    { beforeUpdate, afterUpdate }: StateManagerOpts<TState> = {}
  ) {
    this._initialState = clone(initialState);
    this._state = clone(initialState);
    this._beforeUpdateFn = beforeUpdate || null;
    this._afterUpdateFn = afterUpdate || null;
    this._boundary = new Boundary({
      onEnter: () => this._onEnter(),
      onExit: () => this._onExit(),
    });
  }

  /**
   * Returns the current state (read only).
   */
  public getState(): Readonly<TState> {
    return Object.freeze(clone(this._state));
  }

  /**
   * Returns the diff of the current state compared to the initial state (read only).
   * This can be useful when you are subscribing if you want to catch up with changes
   * you missed.
   */
  public getStateDiff(): Readonly<Partial<TState>> {
    return calculateDiff(this._state, this._initialState);
  }

  /**
   * This is how you update the state.
   *
   * The first argument takes a function that will be invoked synchronously and
   * provided with the current state as the first argument. To make changes to the
   * state just update the object. It is possible to have multiple nested update calls
   * and the subscribers will only be invoked when all calls have completed.
   *
   * It is possible to omit function, meaning just `beforeUpdate` and `afterUpdate`
   * will be called.
   */
  public update(): undefined;
  public update<T>(fn: UpdateFn<TState, T>): T;
  public update<T>(fn?: UpdateFn<TState, T>): T | undefined {
    if (!fn) {
      this._boundary.enter();
      return;
    }
    return this._boundary.enter(() => fn(this._state));
  }

  /**
   * This is how you are notified of changes to the state.
   *
   * The first argument taked a function which is invoked with 2 arguments:
   * - diff: This is an object which contains just the keys of the state that have changed
   *         since the last time you were called or subscribed (read only).
   * - state: This is the current state (read only).
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
    const listenerWithState = {
      listener,
      removed: false,
      state: clone(this._state),
    };
    this._listeners.push(listenerWithState);

    return {
      remove: () => {
        if (listenerWithState.removed) {
          return;
        }
        listenerWithState.removed = true;
        this._listeners.splice(this._listeners.indexOf(listenerWithState), 1);
      },
    };
  }

  private _onEnter(): void {
    if (this._beforeUpdateFn) {
      try {
        this._beforeUpdateFn(this._state);
      } catch (e) {
        if (e === CannotEnterError) {
          throw CannotUpdateFromBeforeUpdateError;
        }
        throw e;
      }
    }
  }

  private _onExit(): void {
    const exitDetector = this._exitDetector;
    this._exitDetector = Object.create(null);
    const finishedListeners = !this._listeners
      .slice() // listeners may remove themselves. `some` would jump over items if the array changes beneath it
      .some((listenerWithState) => {
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

  private _updateListener(listenerWithState: ListenerWithState<TState>): void {
    const { listener, state } = listenerWithState;
    const diff = calculateDiff(this._state, state);
    if (Object.keys(diff).length) {
      listenerWithState.state = this.getState();
      listener(diff, this.getState());
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
          state: this.getState(),
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
