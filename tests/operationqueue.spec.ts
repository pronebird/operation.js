import * as chai from 'chai';
import * as spies from 'chai-spies';
import { BlockOperation, OperationQueue } from '../';

chai.use(spies);

const { expect, spy } = chai;

describe('OperationQueue', () => {
  it('Should execute an operation', (done) => {
    const operation = new BlockOperation((finish) => {
      finish();
      done();
    });
    const operationQueue = new OperationQueue();
    operationQueue.add(operation);
  });

  it('Should execute dependencies first', (done) => {
    const dependencyFinished = chai.spy();
    const dependencies = [1, 2, 3, 4, 5].map(() => {
      return new BlockOperation((finish) => {
        setTimeout(() => {
          dependencyFinished();
          finish();
        }, 1);
      });
    });

    const dependent = new BlockOperation((finish) => {
      finish();

      try {
        expect(dependencyFinished).to.have.been.called.exactly(5);
        done();
      } catch (error) {
        done(error);
      }
    });
    dependent.addDependencies(dependencies);

    const operationQueue = new OperationQueue();
    operationQueue.add(dependent);
    operationQueue.add(dependencies);
  });

  it('Should execute a complex dependency tree in order', (done) => {
    const spy = chai.spy((action) => {});

    const operationA = new BlockOperation((finish) => {
      spy('A');
      finish();

      try {
        expect(spy).to.have.been.first.called.with('D');
        expect(spy).to.have.been.second.called.with('C');
        expect(spy).to.have.been.third.called.with('B');
        expect(spy)
          .on.nth(4)
          .be.called.with('A');
        done();
      } catch (error) {
        done(error);
      }
    });
    operationA.name = 'A';

    const operationB = new BlockOperation((finish) => {
      spy('B');
      finish();
    });
    operationB.name = 'B';

    const operationC = new BlockOperation((finish) => {
      spy('C');
      finish();
    });
    operationC.name = 'C';

    const operationD = new BlockOperation((finish) => {
      spy('D');
      finish();
    });
    operationD.name = 'D';

    operationA.addDependencies([operationB, operationC]);
    operationB.addDependency(operationC);
    operationC.addDependency(operationD);

    const operationQueue = new OperationQueue();

    operationQueue.add([operationA, operationB, operationC, operationD]);
  });

  it('Should handle dependencies across queues', (done) => {
    const spy = chai.spy();

    const operationA = new BlockOperation((finish) => {
      setTimeout(() => {
        spy();
        finish();
      }, 1);
    });

    const operationB = new BlockOperation((finish) => {
      finish();

      try {
        expect(spy).to.have.been.called();
        done();
      } catch (error) {
        done(error);
      }
    });

    operationB.addDependency(operationA);

    const operationQueueA = new OperationQueue();
    const operationQueueB = new OperationQueue();

    operationQueueA.add(operationA);
    operationQueueB.add(operationB);
  });

  it('Should enqueue cancelled operation', (done) => {
    const spy = chai.spy();
    const op = new BlockOperation((finish) => {
      spy();
      finish();
    });
    const dep = new BlockOperation((finish) => {
      finish();

      try {
        expect(spy).to.not.have.been.called;
        done();
      } catch (error) {
        done(error);
      }
    });
    dep.addDependency(op);
    op.cancel();

    const operationQueue = new OperationQueue();
    operationQueue.add([op, dep]);
  });

  it('Should handle an operation cancellation before it being added to an operation queue', (done) => {
    const op = new BlockOperation((finish) => finish());
    op.onCompletion = () => {
      try {
        expect(op.isCancelled).to.be.true;
        expect(op.isFinished).to.be.true;
        done();
      } catch (error) {
        done(error);
      }
    };
    op.cancel();
  });

  it('Should not allow adding the same operation twice', () => {
    const op = new BlockOperation((finish) => finish());
    const operationQueue = new OperationQueue();
    operationQueue.add(op);

    expect(() => operationQueue.add(op)).to.throw(/already been enqueued/);
  });
});
