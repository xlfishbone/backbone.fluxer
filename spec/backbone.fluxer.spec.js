// var fluxer = require('../dist/backbone.fluxer.js');
// var _ = require('underscore');
// var Immutable = require('immutable');
// var Backbone = require('backbone');
// var storageMock = require('./support/helpers/storageMock.js');
// var sessionstorage = require('sessionstorage');

describe("backbone.fluxer", function () {
    it("will return a new object", function () {
        var flux = new Backbone.fluxer();
        expect(flux).toBeDefined();
    });

    it("debug option will create log function", function () {
        var flux = new Backbone.fluxer({ debug: true });
        expect(flux.log).toBeDefined();
    });


    describe("when a new fluxer is created", function () {
        var flux;

        beforeEach(function () {
            flux = new Backbone.fluxer();
        });     

        it("has a hash of store objects", function () {
            expect(flux.stores).toBeDefined();
            expect(_.isObject(flux.stores)).toBe(true);
        });

        it("Evaluate should return an empty object", function () {
            expect(flux.evaluate([])).toEqual({});
        });

        //create store
        describe("when it creates a store", function () {
            beforeEach(function () {
                this.store = flux.createStore({
                    getInitialState: function () {
                        return this.toImmutable({ x: 1, y: 2 });
                    },

                    dispatcherEvents: {
                        "Test:SomeFunc": "onSomeFunc",
                    },

                    onSomeFunc: function (state, data) {
                        return state.merge(data); 
                    },
                });
            });

            it("should return a new store", function () {
                expect(this.store).toBeDefined();
                expect(this.store.Id).toBeDefined();
            });

            //register store
            describe("after a store is registered", function () {
                beforeEach(function () {                   

                    if (flux.stores.length > 0) {
                        flux.stores.TestStore._cleanUp();
                        flux.stores = {};
                    }
                    
                    flux.registerStores({
                        "TestStore": this.store
                    });

                    this.testData = { x: 1, y: 2 };
                    

                    //grrrrrrrrrrr need to mock sessionStorage
                    // var cacheStore = {};

                    // spyOn(sessionStorage, 'getItem').and.callFake(function (key) {
                    //     return cacheStore[key];
                    // });
                    // spyOn(sessionStorage, 'setItem').and.callFake(function (key, value) {
                    //     return cacheStore[key] = value + '';
                    // });
                    // spyOn(sessionStorage, 'clear').and.callFake(function () {
                    //     cacheStore = {};
                    // });

                });

                it("should be added to the store hash", function () {                   
                    expect(_.keys(flux.stores).length > 0).toBe(true);
                });

                it("should now have an id of its registered store name", function () {
                    expect(flux.stores['TestStore'].Id).toBe("TestStore");
                });

                it("should have an initial immutable state", function () {
                    expect(this.store.getState().toJS()).toEqual(this.testData);
                });

                it("should be able to register a store later", function () {
                    var s2 = flux.createStore({});
                    var testId = flux.stores.TestStore.Id;

                    flux.registerStores({ "AnotherStore": s2 });

                    expect(_.keys(flux.stores).length > 1).toBe(true);
                    expect(testId).toEqual(flux.stores.TestStore.Id);

                });

                //Evaluate
                describe("evaluate", function () {
                    beforeEach(function () {
                        this.data = flux.evaluate([]);
                    });

                    it("should contain the store data", function () {                    
                        expect(_.keys(this.data)).toContain('TestStore');
                        expect(this.data.TestStore.get('x')).toEqual(this.testData.x);
                    });

                    it("can retrieve only the selected stores data if passed in.", function () {
                        var ed = flux.evaluate(['TestStore']);
                        expect(ed.get('x')).toEqual(this.testData.x);
                    });
                });

                //SnapShots
                describe("when a snapshot is taken", function () {
                    beforeEach(function () {
                        flux.takeSnapshot();
                    });

                    it("exits in session storage", function () {
                        var ss = JSON.parse(sessionStorage.getItem('lastSnapshot')).data;

                        expect(ss).toBeDefined();
                        expect(ss.TestStore).toEqual(this.testData);
                    });

                    it("contains serialized JSON and not a immutable map", function () {
                        var strJson = sessionStorage.getItem('lastSnapshot');

                        expect(_.isString(strJson)).toBeTruthy();
                    });

                    it("can take a partial snapshot", function () {
                        var anotherStore = flux.createStore({
                            getInitialState: function () {
                                return Immutable.fromJS({a:1, b:2, c:3});
                            },
                            dispatcherEvents: {
                                "changeData": "onChangeData",
                            },
                            onChangeData: function (state, data) {
                                return state.merge(data);
                            },
                        });

                        flux.registerStores({ "AnotherStore": anotherStore });

                        //take a partial snapshot
                        flux.takeSnapshot(['AnotherStore']);

                        //change both stores data
                        flux.dispatch({
                            type: "Test:SomeFunc",
                            data: flux.stores['TestStore'].getState().set('x', 69)
                        });
                        flux.dispatch({
                            type: "changeData",
                            data: flux.stores['AnotherStore'].getState().set('a', 69)
                        });                        

                        //rollback
                        flux.rollback();

                        expect(flux.stores['TestStore'].getState().get('x')).toEqual(69); //should not get rolled back
                        expect(flux.stores['AnotherStore'].getState().get('a')).toEqual(1); //should go back to snapshot                       

                    });
                });

                //Rollback
                describe("when a rollback is performed", function () {
                    beforeEach(function () {
                        flux.takeSnapshot();

                        this.newState = fluxer.toImmutable({ x: 2, y: 3, z: 4 });
                        flux.dispatch({ type: "Test:SomeFunc", data: this.newState });
                        //this.store.setState(this.newState);

                        flux.rollback();
                    });

                    it("sets the state back to the lastSnapshot ", function () {
                        expect(this.store.getState().get('z')).toBeUndefined();  
                    });
                });


                //Bootstrap
                describe("when Bootstrapping", function () {
                    beforeEach(function () {
                        this.bootstrapData = {
                            TestStore: {
                                x: 2,
                                y: 3
                            }
                        };
                    });

                    it("should update the state to the object that was passed in", function () {
                        flux.bootstrap(this.bootstrapData);
                        expect(flux.stores['TestStore'].getState().get('x')).toEqual(this.bootstrapData.TestStore.x);
                    });
                });
                
            });
           
        });

        //Actions
        describe("when an action is created", function () {
            beforeEach(function () {
                flux.actions = {}; //clear out actions so we dont' add duplicates
                this.action = flux.createAction("someAction", function () {
                    return "testing";
                });
            });

            it("should return a function", function () {                
                expect(this.action).toBeDefined();
                expect(_.isFunction(this.action)).toBe(true);                
            });

            it("should exist in the action hash", function () {
                expect(flux.actions["someAction"]).toBeDefined();
                expect(flux.actions["someAction"]()).toEqual("testing");
            });

        });

        //Action Types
        describe("When a action type is created", function () {
            beforeEach(function () {
                //clear actionTypes
                flux.actionTypes = {};

                this.actionTypeName = "NewAction"                
                flux.createActionType(this.actionTypeName);
            });

            it("should return the name in all caps", function () {
                expect(flux.actionTypes[this.actionTypeName.toUpperCase()]).toEqual(this.actionTypeName.toUpperCase());
            });

            it("should add the action type name to the ActionTypes keymirror", function () {
                expect(flux.actionTypes[this.actionTypeName.toUpperCase()]).toEqual(this.actionTypeName.toUpperCase());
            });
        });

        //Getters
        describe("When a getter is created", function () {
            beforeEach(function () {
                flux.getters = {};
                flux.createGetter('testGetter', [], function () {

                });
            });

            it("exist in the getter hash", function () {
                expect(flux.getters['testGetter']).toBeDefined();
            });
        });

        
       
            

            
     

        describe("Action", function () {

        });
    });

  

    

   
});

