import { EventEmitter, once } from 'node:events';

export class WatchableResult {
  /** @param {{ path: string, result: any }} options */
  constructor({ path, result }) {
    this.path = path;
    this.result = result;
  }
}

export class GraphNode {
  /**
   * @param {object} options
   * @param {string} options.name
   * @param {Function} options.action
   * @param {Function?} options.onRemove
   * @param {string[]?} options.dependencies
   */
  constructor({ name, action, onRemove, dependencies = [] }) {
    this.done = false;
    this.name = name;
    this.action = action;
    this.onRemove = onRemove;
    this.dependencies = dependencies;
    this.result = null;
    /** @type {string|null} */
    this.watchPath = null;
  }
}

export default class ExecutionGraph extends EventEmitter {
  /**
   * @param {Object} options
   * @param {ExecutionGraph} options.parent
   * @param {AsyncGenerator<{eventType: string, url: URL}>|null} options.watcher
   */
  constructor({ parent, watcher } = {}) {
    super();

    this.parent = parent;
    /** @type {Map<string, GraphNode>} */
    this.nodes = new Map();
    this.setMaxListeners(0);

    if (watcher) {
      this.#watchForChanges(watcher, this);
    }
  }

  /** @param {AsyncGenerator<{eventType: string, url: URL}>} watcher */
  async #watchForChanges(watcher) {
    for await (const { url } of watcher) {
      for (const [name, { watchPath }] of this.nodes) {
        if (watchPath && url.pathname.startsWith(watchPath.pathname)) {
          console.time(`Build succeeded for ${name}`); // eslint-disable-line no-console
          console.log('Rerunning Node:', name); // eslint-disable-line no-console
          try {
            this.rerunNode(name);
          } catch (e) {
            console.error('BUILD ERROR:', e.stack); // eslint-disable-line no-console
          }
          console.timeEnd(`Build succeeded for ${name}`); // eslint-disable-line no-console
        }
      }
    }
  }

  /** @param {string[]} dependencies */
  async #waitForDependencies(dependencies) {
    /** @type {Record<string, any>} */
    const results = {};

    await Promise.all(dependencies.map(async name => {
      let dependecyNode = this.nodes.get(name);

      if (!dependecyNode || !dependecyNode.done) {
        ([dependecyNode] = await once(this, `done:${name}`));
      }

      results[name] = dependecyNode.result;
    }));

    return results;
  }

  // /**
  //  * @param {Object} options
  //  * @param {string} options.name
  //  * @param {Function} options.action
  //  * @param {Function|undefined} options.onRemove
  //  * @param {string[]} options.dependencies
  //  */
  /** @param {GraphNode|Function} node */
  async addNode(rawNode) {
    const node = rawNode instanceof GraphNode ? rawNode : new GraphNode({ name: rawNode.name, action: rawNode });

    if (node.dependencies.includes(node.name)) {
      throw new Error('Node may not depend on itself.');
    }

    this.nodes.set(node.name, node);

    const dependencyResults = await this.#waitForDependencies(node.dependencies);
    const result = await node.action(dependencyResults);

    if (result instanceof WatchableResult) {
      node.result = result.result;
      node.watchPath = result.path;
    } else {
      node.result = result;
    }

    node.done = true;

    this.emit(`done:${node.name}`, node);
    this.emit('done', node.name, node);

    return node.result;
  }

  /** @param {(GraphNode|Function)[]} nodes */
  async addNodes(nodes) {
    const promises = [];

    /** @type {Record<string, any>} */
    const results = {};

    for (const node of nodes) {
      promises.push(
        this.addNode(node).then(r => {
          results[node.name] = r;
        })
      );
    }

    await Promise.all(promises);

    return results;
  }

  async removeNode(name) {
    const node = this.nodes.get(name);

    if (!node) {
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

    if (node.onRemove) {
      await node.onRemove();
    }

    this.nodes.delete(name);
  }

  /**
   * Inversion! Given a node, which nodes directly depend on it?
   *
   * @param {string} name
   */
  getDirectDependents(name) {
    const dependents = [];

    for (const [nodeName, { dependencies }] of this.nodes) {
      if (dependencies.includes(name)) {
        dependents.push(nodeName);
      }
    }

    return dependents;
  }

  /**
   * rerunning a node amounts to finding the subtree which depends on it,
   * removing its nodes, and re-adding them.
   *
   * @todo This is very clunky. There's probably a more elegant way.
   *
   * @param {string} name
   */
  async rerunNode(name) {
    const node = this.nodes.get(name);

    if (!node) {
      return;
    }

    const dependents = this.getDirectDependents(name);
    const collected = new Map([[name, { node, dependents }]]);

    for (let oldSize = collected.size, newSize = 0; newSize !== oldSize; newSize = oldSize, oldSize = collected.size) {
      for (const { dependents } of collected.values()) {
        for (const name of dependents) {
          if (!collected.has(name)) {
            const node = this.nodes.get(name);
            collected.set(name, { node, dependents: this.getDirectDependents(name) });
          }
        }
      }
    }

    /** @type {Set<string>} */
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

    // Run cleanup for nodes which need it.
    await Promise.all([...collected].map(([, { node }]) => node.onRemove && node.onRemove()));

    // Re-add the nodes.
    await Promise.all(
      [...collected].map(([
        name,
        { node: { action, onRemove, dependencies } }
      ]) => this.addNode(new GraphNode({ name, action, onRemove, dependencies })))
    );

    this.emit('rerun');
  }

  get results() {
    /** @type {Record<string, any>} */
    const results = {};

    for (const [key, { result, done }] of this.nodes) {
      if (done) {
        results[key] = result;
      }
    }

    return results;
  }
}
