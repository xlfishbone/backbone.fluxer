// var fluxer = require('../dist/backbone.fluxer.js');
// var _ = require('underscore');
// var Immutable = require('immutable');
// var Backbone = require('backbone');

//Stores
describe("Store", function () {

    var TestDispatch = "Test:Dispatch";

    beforeEach(function () {

        var flux = new Backbone.fluxer();

        this.testAction = function (data) {
            return {
                type: TestDispatch,
                data: data
            };
        };

        var _store = flux.createStore({
            dispatcherEvents: {
                "Test:Dispatch": "onTestDispatch"
            },

            getInitialState: function () {
                return this.toImmutable({ x: 1, y: 2, z: 3 });
            },

            onTestDispatch: function (state, data) {
                return state.merge(data);
            },

        });

        var _store2 = flux.createStore({
            dispatcherEvents: {
                "Test:Dispatch": "onTestDispatch"
            },

            getInitialState: function () {
                return this.toImmutable({ x: 5, y: 6, z: 7 });
            },

            onTestDispatch: function (state, data) {
                var waitStore = flux.stores.TestStore
                this.waitFor(waitStore);

                //overwrite this store state with store 1's
                return state.merge(waitStore.getState());
            },
        });

        this.store = _store;
        this.store2 = _store2;
        this.flux = flux;

    });

    describe("after it has been registered", function () {
        beforeEach(function () {

            if (this.flux.stores.length > 0) {
                _.each(this.flux.stores, function (store) {
                    store._cleanUp();
                })
            }

            //this.flux.stores.TestStore._cleanUp();
            //this.flux.stores.AnotherStore._cleanUp();

            this.flux.registerStores({
                "TestStore": this.store,
                "AnotherStore": this.store2
            });

        });



        it("should have a dispatch token", function () {
            expect(_.isString(this.store.dispatchToken)).toBe(true);
        });

        describe("Stores State", function () {
            it("should be immutable", function () {
                expect(fluxer.isImmutable(this.store.getState())).toBe(true);
            });

            it("cannot be set directly", function () {
                var state = this.store.getState();
                state.set("test", 3);

                expect(this.store.getState().get('test')).toBeUndefined();
            });

            it("should only be set through dispatched methods", function () {
                var curState = this.store.getState();

                this.flux.dispatch(this.testAction(curState.set('y', 'bar')));
                expect(this.store.getState().get("y")).toEqual("bar");
            });

            //it("setState must take an immutable as a parameter", function () {
            //    var self = this;
            //    expect(function () {
            //        this.flux.dispatch(self.testAction({ y: "bar" }));
            //    }).toThrow();
            //});
        });



        describe("dispatcher events", function () {
            beforeEach(function () {
                this.listener = _.extend({}, Backbone.Events);
            });

            afterEach(function () {
                this.listener.stopListening();
            });

            it("has dispatcherEvent hash", function () {
                expect(this.store.dispatcherEvents).toBeDefined();
            });

            it("should handle dispatch event", function () {
                var action = { type: TestDispatch, data: { x: 15 } };
                this.flux.dispatch(action);
                expect(this.store.getState().get("x")).toEqual(15);
            });

            it("should be able to wait for other stores", function () {
                var action = { type: TestDispatch, data: { x: 150 } };
                var oldState = this.store2.getState();
                var spy = jasmine.createSpy('__change:event__');
                var test = function () {
                    var x = 0;
                }

                this.listener.listenTo(this.store2, 'change', test);
                this.listener.listenTo(this.store, 'change', spy);

                this.flux.dispatch(action);
                expect(this.store2.getState().get("x")).toEqual(150);
                expect(spy).toHaveBeenCalled();
            });
        });
    });
});