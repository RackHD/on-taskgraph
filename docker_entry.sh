#!/bin/sh
# Copyright 2016, EMC, Inc.
# set -x
# /usr/sbin/dhcpd -d -f
/usr/sbin/dhcpd -cf /etc/dhcp/dhcpd.conf -lf /var/lib/dhcp/dhcpd.leases &
node index.js
