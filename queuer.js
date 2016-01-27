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

        logger.log('Added ' + commit.repo_name + ': "' + commit.message + '" to the queue.', 'yellow');

        if (!builder.current()) {
            queuer.next();
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

    current: function () {
      return builder.current();
    },

    tick: function () {
    },

    next: function () {
        nextCommit = queue.shift();
        builder.build.init(nextCommit);
    },

    queue: function () {
        return queue;
    }
};

module.exports = queuer;