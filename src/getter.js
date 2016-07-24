//----------------------
// Getter
//----------------------



var _ = require('underscore');
var _Class = require('./common/_Class.js');
var _stateMutationEvents = require('./common/stateMutationEvents.js');
var _immutableHelpers = require('./common/immutableHelpers.js');
var _stringFormat = require('./common/stringFormat.js');


var _baseGetter = _Class.extend({
    _deps: [],

    dependencies: [],

    sourceVals: [],

    computeFunc: _.noop,

    initialize: function(getterId, dependencies, func, ctx) {
        //private vars
        //var _deps = [];
        var _state;


        this.name = getterId;
        this.dependencies = dependencies;
        this.computeFunc = func;
        this.fluxer = ctx;

        //convert string dependencies to object form
        this._ghettoDI(dependencies);

        //Listen to change events from dependencies
        _.each(this._deps, function(dep) {
            this.listenTo(dep, 'change', this._onDepChanged);
        }, this);

        //generate the state the first time
        //this._generateState();

        //stop listening when cleaning up
        this.on("before:destroy", this._cleanUp);
    },

    getState: function() {
        return this._generateState(this.sourceVals);
    },

    _ghettoDI: function(dependencies) {
        this._deps = _.map(dependencies, function(dep) {
            var oDep = dep;

            if (_.isString(oDep)) {
                if (this.fluxer.stores[dep])
                    oDep = this.fluxer.stores[dep];
                else if (this.fluxer.getters[dep]) {
                    oDep = this.fluxer.getters[dep];
                } else {
                    throw Error(_stringFormat("Error in {1} converting string dependency could not find {0} in stores or getters for this flux instance", dep, this.name));
                }

                return oDep;
            } else {
                throw Error(_stringFormat("Error in {0} dependencies must be strings", this.name));
            }
        }, this);

        this._updateSourceVals();
    },

    _onDepChanged: function() {
        this.emitChanging();
        this._updateSourceVals();
    },

    _updateSourceVals: function() {
        var oldVals = _.clone(this.sourceVals);

        this.sourceVals = _.map(this._deps, function(dep) {
            return dep.getState();
        }, this);

        if (oldVals != this.sourceVals) {
            this.emitChange();
        }
    },

    _generateState: function(sourceVals) {
        //ensure we have a value for each _dep
        if (this._deps.length == sourceVals.length) {
            //call the compute function passing in our source values and get the new state
            var newState = this.computeFunc.apply(this, sourceVals);

            //only change if newState is different that old state
            if (newState) {
                _logger("{0}: has new state value of {1}", this.name, newState);
                return newState;
            } else
                throw Error(_stringFormat("Error in {0} \n All getter functions must return a value", this.name));
        } else
            _logger("{0}: not all deps have a source value", this.name);

    },

    _cleanUp: function() {
        this.stopListening();
    },
});

//extend Store with immutable helpers
_.extend(_baseGetter.prototype, _stateMutationEvents, _immutableHelpers);

module.exports = _baseGetter;