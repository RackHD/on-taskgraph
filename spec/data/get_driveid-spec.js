// Copyright 2015, EMC, Inc.

'use strict';

var rewire = require('rewire');

describe('get_driveid script', function() {
    var getDriveId = rewire('../../data/templates/get_driveid.js');

    //Configure for case with DVD existing and VD info doesn't exist
    var mockScsiDvd =
        '[0:0:0:0]    disk    ATA      QEMU HARDDISK    2.2.  /dev/sda\n' +
        '[1:0:0:0]    cd/dvd  QEMU     QEMU DVD-ROM     2.2.  /dev/sr0';
    var mockScsiEmpty ='';
    var mockVdInfoStdEmpty =
        'total 0\n' +
        'drwxr-xr-x 2 root root 360 Dec 22 10:02 ./\n' +
        'drwxr-xr-x 5 root root 100 Dec 22 10:02 ../';
    var mockWwidStdEmpty =
        'total 0\n' +
        'drwxr-xr-x 2 root root 360 Dec 22 10:02 ./\n' +
        'drwxr-xr-x 5 root root 100 Dec 22 10:02 ../';
    var mockVdInfoDvd = '';
    var mockWwidDvd =
        'total 0\n' +
        'drwxr-xr-x 2 root root 80 Dec 22 07:31 ./\n' +
        'drwxr-xr-x 3 root root 60 Dec 22 07:31 ../\n' +
        'lrwxrwxrwx 1 root root  9 Dec 22 07:31 ata-QEMU_DVD-ROM_QM00003 -> ../../sr0\n' +
        'lrwxrwxrwx 1 root root  9 Dec 22 07:31 ata-QEMU_HARDDISK_QM00001 -> ../../sda';

    //Configure for case with SATADOM, SATA Drive and eUsb
    var mockScsiStd =
        '[5:0:0:0]    disk    ATA      HUS724040ALA640  MFAO  /dev/sda\n' +
        '[6:0:0:0]   disk    ATA      32GB SATA Flash  SFDE  /dev/sdb\n' +
        '[7:2:0:0]    disk    LSI      MRROMB           4.26  /dev/sdc\n' +
        '[7:0:1:0]    disk    LSI      MRROMB           4.26  /dev/sdg\n' +
        '[8:0:0:0]   disk    SMART    eUSB             0298  /dev/sdd';

    var mockVdInfoStd, mockWwidStd, mockSataRawInfoStd, mockSataRawInfoWithEmpty;

    //jshint ignore: start
    mockVdInfoStd =
        'total 0\n' +
        'drwxr-xr-x 2 root root 360 Dec 22 10:02 ./\n' +
        'drwxr-xr-x 5 root root 100 Dec 22 10:02 ../\n' +
        'lrwxrwxrwx 1 root root   9 Dec 24 11:05 pci-0000:03:00.0-scsi-7:2:0:0 -> ../../sdc\n' +
        'lrwxrwxrwx 1 root root   9 Dec 24 11:05 pci-0000:03:00.0-scsi-7:0:1:0 -> ../../sdg\n' +
        'lrwxrwxrwx 1 root root  9 May 15 08:45 pci-0000:00:14.0-usb-0:5:1.0-scsi-0:0:0:0 -> ../../sdd';

    mockWwidStd =
        'total 0\n' +
        'drwxr-xr-x 2 root root 360 Dec 22 10:02 ./\n' +
        'drwxr-xr-x 5 root root 100 Dec 22 10:02 ../\n' +
        'lrwxrwxrwx 1 root root   9 Dec 22 10:03 ata-32GB_SATA-Flash_Drive_QM00001 -> ../../sdb\n' +
        'lrwxrwxrwx 1 root root  10 Dec 22 10:03 ata-32GB_SATA-Flash_Drive_QM00001-part1 -> ../../sdb1\n' +
        'lrwxrwxrwx 1 root root   9 Dec 22 10:03 ata-HUS724040ALA640_PBJY9ZJX -> ../../sda\n' +
        'lrwxrwxrwx 1 root root   9 Dec 24 11:05 scsi-3600163600196c0401e0c0e6511cec3c0 -> ../../sdc\n' +
        'lrwxrwxrwx 1 root root   9 Dec 24 11:05 scsi-3600163600196c0401e0c0e6511dec3c0 -> ../../sdg\n' +
        'lrwxrwxrwx 1 root root   9 Dec 22 10:03 wwn-0x5000cca23de98340 -> ../../sda\n' +
        'lrwxrwxrwx 1 root root   9 Dec 24 11:05 wwn-0x600163600196c0401e0c0e6511cec3c0 -> ../../sdc\n' +//
        'lrwxrwxrwx 1 root root  9 May 15 08:45 usb-SMART_eUSB_SPG143500HQ-0:0 -> ../../sdd';

    mockSataRawInfoStd =
        'dev/sda:\n' +
        '0040 3fff 0000 0010 7e00 0200 003f 0000\n' +
        '0000 0000 514d 3030 3030 3120 2020 2020\n' +
        '2020 2020 2020 2020 0003 0200 0004 322e\n' +
        '322e 3120 2020 5145 4d55 2048 4152 4444\n' +
        '4953 4b20 2020 2020 2020 2020 2020 2020\n' +
        '2020 2020 2020 2020 2020 2020 2020 8010\n'

    mockSataRawInfoWithEmpty =
        'dev/sda:\n' +
        '0040 3fff 0000 0010 7e00 0200 003f 0000\n' +
        '0000 0000 514d 3030 3030 3120 2020 2020\n' +
        '2020 2020 2020 2020 0003 0200 0004 322e\n' +
        '322e 3120 2020 5145 4d55 2048 4152 4444\n' +
        '492D 4b00 2020 2020 2020 2020 2020 2020\n' +
        '2020 2020 2020 2020 2020 2020 2020 8010\n'
    //jshint ignore: end


    describe('parser', function() {
        var buildDriveMap = getDriveId.__get__('buildDriveMap');

        var mockExec = function(cmd) {
            return mockSataRawInfoStd;
        };
        getDriveId.__set__('execSync', mockExec);

        it('should discard DVD info', function() {
            var result = buildDriveMap(mockWwidDvd, mockVdInfoDvd, mockScsiDvd);
            expect(result).to.deep.equal(JSON.stringify(
                //jshint ignore: start
                [
                    {
                        "scsiId":"0:0:0:0",
                        "virtualDisk":"",
                        "esxiWwid":"t10.ATA_____QEMU_HARDDISK___________________________QM00001_____________",
                        "devName":"sda",
                        "identifier":0,
                        "linuxWwid":"/dev/disk/by-id/ata-QEMU_HARDDISK_QM00001"
                    }
                ]
                //jshint ignore: end
            ));
        });

        it('should parse normal data', function() {
            var result = buildDriveMap(mockWwidStd, mockVdInfoStd, mockScsiStd);
            expect(result).to.deep.equal(JSON.stringify(
                //jshint ignore: start
                [
                    {
                        "scsiId":"6:0:0:0",
                        "virtualDisk":"",
                        "esxiWwid":"t10.ATA_____QEMU_HARDDISK___________________________QM00001_____________",
                        "devName":"sdb",
                        "identifier":0,
                        "linuxWwid":"/dev/disk/by-id/ata-32GB_SATA-Flash_Drive_QM00001"
                    },
                    {
                        "scsiId":"5:0:0:0",
                        "virtualDisk":"",
                        "esxiWwid":"t10.ATA_____QEMU_HARDDISK___________________________QM00001_____________",
                        "devName":"sda",
                        "identifier":1,
                        "linuxWwid":"/dev/disk/by-id/ata-HUS724040ALA640_PBJY9ZJX"
                    },
                    {
                        "scsiId":"7:2:0:0",
                        "virtualDisk":"/c7/v0",
                        "esxiWwid":"naa.600163600196c0401e0c0e6511cec3c0",
                        "devName":"sdc",
                        "identifier":2,
                        "linuxWwid":"/dev/disk/by-id/scsi-3600163600196c0401e0c0e6511cec3c0"
                    },
                    {
                        "scsiId":"7:0:1:0",
                        "virtualDisk":"",
                        "esxiWwid":"naa.600163600196c0401e0c0e6511dec3c0",
                        "devName":"sdg",
                        "identifier":3,
                        "linuxWwid":"/dev/disk/by-id/scsi-3600163600196c0401e0c0e6511dec3c0"
                    },
                    {
                        "scsiId":"8:0:0:0",
                        "virtualDisk":"",
                        "esxiWwid":"mpx.vmhba32:C0:T0:L0",
                        "devName":"sdd",
                        "identifier":4,
                        "linuxWwid":"/dev/disk/by-id/usb-SMART_eUSB_SPG143500HQ-0:0"
                    }
                ]
                //jshint ignore: end
            ));
        });

        it('should parser empty lsscsi response', function() {
            var mockExec = function() {
                return mockScsiEmpty;
            };
            getDriveId.__set__('execSync', mockExec);
            var result = buildDriveMap(mockWwidStdEmpty, mockVdInfoStdEmpty, mockScsiEmpty);
            expect(result).to.deep.equal(JSON.stringify(
                //jshint ignore: start
                [{}]
                //jshint ignore: end
            ));
        });


        it('should parser raw SATA data with ASCII code 0x00', function() {
            var mockExec = function() {
                return mockSataRawInfoWithEmpty;
            };
            getDriveId.__set__('execSync', mockExec);
            var result = buildDriveMap(mockWwidDvd, mockVdInfoDvd, mockScsiDvd);
            expect(result).to.deep.equal(JSON.stringify(
                //jshint ignore: start
                [
                    {
                        "scsiId":"0:0:0:0",
                        "virtualDisk":"",
                        "esxiWwid":"t10.ATA_____QEMU_HARDDI2DK00__________________________QM00001_____________",
                        "devName":"sda",
                        "identifier":0,
                        "linuxWwid":"/dev/disk/by-id/ata-QEMU_HARDDISK_QM00001"
                    }
                ]
                //jshint ignore: end
            ));
        });
    });

    describe('run', function() {
        var run = getDriveId.__get__('run');
        var cmdDriveWwid = getDriveId.__get__('cmdDriveWwid');
        var cmdVdInfo = getDriveId.__get__('cmdVdInfo');
        var cmdScsiId = getDriveId.__get__('cmdScsiId');
        var stubDone = sinon.stub();
        var backupExec, backBuildDriveMap;

        function setupExecMock(wwidError, vdInfoError, scsiIdError, selfError) {
            var mockExec = function(cmd, option, callback) {
                if (cmd === cmdDriveWwid) {
                    if (wwidError) {
                        callback(new Error(wwidError), '');
                    }
                    else {
                        callback(false, mockWwidStd);
                    }
                } else if (cmd === cmdVdInfo) {
                    if (vdInfoError) {
                        callback(new Error(vdInfoError), '');
                    }
                    else {
                        callback(false, mockVdInfoStd);
                    }
                } else if (cmd === cmdScsiId) {
                    if (scsiIdError) {
                        callback(new Error(scsiIdError), '');
                    } else {
                        callback(false, mockScsiStd);
                    }
                }

                if (selfError) {
                    throw new Error(selfError);
                }
            };
            getDriveId.__set__('exec', mockExec);
            getDriveId.__set__('buildDriveMap', sinon.stub().returns('testmap'));
        }

        before(function() {
            backupExec = getDriveId.__get__('exec');
            backBuildDriveMap = getDriveId.__get__('buildDriveMap');
        });

        after(function() {
            getDriveId.__set__('exec', backupExec);
            getDriveId.__set__('buildDriveMap', backBuildDriveMap);
        });

        beforeEach(function() {
            stubDone.reset();
        });

        it('should call done with result', function() {
            setupExecMock(false, false, false);
            run(stubDone);
            expect(stubDone).have.been.calledWith(null, 'testmap');
        });

        it('should call done with error if drive wwid command fails', function() {
            setupExecMock('wwid error', false, false);
            run(stubDone);
            expect(stubDone).have.been.calledWith(new Error());
        });

        it('should call done with error if vd info command fails', function() {
            setupExecMock(false, 'vd info error', false);
            run(stubDone);
            expect(stubDone).have.been.calledWith(new Error());
        });

        it('should not call done with error if vd info command cannot access', function() {
            setupExecMock(false,
                'ls: cannot access /dev/disk/by-path: No such file or directory',
                false);
            run(stubDone);
            expect(stubDone).have.been.calledWith(null, 'testmap');
        });

        it('should call done with error if scsi id command fails', function() {
            setupExecMock(false, false, 'scsiId error');
            run(stubDone);
            expect(stubDone).have.been.calledWith(new Error());
        });

        it('should call done with error if exec self throw execption', function() {
            setupExecMock(false, false, false, 'exec self error');
            run(stubDone);
            expect(stubDone).have.been.calledWith(new Error());
        });
    });
});
