OctalBoneScript
===============

Fork to correct some changes to sysfs in relation to the Beaglebone kernel 4.1.6-bone15 and Cape manager 4.1. Mostly changes to folder structure. And a tricky change to pwmchip index numbering in relation to the actual ehrpwm index. Analog and digital IO tested. Interrupts should also work.

A more stable, continuously tested and better node.js library for scripting BeagleBone. This is alternative to [bonescript](https://github.com/jadonk/bonescript) library.

__v1.0.0 introduces major BC breaks. Serialport and I2C support have been dropped. Please refer to [releases](https://github.com/theoctal/octalbonescript/releases) to see the changes made in latest version.__

Installation
------------
OctalBoneScript can be installed on beaglebone and beaglebone black. Run following command as root.

````sh
npm install -g octalbonescript_capemgr4_1
````

Please note that Octalbonescript does not recommend Linux Angstrom. We strongly recommend that you upgrade your BeagleBone to Debian by following link given below:

[http://beagleboard.org/getting-started#update](http://beagleboard.org/getting-started#update)

Examples
--------
Latest code docs, examples and **migration guide** from original bonescript are available at following link:

[https://github.com/theoctal/octalbonescript/wiki](https://github.com/theoctal/octalbonescript/wiki)

Fork
----
This is a fork of [bonescript](https://github.com/jadonk/bonescript). Some APIs are changed in v1.0.0, and we have changed many things under the hood leading to a much better, more functional and faster version of the original library. 

This fork is created to make bonescript more feature rich, faster, fix bugs and make it work in 
simulator mode under Mac OSX and Linux.

We encourage you to report issues rightaway if you face any. We will try our best to be of help.
