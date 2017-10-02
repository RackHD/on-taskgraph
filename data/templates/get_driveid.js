#!/usr/bin/env node

'use strict';

var exec = require('child_process').exec;
var execSync = require('child_process').execSync;

var cmdDriveWwid = 'ls -l /dev/disk/by-id';
var cmdVdInfo = 'ls -l /dev/disk/by-path';
var cmdScsiId = 'lsscsi';
var cmdSataRawInfo = 'sudo hdparm --Istdout';
var options = {
    timeout: 10000 //10 seconds
};

/**
 * Get SATA drive's logic unit name
 * @param {String} sataDrive SATA drive's name, eg. 'sda'
 * @return {String} SATA drive's logic unit name with 60 characters like:
 *  'SATADOM2-ML_3SE_________________________20160623AA106710169E'
 */
function getSataNameStr(sataDrive) {
    var output = execSync(cmdSataRawInfo + ' /dev/' + sataDrive);
    /*  output data like below:
     *  $ sudo hdparm --Istdout /dev/sda
     *  dev/sda:
     *
     *  0040 3fff 0000 0010 7e00 0200 003f 0000
     *  0000 0000 514d 3030 3030 3520 2020 2020
     *  2020 2020 2020 2020 0003 0200 0004 322e
     *  322e 3120 2020 5145 4d55 2048 4152 4444
     *  4953 4b20 2020 2020 2020 2020 2020 2020
     *  2020 2020 2020 2020 2020 2020 2020 8010
     *  .....
     *
     *  Among those raw data:
     *  Serial number hex string is from Word 10 to 19, total 20 bytes
     *  Model number hex string is from Word  27 to 46, total 40 bytes
     */
    var lines = output.toString().split('\n');
    var hexLineMatch = /^([0-9A-Fa-f]{4}\s+){7}[0-9A-Fa-f]{4}$/;

    var rawHexStr = lines.reduce(function (result,line) {
        if(hexLineMatch.test(line)) {
            result.push(line);
        }
        return result;
    },[]).join(' ').split(' ');

    //Logic unit name string should be: Model Number String + Serial Number String
    var snHexStr = rawHexStr.slice(10, 20).join('');
    var modelHexStr = rawHexStr.slice(27, 47).join('');
    var nameHexStr = modelHexStr + snHexStr;

    var nameStr = '';
    for(var i = 0; i < nameHexStr.length; i+=2) {
        var ascii = Number('0x' + nameHexStr.charAt(i) + nameHexStr.charAt(i+1));
        var nameChar = String.fromCharCode(ascii);
        if(nameChar === ' ') {
            nameStr += '_';  // All space should be filled with '_'
        } else if(nameChar === '\u0000') { // ASCII code 0x00 is parsed as nameChar '\u0000'
            nameStr += '00';  // ESXi parses ASCII code 0x00 as string '00'
        } else {
            nameStr += nameChar;
        }
    }

    return nameStr;
}

/**
 * Parse the Drive WWID output
 * @param {String} idList - stdout for command 'ls -l /dev/disk/by-id'
 * @return {Object} include device name, Linux and ESXi WWIDs for each disks
 */
