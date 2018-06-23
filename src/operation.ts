import * as assert from 'assert';
import * as debugFactory from 'debug';

import { IObserver } from './observer';
import { OperationState, RawOperationState, reverseState } from './operationstate';

type CompletionHandler = () => void;

let operationCount = 0;

export default abstract class Operation {
  // @internal
  public readonly state = new OperationState(RawOperationState.Initialized);
  // @internal
  public wasEnqueued = false;

  private _name = '';
  private _dependencies: Operation[] = [];
  private _observers: Array<IObserver<this>> = [];
  private _onCompletion: CompletionHandler | null = null;
  private _isCancelled = false;
  private trace: debug.IDebugger;

  constructor() {
    this.name = (++operationCount).toString();
  }

  get name() {
    return this._name;
  }

  set name(value: string) {
    if (value !== this._name) {
      this._name = value;
      this.trace = debugFactory(`operation:${value}`);
    }
  }

  get isFinished() {
    return this.state.value === RawOperationState.Finished;
  }

  get isExecuting() {
    return this.state.value === RawOperationState.Executing;
  }

  get isCancelled() {
    return this._isCancelled;
  }

  get dependencies() {
    return this._dependencies.slice();
  }

  set onCompletion(fn: CompletionHandler) {
    assert(
      this.state.value === RawOperationState.Initialized,
      'Cannot set a completion handler after the operation has been added to an operation queue',
    );
    this._onCompletion = fn;
  }

  public addDependency(dependency: Operation) {
    assert(
      this.state.value === RawOperationState.Initialized,
      `Cannot add a dependency after the operation has been added to an operation queue`,
    );

    this._dependencies.push(dependency);
  }

  public addDependencies(dependencies: Operation[]) {
    for (const dependency of dependencies) {
      this.addDependency(dependency);
    }
  }

  public addObserver(observer: IObserver<this>) {
    assert(
      this.state.value === RawOperationState.Initialized,
      `Cannot add an observer after the operation has been added to an operation queue`,
    );

    this._observers.push(observer);
  }

  public cancel() {
    this._isCancelled = true;

    if (this.state.value < RawOperationState.Finished) {
      this.completeOperation();
    }
  }

  /**
   * A private method called to notify the operation when its being attached to an operation queue.
   * The operation has to switch to the `OperationState.Pending` state.
   * @internal
   */
  public onEnqueue() {
    const currentState = this.state.value;
    assert(
      currentState === RawOperationState.Initialized,
      `Out of order state transition from ${reverseState(currentState)} to pending`,
    );

    this.state.value = RawOperationState.Pending;

    this.trace(`${reverseState(currentState)} -> ${reverseState(this.state.value)}`);

    for (const observer of this._observers) {
      if (observer.enqueued) {
        observer.enqueued(this);
      }
    }
  }

  /**
   * A private operation executor called by `OperationQueue` when operation becomes ready to
   * execute.
   * The operation has to switch to the `OperationState.Executing` state.
   * @internal
   */
  public main() {
    const currentState = this.state.value;
    assert(
      currentState === RawOperationState.Pending,
      `Cannot execute the operation that is already ${reverseState(currentState)}`,
    );

    this.trace(`Operation will execute`);
    for (const observer of this._observers) {
      if (observer.willExecute) {
        observer.willExecute(this);
      }
    }

    // Make sure that the operation was not cancelled by observers
    if (this.state.value === RawOperationState.Pending) {
      this.state.value = RawOperationState.Executing;
      this.trace(`${reverseState(currentState)} -> ${reverseState(this.state.value)}`);

      this.execute();
    }
  }

  protected finish() {
    if (this.isFinished) {
      this.trace(`Ignored an attempt to finish '${this.constructor.name}' twice.`);
      return;
    }

    const currentState = this.state.value;
    assert(
      currentState > RawOperationState.Initialized && currentState < RawOperationState.Finished,
      `Cannot finish '${this.constructor.name}' because it's already ${reverseState(currentState)}`,
    );

    this.completeOperation();
  }

  // Override this method to provide the body of operation.
  protected abstract execute();

  private completeOperation() {
    const currentState = this.state.value;

    this.state.value = RawOperationState.Finished;

    if (this.isCancelled) {
      this.trace(`${reverseState(currentState)} -> ${reverseState(this.state.value)} ⚠️`);

      for (const observer of this._observers) {
        if (observer.cancelled) {
          observer.cancelled(this);
        }
      }
    } else {
      this.trace(`${reverseState(currentState)} -> ${reverseState(this.state.value)}`);

      for (const observer of this._observers) {
        if (observer.finished) {
          observer.finished(this);
        }
      }
    }

    if (this._onCompletion) {
      this._onCompletion();
    }
  }
}

export interface IInputOperation<Input> extends Operation {
  input?: Input;

  inject(operation: IOutputOperation<Input>): this;
  injectWithTransform<Output>(
    operation: IOutputOperation<Output>,
    transform: (output: Output) => Input,
  ): this;
}

export interface IOutputOperation<Output> extends Operation {
  output?: Output;
}

// TODO: Figure out how to make InputOperation and OutputOperation mixable

class InputOperation<Input> extends Operation implements IInputOperation<Input> {
  public input?: Input;

  private inputInjectors: Array<() => void> = [];

  public inject(operation: IOutputOperation<Input>): this {
    return this.injectWithTransform(operation, (output) => output);
  }

  public injectWithTransform<Output>(
    operation: IOutputOperation<Output>,
    transform: (output: Output) => Input,
  ): this {
    assert(
      this.state.value === RawOperationState.Initialized,
      `Cannot inject into the operation that's already ${reverseState(this.state.value)}.`,
    );

    assert(
      operation.state.value === RawOperationState.Initialized,
      `Cannot inject the operation that's already ${reverseState(operation.state.value)}.`,
    );

    const inject = () => {
      if (operation.output !== undefined) {
        this.input = transform(operation.output);
      }
    };

    this.inputInjectors.push(inject);
    this.addDependency(operation);

    return this;
  }

  public main() {
    // Set input using the output from injected operations
    this.setInput();

    // Cancel operations that did not manage to satisfy the input
    if (this.input === undefined) {
      super.cancel();
    } else {
      super.main();
    }
  }

  protected execute() {
    // no-op
  }

  private setInput() {
    for (const inject of this.inputInjectors) {
      inject();
    }
  }
}

class OutputOperation<Output> extends Operation implements IOutputOperation<Output> {
  public output?: Output;

  protected execute() {
    // no-op
  }

  protected finishWithResult(result: Output) {
    this.output = result;
    this.finish();
  }

  protected finish() {
    if (!this.isFinished) {
      assert(
        this.output !== undefined,
        `Output operation ${this.constructor.name} finished without setting the output.`,
      );
    }

    super.finish();
  }
}

// @ts-ignore
export abstract class IoOperation<Input, Output>
  implements IInputOperation<Input>, IOutputOperation<Output> {
  // It has to be declared here for typings
  protected finishWithResult(result: Output) {
    // no-op
  }
}

applyMixins(IoOperation, [InputOperation, OutputOperation]);

function applyMixins(derivedCtor: any, baseCtors: any[]) {
  baseCtors.forEach((baseCtor) => {
    Object.getOwnPropertyNames(baseCtor.prototype)
      .filter((name) => ['constructor', 'execute'].indexOf(name) === -1)
      .forEach((name) => {
        derivedCtor.prototype[name] = baseCtor.prototype[name];
      });
  });
}
