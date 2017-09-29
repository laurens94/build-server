# Prerequisites
- nginx
- node 4.5.0

# Installation:
- `npm install`
- `touch .env`
- Add the following line to `.env`:
  `GIT_HOOK_SECRET=your-secret-key-here`

# Usage:
- `sudo forever start index.js`

To stop:
`sudo forever stopall`