function parseDriveWwid(idList) {
    //idList example
    //"lrwxrwxrwx. 1 root root  9 Nov 18 20:30 ata-SATADOM-SV_3SE_20150522AA9992050085 -> ../../sdb"
    //returned string example
    // "ata-SATADOM-SV_3SE_20150522AA9992050085->../../sdb"
    var lines = idList.split('\n').map(function(line) {
        var split = line.split(/\s+/);
        return [split[8],split[10]].join('->');
    });

    //According to SCSI-3 spec, vendor specified logic unit name string is 60
	//Only IDE and SCSI disk will be retrieved
    var scsiLines = [], sataLines = [], usbLines = [];
    lines.forEach(function(line){
        if ( line && !(line.match('part')) && line.match(/[sh]d[a-z]?[a-z]$/i)){
            var nameIndex = line.lastIndexOf('/'), idIndex = line.lastIndexOf('->');
            if (line.indexOf('scsi') === 0) {
                scsiLines.push([line.slice(nameIndex + 1), line.slice(0, idIndex)]);
            }
            else if (line.indexOf('ata') === 0) {
                sataLines.push([line.slice(nameIndex + 1), line.slice(0, idIndex)]);
            }
            else if (line.indexOf('usb') === 0) {
                usbLines.push([line.slice(nameIndex + 1), line.slice(0, idIndex)]);
            }
        }
    });

    //ESXi SATA WWID should be ('t10.ATA_____' + logic unit name)
    //ESXi SATA WWID should finally replace remaing dashs '-' with '2D', '3D' ..., 'ND', N means
    //it is the Nth dash.
    //esxiLine example:
    //["sda", "ata-32GB_SATA_Flash_Drive_B061430580090000000F"]
    //esxiSata example
    //["sda", "t10.ATA_____32GB_SATA_Flash_Drive___________________B061430580090000000F"]
    //TODO: confrim above analysis is correct for all SATA disks.
    var esxiSata = sataLines.map(function(esxiLine) {
        var line = esxiLine[1];
        var headIndex = line.indexOf('-');
        var headStr = ['t10.', line.slice(0, headIndex).toUpperCase(), '_____'].join(''),
            nameStr = getSataNameStr(esxiLine[0]);
        var strLine = headStr + nameStr;
        //return strLine.replace('-', '2D');
        //ESXi driveid replaces Nth '-' with 'ND' like 2D, 3D
        var strArray = strLine.split('-');
        if (strArray.length !== 1) {
            strLine = strArray[0];
            for (var i = 0; i < strArray.length -1; i += 1){
                strLine = [strLine, (i + 2).toString(), 'D', strArray[i + 1]].join('');
            }
        }
        return [esxiLine[0], strLine];
    });

    //If drive have both WWN and SATA ID, ESXi will use SATA name only

    //esxiLine example: ["sda", "scsi-35000c500725f45d7"]
    //esxiScsi example: ["sda", "naa.5000c500725f45d7"]
    var esxiScsi = scsiLines.map(function(esxiLine) {
        var line = esxiLine[1];
        var split = line.split(/-|_/);
        return [esxiLine[0], 'naa.' + split[1].slice(1)];
    });

    var esxiUsb = usbLines.map(function(esxiLine) {
        return [esxiLine[0], 'mpx.'];
    });

    //linuxLine example: ["sda", "scsi-35000c500725f45d7"]
    //linuxParsed example: ["sda", "/dev/disk/by-id/scsi-35000c500725f45d7"]
    var linuxParsed = sataLines.concat(scsiLines, usbLines).map(function(linuxLine) {
        return [linuxLine[0], '/dev/disk/by-id/' + linuxLine[1]];
    });

    return {esxiDriveIds: esxiSata.concat(esxiScsi, esxiUsb), linuxDriveIds: linuxParsed};
}


/**
 * Parse Virtual Drive output via by-path output
 * @param {String} pathList - stdout for command 'ls -l /dev/disk/by-path'
 * @return {Array} include device name, virtual disk name and scsi ID for each disk
 */
function parseVdInfo(pathList) {
    /**
     * ls -l /dev/disk/by-path output example:
     * total 0
     * lrwxrwxrwx 1 root root  9 Dec 30 11:55 pci-0000:00:10.0-scsi-0:0:0:0 -> ../../sda
     * lrwxrwxrwx 1 root root 10 Dec 30 11:55 pci-0000:00:10.0-scsi-0:0:0:0-part1 -> ../../sda1
     */
    var lines = pathList.split('\n').map(function(line) {
        var split = line.split(/\s+/);
        return [split[8],split[10]].join('->');
    });
    var pciLines = [];
    lines.forEach(function(line){
        if ( line && !(line.match('part'))){
            var nameIndex = line.lastIndexOf('/'), idIndex = line.lastIndexOf('->');
            if (line.indexOf('pci') === 0) {
                pciLines.push([line.slice(nameIndex + 1), line.slice(0,idIndex)]);
            }
        }
    });

    return pciLines.map(function(line) {
        var scsiId = line[1].slice(line[1].lastIndexOf('-') + 1),
            vdStr = '';
        var scsiIdArray = scsiId.split(':');
        if (scsiIdArray.length === 4){
            //Suppose controller id = 0 stands for JBOD
            if (scsiIdArray[1] !== "0") {
                vdStr = ['/c', scsiIdArray[0], '/v', scsiIdArray[2]].join('');
            }
        }
        return [line[0], vdStr, scsiId];
    });
}

