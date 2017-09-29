var queue = [],
  _ = require('lodash'),
  logger = require('./logger'),
  builder = require('./builder'),
  interval = 0;

var queuer = {

    // This get's triggered by an push event.
    add: function (commit) {
        var currentBuild = builder.current();
        if (currentBuild && commit.repo_name == currentBuild.repo_name && commit.branch == currentBuild.branch) {
            builder.cancel(commit);
        }

        queue.push(commit);
        queuer.deduplicate();
        logger.log('Added ' + commit.repo_name + ': "' + commit.message + '" to the queue.', 'yellow');
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
        if (!builder.current() && queue.length) {
            queuer.next();
        }
    },

    next: function () {
        if (queue.length) {
            nextCommit = queue.shift();
            builder.build.init(nextCommit);
        }
    },

    queue: function () {
        return queue;
    }
};

module.exports = queuer;
