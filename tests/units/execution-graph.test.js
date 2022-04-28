import assert from 'node:assert/strict';
import test from 'node:test';
import { EventEmitter } from 'node:events';
import crypto from 'node:crypto';
import ExecutionGraph from '../../lib/execution-graph.js';
import { setTimeout as wait } from 'timers/promises';

test('execution-graph', () => {
  test('is a function', () => {
    assert.equal(typeof ExecutionGraph, 'function');
  });

  test('creates execution graph instances', () => {
    const graph = new ExecutionGraph();
    assert.ok(graph instanceof ExecutionGraph);
  });

  test('graphs are instances of EventEmitter', () => {
    const graph = new ExecutionGraph();
    assert.ok(graph instanceof EventEmitter);
  });

  test('adding a node', () => {
    test('returns a promise', () => {
      const graph = new ExecutionGraph();
      assert.ok(graph.addNode({ name: 'a-name', action() {} }) instanceof Promise);
    });

    test('resolves the promise after a synchronous action is run when there are no dependencies', async () => {
      const graph = new ExecutionGraph();
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

    test('resolves to the return value of a synchronous action to the node', async () => {
      const graph = new ExecutionGraph();
      const expected = crypto.randomBytes(8).toString('hex');
      const result = await graph.addNode({
        name: 'a-name',
        action() {
          return expected;
        }
      });

      assert.equal(result, expected);
    });

    test('resolves the promise after an asynchronous action is run when there are no dependencies', async () => {
      const graph = new ExecutionGraph();
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

    test('resolves to the resulution value of an asynchronous action to the node', async () => {
      const graph = new ExecutionGraph();
      const expected = crypto.randomBytes(8).toString('hex');
      const result = await graph.addNode({
        name: 'a-name',
        action() {
          return Promise.resolve(expected);
        }
      });

      assert.equal(result, expected);
    });

    test('waits for dependencies which are not yet registered before resolving', async () => {
      const graph = new ExecutionGraph();
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

    test('passes results from dependencies into an action', async () => {
      const graph = new ExecutionGraph();

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

  test('adding multiple nodes', () => {
    test('returns a promise', () => {
      const graph = new ExecutionGraph();
      assert.ok(graph.addNodes({ name: { action() {} } }) instanceof Promise);
    });

    test('resolves to a collection of results for the added nodes', async () => {
      const graph = new ExecutionGraph();
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

    test('does not include results of nodes not in the collection added', async () => {
      const graph = new ExecutionGraph();
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

  test('removing nodes', () => {
    test('removes a node with no dependencies', async () => {
      const graph = new ExecutionGraph();

      await graph.addNode({
        name: 'a',
        action() {}
      });

      graph.removeNode({ name: 'a' });

      assert.equal(graph.nodes.size, 0);
    });

    test('throws when attempting to remove a node with dependencies', async () => {
      const graph = new ExecutionGraph();

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

      assert.throws(
        () => graph.removeNode({ name: 'a' }),
        Error,
        'Node a has dependent nodes: b, c'
      );

      assert.deepEqual([...graph.nodes.keys()], ['a', 'b', 'c']);
    });
  });

  test('rerunning nodes', () => {
    test('reruns leaf nodes', async () => {
      const graph = new ExecutionGraph();
      let nodesRerun = [];

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

      await graph.rerunNode({ name: 'c' });

      assert.deepEqual(nodesRerun, ['c']);
    });

    test('reruns on-leaf nodes and their decendents in order', async () => {
      const graph = new ExecutionGraph();
      let nodesRerun = [];

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

      await graph.rerunNode({ name: 'b' });

      assert.deepEqual(nodesRerun, ['b', 'c']);
    });
  });

  test('getting results', () => {
    test('gets results of returned and resolved nodes', async () => {
      const graph = new ExecutionGraph();
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
