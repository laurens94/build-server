'use strict';

var express = require('express'),
  _ = require('lodash'),
  bodyParser = require('body-parser'),
  logger = require('./logger'),
  queue = require('./queuer'),
  parser = require('./commitParser');

var app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.get('/', function (req, res) {
  res.status(200).send('Yo world');
});

app.post('/github', function (req, res) {
  var commit = parser.parseGithub(req);
  var logMessage = '';

  if (commit) {
    queue.add(commit);
  }

  res.status(200).send(logMessage);
  res.end();
});

app.listen(3000, "0.0.0.0");

logger.log('Started server on port 3000.', 'green');
logger.log('Waiting for incoming GitHub events...', 'green');

queue.init();