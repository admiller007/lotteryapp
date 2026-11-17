import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { planWinnerSync, winnerDocId } from '../src/lib/winnerSync';

describe('planWinnerSync', () => {
  it('writes nothing when the collection already matches', () => {
    const plan = planWinnerSync(
      [
        { id: winnerDocId('p1', 'u1'), prizeId: 'p1', winnerId: 'u1' },
        { id: 'legacyRandomId', prizeId: 'p2', winnerId: 'u2' },
      ],
      { p1: ['u1'], p2: ['u2'] }
    );
    assert.deepEqual(plan, { toDelete: [], toAdd: [] });
  });

  it('adds only new winners and deletes only removed ones', () => {
    const plan = planWinnerSync(
      [
        { id: 'a', prizeId: 'p1', winnerId: 'u1' },
        { id: 'b', prizeId: 'p1', winnerId: 'u2' },
      ],
      { p1: ['u1', 'u3'] }
    );
    assert.deepEqual(plan.toDelete, ['b']);
    assert.deepEqual(plan.toAdd, [{ id: winnerDocId('p1', 'u3'), prizeId: 'p1', winnerId: 'u3' }]);
  });

  it('removes duplicate and malformed docs, keeping the deterministic one', () => {
    const plan = planWinnerSync(
      [
        { id: 'dupe1', prizeId: 'p1', winnerId: 'u1' },
        { id: winnerDocId('p1', 'u1'), prizeId: 'p1', winnerId: 'u1' },
        { id: 'dupe2', prizeId: 'p1', winnerId: 'u1' },
        { id: 'broken' },
      ],
      { p1: ['u1'] }
    );
    assert.deepEqual(plan.toDelete.sort(), ['broken', 'dupe1', 'dupe2']);
    assert.deepEqual(plan.toAdd, []);
  });

  it('clears everything when there are no winners', () => {
    const plan = planWinnerSync([{ id: 'a', prizeId: 'p1', winnerId: 'u1' }], {});
    assert.deepEqual(plan, { toDelete: ['a'], toAdd: [] });
  });

  it('gives distinct IDs to pairs that would collide when joined naively', () => {
    assert.notEqual(winnerDocId('a_b', 'c'), winnerDocId('a', 'b_c'));
    assert.ok(!winnerDocId('a/b', 'c').includes('/'));
  });
});
