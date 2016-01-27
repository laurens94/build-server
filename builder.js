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

            async.series(checkPromises, function(err, results){
            })
        },
        
        runCheck: function (params) {
            logger.log('Starting with executing ' + params.check.name, 'yellow');

            return new Promise(function(resolve, reject) {
                var command = '';

                if (typeof params.check.command == 'function') {
                    command = params.check.command(params);
                }
                else {
                    command = params.check.command;
                }

                exec(command, {
                    cwd: __dirname + '/builds/' + params.commit.repo_name
                }, function(error, stdout, stderr) {

                    logger.log('After executing ' + params.check.name, 'yellow');

                    if (stdout) {
                        logger.log("stdout:\n\n" + stdout + "\n\n", 'yellow');
                    }

                    if (stderr) {
                        logger.log("stderr:\n\n" + stderr, 'yellow');
                    }

                    if (error) {
                        logger.log("error:\n\n" + error, 'yellow');
                    }

                    resolve('Finnised ' + params.check.name);
                });
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
            "name": "nginx",
            "filename": "vhost",
            "command": function (params) {
                return  'rm -f /etc/nginx/sites-enabled/' + params.commit.repo_name + '; ' +
                        'cp ' + __dirname + '/builds/' + params.commit.repo_name + '/vhost /etc/nginx/sites-enabled/' + params.commit.repo_name + '; ' +
                        'service nginx reload;';
            },
            "successMessage": "Succesfully deployed project.",
            "killable": true
        }
    ]
};

module.exports = builder;