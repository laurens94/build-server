var fs = require('fs'),
  mkdirp = require('mkdirp'),
  logger = require('./logger'),
  async = require('async'),
  exec = require('child_process').exec,
  Git = require("nodegit"),
  path = require("path"),
  ncp = require('ncp').ncp,
  rimraf = require('rimraf'),
  cred = Git.Cred;

ncp.limit = 16;

var currentCommit = null;
var currentCheck = null;

var currentTerminalCommand;
var mustKillNextCheck = false;

var builderDomain = 'build.studiofonkel.nl';

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

    getSourcePath: function (commit) {
        return __dirname + '/builds/' + commit.repo_name + '_' + commit.branch;
    },

    getBuildPath: function (commit) {
        return '/var/www/' + commit.repo_name + '/' + commit.branch + '_' + commit.timestamp;
    },

    getBuildsPath: function (commit) {
        return '/var/www/' + commit.repo_name;
    },

    getVhostPath: function (commit) {
        return '/var/www/vhosts/' + commit.branch + '_' + commit.repo_name;
    },

    build: {
        init: function (commit) {
            mustKillNextCheck = false;

            currentCommit = commit;

            if (!fs.existsSync(builder.getSourcePath(commit))) {
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

                var cloneOptions = {
                    checkoutBranch: commit.branch,
                    remoteCallbacks: {
                        credentials: function (url, userName) {
                            return cred.sshKeyFromAgent(userName);
                        }
                    }
                };

                try {
                    Git.Clone(commit.repo, builder.getSourcePath(commit), cloneOptions)
                    .then(function(repo) {
                        logger.log('Cloned repo: ' + commit.repo_name, 'yellow')
                        builder.build.pull(commit);
                    })
                }
                catch(error) {
                    console.log(error)
                }
            });
        },

        pull: function (commit) {
            try {
                Git.Repository.open(builder.getSourcePath(commit))
                .then(function (repo) {
                    repo.fetchAll().then(function () {
                        repo.mergeBranches(commit.branch, 'origin/' + commit.branch);
                        logger.log('Pulled on repo: ' + commit.repo_name, 'yellow');
                        builder.build.runChecks(commit);
                    });
                })
            }
            catch(error) {
                console.log(error)
            }
        },

        runChecks: function (commit) {
            var checkPromises = [];
            builder.checks.forEach(function (check) {
                checkPromises.push(async.asyncify(function () {
                    return builder.build.runCheck({ commit: commit, check: check });
                }));
            });

            async.waterfall(checkPromises, function(err, results){
                currentCommit = null;
                currentCheck = null;
            })
        },
        
        runCheck: function (params) {
            var commit = params.commit;
            currentCheck = params.check;

            if (fs.existsSync(builder.getSourcePath(commit) + '/' + currentCheck.filename)) {
                logger.log('Check ' + currentCheck.filename + ' was found', 'yellow');

                if (mustKillNextCheck) {
                    mustKillNextCheck = false;
                    reject(Error("Canceled..."));
                }

                logger.log('Starting with executing ' + params.check.name, 'yellow');

                return new Promise(function(resolve, reject) {
                    var execCommand = '';

                    if (typeof params.check.exec == 'function') {
                        execCommand = params.check.exec(params);
                    }
                    else {
                        execCommand = params.check.exec;
                    }

                    if (execCommand) {
                        currentTerminalCommand = exec(execCommand, {
                            cwd: builder.getSourcePath(params.commit),
                            shell: '/bin/bash',
                            maxBuffer: 1000 * 1024
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
                    else if (params.check.command && typeof params.check.command == 'function') {
                        var result = params.check.command(params);
                        resolve(result);
                    }
                    else {
                        reject(Error("Broken..."));
                    }
                });
            }
            else {
                return new Promise(function(resolve, reject) {
                    logger.log('Check ' + currentCheck.name + ' was not successful', 'yellow');
                    resolve(true)
                })
            }
        }
    },

    checks: [
        {
            "name": "npm",
            "filename": "package.json",
            "exec": "npm install",
            "successMessage": "Done installing packages.",
            "killable": false
        },

        {
            "name": "bundler",
            "filename": "Gemfile",
            "exec": "bundle install",
            "successMessage": "Done installing gems.",
            "killable": false
        },

        {
            "name": "bower",
            "filename": "bower.json",
            "exec": "bower install --allow-root",
            "successMessage": "Done installing bower dependencies.",
            "killable": false
        },

        {
            "name": "grunt",
            "filename": "Gruntfile.js",
            "exec": "grunt build",
            "successMessage": "Succesfully deployed project.",
            "killable": true
        },

        {
            "name": "vhost replacement",
            "filename": "vhost",
            "command": function (params) {
                if (fs.existsSync(builder.getVhostPath(params.commit))) {
                    fs.unlinkSync(builder.getVhostPath(params.commit));
                }

                var cname = fs.readFileSync(builder.getSourcePath(params.commit) + '/CNAME').toString().trim();
                var vhost = fs.readFileSync(builder.getSourcePath(params.commit) + '/vhost').toString().trim();

                vhost = vhost.replace('[REPLACE_WITH_BUILD_PATH]', builder.getBuildPath(params.commit));

                if (params.commit.branch && params.commit.branch != 'master') {
                    cname = params.commit.branch + '.' + cname;
                }

                vhost = vhost.replace('[REPLACE_WITH_CNAME]', cname + ' ' + cname + '.' + builderDomain);

                try {
                    fs.writeFile(builder.getVhostPath(params.commit), vhost);
                }
                catch(err) {
                    console.log(err)
                }

                return 'done';
            },
            "successMessage": "Succesfully replaced the vhost.",
            "killable": false
        },

        {
            "name": "build folder copy",
            "filename": "vhost",
            "command": function (params) {
                mkdirp(builder.getBuildsPath(params.commit), function(err) {
                    logger.log('Ensured ' + builder.getBuildsPath(params.commit) + ' folder', 'green');

                    if (params.commit.repo_name && params.commit.timestamp) {
                        rimraf.sync(builder.getBuildPath(params.commit));
                    }

                    ncp(builder.getSourcePath(params.commit) + '/dist', builder.getBuildPath(params.commit), function (err) {
                        if (err) {
                            console.log(err)
                        }
                    });
                });

                return 'build folder copy';
            },
            "successMessage": "Succesfully copied build.",
            "killable": false
        },

        {
            "name": "nginx reload",
            "filename": "vhost",
            "exec": "sudo service nginx reload",
            "successMessage": "Reloaded nginx.",
            "killable": false
        }
    ]
};

module.exports = builder;