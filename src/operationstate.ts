import * as assert from 'assert';
import { EventEmitter } from 'events';

// Raw operation state representation
export enum RawOperationState {
  // initialized but not added to operation queue
  Initialized = 0,
  // pending execution, waiting for dependencies to finish execution
  Pending,
  // executing
  Executing,
  // finished execution with or without error
  Finished,
}

// Internal helper to reverse the number representation of RawOperationState into string.
export function reverseState(stateValue: number): string | null {
  const key = RawOperationState[stateValue];
  if (key) {
    return key.toLocaleLowerCase();
  } else {
    return null;
  }
}

// Operation state
export class OperationState extends EventEmitter {
  private _value: number;

  constructor(initialValue: number) {
    super();
    this._value = initialValue;
  }

  get value() {
    return this._value;
  }

  set value(newValue: number) {
    const reversedState = reverseState(newValue);

    assert(typeof reversedState === 'string', `Unknown state ${newValue}`);
    assert(
      this._value < newValue,
      `Cannot transition from ${reverseState(this._value)} to ${reversedState}`,
    );

    this._value = newValue;
    this.emit(reversedState, newValue);
  }
}
