var fs = require('fs'),
  mkdirp = require('mkdirp'),
  logger = require('./logger'),
  async = require('async'),
  exec = require('child_process').exec,
  Git = require("nodegit");

var currentCommit = null;
var currentCheck = null;

var currentTerminalCommand;
var mustKillNextCheck = false;
var builder = {

    current: function () {
        return currentCommit;
    },

    cancel: function (commit) {
        if (currentCommit && commit.repo_name == currentCommit.repo_name && commit.branch == currentCommit.branch) {

            if (currentCheck && currentCheck.killable) {
                currentTerminalCommand.kill('SIGINT');
                currentCommit = null;
                logger.log('Killed ' + commit.message, 'red');
            }
            else {
                logger.log('Canceled ' + commit.message + ', but had a non killable task, will terminate the build when possible', 'red');
            }

            mustKillNextCheck = true;
        }
    },

    build: {
        init: function (commit) {
            mustKillNextCheck = false;

            currentCommit = commit;

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
            var checkPromises = [];
            builder.checks.forEach(function (check) {
                if (fs.existsSync(__dirname + '/builds/' + commit.repo_name + '/' + check.filename)) {
                    logger.log('Check ' + check.filename + ' was found', 'yellow');

                    checkPromises.push(async.asyncify(function () {
                        return builder.build.runCheck({ commit: commit, check: check });
                    }));
                }
                else {
                    logger.log('Check ' + check.name + ' was not successful', 'yellow');
                }
            });

            async.waterfall(checkPromises, function(err, results){
                currentCommit = null;
                currentCheck = null;
            })
        },
        
        runCheck: function (params) {
            currentCheck = params.check;

            if (mustKillNextCheck) {
                mustKillNextCheck = false;
                reject(Error("Canceled..."));
            }

            logger.log('Starting with executing ' + params.check.name, 'yellow');

            return new Promise(function(resolve, reject) {
                var command = '';

                if (typeof params.check.command == 'function') {
                    command = params.check.command(params);
                }
                else {
                    command = params.check.command;
                }

                if (command) {
                    currentTerminalCommand = exec(command, {
                        cwd: __dirname + '/builds/' + params.commit.repo_name,
                        shell: '/bin/bash',
                    }, function(error, stdout, stderr) {

                        logger.log(params.check.successMessage, 'yellow');

                        if (stdout) {
                            logger.log("stdout:\n\n" + stdout + "\n\n", 'yellow');
                        }

                        if (stderr) {
                            logger.log("stderr:\n\n" + stderr, 'yellow');
                        }

                        if (error) {
                            logger.log("error:\n\n" + error, 'yellow');
                        }

                        if (params.check.post && typeof params.check.post == 'function') {
                            params.check.post(params)
                        }

                        resolve(params.check.successMessage);
                    });
                }
                else {
                    reject(Error("Broken..."));
                }
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
        },

        {
            "name": "vhost replacement",
            "filename": "vhost",
            "command": function (params) {
                if (params.commit.repo_name) {
                    return  'sudo rm -f /var/www/vhosts/' + params.commit.repo_name + '; ' +
                        'sudo cp ' + __dirname + '/builds/' + params.commit.repo_name + '/vhost /var/www/vhosts/' + params.commit.repo_name + '; ';
                }
            },
            "successMessage": "Succesfully replaced the vhost.",
            "killable": false
        },

        {
            "name": "build folder copy",
            "filename": "vhost",
            "command": function (params) {
                if (params.commit.repo_name) {
                    return 'sudo cp --parents ' + __dirname + '/builds/' + params.commit.repo_name + '/dist /var/www/' + params.commit.repo_name + '/' + params.commit.timestamp + '; ';
                }
            },
            "post": function (params) {
                fs.readFile('/var/www/vhosts/' + params.commit.repo_name, 'utf8', function (err,data) {
                    if (err) {
                        return console.log(err);
                    }
                    var result = data.replace(/[REPLACE_WITH_BUILD_PATH]/g, '/dist /var/www/' + params.commit.repo_name + '/' + params.commit.timestamp);

                    fs.writeFile('/var/www/vhosts/' + params.commit.repo_name, result, 'utf8', function (err) {
                        if (err) return console.log(err);
                    });
                });
            },
            "successMessage": "Succesfully copied build.",
            "killable": false
        },


        {
            "name": "nginx reload",
            "filename": "vhost",
            "command": "sudo service nginx reload",
            "successMessage": "Reloaded nginx.",
            "killable": false
        }
    ]
};

module.exports = builder;