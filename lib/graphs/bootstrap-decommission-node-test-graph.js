// Copyright 2018, EMC, Inc.

'use strict';
/*jshint multistr: true */

module.exports = {
    friendlyName: 'Test decommission of a node',
    injectableName: 'Graph.Bootstrap.Decommission.Node.Test',
    options: {
        'shell-commands': {
            commands:[
                {
                  command: "for disk in `lsblk | grep disk | awk '{print $1}'`;\
                  do sudo sfdisk -d /dev/$disk 2>&1 | grep 'No partitions' -q; done"
                }
            ]
        },
	'bootstrap-ubuntu': {
            overlayfsFile: 'secure.erase.overlay.cpio.gz'
        },
        'fail-command' : {
            makeItFail: 'false',
            when: 'false'
        }
    },
    tasks: [
        {
            label: 'set-boot-pxe',
            taskName: 'Task.Obm.Node.PxeBoot',
            ignoreFailure: true
        },
        {
            label: 'reboot-start',
            taskName: 'Task.Obm.Node.Reboot',
            waitOn: {
                'set-boot-pxe': 'finished'
            }
        },
        {
            label: 'bootstrap-ubuntu',
            taskName: 'Task.Linux.Bootstrap.Ubuntu',
            waitOn: {
                'reboot-start': 'succeeded'
            }
        },
        {
            label: 'shell-commands',
            taskName: 'Task.Linux.Commands',
            ignoreFailure: false,
            waitOn: {
                'bootstrap-ubuntu': 'succeeded'
            }
        },
        {
            label: 'reboot-after-shell-commands',
            taskName: 'Task.ProcShellReboot',
            waitOn: {
                'shell-commands': 'finished'
            }
        },
        {
            label: 'send-finish',
            taskName: 'Task.Trigger.Send.Finish',
            waitOn: {
		'reboot-after-shell-commands': 'finished',
                'shell-commands': 'succeeded'
            }
        },
        {
            label: 'fail-command',
            taskName: 'Task.Evaluate.Condition',
            waitOn: {
		'reboot-after-shell-commands': 'finished',
		'shell-commands': 'failed'
            }
        }
    ]
    
};
