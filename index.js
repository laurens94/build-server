'use strict';

var express = require('express'),
  exphbs  = require('express-handlebars'),
  _ = require('lodash'),
  bodyParser = require('body-parser'),
  logger = require('./logger'),
  queue = require('./queuer'),
  parser = require('./commitParser');

var app = express();

app.engine('handlebars', exphbs({defaultLayout: 'main'}));
app.set('view engine', 'handlebars');
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.get('/', function (req, res) {
  res.render('home', {
    queue_items: function () {
      return queue.queue();
    },
    current_build: function () {
      return queue.current();
    }
  });
});

app.post('/github', function (req, res) {
  var commit = parser.parseGithub(req);

  if (commit) {
    queue.add(commit);
  }

  res.status(200).send('Woop woop');
  res.end();
});

app.listen(3000, "0.0.0.0");

logger.log('Started server on port 3000.', 'green');
logger.log('Waiting for incoming GitHub events...', 'green');

queue.init();