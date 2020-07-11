import { StateManager } from './state-manager';
import { CannotUpdateFromBeforeUpdateError } from './state-manager-error';

describe('StateManager', () => {
  let throwAsyncSpy: jest.SpyInstance;
  beforeEach(() => {
    throwAsyncSpy = jest
      .spyOn(StateManager.prototype, '_throwAsync' as any)
      .mockImplementation();
  });

  it('calls the update() callback with the correct input', () => {
    const stateManager = new StateManager({ a: 1, b: true });
    const spy = jest.fn();
    stateManager.update(spy);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).lastCalledWith({ a: 1, b: true }, expect.any(Function));
  });

  it('returns the immutable state from getState()', () => {
    const stateManager = new StateManager({ a: 1, b: true, c: { d: true } });
    const state = stateManager.getState();
    expect(state).toEqual({ a: 1, b: true, c: { d: true } });
    expect(Object.isFrozen(state)).toBe(true);
    stateManager.update((state) => {
      state.a = 2;
      state.c.d = false;
    });
    const state2 = stateManager.getState();
    expect(state).toEqual({ a: 1, b: true, c: { d: true } });
    expect(state2).toEqual({ a: 2, b: true, c: { d: false } });
    expect(Object.isFrozen(state2)).toBe(true);
  });

  it('returns the correct immutable changes from getStateChanges()', () => {
    const stateManager = new StateManager({ a: 1, b: true, c: { d: true } });
    const changes = stateManager.getStateChanges();
    expect(changes).toEqual({});
    expect(Object.isFrozen(changes)).toBe(true);
    stateManager.update((state) => {
      state.a = 2;
      state.c.d = false;
    });
    const changes2 = stateManager.getStateChanges();
    expect(changes).toEqual({});
    expect(changes2).toEqual({ a: true, c: { d: true } });
    expect(Object.isFrozen(changes2)).toBe(true);
  });

  it('calls the subscriber when the state changes with the correct input', () => {
    const stateManager = new StateManager({ a: 1, b: true });
    const spy = jest.fn();
    stateManager.subscribe(spy);
    stateManager.update((state) => (state.a = 2));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).lastCalledWith({ a: true }, { a: 2, b: true });
    expect(Object.isSealed(spy.mock.calls[0][0])).toBe(true);
    expect(Object.isSealed(spy.mock.calls[0][1])).toBe(true);
    stateManager.update((state) => (state.b = false));
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).lastCalledWith({ b: true }, { a: 2, b: false });
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
    let log: Array<{ id: number; state: any; changes: any }> = [];
    stateManager.subscribe((changes, state) => {
      log.push({ id: 1, changes, state });
      stateManager.update((stateToUpdate) => (stateToUpdate.a = 3));
    });
    stateManager.subscribe((changes, state) => {
      log.push({ id: 2, changes, state });
    });
    stateManager.update((state) => (state.a = 2));
    expect(log).toEqual([
      { id: 1, changes: { a: true }, state: { a: 2, b: true } },
      { id: 1, changes: { a: true }, state: { a: 3, b: true } },
      { id: 2, changes: { a: true }, state: { a: 3, b: true } },
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
    expect(spy).toBeCalledWith({ a: true }, { a: 2, b: true });
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

  it('supports marking non objects of the state', () => {
    const b = () => {};
    const stateManager = new StateManager({ a: 1, b });
    const spy = jest.fn();
    stateManager.subscribe(spy);
    stateManager.update(({ b }, mark) => {
      mark(b);
    });
    expect(spy).lastCalledWith({ b: true }, { a: 1, b });
    stateManager.update((state) => (state.a = 2));
    expect(spy).lastCalledWith({ a: true }, { a: 2, b });
  });

  it('supports class instances', () => {
    class SomeClass {
      private i = 123;
      public getI() {
        return this.i;
      }
    }

    const b = new SomeClass();
    const stateManager = new StateManager({ a: 1, b });
    const spy = jest.fn();
    stateManager.subscribe(spy);
    stateManager.update(({ b }) => {
      expect(b.getI()).toBe(123);
    });
    expect(spy).toHaveBeenCalledTimes(0);
    const b2 = new SomeClass();
    stateManager.update((state) => {
      state.b = b2;
    });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).lastCalledWith({ b: true }, { a: 1, b: b2 });
    stateManager.update(({ b }, mark) => {
      mark(b);
    });
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).lastCalledWith({ b: true }, { a: 1, b: b2 });
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

  describe('maxDepth', () => {
    it('stops finding changes at the correct level', () => {
      const stateManager = new StateManager(
        { a: { b: true }, c: 1 },
        { maxDepth: 1 }
      );
      stateManager.update((state) => {
        state.a = { b: false };
        state.c = 2;
      });
      const changes = stateManager.getStateChanges();
      expect(changes).toEqual({ c: true });
    });

    it('stops returning object clones at the correct level', () => {
      const b = { c: true };
      const a = { b };
      const stateManager = new StateManager({ a }, { maxDepth: 2 });
      stateManager.update((state) => {
        expect(state.a).not.toBe(a);
        expect(state.a.b).toBe(b);
      });
    });
  });
});
