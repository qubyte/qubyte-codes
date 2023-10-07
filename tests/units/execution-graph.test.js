import { describe, beforeEach, it } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import crypto from 'node:crypto';
import ExecutionGraph from '../../lib/execution-graph.js';
import { setTimeout as wait } from 'timers/promises';

describe('execution-graph', () => {
  let graph;

  beforeEach(() => {
    graph = new ExecutionGraph();
  });

  it('is a function', () => {
    assert.equal(typeof ExecutionGraph, 'function');
  });

  it('creates execution graph instances', () => {
    assert.ok(graph instanceof ExecutionGraph);
  });

  it('graphs are instances of EventEmitter', () => {
    assert.ok(graph instanceof EventEmitter);
  });

  describe('adding a node', () => {
    it('returns a promise', () => {
      assert.ok(graph.addNode({ name: 'a-name', action() {} }) instanceof Promise);
    });

    it('resolves the promise after a synchronous action is run when there are no dependencies', async () => {
      const order = [];

      graph.once('done:a-name', () => order.push('event'));

      const promise = graph.addNode({
        name: 'a-name',
        action() {
          order.push('action');
        }
      });

      await promise.then(() => order.push('promise'));

      assert.deepEqual(order, ['action', 'event', 'promise']);
    });

    it('resolves to the return value of a synchronous action to the node', async () => {
      const expected = crypto.randomBytes(8).toString('hex');
      const result = await graph.addNode({
        name: 'a-name',
        action() {
          return expected;
        }
      });

      assert.equal(result, expected);
    });

    it('resolves the promise after an asynchronous action is run when there are no dependencies', async () => {
      const order = [];

      graph.once('done:a-name', () => order.push('event'));

      const promise = graph.addNode({
        name: 'a-name',
        async action() {
          await wait(100);
          order.push('action');
        }
      });

      await promise.then(() => order.push('promise'));

      assert.deepEqual(order, ['action', 'event', 'promise']);
    });

    it('resolves to the resulution value of an asynchronous action to the node', async () => {
      const expected = crypto.randomBytes(8).toString('hex');
      const result = await graph.addNode({
        name: 'a-name',
        action() {
          return Promise.resolve(expected);
        }
      });

      assert.equal(result, expected);
    });

    it('waits for dependencies which are not yet registered before resolving', async () => {
      const order = [];
      const promises = [];

      promises.push(graph.addNode({
        name: 'a',
        dependencies: ['b', 'c'],
        action() {
          assert.deepEqual(order, ['c', 'b']);
        }
      }).then(() => order.push('a')));

      promises.push(graph.addNode({
        name: 'b',
        action() {
          return wait(100);
        }
      }).then(() => order.push('b')));

      promises.push(graph.addNode({
        name: 'c',
        action() {
          return wait(50);
        }
      }).then(() => order.push('c')));

      await Promise.all(promises);

      assert.deepEqual(order, ['c', 'b', 'a']);
    });

    it('passes results from dependencies into an action', async () => {
      graph.addNode({
        name: 'a',
        action() {
          return 'result-a';
        }
      });

      graph.addNode({
        name: 'b',
        action() {
          return Promise.resolve('result-b');
        }
      });

      graph.addNode({
        name: 'c',
        async action() {
          await wait(10);
          return 'result-c';
        }
      });

      const passedIn = await graph.addNode({
        name: 'd',
        dependencies: ['a', 'b', 'c'],
        action(input) {
          return input;
        }
      });

      assert.deepEqual(passedIn, { a: 'result-a', b: 'result-b', c: 'result-c' });
    });
  });

  describe('adding multiple nodes', () => {
    it('returns a promise', () => {
      assert.ok(graph.addNodes({ name: { action() {} } }) instanceof Promise);
    });

    it('resolves to a collection of results for the added nodes', async () => {
      const results = await graph.addNodes({
        a: {
          async action() {
            await wait(10);
            return 'result-a';
          }
        },
        b: {
          dependencies: ['a'],
          action({ a }) {
            return `result-b: result-a is "${a}"`;
          }
        }
      });

      assert.deepEqual(results, { a: 'result-a', b: 'result-b: result-a is "result-a"' });
    });

    it('does not include results of nodes not in the collection added', async () => {
      await graph.addNode({
        name: 'x',
        action() {
          return 3;
        }
      });

      const results = await graph.addNodes({
        a: {
          dependencies: ['x'],
          action({ x }) {
            return x ** 2;
          }
        }
      });

      assert.deepEqual(results, { a: 9 });
    });
  });

  describe('removing nodes', () => {
    it('removes a node with no dependencies', async () => {
      await graph.addNode({
        name: 'a',
        action() {}
      });

      await graph.removeNode({ name: 'a' });

      assert.equal(graph.nodes.size, 0);
    });

    it('rejects when attempting to remove a node with dependencies', async () => {
      await Promise.all([
        graph.addNode({
          name: 'a',
          action() {}
        }),
        graph.addNode({
          name: 'b',
          dependencies: ['a'],
          action() {}
        }),
        graph.addNode({
          name: 'c',
          dependencies: ['a'],
          action() {}
        })
      ]);

      assert.rejects(
        () => graph.removeNode({ name: 'a' }),
        Error,
        'Node a has dependent nodes: b, c'
      );

      assert.deepEqual([...graph.nodes.keys()], ['a', 'b', 'c']);
    });

    it('runs cleanup when a node needs it', async () => {
      let guard = false;

      await Promise.all([
        graph.addNode({
          name: 'a',
          action() {},
          onRemove() {
            return new Promise(resolve => setTimeout(() => {
              guard = true;
              resolve();
            }, 500));
          }
        })
      ]);

      await graph.removeNode({ name: 'a' });

      assert.equal(guard, true);
    });
  });

  describe('rerunning nodes', () => {
    let nodesRerun;
    let guard;

    beforeEach(async () => {
      nodesRerun = [];
      guard = false;

      await Promise.all([
        graph.addNode({
          name: 'a',
          async action() {
            await wait(10);
            nodesRerun.push('a');
          }
        }),
        graph.addNode({
          name: 'b',
          dependencies: ['a'],
          async action() {
            await wait(10);
            nodesRerun.push('b');
          },
          onRemove() {
            return new Promise(resolve => setTimeout(() => {
              guard = true;
              resolve();
            }, 500));
          }
        }),
        graph.addNode({
          name: 'c',
          dependencies: ['b'],
          async action() {
            await wait(10);
            nodesRerun.push('c');
          }
        })
      ]);

      nodesRerun = [];
    });

    it('reruns leaf nodes', async () => {
      await graph.rerunNode({ name: 'c' });

      assert.deepEqual(nodesRerun, ['c']);
    });

    it('reruns on-leaf nodes and their decendents in order', async () => {
      await graph.rerunNode({ name: 'b' });

      assert.deepEqual(nodesRerun, ['b', 'c']);
    });

    it('runs cleanup on nodes which need it', async () => {
      await graph.rerunNode({ name: 'c' });

      assert.equal(guard, false);

      await graph.rerunNode({ name: 'a' });

      assert.equal(guard, true);
    });
  });

  describe('getting results', () => {
    it('gets results of returned and resolved nodes', async () => {
      graph.addNode({
        name: 'a',
        action() {
          return 1;
        }
      });
      graph.addNode({
        name: 'c',
        async action() {
          await wait(200);
          return '3';
        }
      });
      await graph.addNode({
        name: 'b',
        action() {
          return Promise.resolve(2);
        }
      });

      assert.deepEqual(graph.results, { a: 1, b: 2 });
    });
  });
});
