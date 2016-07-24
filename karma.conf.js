module.exports = function(config) {
  config.set({
    frameworks: ['jasmine'],
    //reporters: ['spec'],
    browsers: ['Chrome'],
    files: [
      'libs/jquery-2.2.2.js',
       'libs/underscore.js',
       'libs/backbone.js',
       'libs/immutable.js',
       'libs/Flux.js',
      'dist/backbone.fluxer.wp.js',
      'spec/**/*spec.js'
    ]
  });
};