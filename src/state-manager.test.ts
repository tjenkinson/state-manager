import { StateManager } from './state-manager';
import { CannotUpdateFromBeforeUpdateError } from './state-manager-error';

describe('StateManager', () => {
  let throwAsyncSpy: jest.SpyInstance;
  beforeEach(() => {
    throwAsyncSpy = jest
      .spyOn(StateManager.prototype, '_throwAsync' as any)
      .mockImplementation();
  });

  it('returns the immutable state from getState()', () => {
    const stateManager = new StateManager({ a: 1, b: true });
    const state = stateManager.getState();
    expect(state).toEqual({ a: 1, b: true });
    expect(Object.isFrozen(state)).toBe(true);
    stateManager.update((state) => (state.a = 2));
    const state2 = stateManager.getState();
    expect(state).toEqual({ a: 1, b: true });
    expect(state2).toEqual({ a: 2, b: true });
    expect(Object.isFrozen(state2)).toBe(true);
  });

  it('returns the correct immutable diff from getStateDiff()', () => {
    const stateManager = new StateManager({ a: 1, b: true });
    const diff = stateManager.getStateDiff();
    expect(diff).toEqual({});
    expect(Object.isFrozen(diff)).toBe(true);
    stateManager.update((state) => (state.a = 2));
    const diff2 = stateManager.getStateDiff();
    expect(diff).toEqual({});
    expect(diff2).toEqual({ a: 2 });
    expect(Object.isFrozen(diff2)).toBe(true);
  });

  it('calls the subscriber when the state changes with the correct input', () => {
    const stateManager = new StateManager({ a: 1, b: true });
    const spy = jest.fn();
    stateManager.subscribe(spy);
    stateManager.update((state) => (state.a = 2));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).lastCalledWith({ a: 2 }, { a: 2, b: true });
    expect(Object.isSealed(spy.mock.calls[0][0])).toBe(true);
    expect(Object.isSealed(spy.mock.calls[0][1])).toBe(true);
    stateManager.update((state) => (state.b = false));
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).lastCalledWith({ b: false }, { a: 2, b: false });
    expect(Object.isSealed(spy.mock.calls[1][0])).toBe(true);
    expect(Object.isSealed(spy.mock.calls[1][1])).toBe(true);
  });

  it('does not call the subscriber when the state does not change', () => {
    const stateManager = new StateManager({ a: 1, b: true });
    const spy = jest.fn();
    stateManager.subscribe(spy);
    stateManager.update();
    expect(spy).toHaveBeenCalledTimes(0);
  });

  it('always invokes subscribers with the correct state', () => {
    const stateManager = new StateManager({ a: 1, b: true });
    let log: Array<{ id: number; state: any; diff: any }> = [];
    stateManager.subscribe((diff, state) => {
      log.push({ id: 1, diff, state });
      stateManager.update((stateToUpdate) => (stateToUpdate.a = 3));
    });
    stateManager.subscribe((diff, state) => {
      log.push({ id: 2, diff, state });
    });
    stateManager.update((state) => (state.a = 2));
    expect(log).toEqual([
      { id: 1, diff: { a: 2 }, state: { a: 2, b: true } },
      { id: 1, diff: { a: 3 }, state: { a: 3, b: true } },
      { id: 2, diff: { a: 3 }, state: { a: 3, b: true } },
    ]);
  });

  it('removes the subscriber', () => {
    const stateManager = new StateManager({ a: 1, b: true });
    const spy = jest.fn();
    const { remove } = stateManager.subscribe(spy);
    stateManager.update((state) => (state.a = 2));
    expect(spy).toBeCalledTimes(1);
    remove();
    stateManager.update((state) => (state.a = 3));
    expect(spy).toBeCalledTimes(1);
  });

  it('handles a listener removing a later subscriber', () => {
    const stateManager = new StateManager({ a: 1, b: true });
    const spy = jest.fn();
    const spy2 = jest.fn();
    stateManager.subscribe(() => remove());
    stateManager.subscribe(spy2);
    const { remove } = stateManager.subscribe(spy);
    stateManager.update((state) => (state.a = 2));
    expect(spy).toBeCalledTimes(0);
    expect(spy2).toBeCalledTimes(1);
  });

  it('handles a listener removing itself', () => {
    const stateManager = new StateManager({ a: 1, b: true });
    const spy = jest.fn();
    const { remove } = stateManager.subscribe(() => remove());
    stateManager.subscribe(spy);
    stateManager.update((state) => (state.a = 2));
    expect(spy).toBeCalledTimes(1);
  });

  it('provides the correct input to beforeUpdate', () => {
    const spy = jest.fn();
    const stateManager = new StateManager(
      { a: 1, b: true },
      { beforeUpdate: spy }
    );
    stateManager.update();
    expect(spy).toBeCalledTimes(1);
    expect(spy).toBeCalledWith({ a: 1, b: true });
  });

  it('allows beforeUpdate to update the state', () => {
    const stateManager = new StateManager(
      { a: 1, b: true },
      {
        beforeUpdate: (state) => {
          state.a = 2;
        },
      }
    );
    const spy = jest.fn();
    stateManager.subscribe(spy);
    stateManager.update();
    expect(spy).toBeCalledTimes(1);
    expect(spy).toBeCalledWith({ a: 2 }, { a: 2, b: true });
  });

  it('calls afterUpdate after subscribers', () => {
    let log: number[] = [];
    const stateManager = new StateManager(
      { a: 1, b: true },
      {
        afterUpdate: () => log.push(2),
      }
    );
    stateManager.subscribe(() => log.push(1));
    stateManager.update((state) => (state.a = 2));
    expect(log).toEqual([1, 2]);
  });

  it('calls afterUpdate when there is no change', () => {
    let log: number[] = [];
    const stateManager = new StateManager(
      { a: 1, b: true },
      {
        afterUpdate: () => log.push(2),
      }
    );
    stateManager.update();
    expect(log).toEqual([2]);
  });

  it('calls afterUpdate with the correct input', () => {
    const spy = jest.fn();
    const stateManager = new StateManager(
      { a: 1, b: true },
      {
        afterUpdate: spy,
      }
    );
    stateManager.update((state) => (state.a = 2));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).lastCalledWith({
      state: { a: 2, b: true },
      exceptionOccurred: false,
      retrieveExceptions: expect.any(Function),
    });
    expect(Object.isSealed(spy.mock.calls[0][0].state)).toBe(true);
  });

  it('passes through the return value from update()', () => {
    const stateManager = new StateManager({ a: 1, b: true });
    const mockReturnValue = Symbol('mockReturnValue');
    expect(stateManager.update(() => mockReturnValue)).toBe(mockReturnValue);
  });

  describe('error handling', () => {
    it('rethrows an error from beforeUpdate after updating state and does not call update callbacks', (done) => {
      const mockError = Symbol('mockError');
      const stateManager = new StateManager(
        { a: 1, b: true },
        {
          beforeUpdate: (state) => {
            state.a = 2;
            throw mockError;
          },
        }
      );

      const spy = jest.fn();
      try {
        stateManager.update(spy);
        done.fail('expecting error');
      } catch (e) {
        expect(e).toBe(mockError);
      }
      expect(stateManager.getState()).toEqual({ a: 2, b: true });
      expect(spy).toHaveBeenCalledTimes(0);
      done();
    });

    it('rethrows an error from update after updating state', (done) => {
      const mockError = Symbol('mockError');
      const stateManager = new StateManager({ a: 1, b: true });

      try {
        stateManager.update((state) => {
          state.a = 2;
          throw mockError;
        });
        done.fail('expecting error');
      } catch (e) {
        expect(e).toBe(mockError);
      }
      expect(stateManager.getState()).toEqual({ a: 2, b: true });
      done();
    });

    it('throws listener errors async if not handled in afterUpdate and still calls all listeners', () => {
      const mockError = Symbol('mockError');
      const stateManager = new StateManager({ a: 1, b: true });
      const spy = jest.fn();

      stateManager.subscribe(() => {
        throw mockError;
      });
      stateManager.subscribe(spy);
      stateManager.update((state) => (state.a = 2));

      expect(spy).toHaveBeenCalledTimes(1);
      expect(stateManager.getState()).toEqual({ a: 2, b: true });
      expect(throwAsyncSpy).toHaveBeenCalledTimes(1);
      expect(throwAsyncSpy).lastCalledWith([mockError]);
    });

    it('throws listener errors async if retrieveExceptions not called in afterUpdate', () => {
      const mockError = Symbol('mockError');
      const spy = jest.fn();
      const afterUpdateSpy = jest.fn();
      const stateManager = new StateManager(
        { a: 1, b: true },
        {
          afterUpdate: afterUpdateSpy,
        }
      );

      stateManager.subscribe(() => {
        throw mockError;
      });
      stateManager.subscribe(spy);
      stateManager.update((state) => (state.a = 2));

      expect(spy).toHaveBeenCalledTimes(1);
      expect(stateManager.getState()).toEqual({ a: 2, b: true });
      expect(afterUpdateSpy).toHaveBeenCalledTimes(1);
      expect(afterUpdateSpy).lastCalledWith({
        state: { a: 2, b: true },
        exceptionOccurred: true,
        retrieveExceptions: expect.any(Function),
      });
      expect(throwAsyncSpy).toHaveBeenCalledTimes(1);
      expect(throwAsyncSpy).lastCalledWith([mockError]);
    });

    it('does not throw listener errors async if retrieveExceptions called in afterUpdate', () => {
      const mockError = Symbol('mockError');
      const spy = jest.fn();
      let exceptions: any[] | null = null;
      const stateManager = new StateManager(
        { a: 1, b: true },
        {
          afterUpdate: ({ retrieveExceptions }) => {
            exceptions = retrieveExceptions();
          },
        }
      );

      stateManager.subscribe(() => {
        throw mockError;
      });
      stateManager.subscribe(spy);
      stateManager.update((state) => (state.a = 2));

      expect(exceptions).toEqual([mockError]);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(throwAsyncSpy).toHaveBeenCalledTimes(0);
    });

    it('rethrows error from afterUpdate', (done) => {
      const mockError = Symbol('mockError');
      const stateManager = new StateManager(
        { a: 1, b: true },
        {
          afterUpdate: () => {
            throw mockError;
          },
        }
      );

      try {
        stateManager.update((state) => (state.a = 2));
        done.fail('expecting error');
      } catch (e) {
        expect(e).toBe(mockError);
      }
      expect(stateManager.getState()).toEqual({ a: 2, b: true });
      done();
    });

    it('throws CannotUpdateFromBeforeUpdateError if beforeUpdate calls update', (done) => {
      const stateManager = new StateManager(
        { a: 1, b: true },
        {
          beforeUpdate: () => {
            stateManager.update();
          },
        }
      );

      try {
        stateManager.update();
        done.fail('expecting error');
      } catch (e) {
        expect(e).toBe(CannotUpdateFromBeforeUpdateError);
      }
      done();
    });
  });

  describe('subscribeIndividual()', () => {
    it('only calls the subscriber when the value changes', () => {
      const stateManager = new StateManager({ a: 1, b: true });
      const spy = jest.fn();
      stateManager.subscribeIndividual('a', spy);
      stateManager.update((state) => (state.b = false));
      expect(spy).toBeCalledTimes(0);
      stateManager.update((state) => (state.a = 2));
      expect(spy).toBeCalledTimes(1);
      expect(spy).lastCalledWith(2);
    });

    it('unsubscribes when remove() called', () => {
      const stateManager = new StateManager({ a: 1, b: true });
      const spy = jest.fn();
      const { remove } = stateManager.subscribeIndividual('a', spy);
      stateManager.update((state) => (state.a = 2));
      expect(spy).toBeCalledTimes(1);
      expect(spy).lastCalledWith(2);
      remove();
      stateManager.update((state) => (state.a = 3));
      expect(spy).toBeCalledTimes(1);
    });
  });
});
