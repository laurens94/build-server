# Build server

## Prerequisites
- nginx (with `include /var/www/vhosts/*;` in config)
- node with npm

## Installation
1. Run `sudo visudo` and add the following line *(replace `thisuser` with an existing user)*:  
  `thisuser ALL=(ALL) NOPASSWD: /usr/sbin/service nginx start,/usr/sbin/service nginx stop,/usr/sbin/service nginx restart`
2. `yarn` or `npm install`
3. Copy and edit contents of `.env.example` to `.env`:
4. [Create an access token](https://github.com/settings/tokens) and save the variable as `GITHUB_TOKEN` in `.env`
5. Add the webhook to your repo, making sure your `GIT_HOOK_SECRET` (in `.env`) is the same as the secret of your private repo.

## Usage
### Start
`forever start --uid "thisuser" -a index.js`  
*(replace `thisuser` with the same user given in step 1 under Installation)*

### Stop
`forever stop index.js`

## Todo:
- do something with permissions, so repositories can only read/write in their own repo (for gulp/npm postinstall scripts etc)
