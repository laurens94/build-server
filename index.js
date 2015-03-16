'use strict';

/* WEBHOOK ADDRESS: http://128.199.56.106:3000/github */

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
    ip: '192.30.252.41',
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
        console.log(colors.yellow('Starting with: %s'), folderName);

        if (!fs.existsSync(sitesFolder + folderName)){
          console.log(colors.yellow('git clone git@github.com: %s.git'), req.body.repository.full_name);
          shell.exec('cd '+ sitesFolder + '; git clone git@github.com:' + req.body.repository.full_name + '.git');
          console.log(colors.green('Done cloning %s'), folderName);
        }

        console.log(colors.yellow('git pull origin master'));
        shell.exec('cd '+ sitesFolder + folderName + '; git pull origin master');
        console.log(colors.green('Done pulling the latest changes from GitHub.'));

        // packages.json check
        if (fs.existsSync(sitesFolder + folderName + '/packages.json')) {
          console.log(colors.green('packages.json found'));
          console.log(colors.yellow('npm install'));
          shell.exec('cd '+ sitesFolder + folderName + '; npm install');
          console.log(colors.green('Done installing packages.'), folderName);
        } else {
          console.log(colors.blue('no packages.json found'));
        }

        // GEMFILE check
        if (fs.existsSync(sitesFolder + folderName + '/GEMFILE')) {
          console.log(colors.green('GEMFILE found'));
          console.log(colors.yellow('bundle install'));
          shell.exec('cd '+ sitesFolder + folderName + '; bundle install');
          console.log(colors.green('Done installing gems.'), folderName);
        } else {
          console.log(colors.blue('no GEMFILE found'));
        }

        // Gruntfile check
        if (fs.existsSync(sitesFolder + folderName + '/Gruntfile.js')) {
          console.log(colors.green('Gruntfile.js found'));
          console.log(colors.yellow('grunt deploy'));
          shell.exec('cd '+ sitesFolder + folderName + '; grunt deploy');
          console.log(colors.green('Succesfully deployed project!'), folderName);
        } else {
          console.log(colors.blue('no Gruntfile.js found'));
        }

        console.log(colors.green('Done.\n'));
        console.log(colors.yellow('Waiting for incoming GitHub events...\n'));
      }
    }
  });
});

app.listen(3000);
console.log(colors.green('Started server on port 3000.'));
console.log(colors.yellow('Waiting for incoming GitHub events...\n'));
