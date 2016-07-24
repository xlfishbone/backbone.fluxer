// backbone.fluxer

// Copyright (c) 2016 Josh Allen
// Released under the MIT license

/*
 * Flux implementation for backbone.js applications
 * Uses pricipals of both nuclear.js and alt.js.
 * 
 * Principals: 
 * micro library
 * fail loudly
 * hot reload
 * snapshots
 * Backbone event bus
 * Flux Dispatcher
 * getters / composite stores
 * 
 * */
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(['underscore', 'backbone', 'flux', 'immutable'], function (_, Backbone, Flux, Immutable) {
            return factory(_, Backbone, Flux, Immutable);
        });
    }
    else if (typeof exports !== 'undefined') {
        var _ = require('underscore');
        var Backbone = require('backbone');
        var Flux = require('flux');
        var Immutable = require('immutable');
        module.exports = factory(_, Backbone, Flux, Immutable);
    }
    else {
        root.fluxer = root.Backbone.fluxer = factory(root._, root.Backbone, root.Flux, root.Immutable);
    }
}(this, function (_, Backbone, Flux, Immutable) {
    'use strict';

    var _Dispatcher = new Flux.Dispatcher();

    var _immutableHelpers = (function () {
        /**
         * A collection of helpers for the ImmutableJS library
         */


        /**
         * @param {*} obj
         * @return {boolean}
         */
        function isImmutable(obj) {
            return Immutable.Iterable.isIterable(obj);
        }

        /**
         * Returns true if the value is an ImmutableJS data structure
         * or a JavaScript primitive that is immutable (string, number, etc)
         * @param {*} obj
         * @return {boolean}
         */
        function isImmutableValue(obj) {
            return (isImmutable(obj)
                || !_.isObject(obj)
            );
        }

        /**
         * Converts an Immutable Sequence to JS object
         * Can be called on any type
         */
        function toJS(arg) {
            // arg instanceof Immutable.Sequence is unreliable
            return (isImmutable(arg))
              ? arg.toJS()
              : arg;
        }

        /**
         * Converts a JS object to an Immutable object, if it's
         * already Immutable its a no-op
         */
        function toImmutable(arg) {
            return (isImmutable(arg))
              ? arg
              : Immutable.fromJS(arg);
        }


        return {
            isImmutable: isImmutable,
            isImmutableValue: isImmutableValue,
            toJS: toJS,
            toImmutable: toImmutable
        };


    })();

    var _stateMutationEvents = {
        emitChange: function () {
            this.trigger("change");
            this.trigger("state:changed");
        },

        emitChanging: function () {
            this.trigger('changing');
            this.trigger('state:changing');
        },
    };

    var _stringFormat = function (msg) {
        //give us a string.format style for our log.
        var args = arguments;
        var logMsg = msg.replace(/{(\d+)}/g, function (match, number) {
            var retval;
            ++number;
            if (typeof args[number] != 'undefined') {
                var val = args[number];
                retval = _.isString(val) ? val : JSON.stringify(val);
            }
            else {
                retval = match;
            }

            return retval;
        });

        return logMsg;
    };

    var _logger = function (msg) {
        console.log(_stringFormat(msg));
    }

    //entire application state
    //A mutable object of Immutable k v pairs.
    //Its mutable so === will work correctly if the stores state has not changed.
    var __state__ = {};



    //Borrowed from Backbone.Marionette. 
    //Allows extend-able, easy class creation with backbone events
    // ex var x =  fluxer.Class.extend({stuff: ""});
    var _Class = (function () {
        var _class = function (options) {
            this.options = _.extend({}, _.result(this, 'options'), options);
            this.initialize.apply(this, arguments);
        };

        _class.extend = Backbone.Model.extend;

        // Class Methods
        // --------------

        // Ensure it can trigger events with Backbone.Events
        _.extend(_class.prototype, Backbone.Events, {

            //this is a noop method intended to be overridden by classes that extend from this base
            initialize: function () { },

            onBeforeDestroy: _.noop,

            onDestroy: _.noop,

            destroy: function () {
                this.trigger('before:destroy');
                this.onBeforeDestroy();

                this.trigger('onDestroy');
                this.onDestroy();

                this.stopListening();
                return this;
            }
        });

        return _class;
    })();


    //--------------------
    // Store
    // 
    //--------------------
    var _Store = (function () {
        var __setState = function (data, ctx) {
            /// <summary>
            /// Sets the stores entire state and triggers the change event
            /// this will replace the current state for what is passed in
            /// </summary>
            /// <param name="data">new state description</param>                         

            if (ctx.isImmutable(data)) {
                ctx.emitChanging();
                __state__[ctx.Id] = data;
                ctx.emitChange();
            }
            else {
                throw new Error("Error in setting the state id = " + ctx.Id + ". State must be of type immutable");
            }
        };

        //Public
        var _baseStore = _Class.extend({
            constructor: function () {
                this._processDispatcherEventHash();
                this.dispatchToken = _Dispatcher.register(_.bind(this._processEvent, this));
                this.on("before:destroy", this._cleanUp);
                this.Id = _.uniqueId("fs");

                _Class.prototype.constructor.apply(this, arguments);
            },

            getState: function () {
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

            _cleanUp: function () {
                // clean up dispatcher functions
                _Dispatcher.unregister(this.dispatchToken);

                //Stop Listening to any events
                this.stopListening();
            },

            _processEvent: function (payload) {
                if (this.dispatcherEvents && this.dispatcherEvents[payload.type]) {


                    //call the dispatch event and get the new state
                    var newState = this.dispatcherEvents[payload.type](this.getState(), payload.data);

                    //make sure we got a state value back
                    if (_.isUndefined(newState) || newState === null) {
                        throw new Error("A dispatch event must return the new state. Even if your not changing the state just return it back");
                    }
                    else {
                        this.trigger('dispatchHandled');
                        if (this.getState() != newState) {
                            //only set the state if they are not equal.
                            __setState(newState, this);
                        }
                    }

                }
            },

            _processDispatcherEventHash: function (events) {
                events || (events = _.result(this, 'dispatcherEvents'));
                for (var key in events) {
                    var method = events[key];
                    if (!_.isFunction(method))
                        method = this[method];

                    this._convertStringCallback(key, _.bind(method, this));
                }
            },

            _convertStringCallback: function (name, method) {
                this.dispatcherEvents[name] = method;
            },

            _getInitalStateValue: function () {
                var localState = this.getInitialState();

                if (localState) {
                    if (!this.isImmutable(localState)) {
                        localState = this.toImmutable(localState);
                    }
                    return localState;
                }

                return Immutable.Map({});
            },

            waitFor: function (ids) {
                /// <summary>
                /// Stops a method from executing until a store or stores passed in are done.
                /// ex) this.waitFor([Store1, Store2.dispatchToken]);
                /// </summary>
                /// <param name="ids" type="array object or string"></param>

                //if a whole store was passed in use its dispatch token

                if (ids) {
                    var stringIds;

                    if (_.isArray(ids)) {
                        stringIds = ids.map(function (val) {
                            return _.isString(val) ? val : val.dispatchToken;
                        });
                    }
                    else if (_.isString(ids)) {
                        stringIds = [ids];
                    }
                    else {
                        stringIds = [ids.dispatchToken];
                    }

                    _Dispatcher.waitFor(stringIds);
                }
                else {
                    throw Error("Error in BaseStore.waitFor ids were undefined");
                }
            }

        });

        //extend Store with immutable helpers
        _.extend(_baseStore.prototype, _stateMutationEvents, _immutableHelpers);

        return _baseStore;
    })();

    //--------------------
    // Actions
    //--------------------
    var _Action = (function () {
        var _action = function (type, data) {

            var action = {
                type: type,
                data: data

            };

            return action;
        };

        return _action;

    })();


    //----------------------
    // Getter
    //----------------------
    var _Getter = (function () {
        var _baseGetter = _Class.extend({
            _deps: [],

            dependencies: [],

            sourceVals: [],

            computeFunc: _.noop,

            initialize: function (getterId, dependencies, func, ctx) {
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
                _.each(this._deps, function (dep) {
                    this.listenTo(dep, 'change', this._onDepChanged);
                }, this);

                //generate the state the first time
                //this._generateState();

                //stop listening when cleaning up
                this.on("before:destroy", this._cleanUp);
            },

            getState: function () {
                return this._generateState(this.sourceVals);                
            },

            _ghettoDI: function (dependencies) {
                this._deps = _.map(dependencies, function (dep) {
                    var oDep = dep;

                    if (_.isString(oDep)) {
                        if (this.fluxer.stores[dep])
                            oDep = this.fluxer.stores[dep];
                        else if (this.fluxer.getters[dep]) {
                            oDep = this.fluxer.getters[dep];
                        }
                        else {
                            throw Error(_stringFormat("Error in {1} converting string dependency could not find {0} in stores or getters for this flux instance", dep, this.name));
                        }

                        return oDep;
                    }
                    else {
                        throw Error(_stringFormat("Error in {0} dependencies must be strings", this.name));
                    }
                }, this);

                this._updateSourceVals();
            },

            _onDepChanged: function () {
                this.emitChanging();
                this._updateSourceVals();                
            },

            _updateSourceVals: function () {
                var oldVals = _.clone(this.sourceVals);

                this.sourceVals = _.map(this._deps, function (dep) {
                    return dep.getState();
                }, this);

                if (oldVals != this.sourceVals) {
                    this.emitChange();
                }
            },

            _generateState: function (sourceVals) {              
                //ensure we have a value for each _dep
                if (this._deps.length == sourceVals.length) {
                    //call the compute function passing in our source values and get the new state
                    var newState = this.computeFunc.apply(this, sourceVals);

                    //only change if newState is different that old state
                    if (newState) {                        
                        _logger("{0}: has new state value of {1}", this.name, newState);
                        return newState;
                    }
                    else
                        throw Error(_stringFormat("Error in {0} \n All getter functions must return a value", this.name));
                }
                else
                    _logger("{0}: not all deps have a source value", this.name);

            },

            _cleanUp: function () {
                this.stopListening();
            },
        });

        //extend Store with immutable helpers
        _.extend(_baseGetter.prototype, _stateMutationEvents, _immutableHelpers);

        return _baseGetter;

    })();


    //-------------------
    // fluxer
    // Main methods and behaviors
    //-------------------
    var _baseFluxer = (function () {

        //private 
        var _bulkStateSet = function (desiredState, ctx) {
            //loop through the snapshot and set state if it has changed.
            _.each(desiredState, function (statePiece, key) {
                if (!_.isEqual(statePiece, __state__[key].toJS())) {
                    var curStore = this.stores[key];
                    curStore.emitChanging();
                    __state__[key] = fluxer.toImmutable(statePiece);
                    curStore.emitChange();
                }
            }, ctx);
        };

        //public
        return _Class.extend({
            initialize: function (opts) {
                //make sure we start fresh and don't have zombies.
                this._cleanUp();

                //set up debuger
                if (opts && opts.debug === true) {
                    this.log = _logger;
                }
                else {
                    this.log = _.noop;
                }

                this.on("before:destroy", this._cleanUp);
            },

            stores: {},

            actions: {},

            actionTypes: {},

            getters: {},

            evaluate: function (stores) {
                if (stores && stores.length > 0) {
                    if (stores.length === 1) {
                        return _.clone(__state__[stores[0]]);
                    }
                    else {
                        return _.map(stores, function (name) {
                            return __state__[name];
                        });
                    }
                }

                return _.clone(__state__);
            },

            createStore: function (options) {
                /// <summary>
                /// creates a new initialized fluxer store
                /// </summary>
                /// <param name="options" type="object">the store object literal</param>
                /// <returns type="">initialized fluxer store</returns>

                var _newStore = _Store.extend(options);
                _newStore.prototype.actionTypes = this.actionTypes;

                return new _newStore();
            },

            createAction: function (actionId, func) {

                if (_.isFunction(func)) {
                    if (_.pluck(this.actions, actionId).length === 0) {
                        func.prototype.actionTypes = this.actionTypes;
                        func.prototype.actions = _.omit(this.actions, actionId);
                        func.prototype.dispatch = this.dispatch;

                        this.actions[actionId] = func;

                        return this.actions[actionId];
                    }
                    else {
                        throw new Error(_stringFormat("Action with the same id: {0} already exists", actionId));
                    }
                }
                else {
                    throw Error(_stringFormat("Second parameter must be a function. Received {0}", typeof func));
                }

            },

            createActionType: function (actionTypeName) {
                /// <summary>
                /// adds action type to the key mirror
                /// </summary>
                /// <param name="actionTypeName" type="string"></param>

                //check it doesn't already exist
                var actionTypeName = actionTypeName.toUpperCase();
                if (_.pluck(this.actionTypes, actionTypeName).length === 0) {
                    this.actionTypes[actionTypeName] = actionTypeName;
                    return this.actionTypes[actionTypeName];
                }
                else {
                    throw new Error(_stringFormat("Action type: {0} already exists", actionTypeName));
                }
            },

            createGetter: function (getterId, dependencies, func) {
                if (!_.contains(_.keys(this.getters), getterId)) {
                    return this.getters[getterId] = new _Getter(getterId, dependencies, func, this);
                }
                else {
                    throw Error(_stringFormat("Getter with the same id: {0} already exists", getterId));
                }

            },

            registerStores: function (stores) {
                /// <summary>
                /// Registers stores with the fluxer instance. Also gets the initial state for each store.
                /// Stores can be registered all at once or dynamically when needed.
                /// </summary>
                /// <param name="stores" type="type"></param>

                var self = this;
                _.each(stores, function (v, k) {
                    var store = self.stores[k] = v;
                    store.Id = k; // set the ID on the store
                    __state__[v.Id] = v._getInitalStateValue();
                });
            },

            dispatch: function (payload) {
                /// <summary>
                /// Dispatches an action through the dispatcher
                /// </summary>
                /// <param name="payload" type="type"></param>

                this.log("Dispatching action: {0} with payload of {1}", payload.type, payload.data);
                _Dispatcher.dispatch(payload);
            },

            bootstrap: function (newState) {
                /// <summary>
                /// Hot load data into the state
                /// </summary>
                /// <param name="strData" type="string | object">JSON string or object of data to load</param>
                var state = {};

                if (_.isString(newState)) {
                    state = JSON.parse(newState);
                }
                else if (_.isObject(newState)) {
                    state = newState;
                }
                else {
                    throw new Error("Desired state data passed was not a supported type");
                }

                _bulkStateSet(newState, this);

            },

            takeSnapshot: function (arrStores) {
                /// <summary>
                /// takes a snapshot of the entire application state serialized to JSON. 
                /// Also pass stores to take a partial snapshot. Only the stores passed in will be saved and updated on rollback.
                /// </summary>
                /// <param name="arrStores" type="array">optional array of store names for a partial snapshot</param>

                var obj = {};
                if (arrStores && _.isArray(arrStores) && arrStores.length > 0) {
                    _.each(arrStores, function (storeName) {
                        obj[storeName] = __state__[storeName].toJSON();
                    });
                }
                else {
                    _.each(__state__, function (state, name) {
                        obj[name] = state.toJSON();
                    });
                }

                sessionStorage.setItem('lastSnapshot', JSON.stringify({ "data": obj }));
            },

            flush: function () {
                /// <summary>
                /// Resets all the stores back to their original state.
                /// Use case:
                /// Bootstrap some data and then use flush to make sure the app state is how it should be
                /// </summary>               

                _.each(this.stores, function (store) {
                    var initVal = store._getInitalStateValue();
                    if (__state__[store.Id] !== initVal) {
                        store.emitChanging();
                        __state__[store.Id] = initVal;
                        store.emitChange();
                    }

                }, this);
            },

            recycle: function (arrStores) {
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
                    _.each(arrStores, function (storeName) {
                        flush(ctx.stores[storeName]);
                    });
                }
                else {
                    _.each(this.stores, function (store, id) {
                        flush(store);
                    });
                }

            },

            rollback: function () {
                /// <summary>
                /// Rollback the state to the last snapshot that was taken
                /// this will throw an error if no snapshot can be found.
                /// </summary>
                var snapData = JSON.parse(sessionStorage.getItem('lastSnapshot')).data;

                if (snapData) {
                    //loop through the snapshot and set state if it has changed.
                    _bulkStateSet(snapData, this);
                }
                else {
                    throw new Error("Rollback was called before a snapshot was taken");
                }
            },

            _cleanUp: function () {
                if (this.stores.length > 0) {
                    _.each(this.stores, function (v, k) {
                        v.destroy();
                    }, this);
                }

                if (this.getters.length > 0) {
                    _.each(this.getters, function (v, k) {
                        v.destroy();
                    }, this);
                }

                this.stores = {};
                this.getters = {};

                __state__ = {};

            },

        });
    })();


    var fluxer = _.extend(_baseFluxer, _immutableHelpers);



    return fluxer;

}));