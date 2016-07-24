/**
 * A collection of helpers for the ImmutableJS library 
 * borrows from NuclearJS
 */

var Immutable = require('immutable');
var _ = require('underscore');

module.exports = {
        


        /**
         * @param {*} obj
         * @return {boolean}
         */
        isImmutable: function (obj) {
            return Immutable.Iterable.isIterable(obj);
        },

        /**
         * Returns true if the value is an ImmutableJS data structure
         * or a JavaScript primitive that is immutable (string, number, etc)
         * @param {*} obj
         * @return {boolean}
         */
        isImmutableValue: function (obj) {
            return (isImmutable(obj)
                || !_.isObject(obj)
            );
        },

        /**
         * Converts an Immutable Sequence to JS object
         * Can be called on any type
         */
        toJS: function (arg) {
            // arg instanceof Immutable.Sequence is unreliable
            return (isImmutable(arg))
              ? arg.toJS()
              : arg;
        },

        /**
         * Converts a JS object to an Immutable object, if it's
         * already Immutable its a no-op
         */
        toImmutable: function(arg) {
            return (isImmutable(arg))
              ? arg
              : Immutable.fromJS(arg);
        }       


    };
