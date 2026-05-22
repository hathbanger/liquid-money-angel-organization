const path = require('path');

/** @type {import('next').NextConfig} */
const config = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname),
};
module.exports = config;
