[![npm version](https://badge.fury.io/js/%40tjenkinson%2Fstate-manager.svg)](https://badge.fury.io/js/%40tjenkinson%2Fstate-manager)

# State Manager

This provides a controlled way of managing a state object, and being notified when parts of it have changed. It ensures that state updates are atomic, meaning change subscribers are only notified of changes when the state has been updated completely. Subscribers also get the latest state and changes whenver they are invoked.

The changes is an object containing just the keys from the state which have changed since the subscriber was last called/registered.

Subscribers are also able to update the state. Earlier subscribers see the changes from later subscribers. The last subsciber won't see the intermediary changes.

By default nested objects are handled. See the [`maxDepth` option](#maxdepth).

## Installation

```sh
npm install --save @tjenkinson/state-manager
```

or available on JSDelivr at "https://cdn.jsdelivr.net/npm/@tjenkinson/state-manager@1".

## API

### Constructor

Provide the initial state as the first argument.

The second argument is an optional object which can contain the following properties:

- `beforeUpdate`: This is called after the first `update()` call but before the callback. It receives the state as the first argument and you are allowed to update it. You are not allowed to make a call to `update()` from this function.
- `afterUpdate`: This is called after an update occurs after the last subscriber has finished. It receives an object in the first argument with the following:
  - `state:` The current state (read only).
  - `exceptionOccurred`: This is a boolean which is `true` if an exception occured in one or more of the subscribers.
  - `retrieveExceptions`: This returns an array of exceptions that occurred in one of more of the subscribers. If you do not call this function the exceotions will be thrown asynchronously when the current stack ends. If you do call this function the exceptions will not be thrown and it's up to you to handle them.
- `maxDepth`: How many layers to look at when calculating the changes. If you set this to `1` and change from `{ a: { b: 1 } }` to `{ a: { b: 2 } }`, the change of `a.b` will not be picked up. The value of `a` passed to the subscriber will also not be a clone. Defaults to `Infinity`, meaning all objects will be cloned and changes will be detected. Set this if you know how many levels of the object you care about, to increase performance.

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

Returns the current state (read only).

```ts
stateManager.getState();
```

### getStateChanges()

Returns the changes of the current state compared to the initial state (read only).
This can be useful when you are subscribing if you want to catch up with changes you missed.

```ts
stateManager.getStateChanges();
```

### update(fn)

This is how you update the state.

The first argument takes a function that will be invoked synchronously and provided with a clone of the current state as the first argument. To make changes to the state just update the object. It is possible to have multiple nested update calls and the subscribers will only be invoked when all calls have completed.

The return value is passed through.

```ts
stateManager.update((state) => {
  // update `state` here
});
```

It is possible to omit function, meaning just `beforeUpdate` and `afterUpdate` will be called.

### subscribe(fn)

This is how you are notified of changes to the state.

The first argument taked a function which is invoked with 2 arguments:

- `changes`: This is an object which contains just the keys of the state that have changed since the last time you were called or subscribed (read only).
- `state`: This is the current state (read only).

You are allowed to update the state again from your subscriber, but it needs to be from an `update` call.

Subscribers are invoked in the order they were registered. If a subscriber changes the state the first subscriber will be invoked again. This means earlier subscribers see the changes from later subscribers. The last subscriber won't see the intermediary changes.

An object is returned that contains a `remove` function. Call this to unsubscribe.

If your subscriber throws an error it will not prevent other subscribers being invoked. The `afterUpdate` function will have an oppurtunity to handle the exception, or it will be rethrown asynchronously.

## Example

```ts
import { StateManager } from '@tjenkinson/state-manager';

const stateManager = new StateManager({ a: 1, b: 2, c: { d: 3, e: 4 } });

stateManager.subscribe((changes, state) => {
  if (changes.a) {
    console.log(`subscriber1 a=${state.a}`);
  }
});

stateManager.subscribe(({ b: bChanged }, { b }) => {
  if (bChanged) {
    console.log(`subscriber2 b=${b}`);
    if (b === 3) {
      stateManager.update((state) => (state.a = 1));
    }
  }
});

stateManager.subscribe((changes, state) => {
  console.log(
    `subscriber3 changes=${JSON.stringify(changes)} state=${JSON.stringify(
      state
    )}`
  );
});

stateManager.update((state) => {
  state.a = 100;
  stateManager.update((state2) => {
    state2.a = 2;
  });
});

// just before reaching this point there the following would be logged
// - subscriber1 a=2
// - subscriber3 changes={"a":true} state={"a":2,"b":2",c:{"d":3,"e":4}}

stateManager.update((state) => {
  state.b = 3;
  state.c.e = 5;
});

// just before reaching this point there the following would be logged
// - subscriber2 b=3
// - subscriber1 a=1
// - subscriber3 changes={"a":true,"b":true,"c":{"e":true}} state={"a":1,"b":3",c:{"d":3,"e":5}}
```
