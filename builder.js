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

var builderDomain = process.env.BUILDER_DOMAIN;

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
            logger.log('Running builder.build.init', 'white');
            mustKillNextCheck = false;

            currentCommit = commit;

	    var folderToBuild = builder.getSourcePath(commit);

            if (!fs.existsSync(folderToBuild)) {
                builder.build.clone(commit);
            }
            else {
		// Remove folder then clone:
		rmdirAsync(folderToBuild, function () {
                  console.log('Removed old build: ' + folderToBuild);
		  builder.build.clone(commit);
                });
            }
        },

        clone: function (commit) {

            logger.log('Cloning commit:', 'green');
            logger.log(commit.repo, 'rainbow');

            // Check if we have a builds folder.
            mkdirp(__dirname + '/builds', function(err) {
                logger.log('Ensured a builds folder', 'green');

                var cloneOptions = {
                    checkoutBranch: commit.branch
                };

                cloneOptions.fetchOpts = {
                  callbacks: {
                    certificateCheck: function() { return 1; },
                    credentials: function() {
                      return Git.Cred.userpassPlaintextNew(process.env.GITHUB_TOKEN, "x-oauth-basic");
                    }
                  }
                };

		var errorAndAttemptOpen = function() {
 		    return Git.Repository.open(builder.getSourcePath(commit));
		};

                var cloneRepo = Git.Clone(commit.repo, builder.getSourcePath(commit), cloneOptions);
                cloneRepo.catch(errorAndAttemptOpen)
                    .then(function(repository) {
                        logger.log('Cloned repo: ' + commit.repo_name, 'yellow');
			builder.build.runChecks(commit);
                    });
            });
        },

        garbageCollector: function (commit) {
            var folder = '/var/www/' + commit.repo_name;
            var oldBuilds = [];

            fs.readdir(folder, function(err, items) {
                for (var i=0; i < items.length; i++) {

                    if (items[i].substr(0, commit.branch.length) == commit.branch && commit.branch + '_' + commit.timestamp != items[i]) {
                        oldBuilds.push(items[i]);
                    }
                }

                // A > Z
                oldBuilds.sort();

                // Z > A
                oldBuilds.reverse();

                // The number is the threshold of builds we keep to roll back.
                var buildsToRemove = oldBuilds.slice(2);

                buildsToRemove.forEach(function (oldBuildFolderName) {
                    rmdirAsync(folder + '/' + oldBuildFolderName, function () {
                        console.log('Removed old build: ' + folder + '/' + oldBuildFolderName);
                    });
                });
            });
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
            "name": "gulp",
            "filename": "gulpfile.js",
            "exec": "gulp build",
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

                vhost = vhost.replace(/\[REPLACE_WITH_CNAME\]/g, cname);
                vhost = vhost.replace(/\[REPLACE_WITH_ALIAS\]/g, cname + '.' + builderDomain);

                try {
                    fs.writeFile(builder.getVhostPath(params.commit), vhost);
                }
                catch(err) {
                    console.log(err)
                    logger.log(err, 'red');
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
                        else {
                            builder.build.garbageCollector(params.commit);
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
            "exec": "sudo /usr/sbin/service nginx restart",
            "successMessage": "Reloaded nginx.",
            "killable": false
        }
    ]
};

var rmdirAsync = function(path, callback) {
    fs.readdir(path, function(err, files) {
        if(err) {
            // Pass the error on to callback
            callback(err, []);
            return;
        }
        var wait = files.length,
            count = 0,
            folderDone = function(err) {
                count++;
                // If we cleaned out all the files, continue
                if( count >= wait || err) {
                    fs.rmdir(path,callback);
                }
            };
        // Empty directory to bail early
        if(!wait) {
            folderDone();
            return;
        }

        // Remove one or more trailing slash to keep from doubling up
        path = path.replace(/\/+$/,"");
        files.forEach(function(file) {
            var curPath = path + "/" + file;
            fs.lstat(curPath, function(err, stats) {
                if( err ) {
                    callback(err, []);
                    return;
                }
                if( stats.isDirectory() ) {
                    rmdirAsync(curPath, folderDone);
                } else {
                    fs.unlink(curPath, folderDone);
                }
            });
        });
    });
};

module.exports = builder;
