'use strict';

require('dotenv').config();

var express = require('express'),
    path = require('path'),
    exphbs = require('express-handlebars'),
    _ = require('lodash'),
    bodyParser = require('body-parser'),
    logger = require('./logger'),
    queue = require('./queuer'),
    parser = require('./commitParser'),
    crypto = require('crypto');

var appRoot = process.cwd();

var app = express();

var hbs = exphbs.create({
    helpers: {
        name: process.env.NAME
    },
    defaultLayout: 'main'
});

app.engine('handlebars', hbs.engine);
app.set('view engine', 'handlebars');

// Calculate the X-Hub-Signature header value.
function getSignature (buf) {
    var hmac = crypto.createHmac('sha1', process.env.GIT_HOOK_SECRET);
    hmac.update(buf, 'utf-8');
    return 'sha1=' + hmac.digest('hex');
}

// Verify function compatible with body-parser to retrieve the request payload.
// Read more: https://github.com/expressjs/body-parser#verify
function verifyRequest (req, res, buf, encoding) {
    var expected = req.headers['x-hub-signature'];
    var calculated = getSignature(buf);
    if (expected) {
        console.log ('Expected present');
    }
    if (expected !== calculated) {
        throw new Error('Invalid signature.');
    }
    else {
        console.log('Valid signature!');
    }
}

// Express error-handling middleware function.
// Read more: http://expressjs.com/en/guide/error-handling.html
function abortOnError (err, req, res, next) {
    if (err) {
        console.log(err);
        res.status(400).send({ error: 'Invalid signature.' });
    }
    else {
        next();
    }
}

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json({ verify: verifyRequest }));

// Add an error-handling Express middleware function
// to prevent returning sensitive information.
app.use(abortOnError);

app.set('views', path.join(appRoot, 'views'));
app.use(express.static('css'));

app.get('/', function(req, res) {
    res.render('home', {
        root: appRoot,
        queue_items: function() {
            return queue.queue();
        },
        current_build: function() {
            return queue.current();
        }
    });
});

app.post('/github', function(req, res) {
    var commit = parser.parseGithub(req);

    if (commit) {
        queue.add(commit);
    }

    res.status(200).send('Woop woop');
    res.end();
});

app.listen(3000, '0.0.0.0');

logger.log('Started server on port 3000.', 'green');
logger.log('Waiting for incoming push events...', 'green');

queue.init();
