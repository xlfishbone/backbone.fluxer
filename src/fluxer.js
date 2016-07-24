//-------------------
// fluxer
// Main methods and behaviors
//-------------------

var _ = require('underscore');
var _Class = require('./common/_Class.js');
var __state__ = require('./common/state.js');
var _Dispatcher = require('./common/dispatcher.js');
var _Store = require('./store.js');
var _Getter = require('./getter.js');
var _stateMutationEvents = require('./common/stateMutationEvents.js');
var _immutableHelpers = require('./common/immutableHelpers.js');
var _stringFormat = require('./common/stringFormat.js');
var _logger = require('./util/logger.js');

//private 
var _bulkStateSet = function(desiredState, ctx) {
    //loop through the snapshot and set state if it has changed.
    _.each(desiredState, function(statePiece, key) {
        if (!_.isEqual(statePiece, __state__[key].toJS())) {
            var curStore = this.stores[key];
            curStore.emitChanging();
            __state__[key] = fluxer.toImmutable(statePiece);
            curStore.emitChange();
        }
    }, ctx);
};

//public
var _baseFluxer = _Class.extend({
    initialize: function(opts) {
        //make sure we start fresh and don't have zombies.
        this._cleanUp();

        //set up debuger
        if (opts && opts.debug === true) {
            this.log = _logger;
        } else {
            this.log = _.noop;
        }

        this.on("before:destroy", this._cleanUp);
    },

    stores: {},

    actions: {},

    actionTypes: {},

    getters: {},

    evaluate: function(stores) {
        if (stores && stores.length > 0) {
            if (stores.length === 1) {
                return _.clone(__state__[stores[0]]);
            } else {
                return _.map(stores, function(name) {
                    return __state__[name];
                });
            }
        }

        return _.clone(__state__);
    },

    createStore: function(options) {
        /// <summary>
        /// creates a new initialized fluxer store
        /// </summary>
        /// <param name="options" type="object">the store object literal</param>
        /// <returns type="">initialized fluxer store</returns>

        var _newStore = _Store.extend(options);
        _newStore.prototype.actionTypes = this.actionTypes;

        return new _newStore();
    },

    createAction: function(actionId, func) {

        if (_.isFunction(func)) {
            if (_.pluck(this.actions, actionId).length === 0) {
                func.prototype.actionTypes = this.actionTypes;
                func.prototype.actions = _.omit(this.actions, actionId);
                func.prototype.dispatch = this.dispatch;

                this.actions[actionId] = func;

                return this.actions[actionId];
            } else {
                throw new Error(_stringFormat("Action with the same id: {0} already exists", actionId));
            }
        } else {
            throw Error(_stringFormat("Second parameter must be a function. Received {0}", typeof func));
        }

    },

    createActionType: function(actionTypeName) {
        /// <summary>
        /// adds action type to the key mirror
        /// </summary>
        /// <param name="actionTypeName" type="string"></param>

        //check it doesn't already exist
        var actionTypeName = actionTypeName.toUpperCase();
        if (_.pluck(this.actionTypes, actionTypeName).length === 0) {
            this.actionTypes[actionTypeName] = actionTypeName;
            return this.actionTypes[actionTypeName];
        } else {
            throw new Error(_stringFormat("Action type: {0} already exists", actionTypeName));
        }
    },

    createGetter: function(getterId, dependencies, func) {
        if (!_.contains(_.keys(this.getters), getterId)) {
            return this.getters[getterId] = new _Getter(getterId, dependencies, func, this);
        } else {
            throw Error(_stringFormat("Getter with the same id: {0} already exists", getterId));
        }

    },

    registerStores: function(stores) {
        /// <summary>
        /// Registers stores with the fluxer instance. Also gets the initial state for each store.
        /// Stores can be registered all at once or dynamically when needed.
        /// </summary>
        /// <param name="stores" type="type"></param>

        var self = this;
        _.each(stores, function(v, k) {
            var store = self.stores[k] = v;
            store.Id = k; // set the ID on the store
            __state__[v.Id] = v._getInitalStateValue();
        });
    },

    dispatch: function(payload) {
        /// <summary>
        /// Dispatches an action through the dispatcher
        /// </summary>
        /// <param name="payload" type="type"></param>

        this.log("Dispatching action: {0} with payload of {1}", payload.type, payload.data);
        _Dispatcher.dispatch(payload);
    },

    bootstrap: function(newState) {
        /// <summary>
        /// Hot load data into the state
        /// </summary>
        /// <param name="strData" type="string | object">JSON string or object of data to load</param>
        var state = {};

        if (_.isString(newState)) {
            state = JSON.parse(newState);
        } else if (_.isObject(newState)) {
            state = newState;
        } else {
            throw new Error("Desired state data passed was not a supported type");
        }

        _bulkStateSet(newState, this);

    },

    takeSnapshot: function(arrStores) {
        /// <summary>
        /// takes a snapshot of the entire application state serialized to JSON. 
        /// Also pass stores to take a partial snapshot. Only the stores passed in will be saved and updated on rollback.
        /// </summary>
        /// <param name="arrStores" type="array">optional array of store names for a partial snapshot</param>

        var obj = {};
        if (arrStores && _.isArray(arrStores) && arrStores.length > 0) {
            _.each(arrStores, function(storeName) {
                obj[storeName] = __state__[storeName].toJSON();
            });
        } else {
            _.each(__state__, function(state, name) {
                obj[name] = state.toJSON();
            });
        }

        sessionStorage.setItem('lastSnapshot', JSON.stringify({
            "data": obj
        }));
    },

    flush: function() {
        /// <summary>
        /// Resets all the stores back to their original state.
        /// Use case:
        /// Bootstrap some data and then use flush to make sure the app state is how it should be
        /// </summary>               

        _.each(this.stores, function(store) {
            var initVal = store._getInitalStateValue();
            if (__state__[store.Id] !== initVal) {
                store.emitChanging();
                __state__[store.Id] = initVal;
                store.emitChange();
            }

        }, this);
    },

    recycle: function(arrStores) {
        /// <summary>
        /// Resets a store or stores back to their original state.
        /// </summary>

        var flush = function _flush(store) {
            var initVal = store._getInitalStateValue();
            if (!_.isEqual(store.getState().toJS(), initVal.toJS())) {
                store.emitChanging();
                __state__[store.Id] = initVal;
                store.emitChange();
            }
        }

        if (arrStores && _.isArray(arrStores) && arrStores.length > 0) {
            var ctx = this;
            _.each(arrStores, function(storeName) {
                flush(ctx.stores[storeName]);
            });
        } else {
            _.each(this.stores, function(store, id) {
                flush(store);
            });
        }

    },

    rollback: function() {
        /// <summary>
        /// Rollback the state to the last snapshot that was taken
        /// this will throw an error if no snapshot can be found.
        /// </summary>
        var snapData = JSON.parse(sessionStorage.getItem('lastSnapshot')).data;

        if (snapData) {
            //loop through the snapshot and set state if it has changed.
            _bulkStateSet(snapData, this);
        } else {
            throw new Error("Rollback was called before a snapshot was taken");
        }
    },

    _cleanUp: function() {
        if (this.stores.length > 0) {
            _.each(this.stores, function(v, k) {
                v.destroy();
            }, this);
        }

        if (this.getters.length > 0) {
            _.each(this.getters, function(v, k) {
                v.destroy();
            }, this);
        }

        this.stores = {};
        this.getters = {};

        __state__ = {};

    },

});



var fluxer = _.extend(_baseFluxer, _immutableHelpers);



module.exports = fluxer;