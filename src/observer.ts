import Operation from './operation';

export interface IObserver<T extends Operation> {
  /// Called when the operation is being added to an operation queue
  enqueued?(operation: T);

  /// Called when the operation is about to execute
  willExecute?(operation: T);

  /// Called when the operation is being cancelled
  cancelled?(operation: T);

  /// Called when the operation is being finished
  finished?(operation: T);
}
