#!/usr/bin/nodejs

// Copyright 2015, EMC, Inc.
'use strict';

var command = process.argv[2];

switch (command) {
    case '--list':
        console.log(
            JSON.stringify(
                {
                    '_meta': {
                        'hostvars': {
                            '<%=ipaddress%>': {
                                'ansible_ssh_user': '<%=username%>',
                                'ansible_sudo_pass': '<%=password%>'
                            }
                        }
                    },
                    '<%=identifier%>': {
                        'hosts': [
                            '<%=ipaddress%>'
                        ]
                    }
                }
            )
        );

        break;

    default:
        console.log('Missing required argument --host');
        break;
}
