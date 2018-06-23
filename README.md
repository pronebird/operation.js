# Operation.js

This repository is an attempt to rebuild NSOperation and NSOperationQueue from Apple's Foundation framework in Javascript to support complex flows with dependencies in Javascript apps.

I follow the general design of NSOperation but also take a lof of inspiration from ProcedureKit and Operative frameworks written in Swift and Objective-C and hoping to add result injections and conditions some time soon.

The very minimal pseudo example:

```javascript
const operationQueue = new OperationQueue();

/* create operations */
const createUser = new BlockOperation((finish) => {
  // create user first
  mongoose.model('User').create({ username: 'Marlon Brando' }, function () {
    finish();
  });
});

const renderPage = new BlockOperation((finish) => {
  // then render welcome page
  res.render('welcome', function () {
    finish();
  });
});

/* set dependencies between operations */
renderPage.addDependency(createUser);

/* execute */
operationQueue.add([createUser, renderPage]);
```
