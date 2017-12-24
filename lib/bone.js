// Copyright (C) 2013 - Texas Instruments, Jason Kridner
//
// This is meant to hold some private functions
// Modified by Aditya Patadia, Octal Consulting LLP
var fs = require('fs');
var debug = require('debug')('bone');
var pinmap = require('./pinmap');
var verror = require("verror");

var sysfsFiles = {};

function boneRequire(packageName, onfail) {
    var y = {};
    try {
        y = require(packageName);
        y.exists = true;
    } catch (ex) {
        y.exists = false;
        var err = new verror("Optional package '%s' not loaded", packageName);
        console.error(err.message);
        if (onfail) onfail();
    }
    return (y);
}

module.exports = {

    require: boneRequire,

    getpin: function(pin) {
      debug('getpin('+[pin]+')');
        if (typeof pin == 'object') return (pin);
        else if (typeof pin == 'string' && pinmap[pin]) {
            if (pinmap[pin].exists) {
                return (pinmap[pin]);
            } else {
                var p = "ocp:" + pinmap[pin].key + "_pinmux";
                var path = module.exports.find_sysfsFile(p, module.exports.is_ocp(), p);
                debug("Pin Path :" + path);
                if (fs.existsSync(path + "/state") ||
                    typeof pinmap[pin].ain != 'undefined' ||
                    typeof pinmap[pin].led != 'undefined') {
                    pinmap[pin].exists = true;
                    return pinmap[pin];
                } else {
                    throw new verror("The pin " + pinmap[pin].key + " is not availble to write. " +
                        "Please make sure it is not used by another cape.");
                }
            }
        } else throw new verror("Invalid pin: " + pin);
    },

    is_capemgr: function(callback) {
      if(typeof callback == 'function') callback({path: "/sys/devices/platform/bone_capemgr"});
      return "/sys/devices/platform/bone_capemgr";
    },

    is_ocp: function(callback) {
      if(typeof callback == 'function') callback({path: "/sys/devices/platform/ocp"});
      return "/sys/devices/platform/ocp";
    },

    is_cape_universal: function(callback) {
        var ocp = module.exports.is_ocp();
        debug('is_ocp() = ' + ocp);
        var cape_universal = module.exports.find_sysfsFile('cape-universal', ocp, 'ocp:cape-universal', callback);
        debug('is_cape_universal() = ' + cape_universal);
        return (cape_universal);
    },

    is_cape_universal_loaded: function () {

        // the universal capes start with cape-univ and or univ- so we try to find them using those two names
        var capemgr = module.exports.is_capemgr();
        var slotsFile = capemgr + '/slots';
        var slots = fs.readFileSync(slotsFile, 'ascii');
        var slotRegex = new RegExp('\\d+(?=\\s*:.*,(cape-univ|univ-))', 'gm');
        var foundUniv = slots.match(slotRegex);
        debug('Slots returned ' + slots);
        debug('found Universial at slot ' + foundUniv);
        // U-Boot overlays will pass bone_capemgr.uboot_capemgr_enabled=1 thru /proc/cmdline
        const exec = require('child_process').exec;
        exec('grep -c bone_capemgr.uboot_capemgr_enabled=1 /proc/cmdline', (error, stdout, stderr)=> {
            if (error) {
                // Classic load path (uboot not loading cape universal)
                if (foundUniv) {
                    debug('Found Universial using ",cape-univ" or ",univ-" as filter');
                    return true;
                } else {
                    debug('No Universial Cape Found');
                    return false;
                }
            } else {
                debug('U-Boot Overlays providing cape Universal');
                return true;
            }
        });
        
        
        
    },
    load_universal_cape: function (callback) {
        // 06/02/2016 Andrew DeVries Logic based on dogtag BeagleBoard.org Debian Image 2016-05-13
        // need to determine which universal cape to load based on board type ie BeagleBone Green has no HDMI etc.
        //this logic was taken from https://github.com/RobertCNelson/boot-scripts/blob/master/boot/am335x_evm.sh#L321-L407
        //the am335x_evm.sh script executes at boot and should autoload universal
        // script is located at /opt/scripts/boot/am335x_evm.sh
        //
        // Note known issue on console image (lqxn image works correctly) BeagleBoard.org Debian Image 2016-05-13 where config-pin missing
        // so universial is not loaded automaticaly at boot.
        // Fix so script runs at boot is to add config-pin link
        //
        //  cd /opt/source/
        //  sudo  git clone https://github.com/cdsteinkuehler/beaglebone-universal-io.git
        //  sudo chmod a+ rwx / opt / source / beaglebone - universal - io / config - pin
        //  cd / usr / local / bin /
        //  sudo ln - s / opt / source / beaglebone - universal - io / config - pin config- pin

        //
        //overlays can be found here https://github.com/RobertCNelson/bb.org-overlays/tree/master/src/arm
        // view loaded overlays 'cat /sys/devices/platform/bone_capemgr/slots'
        // manual load of overlay 'sudo sh -c "echo 'univ-emmc' > /sys/devices/platform/bone_capemgr/slots"'
        // manual unload of overlay 'sudo sh -c "echo '-4' > /sys/devices/platform/bone_capemgr/slots"'


        // Check /proc/device-tree/model for the model
        var overlay = 'cape-universaln'; 
        try {
            var machine = fs.readFileSync('/proc/device-tree/model', 'ascii');
            if (machine) {
                machine = machine.replace(/ /g, "_");
            }
            switch (machine) {
                case 'TI_AM335x_BeagleBone':
                    overlay = "univ-all";
                    break;
                case 'TI_AM335x_BeagleBone_Black_Wireless':
                    overlay = "cape-universaln"
                    break;
                case 'TI_AM335x_BeagleBone_Black':
                    overlay = "cape-universaln";
                    break;
                case 'TI_AM335x_BeagleBone_Green':
                    overlay = "univ-emmc";
                    break;
                 case 'TI_AM335x_BeagleBone_Green_Wireless':
                    overlay= "univ-bbgw";
                    break;   
            }
            debug('Detected machine ' + machine + ' using Overlay ' + overlay );
        } catch(err){
            debug('Error detecting machine');
        }
        module.exports.load_dt_sync(overlay);
        // if (!bone.is_audio_enable()) {
        //     debug('Loading AUDIO Cape...');
        //     bone.load_dt_sync("cape-univ-audio");
        // }

        //if (!bone.is_hdmi_enable()) {
        //    debug('Loading HDMI Cape...');
        //    bone.load_dt_sync('cape-univ-hdmi');
        //}
    },
    is_hdmi_enable: function() {
      var capemgr = module.exports.is_capemgr();
      var slotsFile = capemgr + '/slots';
      var slots = fs.readFileSync(slotsFile, 'ascii');

      var slotRegex = new RegExp('\\d+(?=\\s*:.*,' + 'cape-univ-hdmi' + ')', 'gm');
      return slots.match(slotRegex);
    },

    is_audio_enable: function() {
      var capemgr = module.exports.is_capemgr();
      var slotsFile = capemgr + '/slots';
      var slots = fs.readFileSync(slotsFile, 'ascii');

      var slotRegex = new RegExp('\\d+(?=\\s*:.*,' + 'cape-univ-audio' + ')', 'gm');
      return slots.match(slotRegex);
    },

    find_sysfsFile: function(name, path, prefix, callback) {
        debug("find_sysfsFile("+ [name,path,prefix] + ")");
        if (typeof sysfsFiles[name] == 'undefined') {
            if (callback) {
                module.exports.file_find(path, prefix, onFindFile);
            } else {
                sysfsFiles[name] = module.exports.file_find(path, prefix);
            }
        } else if(typeof callback == 'function') {
            callback(null, {
                path: sysfsFiles[name]
            });
        }

        function onFindFile(err, resp) {
            if (err) {
                if(typeof callback == 'function') callback(err, null);
            } else {
                sysfsFiles[name] = resp.path;
                if(typeof callback == 'function') callback(null, resp);
            }
        }

        return (sysfsFiles[name]);
    },

    file_find: function(path, prefix, callback) {
        var resp = {
            path: null
        };

        if (callback) {
            fs.readdir(path, onReadDir);
        } else {
            try {
                var files = fs.readdirSync(path);
                onReadDir(null, files);
            } catch (ex) {
                console.error('Error reading directory ' + path);
            }
            return (resp.path);
        }

        function onReadDir(err, fileList) {
            if (err) {
                err = verror(err, 'Error listing directory %s', path);
                if(typeof callback == 'function') callback(err, null);
                return;
            }
            for (var j in fileList) {
                if (fileList[j].indexOf(prefix) === 0) {
                    resp.path = path + '/' + fileList[j];
                    if(typeof callback == 'function') callback(null, resp);
                    return;
                }
            }
            if (resp.path === null && callback) {
                callback(null, resp);
            }
        }
    },

    // Note, this just makes sure there was an attempt to load the
    // devicetree fragment, not if it was successful

    load_dt_sync: function(name) {
        debug('load_dt_sync(' + [name] + ')');
        var slotsFile;
        var err;
        var readAttempts = 0;

        var capemgr = module.exports.is_capemgr();
        debug('onFindCapeMgr: path = ' + capemgr);
        if (!capemgr) {
            throw new verror("CapeMgr not found ");
        }

        slotsFile = capemgr + '/slots';
        readSlots();

        function readSlots() {
            var slots;
            try {
                slots = fs.readFileSync(slotsFile, 'ascii');
            } catch (ex) {
                err = ex;
            }
            onReadSlots(err, slots);
        }

        function onReadSlots(err2, slots) {
            readAttempts++;
            if (err2) {
                throw new verror(err2, 'Unable to read from CapeMgr slots');
            }
            var index = slots.indexOf(name);
            debug('onReadSlots: index = ' + index + ', readAttempts = ' + readAttempts);
            if (index >= 0) {
                debug(name + " is successfully loaded"); // do nothing...
            } else if (readAttempts <= 1) {
                // Attempt to load fragment
                try {
                    debug('Writing ' + name + ' to ' + slotsFile);
                    fs.writeFileSync(slotsFile, name, 'ascii');
                } catch (ex) {
                    err2 = ex;
                }
                onWriteSlots(err2);
            } else {
                err2 = 'Error waiting for CapeMgr slot to load';
                throw new verror(err2);
            }
        }

        function onWriteSlots(err2) {
            if (err2) {
                throw new verror(err2, 'Write to CapeMgr slots failed');
            }
            readSlots();
        }

        debug('load_dt_sync return');
        return true;
    },

    unload_dt_sync : function(name) {
      debug('unload_dt_sync('+ [name] + ')');
      var capemgr = module.exports.is_capemgr();
      var slotsFile = capemgr + '/slots';
      var slots = fs.readFileSync(slotsFile, 'ascii');

      var slotRegex = new RegExp('\\d+(?=\\s*:.*,' + name + ')', 'gm');
      var slot = slots.match(slotRegex);
      debug("Found slot : " + slot);
      if (slot && slot[0]) {
        debug('Attempting to unload conflicting slot ' +
            slot[0] + ' for ' + name);
        fs.writeFileSync(slotsFile, '-'+slot[0], 'ascii');
        debug('slot unload successful');
        return true;
      } else {
        return false;
      }
    }

};
