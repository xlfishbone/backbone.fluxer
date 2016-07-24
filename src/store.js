var _ = require('underscore');
var _Dispatcher = require('./common/dispatcher.js');
var _Class = require('./common/_Class.js');
var __state__ = require('./common/state.js');
var _stateMutationEvents = require('./common/stateMutationEvents.js');
var _immutableHelpers = require('./common/immutableHelpers.js');




var __setState = function(data, ctx) {
    /// <summary>
    /// Sets the stores entire state and triggers the change event
    /// this will replace the current state for what is passed in
    /// </summary>
    /// <param name="data">new state description</param>                         

    if (ctx.isImmutable(data)) {
        ctx.emitChanging();
        __state__[ctx.Id] = data;
        ctx.emitChange();
    } else {
        throw new Error("Error in setting the state id = " + ctx.Id + ". State must be of type immutable");
    }
};

//Public
var _baseStore = _Class.extend({
    constructor: function() {
        this._processDispatcherEventHash();
        this.dispatchToken = _Dispatcher.register(_.bind(this._processEvent, this));
        this.on("before:destroy", this._cleanUp);
        this.Id = _.uniqueId("fs");

        _Class.prototype.constructor.apply(this, arguments);
    },

    getState: function() {
        /// <summary>
        /// Returns the stores state
        /// </summary>
        /// <returns type="Immutable">state</returns>

        return __state__[this.Id];
    },

    /*
     * Runs before taking a snapshot
     * */
    onSerialize: _.noop,

    /*
     * Runs before bootstrapping data
     * */
    onDeserialize: _.noop,

    getInitialState: _.noop,

    _cleanUp: function() {
        // clean up dispatcher functions
        _Dispatcher.unregister(this.dispatchToken);

        //Stop Listening to any events
        this.stopListening();
    },

    _processEvent: function(payload) {
        if (this.dispatcherEvents && this.dispatcherEvents[payload.type]) {


            //call the dispatch event and get the new state
            var newState = this.dispatcherEvents[payload.type](this.getState(), payload.data);

            //make sure we got a state value back
            if (_.isUndefined(newState) || newState === null) {
                throw new Error("A dispatch event must return the new state. Even if your not changing the state just return it back");
            } else {
                this.trigger('dispatchHandled');
                if (this.getState() != newState) {
                    //only set the state if they are not equal.
                    __setState(newState, this);
                }
            }

        }
    },

    _processDispatcherEventHash: function(events) {
        events || (events = _.result(this, 'dispatcherEvents'));
        for (var key in events) {
            var method = events[key];
            if (!_.isFunction(method))
                method = this[method];

            this._convertStringCallback(key, _.bind(method, this));
        }
    },

    _convertStringCallback: function(name, method) {
        this.dispatcherEvents[name] = method;
    },

    _getInitalStateValue: function() {
        var localState = this.getInitialState();

        if (localState) {
            if (!this.isImmutable(localState)) {
                localState = this.toImmutable(localState);
            }
            return localState;
        }

        return Immutable.Map({});
    },

    waitFor: function(ids) {
        /// <summary>
        /// Stops a method from executing until a store or stores passed in are done.
        /// ex) this.waitFor([Store1, Store2.dispatchToken]);
        /// </summary>
        /// <param name="ids" type="array object or string"></param>

        //if a whole store was passed in use its dispatch token

        if (ids) {
            var stringIds;

            if (_.isArray(ids)) {
                stringIds = ids.map(function(val) {
                    return _.isString(val) ? val : val.dispatchToken;
                });
            } else if (_.isString(ids)) {
                stringIds = [ids];
            } else {
                stringIds = [ids.dispatchToken];
            }

            _Dispatcher.waitFor(stringIds);
        } else {
            throw Error("Error in BaseStore.waitFor ids were undefined");
        }
    }

});

//extend Store with immutable helpers
_.extend(_baseStore.prototype, _stateMutationEvents, _immutableHelpers);

module.exports =  _baseStore;