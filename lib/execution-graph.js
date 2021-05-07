import { EventEmitter, once } from 'node:events';
import { pathToFileURL } from 'node:url';

async function waitForDependencies(executionGraph, dependencies) {
  const results = {};

  await Promise.all(dependencies.map(async name => {
    let dependecyNode = executionGraph.nodes.get(name);

    if (!dependecyNode || !dependecyNode.done) {
      ([dependecyNode] = await once(executionGraph, `done:${name}`));
    }

    results[name] = dependecyNode.result;
  }));

  return results;
}

async function watchForChanges(watcher, graph) {
  try {
    const [, pathStr] = await once(watcher, 'all');

    const url = pathToFileURL(pathStr);

    for (const [name, { watchPath }] of graph.nodes) {
      if (watchPath && url.href.startsWith(watchPath)) {
        console.time(`Build succeeded for ${name}`); // eslint-disable-line no-console
        console.log('Rerunning Node:', name); // eslint-disable-line no-console
        graph.rerunNode({ name });
        console.timeEnd(`Build succeeded for ${name}`); // eslint-disable-line no-console
      }
    }
  } catch (e) {
    console.error('BUILD ERROR:', e.stack); // eslint-disable-line no-console
  }

  return watchForChanges(watcher, graph);
}

class WatchableResult {
  constructor({ path, result }) {
    this.path = path;
    this.result = result;
  }
}

export default class ExecutionGraph extends EventEmitter {
  constructor({ parent, watcher } = {}) {
    super();

    this.parent = parent;
    this.nodes = new Map();
    this.setMaxListeners(0);

    if (watcher) {
      watchForChanges(watcher, this);
    }
  }

  async addNode({ name, action, dependencies = [] }) {
    const node = { action, dependencies, done: false };

    if (dependencies.includes(name)) {
      throw new Error('Node may not depend on itself.');
    }

    this.nodes.set(name, node);

    const dependencyResults = await waitForDependencies(this, dependencies);

    const result = await action(dependencyResults);

    if (result instanceof WatchableResult) {
      node.result = result.result;
      node.watchPath = result.path;
    } else {
      node.result = result;
    }

    node.done = true;

    this.emit(`done:${name}`, node);
    this.emit('done', name, node);

    return node.result;
  }

  addNodes(nodes) {
    const processNode = ([name, { action, dependencies }]) => {
      return this.addNode({ name, action, dependencies })
        .then(result => [name, result]);
    };

    return Promise.all(Object.entries(nodes).map(processNode)).then(Object.fromEntries);
  }

  removeNode({ name }) {
    if (!this.nodes.has(name)) {
      return;
    }

    const dependents = [];

    for (const [dependencyName, { dependencies }] of this.nodes) {
      if (dependencies.includes(name)) {
        dependents.push(dependencyName);
      }
    }

    if (dependents.length) {
      throw new Error(`Node ${name} has dependent nodes: ${dependents.join(', ')}`);
    }

    this.nodes.delete(name);
  }

  // Inversion! Given a node, which nodes directly depend on it?
  getDirectDependents({ name }) {
    const dependents = [];

    for (const [nodeName, { dependencies }] of this.nodes) {
      if (dependencies.includes(name)) {
        dependents.push(nodeName);
      }
    }

    return dependents;
  }

  // rerunning a node amounts to finding the subtree which depends on it,
  // removing its nodes, and re-adding them.
  // TODO: This is very clunky. There's probably a more elegant way.
  // eslint-disable-next-line max-statements
  async rerunNode({ name }) {
    const { action, dependencies } = this.nodes.get(name);
    const dependents = this.getDirectDependents({ name });
    const collected = new Map([[name, { action, dependencies, dependents }]]);

    let oldSize;
    let newSize;

    // Collect the tree of nodes dependent on the targeted node.
    do {
      oldSize = collected.size;

      for (const { dependents } of collected.values()) {
        for (const name of dependents) {
          if (!collected.has(name)) {
            const { action, dependencies } = this.nodes.get(name);
            collected.set(name, {
              action,
              dependencies,
              dependents: this.getDirectDependents({ name })
            });
          }
        }
      }

      newSize = collected.size;
    } while (oldSize !== newSize);

    const removed = new Set();

    // Remove the nodes, starting with leaves.
    while (removed.size < collected.size) {
      for (const [name, { dependents }] of collected) {
        if (!removed.has(name) && dependents.every(name => removed.has(name))) {
          removed.add(name);
          this.nodes.delete(name);
        }
      }
    }

    // Re-add the nodes.
    const results = await Promise.all(
      [...collected].map(([name, { action, dependencies }]) => this.addNode({ name, action, dependencies }))
    );

    this.emit('rerun');

    return results;
  }

  get results() {
    const results = {};

    for (const [key, { result, done }] of this.nodes) {
      if (done) {
        results[key] = result;
      }
    }

    return results;
  }

  static createWatchableResult({ path, result }) {
    return new WatchableResult({ path, result });
  }
}
