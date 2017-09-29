# Build server

## Prerequisites
- nginx (with `include /var/www/vhosts/*;` in config)
- node 4.5.0

## Installation:
- `yarn` or `npm install`
- Copy and edit contents of `.env.example` to `.env`

## Usage:
### Start:
`sudo forever start index.js`

### Stop:
`sudo forever stopall`
