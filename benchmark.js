const { performance } = require('perf_hooks');
const { StateManager } = require('./dist/state-manager');

const NUM_PROPERTIES = 150;
const DEPTH = 3;
const NUM_SUBSCRIBERS = 100;
const NUM_RUNS = 10;

function run() {
  function buildObject(depth) {
    const object = {};
    if (depth > 0) {
      for (let i = 0; i < NUM_PROPERTIES; i++) {
        object[`prop${i}`] = buildObject(depth - 1);
      }
    }
    return object;
  }

  const state = buildObject(DEPTH);
  const start = performance.now();

  const stateManager = new StateManager(state);

  for (let i = 0; i < NUM_SUBSCRIBERS; i++) {
    const subscriberNum = i;
    const newObject = {};
    stateManager.subscribe((hasChanged) => {
      hasChanged('prop1');
      hasChanged('prop1', 'prop0');
      if (subscriberNum < 3) {
        stateManager.update((state) => {
          // for second and third this update is essentially ignored because reset by 1
          state.prop1.prop0 = newObject;
        });
      }
    });
  }
  stateManager.update((state) => (state.prop0.prop0 = {}));

  const duration = performance.now() - start;
  console.log(`Run finished: ${Math.round(duration * 10000) / 10000}ms`);
  return duration;
}

let totalDuration = 0;
for (let i = 0; i < NUM_RUNS; i++) {
  totalDuration += run();
}
const avgDuration = totalDuration / NUM_RUNS;
console.log(`Average duration: ${Math.round(avgDuration * 10000) / 10000} ms`);
