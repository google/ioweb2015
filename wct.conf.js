module.exports = {
  verbose: true,
  persistent:  true,
  suites:      ['app/scripts/helper'],
  plugins: {
    local: {
      browsers: ['chrome']
    }
  },
};
