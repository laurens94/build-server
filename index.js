'use strict';

var express = require('express'),
  path = require('path'),
  exphbs  = require('express-handlebars'),
  _ = require('lodash'),
  bodyParser = require('body-parser'),
  logger = require('./logger'),
  queue = require('./queuer'),
  parser = require('./commitParser');

var appRoot = process.cwd();

var settings = require('./settings.json');
var settingsDefault = require('./settings.default.json');

var app = express();

var mergedSettings = _.merge(settingsDefault, settings)

var hbs = exphbs.create({
  helpers: mergedSettings,
  defaultLayout: 'main'
});

app.engine('handlebars', hbs.engine);
app.set('view engine', 'handlebars');

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.set('views', path.join(appRoot, 'views'));
app.use(express.static('css'));

app.get('/', function (req, res) {
  res.render('home', {
    root: appRoot,
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
logger.log('Waiting for incoming push events...', 'green');

queue.init();