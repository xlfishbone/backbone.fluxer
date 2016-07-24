
var _stateMutationEvents = {
    /**
     * Emit change event
     */
    emitChange: function() {
        this.trigger("change");
        this.trigger("state:changed");
    },

    /**
     * Emit changin event
     */
    emitChanging: function() {
        this.trigger('changing');
        this.trigger('state:changing');
    },
};

module.exports = _stateMutationEvents;