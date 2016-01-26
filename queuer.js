var queue = [],
  _ = require('lodash'),
  logger = require('./logger'),
  builder = require('./builder'),
  interval = 0,
  running = false;

var queuer = {
    // This get's triggered by an push event.
    add: function (commit) {
        queue.push(commit);
        queuer.deduplicate();

        logMessage = 'Added ' + commit.name + ': "' + commit.message + '" to the queue.';
        logger.log(logMessage, 'yellow');


        if (!running) {
            queuer.next()
        }
    },

    // This function keeps the oldest commit.
    deduplicate: function () {
        queue = _.uniqBy(queue, function (commit) {
            return commit.repo + commit.branch
        });

        queue = _.sortBy(queue, function (commit) {
            return commit.timestamp;
        })
    },

    init: function () {
        interval = setInterval(function () {
            queuer.tick();
        }, 2000);
    },

    tick: function () {
    },

    next: function () {
        nextCommit = queue[0];
        delete queue[0];
        builder.build(nextCommit);
    }
};

module.exports = queuer;