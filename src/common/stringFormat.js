/**
 * C# style string.format
 * ex) _stringFormat('Hello {0}{1}','World', '!')
 * returns 'Hello World!'
 * 
 * @param {any} msg
 * @returns {string}
 */
function _stringFormat(msg) {
    var args = arguments;
    var logMsg = msg.replace(/{(\d+)}/g, function(match, number) {
        var retval;
        ++number;
        if (typeof args[number] != 'undefined') {
            var val = args[number];
            retval = _.isString(val) ? val : JSON.stringify(val);
        } else {
            retval = match;
        }

        return retval;
    });

    return logMsg;
};

module.exports = _stringFormat;