'use strict';

var express = require('express'),
    debug = require('debug')('api'),
    bodyParser = require('body-parser'),
    Githook = require('git-hook'),
    shell = require('shelljs'),
    fs = require('fs');

var app = express();
var gh = new Githook();

app.use(bodyParser.json({
    limit: '1mb'
}));

app.get('/', function (req, res) {
    res.status(200).send('yo world');
});

app.post('/github', function (req, res) {
    debug('github event');
    gh.handleEvent('github', {
        ip: '192.30.252.1', // gh.determineIP(req),
        headers: req.headers,
        body: req.body
    }, function (err) {
        if (err) {
            res.status(400).send('Event not supported');
        } else {
            if (req.body.ref == 'refs/heads/master') {
                res.status(200).send('Building your shizzle.');
                res.end();

                var folderName = req.body.repository.name
                console.log('Starting with: ' + folderName)

                if (!fs.existsSync('sites/' + folderName)){
                    console.log('Git clone: ' + folderName)
                    shell.exec('cd sites; git clone git@github.com:' + req.body.repository.full_name + '.git');
                }

                console.log('npm install')
                shell.exec('cd sites/' + folderName + '; npm install');

                console.log('bundle install')
                shell.exec('cd sites/' + folderName + '; bundle install');

                console.log('git pull')
                shell.exec('cd sites/' + folderName + '; git pull origin master');

                console.log('grunt deploy')
                shell.exec('cd sites/' + folderName + '; grunt deploy');
            }
        }
    });
});

app.listen(3000);
console.log('started server on port 3000');
