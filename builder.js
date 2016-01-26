var fs = require('fs');

module.exports = {
    build: function (commit) {
        // git clone if this is the first time
        if (!fs.existsSync(sitesFolder + '/' + folderName)) {
            // make sites folder if there wasn't one yet
            if (!fs.existsSync(sitesFolder)){
                shell.exec('cd '+ sitesFolder + '; mkdir ' + sitesFolder);
            }

            console.log('git clone git@github.com: ' + req.body.repository.full_name + '.git');
            shell.exec('cd '+ sitesFolder + '; git clone git@github.com:' + req.body.repository.full_name + '.git');
            console.log(colors.green('Done cloning %s\n'), folderName);
        }
    },

};