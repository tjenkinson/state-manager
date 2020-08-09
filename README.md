[![npm version](https://badge.fury.io/js/%40tjenkinson%2Fstate-manager.svg)](https://badge.fury.io/js/%40tjenkinson%2Fstate-manager)

# State Manager

This provides a controlled way of managing a state object, and being notified when parts of it have changed. It ensures that state updates are atomic, meaning change subscribers are only notified of changes when the state has been updated completely. Subscribers also get the latest state and changes whenver they are invoked.

It requires [`Proxy`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy/Proxy) support. If you are running on an environment where this is unavailable I'd recommend [GoogleChrome/proxy-polyfill](https://github.com/GoogleChrome/proxy-polyfill). You can provide the implementation on the `Proxy` config option if you don't want to polyfill. Take note of the differences in behaviour to real `Proxy`'s in the README.

Subscribers receive a `hasChanged` function which when called with a property path will return `true` if something at or below the provided path has changed since the subscriber was last invoked.

Subscribers are also able to update the state. Earlier subscribers see the changes from later subscribers. The last subsciber won't see the intermediary changes.

Changes to values on [plain objects (created by the `Object` constructor)](https://github.com/jonschlinkert/is-plain-object) and nested plain objects in the state are detected (as these are proxied). Values inside other types of objects are not watched.

## Installation

```sh
npm install --save @tjenkinson/state-manager
```

or available on JSDelivr at "https://cdn.jsdelivr.net/npm/@tjenkinson/state-manager@4".

## API

### Constructor

Provide the initial state as the first argument. You must not mutate this state directly. You can get a reference to a read-only version using the `getState()` method.

The second argument is an optional object which can contain the following properties:

- `beforeUpdate`: This is called after the first `update()` call but before the callback. It receives the state as the first argument and you are allowed to update it. You are not allowed to make a call to `update()` from this function.
- `afterUpdate`: This is called after an update occurs after the last subscriber has finished. It receives an object in the first argument with the following:
  - `state:` A `Proxy` to the current state (read-only).
  - `exceptionOccurred`: This is a boolean which is `true` if an exception occured in one or more of the subscribers.
  - `retrieveExceptions`: This returns an array of exceptions that occurred in one of more of the subscribers. If you do not call this function the exceptions will be thrown asynchronously when the current stack ends. If you do call this function the exceptions will not be thrown and it's up to you to handle them.

You can also provide the type of the state as a generic. E.g. `new StateManager<StateType>`.

```ts
const initialState = { a: 1, b: 'something' };
const stateManager = new StateManager(initialState, {
  // optional
  beforeUpdate: (state) => {},
  afterUpdate: ({ state, exceptionOccurred, retrieveException }) => {},
});
```

### getState()

Returns a read-only version of the state. This is not a snapshot. The object you get back is a `Proxy` to the original state. Properties to plain objects are also `Proxy`'s.

```ts
stateManager.getState();
```

### hasChanged(...propertyPath)

Informs you if the thing at the given property path or below has changed. This can be useful when you are subscribing if you want to catch up with changes you missed.

```ts
stateManager.hasChanged(...propertyPath);
```

### update(fn)

This is how you update the state.

The first argument takes a function that will be invoked synchronously and provided with a `Proxy` to the current state as the first argument. To make changes to the state just update the object. It is possible to have multiple nested update calls and the subscribers will only be invoked when all calls have completed.

```ts
stateManager.update((state) => {
  // update `state` here
});
```

It is possible to omit function, which is only useful if `beforeUpdate` makes changes to the state.

The return value is passed through.

### subscribe(fn)

This is how you are notified of changes to the state.

The first argument taked a function which is invoked with 2 arguments:

- `hasChanged`: This is a function which takes a property path. It returns `true` if something at or below the provided path has changed since the subscriber was last invoked. E.g. `hasChanged('a', 'b')` for checking `state.a.b`.
- `state`: This is a `Proxy` to the current state (read-only).

You are allowed to update the state again from your subscriber, but it needs to be from an `update` call.

Subscribers are invoked in the order they were registered. If a subscriber changes the state the first subscriber will be invoked again. This means earlier subscribers see the changes from later subscribers. The last subscriber won't see the intermediary changes.

An object is returned that contains a `remove` function. Call this to unsubscribe.

If your subscriber throws an error it will not prevent other subscribers being invoked. The `afterUpdate` function will have an oppurtunity to handle the exception, or it will be rethrown asynchronously.

## Example

```ts
import { StateManager } from '@tjenkinson/state-manager';

const stateManager = new StateManager({ a: 1, b: 2, c: { d: 3, e: 4 } });

stateManager.subscribe((hasChanged, state) => {
  if (hasChanged('a')) {
    console.log(`subscriber1 a=${state.a}`);
  }
});

stateManager.subscribe((hasChanged, { b }) => {
  if (hasChanged('b')) {
    console.log(`subscriber2 b=${b}`);
    if (b === 3) {
      stateManager.update((state) => (state.a = 1));
    }
  }
});

stateManager.subscribe((hasChanged, state) => {
  if (hasChanged('c', 'e')) {
    console.log(`subscriber3 c.e=${state.c.e}`);
  }
});

stateManager.subscribe((hasChanged, state) => {
  console.log(`subscriber4 state=${JSON.stringify(state)}`);
});

stateManager.update((state) => {
  state.a = 100;
  stateManager.update((state2) => {
    state2.a = 2;
  });
});

// just before reaching this point there the following would be logged
// - subscriber1 a=2
// - subscriber4 state={"a":2,"b":2",c:{"d":3,"e":4}}

stateManager.update((state) => {
  state.b = 3;
  state.c.e = 5;
});

// just before reaching this point there the following would be logged
// - subscriber2 b=3
// - subscriber1 a=1
// - subscriber3 c.e=5
// - subscriber4 state={"a":1,"b":3",c:{"d":3,"e":5}}
```
