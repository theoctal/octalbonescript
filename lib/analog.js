var fs = require('fs');
var debug = require('debug')('bone');
var bone = require('./bone');
var verror = require("verror");
var async = require('async');

var ainPrefix = "";

module.exports = {

    enable: function(callback) {
		var readAttempts = 0;
        var helper;
        async.doWhilst(
		function (attempt) {
			helper = bone.find_sysfsFile('helper', '/sys/devices/platform/ocp', '44e0d000.tscadc');
            if (helper) {
				ainPrefix = helper + '/TI-am335x-adc/iio:device0/in_voltage';
				debug('analog enable. Path = ' + ainPrefix);
            } 
			readAttempts++;
			attempt();
        }, function () {
			return ((readAttempts <= 300) && !helper)
		}, function(err) {
			if (!helper) {
			debug('maximum retries. Still no /sys/..../44e0d000.tscadc found... ');
			}
		});
        if (typeof callback == 'function') callback(null, {
            'path': helper
        });

    },

    read: function(pin, callback) {
        debug('read Analog input ' + pin.key);
        var ainFile = ainPrefix + pin.ain.toString() + '_raw';
		debug('read analog path and file = ' + ainFile);
        fs.readFile(ainFile, onReadAIN);

        function onReadAIN(err, data) {
            if (err) {
                err = new verror(err, 'analogRead error');
                callback(err, null);
            } else {
                callback(null, parseInt(data, 10) / pin.scale);
            }
        }
    }
};