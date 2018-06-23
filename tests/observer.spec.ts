import * as chai from 'chai';
import * as spies from 'chai-spies';
import { IObserver, BlockOperation, Operation, OperationQueue } from '../';

chai.use(spies);

const { expect, spy } = chai;

describe('Observer', () => {
  it('Should handle the successful operation', (done) => {
    const operation = new BlockOperation((finish) => {
      finish();
    });

    const observer = {
      enqueued: spy(),
      willExecute: spy(),
      finished: spy(),
      cancelled: spy(),
    };

    operation.addObserver(observer);
    operation.onCompletion = () => {
      try {
        expect(observer.enqueued).to.have.been.first.called;
        expect(observer.willExecute).to.have.been.second.called;
        expect(observer.finished).to.have.been.third.called;
        expect(observer.cancelled).to.not.have.been.called;
        done();
      } catch (error) {
        done(error);
      }
    };

    const operationQueue = new OperationQueue();

    operationQueue.add(operation);
  });

  it('Should handle the operation cancellation after adding it to the queue', (done) => {
    const operation = new BlockOperation((finish) => {
      finish();
    });

    const observer = {
      enqueued: spy(),
      willExecute: spy(),
      finished: spy(),
      cancelled: spy(),
    };

    operation.addObserver(observer);

    operation.onCompletion = () => {
      try {
        expect(observer.enqueued).to.have.been.first.called;
        expect(observer.cancelled).to.have.been.second.called;
        expect(observer.willExecute).to.not.have.been.called;
        expect(observer.finished).to.not.have.been.called;
        done();
      } catch (error) {
        done(error);
      }
    };

    const operationQueue = new OperationQueue();

    operationQueue.add(operation);

    operation.cancel();
  });

  it('Should handle the operation cancellation before adding it to the queue', (done) => {
    const operation = new BlockOperation((finish) => {
      finish();
    });

    const observer = {
      enqueued: spy(),
      willExecute: spy(),
      finished: spy(),
      cancelled: spy(),
    };

    operation.addObserver(observer);

    operation.onCompletion = () => {
      try {
        expect(observer.cancelled).to.have.been.first.called;
        expect(observer.enqueued).to.not.have.been.called;
        expect(observer.willExecute).to.not.have.been.called;
        expect(observer.finished).to.not.have.been.called;
        done();
      } catch (error) {
        done(error);
      }
    };

    const operationQueue = new OperationQueue();

    operation.cancel();

    operationQueue.add(operation);
  });

  it('Should be able to cancel the operation from willExecute observer', (done) => {
    const operation = new BlockOperation((finish) => {
      finish();
    });

    const observer: IObserver<BlockOperation> = {
      willExecute: spy((operation: BlockOperation) => operation.cancel()),
      cancelled: spy(),
      finished: spy(),
      enqueued: spy(),
    };

    operation.addObserver(observer);
    operation.onCompletion = () => {
      try {
        expect(observer.enqueued).to.not.have.been.first.called;
        expect(observer.willExecute).to.have.been.second.called;
        expect(observer.cancelled).to.have.been.third.called;
        expect(observer.finished).to.not.have.been.called;
        done();
      } catch (error) {
        done(error);
      }
    };

    const operationQueue = new OperationQueue();

    operationQueue.add(operation);
  });
});
