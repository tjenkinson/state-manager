import { ChangeTracker } from './change-tracker';

describe('ChangeTracker', () => {
  it('works', () => {
    const symbol = Symbol();
    const tracker = new ChangeTracker();

    expect(tracker.keys().length).toBe(0);

    expect(tracker.get(['missing'])).toBe(ChangeTracker.missing);

    tracker.set(['a', '1', symbol], 123);
    expect(tracker.keys().length).toBe(1);
    expect(tracker.hasPrefix(['a'])).toBe(true);
    expect(tracker.hasPrefix(['a', '1'])).toBe(true);
    expect(tracker.hasPrefix(['a', '1', symbol])).toBe(true);
    expect(tracker.hasPrefix(['a', '1', symbol, 'b'])).toBe(false);
    expect(tracker.hasPrefix(['a', '2'])).toBe(false);
    expect(tracker.get(['a', '1', symbol])).toBe(123);

    tracker.delete(['a', '2']);
    expect(tracker.keys().length).toBe(1);
    tracker.delete(['a', '1', symbol]);
    expect(tracker.keys().length).toBe(0);

    tracker.set(['a', '1', symbol], 123);
    tracker.set(['a', '2'], 1234);
    expect(tracker.keys().length).toBe(2);
    expect(tracker.get(['a', '2'])).toBe(1234);
    tracker.set(['a', '2'], 1235);
    expect(tracker.keys().length).toBe(2);
    expect(tracker.get(['a', '2'])).toBe(1235);
    expect(tracker.hasPrefix(['a', '1'])).toBe(true);
    expect(tracker.hasPrefix(['a', '2'])).toBe(true);
  });
});
