var fs = require('fs');
var debug = require('debug')('bonepwm');
var bone = require('./bone');
var verror = require("verror");

var pwmPrefix = {};

module.exports = {


    setPinMode: function(pin, mode, callback) {
        debug('pwm.setPinMode(' + [pin.key, mode] + ');');
        var p = pin.key + "_pinmux";
        bone.find_sysfsFile(p, bone.is_ocp(), 'ocp:' + p, onFindPinmux);// was (p, bone.is_ocp(), p + '.', onFindPinmux)

        function onFindPinmux(err, data) {
            if (err) {
                callback(err);
            } else if (!data.path) {
                err = new verror("Pinmux file for " + p + " could not be found");
                callback(err);
            } else {
                fs.writeFile(data.path + "/state", mode, onFindPwmChip); //write mode to the state file...
            }
        }

		function onFindPwmChip(err) {
		    if (err) {
                err = new verror(err, "onFindPinmux problem");
                if (typeof callback == 'function') callback(err);
                return;
            }
			pwmPrefix[pin.pwm.name] = '/sys/devices/platform/ocp/' + pin.pwm.chipAddress + '.epwmss/' + pin.pwm.featAddress + '/pwm';
			fs.readdir(pwmPrefix[pin.pwm.name], function(err, files) {
				if (err) {
					err = new verror(err, "onFindPwmChip readdir problem");
					if (typeof callback == 'function') callback(err);
                return;
				}
				pin.pwm.sysfs = files[0].slice(-1);
				pwmPrefix[pin.pwm.name] = '/sys/class/pwm/pwmchip' + pin.pwm.sysfs + '/pwm' + pin.pwm.index;
				debug(pin.pwm.module + ' belongs to pwmchip' + pin.pwm.sysfs);
				onWriteState(err);
			});
		}
		
        function onWriteState(err) {
            if (err) {
                err = new verror(err, "onFindPwmChip problem");
                if (typeof callback == 'function') callback(err);
                return;
            }
            pwmPrefix[pin.pwm.name] = '/sys/class/pwm/pwmchip' + pin.pwm.sysfs + '/pwm' + pin.pwm.index; // was '/sys/class/pwm/pwm'
			
          
			fs.exists(pwmPrefix[pin.pwm.name], function(exists) {
                if (!exists) {
                    //fs.appendFile('/sys/class/pwm/export', pin.pwm.sysfs, onExport); // now export if not exported
					fs.appendFile('/sys/class/pwm/pwmchip' + pin.pwm.sysfs + '/export', pin.pwm.index, onExport); // now export if not exported
                } else {
                    fs.writeFile(pwmPrefix[pin.pwm.name] + '/enable', 1, onModeComplete); // now start PWM, was '/run'
                }
            });
        }

        function onExport(err) {
            if (err) {
                err = new verror(err, "onExport problem");
                if (typeof callback == 'function') callback(err);
                return;
            }
            fs.writeFile(pwmPrefix[pin.pwm.name] + '/enable', 1, onModeComplete); // now start PWM
        }

        function onModeComplete(err) {
            if (err) {
                err = new verror(err, "onModeComplete problem");
                if (typeof callback == 'function') callback(err);
                return;
            }
            if (typeof callback == 'function') callback(null);
        }
    },

    setPinModeSync: function(pin, mode) {
        debug('pwm.setPinMode(' + [pin.key, mode] + ');');
        var p = pin.key + "_pinmux";
        var path = bone.find_sysfsFile(p, bone.is_ocp(), 'ocp:' + p);// was p + '.'

        fs.writeFileSync(path + "/state", mode);
        
		
		pwmPrefix[pin.pwm.name] = '/sys/devices/platform/ocp/' + pin.pwm.chipAddress + '.epwmss/' + pin.pwm.featAddress + '/pwm';
		
		try {
			var files = fs.readdirSync(pwmPrefix[pin.pwm.name]);
			pin.pwm.sysfs = files[0].slice(-1);
            } catch (ex) {
                console.error('Error reading directory ' + pwmPrefix[pin.pwm.name]);
            }
		
		pwmPrefix[pin.pwm.name] = '/sys/class/pwm/pwmchip' + pin.pwm.sysfs + '/pwm' + pin.pwm.index;

		debug(pin.pwm.module + ' belongs to pwmchip' + pin.pwm.sysfs);

        var exists = fs.existsSync(pwmPrefix[pin.pwm.name]);

        if (exists) {
            fs.writeFileSync(pwmPrefix[pin.pwm.name] + '/enable', 1); // now start PWM
        } else {
            fs.appendFileSync('/sys/class/pwm/pwmchip' + pin.pwm.sysfs + '/export', pin.pwm.index); // now export if not exported
            fs.writeFileSync(pwmPrefix[pin.pwm.name] + '/enable', 1); // now start PWM
        }
        return true;
    },

    stop: function(pin, pwm, callback) {
        var resp = {};
        var path = pwmPrefix[pin.pwm.name];
        debug('Stopping PWM');
        fs.writeFile(path + '/enable', 0, onStopPWM);

        function onStopPWM(err) {
            if (err) {
                err = new verror(err, "Failed to stop PWM");
                if (typeof callback == 'function') callback(err);
            } else {
                if (typeof callback == 'function') callback(null);
            }
        }
    },

    start: function(pin, pwm, callback) {
        var resp = {};
        var path = pwmPrefix[pin.pwm.name];
        debug('Starting PWM');
        fs.writeFile(path + '/enable', 1, onStartPWM);

        function onStartPWM(err) {
            if (err) {
                err = new verror(err, "Failed to start PWM");
                if (typeof callback == 'function') callback(err);
            } else {
                if (typeof callback == 'function') callback(null);
            }
        }
    },

    readFreqAndValue: function(pin, pwm, callback) {
        debug("pwm.readFreqAndValue(" + pin.key + ")");
        var resp = {};
        var error;
        var period = null;
        fs.readFile(pwmPrefix[pin.pwm.name] + '/period_ns', "utf8", onReadPeriod);

        function onReadPeriod(err, data) {
            if (err) {
                error = new verror(err + ': Unable to read period from ' + pwmPrefix[pin.pwm.name] + '/period_ns');
            }
            period = data;
            fs.readFile(pwmPrefix[pin.pwm.name] + '/duty_ns', "utf8", onReadDuty);
        }

        function onReadDuty(err, duty) {
            if (err) {
                error = new verror(error, err + ': Unable to read duty from ' + pwmPrefix[pin.pwm.name] + '/duty_ns');
                callback(error, null);
            } else {
                resp.freq = 1.0e9 / period;
                resp.value = duty / period;
                callback(null, resp);
            }
        }
    },

    writeFreqAndValue: function(pin, pwm, freq, value, callback) {
        debug('pwm.writeFreqAndValue(' + [pin.key, pwm, freq, value] + ');');
        var path = pwmPrefix[pin.pwm.name];
		debug('writeFreqAndValue path = ' + path + '/duty_cycle');
        var period = Math.round(1.0e9 / freq); // period in ns
        var duty = Math.round(period * value);

        var currentDuty;

        fs.readFile(path + '/duty_cycle', onReadDuty);

        function onReadDuty(err, readDuty) {
            if(err && !path) {
                err = new verror("Please call pinMode function on this pin before running analogWrite.");
                if (typeof callback == 'function') callback(err);
                return;
            }
            currentDuty = readDuty;
            if (period >= currentDuty) {
                fs.writeFile(path + '/period', period, onWritePeriod);
            } else {
                fs.writeFile(path + '/duty_cycle', duty, onWriteDuty);
            }
        }

        function onWritePeriod(err) {
            if (err) {
                err = new verror(err, "Fail to update PWM period");
                if (typeof callback == 'function') callback(err);
                return;
            }
            if (period >= currentDuty) {
                fs.writeFile(path + '/duty_cycle', duty, onWriteDuty);
            } else {
                module.exports.start(pin, pwm, callback);
            }

        }

        function onWriteDuty(err) {
            if (err) {
                err = new verror(err, "Fail to update PWM duty");
                if (typeof callback == 'function') callback(err);
                return;
            }
            if (period >= currentDuty) {
                module.exports.start(pin, pwm, callback);
            } else {
                fs.writeFile(path + '/period', period, onWritePeriod);
            }
        }
    }
};
