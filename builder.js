var fs = require('fs'),
  mkdirp = require('mkdirp'),
  logger = require('./logger'),
  async = require('async'),
  exec = require('child_process').exec,
  Git = require("nodegit");

var builder = {
    build: {
        init: function (commit) {
            if (!fs.existsSync(__dirname + '/builds/' + commit.repo_name)) {
                builder.build.clone(commit);
            }
            else {
                builder.build.pull(commit);
            }
        },

        clone: function (commit) {
            // Check if we have a builds folder.
            mkdirp(__dirname + '/builds', function(err) {
                logger.log('Ensured a builds folder', 'green');

                Git.Clone(commit.repo, __dirname + '/builds/' + commit.repo_name)
                .then(function(repo) {
                    logger.log('Cloned repo: ' + commit.repo_name, 'yellow')
                    builder.build.pull(commit);
                })
            });
        },

        pull: function (commit) {
            Git.Repository.open(__dirname + '/builds/' + commit.repo_name)
            .then(function(repo) {
                repo.fetchAll().then(function() {
                    logger.log('Pulled on repo: ' + commit.repo_name, 'yellow');
                    builder.build.runChecks(commit);
                });
            })
        },

        runChecks: function (commit) {
            var checkFunctions = [];

            builder.checks.forEach(function (check) {
                if (fs.existsSync(__dirname + '/builds/' + commit.repo_name + '/' + check.filename)) {
                    logger.log('Check ' + check.name + ' was successful', 'yellow');

                    checkFunctions.push(function (callback) {
                        exec(check.command, {
                            cwd: __dirname + '/builds/' + commit.repo_name
                        }, function(error, stdout, stderr) {

                            console.log('stdout: ' + stdout);
                            console.log('stderr: ' + stderr);

                            if (error !== null) {
                                console.log('exec error: ' + error);
                            }

                            console.log(check)
                            callback()
                        });
                    })
                }
                else {
                    logger.log('Check ' + check.name + ' was not successful', 'yellow');
                }
            });

            async.waterfall(checkFunctions, function (err, result) {
                console.log(result)
            });
        }
    },

    checks: [
        {
            "name": "npm",
            "filename": "package.json",
            "command": "npm install",
            "successMessage": "Done installing packages.",
            "killable": false
        },

        {
            "name": "bundler",
            "filename": "Gemfile",
            "command": "bundle install",
            "successMessage": "Done installing gems.",
            "killable": false
        },

        {
            "name": "bower",
            "filename": "bower.json",
            "command": "bower install --allow-root",
            "successMessage": "Done installing bower dependencies.",
            "killable": false
        },

        {
            "name": "grunt",
            "filename": "Gruntfile.js",
            "command": "grunt build",
            "successMessage": "Succesfully deployed project.",
            "killable": true
        }
    ]
};

module.exports = builder;