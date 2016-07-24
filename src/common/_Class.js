var Backbone = require('backbone');
var _ = require('underscore');


/** 
 * Allows extend-able, easy class creation with backbone events
 * ex var x =  fluxer.Class.extend({stuff: ""});
 * Borrowed from Backbone.Marionette.
 * 
 * @param {any} options
 */
function _class(options) {
    this.options = _.extend({}, _.result(this, 'options'), options);
    this.initialize.apply(this, arguments);
};

_class.extend = Backbone.Model.extend;

// Class Methods
// --------------

// Ensure it can trigger events with Backbone.Events
_.extend(_class.prototype, Backbone.Events, {

    //this is a noop method intended to be overridden by classes that extend from this base
    initialize: function() {},

    onBeforeDestroy: _.noop,

    onDestroy: _.noop,

    destroy: function() {
        this.trigger('before:destroy');
        this.onBeforeDestroy();

        this.trigger('onDestroy');
        this.onDestroy();

        this.stopListening();
        return this;
    }
});

module.exports = _class;