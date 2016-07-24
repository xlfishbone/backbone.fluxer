// var fluxer = require('../dist/backbone.fluxer.js');
// var _ = require('underscore');
// var Immutable = require('immutable');
// var Backbone = require('backbone');

describe("Getters", function () {
	beforeEach(function () {

		//cleanup 
		if (this.flux) {
			this.flux.destroy();
		}

		this.flux = new Backbone.fluxer({ debug: true });

		var ppl = [
			{
				name: 'Josh Allen',
				employer: 'SAIC'
			},
			{
				name: 'Billy Joe',
				employer: 'SAIC'
			},
			{
				name: 'Cathy Griffen',
				employer: 'HP'
			}
		];

		var employers = [
			{
				name: 'SAIC',
				type: 'IT'
			},
			{
				name: 'HP',
				type: 'IT'
			},
		];

		this.personStore = this.flux.createStore({
			dispatcherEvents: {
				"addPerson": "onAddPerson"
			},

			getInitialState: function () {
				return this.toImmutable(ppl);
			},

			onAddPerson: function (state, data) { 
				return state.insert(0, data);
			},
		});

		this.employerStore = this.flux.createStore({
			getInitialState: function () {
				return this.toImmutable(employers);
			},
		});

		this.flux.registerStores({
			"PersonStore": this.personStore,
			"EmployerStore": this.employerStore
		});

		this.firstPersonGetter = this.flux.createGetter("firstPersonGetter", ["PersonStore"], function (person) {
			return person.first();
		});

		this.employeCountGetter = this.flux.createGetter(
			"employeCountGetter",
			['PersonStore', 'EmployerStore'],
			function (person, employer) {
			    var employerCountMap = {};

			    employer.forEach(function (employer) {
					var eCount = person.filter(function (person) {
						return person.get('employer') === employer.get('name');
					}).count();

					employerCountMap[employer.get('name')] = eCount;

			    });

			    return Immutable.Map(employerCountMap);
			});


	});

	it("will return state from a store", function () {
		expect(this.firstPersonGetter.getState()).toEqual(this.personStore.getState().first());
	});

	it("will update after a store has changed", function () {
		var newPerson = {
			name: "James Hardin",
			employer: "HP"
		};

		var origValue = this.firstPersonGetter.getState();

		this.flux.dispatch({ type: "addPerson", data: newPerson });

		expect(origValue).not.toEqual(newPerson);
		expect(this.firstPersonGetter.getState()).toEqual(this.personStore.getState().first());
	});

	it("Can use more than one store", function () {
	    var gState = this.employeCountGetter.getState();
		expect(gState.get('SAIC')).toEqual(2);
	});

	it("Must have a unique name", function () {
	    var self = this;

	    expect(function () {
	        self.flux.createGetter('samename', ['PersonStore'], function (person) {
	            return person;
	        });

	        self.flux.createGetter('samename', ['PersonStore'], function (person) {
	            return person;
	        });
	    }).toThrow()

	});
});