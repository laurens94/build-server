'use strict';

// Change IP address before using this script
var ipAddress = '192.30.252.41';

// Requirements
var express = require('express'),
  debug = require('debug')('api'),
  bodyParser = require('body-parser'),
  Githook = require('git-hook'),
  shell = require('shelljs'),
  fs = require('fs'),
  colors = require('colors');

var app = express();
var gh = new Githook({
  github: {

  }
});

app.use(bodyParser.json({
  limit: '1mb'
}));

app.get('/', function (req, res) {
  res.status(200).send('hee niet spieken droplul');
});

app.post('/github', function (req, res) {
  console.log(colors.bold('Incoming GitHub event!'));
  debug('github event');

  gh.handleEvent('github', {
    ip: ipAddress,
    headers: req.headers,
    body: req.body
  }, function (err) {
    if (err) {
      res.status(400).send('Event not supported');
    } else {
      if (req.body.ref == 'refs/heads/master') {
        res.status(200).send('Building your shizzle.');
        res.end();

        var sitesFolder = 'sites/';
        var folderName = req.body.repository.name;
        console.log(colors.yellow('Starting with: %s\n'), folderName);

        // git clone if this is the first time
        if (!fs.existsSync(sitesFolder + folderName)) {
            // make sites folder if there wasn't one yet
            if (!fs.existsSync(sitesFolder)){
              shell.exec('mkdir ' + sitesFolder);
            }

            console.log('git clone git@github.com: ' + req.body.repository.full_name + '.git');
            shell.exec('cd '+ sitesFolder + '; git clone git@github.com:' + req.body.repository.full_name + '.git');
            console.log(colors.green('Done cloning %s\n'), folderName);
        }

        // git pull origin master
        else {
          console.log('git pull origin master');
          shell.exec('cd '+ sitesFolder + folderName + '; git pull origin master');
          console.log(colors.green('Done pulling the latest changes from GitHub.\n'));
        }

        var checks = {
          "node": {
            "filename": "packages.json",
            "command": "npm install",
            "successMessage": "Done installing packages."
          },

          "bundler": {
            "filename": "GEMFILE",
            "command": "bundle install",
            "successMessage": "Done installing gems."
          },

          "grunt": {
            "filename": "Gruntfile.js",
            "command": "grunt deploy",
            "successMessage": "Succesfully deployed project."
          }
        };

        for (var key in checks) {
          var obj = checks[key];
          console.log(colors.yellow('Trying to locate %s...'), obj.filename);

          if (fs.existsSync(sitesFolder + folderName + '/' + obj.filename)) {
            console.log(colors.green('%s found'), obj.filename);
            console.log(colors.yellow('%s'), obj.command);
            shell.exec('cd '+ sitesFolder + folderName + '; ' + obj.command);
            console.log(colors.green('%s\n'), obj.successMessage);
          }

          else {
            console.log(colors.blue('no %s found\n'), obj.filename);
          }
        }

        console.log(colors.green('All done.\n\n\n'));
        console.log(colors.yellow('Waiting for incoming GitHub events...\n'));
      }
    }
  });
});

app.listen(3000);
console.log(colors.green('Started server on port 3000.'));
console.log(colors.yellow('Waiting for incoming GitHub events...\n'));
