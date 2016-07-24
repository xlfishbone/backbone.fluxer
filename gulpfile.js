var gulp = require('gulp'),
webpack = require('webpack-stream'),
rename = require('gulp-rename'),
uglify = require('gulp-uglify'),
pump = require('pump'),
del = require('del'),
Server = require('karma').Server
;

var distName = 'backbone.fluxer.wp';

gulp.task('clean', function (cb) {
  del(['./dist/backbone.fluxer.wp*'], cb);
});

gulp.task('pack', function() {
  return gulp.src('./src/fluxer.js')  
    .pipe(webpack(require('./webpack.config.js')))
    .pipe(rename(distName + '.js'))
    .pipe(gulp.dest('dist/'));
});

gulp.task('minify', ['pack'], function (cb) {    
    pump([
        gulp.src('./dist/'+distName+'.js'),
        uglify(),
        rename(distName + '.min.js'),
        gulp.dest('dist/')
    ],
    cb
  );
});

gulp.task('test', function (done) {
  return new Server({
    configFile: __dirname + '/karma.conf.js',
    singleRun: true
  }, done).start();
});


gulp.task('default',['clean','pack', 'minify'], function() {
  // place code for your default task here
});