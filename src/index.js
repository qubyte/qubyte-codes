(function () {
  'use strict';

  if (!window.navigator.serviceWorker) {
    return;
  }

  navigator.serviceWorker.getRegistrations()
    .then(function (workers) {
      return Promise.all(workers.map(function (worker) {
        return worker.unregister();
      }));
    })
    .then(function (successes) {
      if (!successes.length) {
        return;
      }

      var succeeded = 0;
      var failed = 0;

      for (var i = 0; i < successes.length; i++) {
        if (successes[i]) {
          succeeded++;
        } else {
          failed++;
        }
      }

      if (failed) {
        console.log(failed, 'workers failed to unregister.');
      }

      console.log(succeeded, 'workers unregistered.');
    });
}());
