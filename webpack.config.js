 module.exports = {
    //  entry: './src/fluxer.js',
    //  output: {
    //      path: './dist',
    //      filename: 'fluxer.wp.js'
    //  },
     externals: {        
        "jquery": "jQuery",
        "backbone": "Backbone",
        "underscore": "_",
        "immutable": "Immutable",
        "flux": "Flux"
    }
 };