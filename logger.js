var colors = require('colors');

module.exports = {
    log: function (string, color) {
        if (colors[color]) {
            console.log(colors[color](string))
        }
        else {
            console.log(string)
        }
    }
};