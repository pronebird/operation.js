import Operation from './operation';

type ExecutionClosure = (finish: () => void) => void;

export default class BlockOperation extends Operation {
  constructor(private executionClosure: ExecutionClosure) {
    super();
  }

  protected execute() {
    this.executionClosure(() => this.finish());
  }
}