/**
 * Parse scsi ID output via lsscsi command
 * @param {String} lsscsiList - stdout for command 'lsscsi'
 * @return {Array} include device name and scsi info for each disk
 */
function parseScsiInfo(lsscsiList) {
    /**
     * lsscsi output example:
     * [2:0:0:0]    disk    VMware   Virtual disk     1.0   /dev/sda
    */
    var lines = lsscsiList.split('\n');
    return lines.map(function(line) {
        if(line){
            return [line.slice(line.lastIndexOf('/') + 1).replace(' ', ''),
                line.slice(1, line.indexOf(']'))];
        }
    });
}

/**
 * Build the drive mapping table
 * @param {String} wwidData
 * @param {String} vdData
 * @param {String} scsiData
 * @return 0 if success, otherwise failed.
 */
function buildDriveMap(wwidData, vdData, scsiData) {
    var parsedWwids = parseDriveWwid(wwidData),
        scsiList = parseScsiInfo(scsiData),
        vdList = parseVdInfo(vdData);
    var linuxWwids = parsedWwids.linuxDriveIds, esxiWwids = parsedWwids.esxiDriveIds;
    var driveIds=[];
    esxiWwids.forEach(function(esxiWwid){
        var vd = '', scsiId = '', diskPath = esxiWwid[0];
        vdList.forEach(function(elem){
            if (typeof elem !== 'undefined') {
                if (elem[0] === diskPath) {
                    vd = elem[1];
                }
            }
        });
        scsiList.forEach(function(elem){
            if (typeof elem !== 'undefined'){
                if(elem[0] === diskPath){
                    scsiId = elem[1];
                }
            }
        });
        //vmhbaAdapter:CChannel:TTarget:LLUN
        //Adapter is set to default value 32 for only one eUsb
        if (esxiWwid[1] === "mpx.") {
            esxiWwid[1] = '';
            if (scsiId !== '') {
                var hctl = scsiId.split(":");
                if (hctl.length === 4) {
                    esxiWwid[1] = "mpx.vmhba32:C".concat(hctl[1], ":T", hctl[2], ":L", hctl[3]);
                }
            }
            vd = '';
        }
        driveIds.push({"scsiId": scsiId, "virtualDisk": vd,
            "esxiWwid": esxiWwid[1], "devName": diskPath});
    });

    linuxWwids.forEach(function(linuxWwid, k){
        driveIds[k].identifier = k;
        driveIds[k].linuxWwid = linuxWwid[1];
    });
    if (driveIds.length===0) {
      driveIds=[{}];
    }
    return JSON.stringify(driveIds);
}

/**
 * Run commands and notify result via callback
 * @param {Function} done - The callback which will be used to notify the result
 */
function run(done) {
    var wwidData, vdData, scsiData;
    try {
        exec(cmdDriveWwid, options, function (err0, stdout0) {
            if (err0) {
                return done(err0);
            }
            wwidData = stdout0;
            exec(cmdVdInfo, options, function (err1, stdout1) {
                if (err1) {
                    var errStr= "ls: cannot access /dev/disk/by-path: No such file or directory";
                    //"/dev/disk/by-path" doesn't exist means only SATADOM exists, no HDDs
                    // Ignore this error and use null string for vdData
                    if (err1.toString().search(errStr) !== -1){
                        vdData = '';
                    }
                    else {
                        return done(err1);
                    }
                }
                else {
                    vdData = stdout1;
                }
                exec(cmdScsiId, options, function (err2, stdout2) {
                    if (err2) {
                        return done(err2);
                    }
                    scsiData = stdout2;
                    var result = buildDriveMap(wwidData, vdData, scsiData);
                    return done(null, result);
                });
            });
        });
    }
    catch (e) {
        return done(e);
    }
}

if (require.main === module) {
    run(function(err, result) {
        if (err) {
            console.error(err.toString());
            process.exit(1);
        } else {
            console.log(result);
            process.exit(0);
        }
    });
}
