import { HasChanged, StateManager } from './state-manager';
import ProxyPolyfillBuilder from 'proxy-polyfill/src/proxy';
const proxyPolyfill = ProxyPolyfillBuilder();

describe('StateManager', () => {
  (
    [
      [Proxy, 'native'],
      [proxyPolyfill as unknown as ProxyConstructor, 'polyfill'],
    ] as const
  ).forEach(([ProxyImpl, proxyType]) => {
    describe(`with ${proxyType} Proxy`, () => {
      let throwAsyncSpy: jest.SpyInstance;
      beforeEach(() => {
        throwAsyncSpy = jest
          .spyOn(StateManager.prototype, '_throwAsync' as any)
          .mockImplementation();
      });

      it('calls the update() callback with the correct input', () => {
        const stateManager = new StateManager(
          { a: 1, b: true },
          { Proxy: ProxyImpl }
        );
        const spy = jest.fn();
        stateManager.update(spy);
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy).lastCalledWith({ a: 1, b: true });
      });

      it('returns mutable state from getState()', () => {
        const stateManager = new StateManager(
          {
            a: 1,
            b: true,
            c: {
              d: true,
            },
          },
          {
            Proxy: ProxyImpl,
            beforeUpdate: () => {
              expect(state.a).toBe(1);
            },
            afterUpdate: () => {
              expect(state.a).toBe(2);
            },
          }
        );
        const state = stateManager.getState();
        expect(state).toEqual({
          a: 1,
          b: true,
          c: {
            d: true,
          },
        });

        state.a = 2;
        expect(stateManager.hasChanged('a')).toBe(true);
        expect(state.a).toEqual(2);
      });

      it('returns the correct result from hasChanged', () => {
        const stateManager = new StateManager(
          {
            a: 1,
            b: true,
            c: { d: true },
          },
          { Proxy: ProxyImpl }
        );
        stateManager.update((state) => (state.a = 2));
        expect(stateManager.hasChanged('a')).toBe(true);
        expect(stateManager.hasChanged('b')).toBe(false);
        expect(stateManager.hasChanged('c')).toBe(false);
        stateManager.update((state) => (state.c.d = false));
        expect(stateManager.hasChanged('c')).toBe(true);
        expect(stateManager.hasChanged('c', 'd')).toBe(true);
      });

      if (proxyType !== 'polyfill') {
        it('supports arrays', () => {
          const stateManager = new StateManager<{ a: (number | number[])[] }>(
            {
              a: [0],
            },
            { Proxy: ProxyImpl }
          );

          let subscriber: (hasChanged: HasChanged) => void;
          let subscribeCalls = 0;
          stateManager.subscribe((hasChanged) => {
            subscribeCalls++;
            subscriber(hasChanged);
          });

          subscriber = (hasChanged: HasChanged) => {
            expect(hasChanged('a')).toBe(true);
            expect(hasChanged('a', 0)).toBe(false);
            expect(hasChanged('a', 1)).toBe(true);
          };
          stateManager.update((state) => state.a.push(1));
          expect(subscribeCalls).toBe(1);

          subscriber = (hasChanged: HasChanged) => {
            expect(hasChanged('a')).toBe(true);
            expect(hasChanged('a', 0)).toBe(true);
            expect(hasChanged('a', 1)).toBe(true);
            expect(hasChanged('a', 2)).toBe(false);
          };
          stateManager.update((state) => state.a.shift());
          expect(subscribeCalls).toBe(2);

          subscriber = (hasChanged: HasChanged) => {
            expect(hasChanged('a')).toBe(true);
            expect(hasChanged('a', 0)).toBe(false);
            expect(hasChanged('a', 1)).toBe(true);
            expect(hasChanged('a', 2)).toBe(true);
            expect(hasChanged('a', 3)).toBe(true);
            expect(hasChanged('a', 4)).toBe(false);
          };
          stateManager.update((state) => state.a.push(2, 3, 4));
          expect(subscribeCalls).toBe(3);

          subscriber = (hasChanged: HasChanged) => {
            expect(hasChanged('a')).toBe(true);
            expect(hasChanged('a', 3)).toBe(false);
            expect(hasChanged('a', 4)).toBe(true);
          };
          stateManager.update((state) => state.a.push([100]));
          expect(subscribeCalls).toBe(4);

          subscriber = (hasChanged: HasChanged) => {
            expect(hasChanged('a')).toBe(true);
            expect(hasChanged('a', 4)).toBe(true);
            expect(hasChanged('a', 4, 0)).toBe(false);
            expect(hasChanged('a', 4, 1)).toBe(true);
          };
          stateManager.update((state) => (state.a[4] as number[]).push(101));
          expect(subscribeCalls).toBe(5);

          subscriber = (hasChanged: HasChanged) => {
            expect(hasChanged('a')).toBe(true);
            expect(hasChanged('a', 'anything')).toBe(true);
          };
          stateManager.update((state) => (state.a = []));
          expect(subscribeCalls).toBe(6);

          subscriber = (hasChanged: HasChanged) => {
            expect(hasChanged('a')).toBe(true);
            expect(hasChanged('a', 'b')).toBe(true);
            expect(hasChanged('a', 0)).toBe(false);
          };
          stateManager.update((state) => ((state.a as any).b = true));
          expect(subscribeCalls).toBe(7);
        });

        it('supports array at root', () => {
          const stateManager = new StateManager([0], { Proxy: ProxyImpl });
          stateManager.update((state) => state.push(1));
          expect(stateManager.hasChanged(0)).toBe(false);
          expect(stateManager.hasChanged(1)).toBe(true);
          expect(stateManager.hasChanged(2)).toBe(false);
        });
      }

      it('calls the subscriber when the state changes with the correct input', () => {
        const stateManager = new StateManager(
          { a: 1, b: true },
          { Proxy: ProxyImpl }
        );
        const spy = jest.fn();
        stateManager.subscribe(spy);
        stateManager.update((state) => (state.a = 2));
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy).lastCalledWith(expect.any(Function), { a: 2, b: true });
        expect(spy.mock.calls[0][0]()).toBe(true);
        expect(spy.mock.calls[0][0]('a')).toBe(true);
        expect(spy.mock.calls[0][0]('b')).toBe(false);

        stateManager.update((state) => (state.b = false));
        expect(spy).toHaveBeenCalledTimes(2);
        expect(spy).lastCalledWith(expect.any(Function), { a: 2, b: false });
        expect(spy.mock.calls[1][0]()).toBe(true);
        expect(spy.mock.calls[1][0]('a')).toBe(false);
        expect(spy.mock.calls[1][0]('b')).toBe(true);
      });

      it('allows state to be mutated in subscriber', () => {
        const stateManager = new StateManager({ a: 0 }, { Proxy: ProxyImpl });

        const subscriber1 = jest.fn();
        const subscriber2 = jest.fn();

        stateManager.subscribe((hasChanged, state) => {
          subscriber1();
          state.a = 2;
        });
        stateManager.subscribe(subscriber2);

        stateManager.getState().a = 1;

        expect(subscriber1).toHaveBeenCalledTimes(2);
        expect(subscriber2).toHaveBeenCalledTimes(1);
      });

      if (proxyType !== 'polyfill') {
        it('handles updates of undefined', () => {
          const stateManager = new StateManager(
            { a: 1 as any },
            { Proxy: ProxyImpl }
          );
          const spy = jest.fn();
          stateManager.subscribe(spy);

          stateManager.update((state) => (state.a = undefined));
          expect(spy).toHaveBeenCalledTimes(1);
          expect(spy).lastCalledWith(expect.any(Function), {
            a: undefined,
          });
          expect(spy.mock.calls[0][0]('a')).toBe(true);

          stateManager.update((state) => {
            delete state.a;
          });
          expect(spy).toHaveBeenCalledTimes(2);
          expect(spy).lastCalledWith(expect.any(Function), {});
          expect(spy.mock.calls[1][0]('a')).toBe(true);

          stateManager.update((state) => (state.a = undefined));
          expect(spy).toHaveBeenCalledTimes(3);
          expect(spy).lastCalledWith(expect.any(Function), { a: undefined });
          expect(spy.mock.calls[2][0]('a')).toBe(true);

          stateManager.update((state) => (state.a = false));
          expect(spy).toHaveBeenCalledTimes(4);
          expect(spy).lastCalledWith(expect.any(Function), { a: false });
          expect(spy.mock.calls[3][0]('a')).toBe(true);
        });
      }

      it('does not call the subscriber when the state does not change', () => {
        const stateManager = new StateManager(
          { a: 1, b: true },
          { Proxy: ProxyImpl }
        );
        const spy = jest.fn();
        stateManager.subscribe(spy);
        stateManager.update();
        expect(spy).toHaveBeenCalledTimes(0);
      });

      it('always invokes subscribers with the correct state', () => {
        const stateManager = new StateManager(
          { a: 1, b: true },
          { Proxy: ProxyImpl }
        );
        let log: Array<{
          id: number;
          a: number;
          b: boolean;
          aChanged: boolean;
          bChanged: boolean;
        }> = [];
        stateManager.subscribe((hasChanged, state) => {
          log.push({
            id: 1,
            a: state.a,
            b: state.b,
            aChanged: hasChanged('a'),
            bChanged: hasChanged('b'),
          });
          stateManager.update((stateToUpdate) => {
            stateToUpdate.a = 3;
            stateToUpdate.b = false;
          });
        });
        stateManager.subscribe((hasChanged, state) => {
          log.push({
            id: 2,
            a: state.a,
            b: state.b,
            aChanged: hasChanged('a'),
            bChanged: hasChanged('b'),
          });
        });
        stateManager.update((state) => (state.a = 2));
        expect(log).toEqual([
          { id: 1, a: 2, b: true, aChanged: true, bChanged: false },
          { id: 1, a: 3, b: false, aChanged: true, bChanged: true },
          { id: 2, a: 3, b: false, aChanged: true, bChanged: true },
        ]);
      });

      it('removes the subscriber', () => {
        const stateManager = new StateManager(
          { a: 1, b: true },
          { Proxy: ProxyImpl }
        );
        const spy = jest.fn();
        const { remove } = stateManager.subscribe(spy);
        stateManager.update((state) => (state.a = 2));
        expect(spy).toBeCalledTimes(1);
        remove();
        stateManager.update((state) => (state.a = 3));
        expect(spy).toBeCalledTimes(1);
      });

      it('handles a listener removing a later subscriber', () => {
        const stateManager = new StateManager(
          { a: 1, b: true },
          { Proxy: ProxyImpl }
        );
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
        const stateManager = new StateManager(
          { a: 1, b: true },
          { Proxy: ProxyImpl }
        );
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
          { Proxy: ProxyImpl, beforeUpdate: spy }
        );
        stateManager.update();
        expect(spy).toBeCalledTimes(1);
        expect(spy).toBeCalledWith({ a: 1, b: true });
      });

      it('allows beforeUpdate to update the state', () => {
        const beforeUpdateSpy = jest.fn();
        const subscribeSpy = jest.fn();
        const stateManager = new StateManager(
          { a: 1, b: true },
          {
            Proxy: ProxyImpl,
            beforeUpdate: (state) => {
              beforeUpdateSpy();
              state.a = 2;
            },
          }
        );
        stateManager.subscribe(subscribeSpy);
        stateManager.update();
        expect(beforeUpdateSpy).toBeCalledTimes(1);
        expect(subscribeSpy).toBeCalledTimes(1);
        expect(subscribeSpy).toBeCalledWith(expect.any(Function), {
          a: 2,
          b: true,
        });
      });

      it('calls afterUpdate once after subscribers', () => {
        let log: number[] = [];
        const stateManager = new StateManager(
          { a: 1, b: true },
          { Proxy: ProxyImpl, afterUpdate: () => log.push(3) }
        );
        stateManager.subscribe(() => {
          log.push(1);
          stateManager.update((state) => {
            log.push(2);
            state.a = 3;
          });
        });
        stateManager.update((state) => (state.a = 2));
        expect(log).toEqual([1, 2, 1, 2, 3]);
      });

      it('calls afterUpdate when there is no change', () => {
        let log: number[] = [];
        const stateManager = new StateManager(
          { a: 1, b: true },
          { Proxy: ProxyImpl, afterUpdate: () => log.push(2) }
        );
        stateManager.update();
        expect(log).toEqual([2]);
      });

      it('calls afterUpdate with the correct input', () => {
        const spy = jest.fn();
        const stateManager = new StateManager(
          { a: 1, b: true },
          { Proxy: ProxyImpl, afterUpdate: spy }
        );
        stateManager.update((state) => (state.a = 2));
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy).lastCalledWith({
          state: { a: 2, b: true },
          exceptionOccurred: false,
          retrieveExceptions: expect.any(Function),
        });
      });

      it('allows state to be mutated in afterUpdate', () => {
        const spy = jest.fn();
        const stateManager = new StateManager(
          { a: 0 },
          {
            Proxy: ProxyImpl,
            afterUpdate: ({ state }) => {
              spy();
              if (state.a === 1) {
                state.a = 2;
              }
            },
          }
        );
        stateManager.getState().a = 1;
        expect(spy).toHaveBeenCalledTimes(2);
      });

      it('handle a listener calling update()', () => {
        const stateManager = new StateManager(
          { a: 0 },
          {
            Proxy: ProxyImpl,
            afterUpdate: ({ state }) => {
              if (state.a === 0) {
                stateManager.update((_state) => {
                  _state.a = 1;
                });
              }
            },
          }
        );
        const subscriberSpy = jest.fn();
        stateManager.subscribe(subscriberSpy);
        stateManager.update();
        expect(stateManager.getState()).toEqual({
          a: 1,
        });
        expect(subscriberSpy).toHaveBeenCalledTimes(1);
      });

      it('passes through the return value from update()', () => {
        const stateManager = new StateManager(
          { a: 1, b: true },
          { Proxy: ProxyImpl }
        );
        const mockReturnValue = Symbol('mockReturnValue');
        expect(stateManager.update(() => mockReturnValue)).toBe(
          mockReturnValue
        );
      });

      it('supports class instances', () => {
        class SomeClass {
          private i = 123;
          public getI() {
            return this.i;
          }
        }

        const b = new SomeClass();
        const stateManager = new StateManager(
          { a: 1, b },
          { Proxy: ProxyImpl }
        );
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
        expect(spy).lastCalledWith(expect.any(Function), { a: 1, b: b2 });
        expect(spy.mock.calls[0][0]('b')).toBe(true);
      });

      describe('error handling', () => {
        it('rethrows an error from beforeUpdate after updating state and does not call update callbacks', (done) => {
          const mockError = Symbol('mockError');
          const stateManager = new StateManager(
            { a: 1, b: true },
            {
              Proxy: ProxyImpl,
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

        it('rethrows an error from beforeUpdate after updating state', (done) => {
          const mockError = Symbol('mockError');
          const stateManager = new StateManager(
            { a: 1, b: true },
            {
              Proxy: ProxyImpl,
              beforeUpdate: (state) => {
                state.a = 2;
                throw mockError;
              },
            }
          );

          try {
            stateManager.update();
            done.fail('expecting error');
          } catch (e) {
            expect(e).toBe(mockError);
          }
          expect(stateManager.getState()).toEqual({ a: 2, b: true });
          done();
        });

        it('rethrows an error from update after updating state', (done) => {
          const mockError = Symbol('mockError');
          const stateManager = new StateManager(
            { a: 1, b: true },
            { Proxy: ProxyImpl }
          );

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
          const stateManager = new StateManager(
            { a: 1, b: true },
            { Proxy: ProxyImpl }
          );
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
            { Proxy: ProxyImpl, afterUpdate: afterUpdateSpy }
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
              Proxy: ProxyImpl,
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
              Proxy: ProxyImpl,
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

        it('allows beforeUpdate to call update', () => {
          const stateManager = new StateManager(
            { a: 1, b: true },
            {
              Proxy: ProxyImpl,
              beforeUpdate: () => {
                stateManager.update((state) => {
                  state.a = 2;
                });
              },
            }
          );

          stateManager.update();
          expect(stateManager.getState().a).toBe(2);
        });
      });
    });
  });
});
