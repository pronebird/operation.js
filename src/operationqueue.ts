import * as assert from 'assert';
import * as debugFactory from 'debug';
import Operation from './operation';
import { RawOperationState, reverseState } from './operationstate';

// Internal helper to give sequential names to each created operation queue
const operationQueueName = (function*() {
  let i = 0;
  while (true) {
    yield `${++i}`;
  }
})();

// Operation queue
export default class OperationQueue {
  private _operations: Operation[] = [];
  private _name = '';
  private trace: debug.IDebugger;

  constructor() {
    this.name = operationQueueName.next().value;
  }

  get name() {
    return this._name;
  }

  set name(value: string) {
    if (value !== this._name) {
      this._name = value;
      this.trace = debugFactory(`queue:${value}`);
    }
  }

  get operations() {
    return this._operations.slice();
  }

  public add(operations: Operation | Operation[]) {
    const newOperations = Array.isArray(operations) ? operations : [operations];
    for (const operation of newOperations) {
      this.enqueue(operation);
    }
  }

  public cancelAll() {
    const operations = this._operations;
    for (const operation of operations) {
      operation.cancel();
    }
  }

  private enqueue(operation: Operation) {
    assert(!operation.wasEnqueued, `The operation has already been enqueued: ${operation.name}`);
    operation.wasEnqueued = true;

    if (!operation.isCancelled) {
      operation.state.once('finished', () => {
        this.unregister(operation);
        this.trace(`dequeue operation ${operation.name}`);
      });

      this.register(operation);
      this.trace(`enqueue operation ${operation.name}`);
      operation.onEnqueue();

      this.waitUntilOperationsFinished(operation.dependencies, () => {
        this.trace(`satisfied dependencies of operation ${operation.name}`);

        setTimeout(() => {
          this.executeOperation(operation);
        }, 0);
      });
    }
  }

  private register(operation: Operation) {
    assert(!operation.isExecuting && !operation.isFinished, 'Out of order execution');
    this._operations.push(operation);
  }

  private unregister(operation: Operation) {
    assert(operation.isFinished, 'Out of order execution');
    const index = this._operations.indexOf(operation);
    assert(index !== -1);
    this._operations.splice(index, 1);
  }

  private executeOperation(operation: Operation) {
    const currentState = operation.state.value;

    // make sure that operation hadn't been cancelled
    if (currentState === RawOperationState.Pending) {
      this.trace(`run operation ${operation.name}`);
      operation.main();
    } else if (currentState === RawOperationState.Finished && operation.isCancelled) {
      this.trace(`not running operation ${operation.name} (was cancelled)`);
    } else {
      assert.fail(
        `Cannot execute operation that is ${reverseState(currentState)} and ${
          operation.isCancelled ? 'cancelled' : 'not cancelled'
        }`,
      );
    }
  }

  private waitUntilOperationsFinished(operations: Operation[], onFinish: () => void) {
    if (operations.length > 0) {
      const finishedOperations = [];
      const onFinishOperation = (operation: Operation) => {
        finishedOperations.push(operation);
        if (finishedOperations.length === operations.length) {
          onFinish();
        }
      };

      for (const operation of operations) {
        if (operation.isFinished) {
          onFinishOperation(operation);
        } else {
          operation.state.once(reverseState(RawOperationState.Finished), () => {
            onFinishOperation(operation);
          });
        }
      }
    } else {
      onFinish();
    }
  }
}
