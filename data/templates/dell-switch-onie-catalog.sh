#!/bin/sh

# Copyright 2018, DELL EMC, Inc.
OPEN_CURLY='{'
CLOSE_CURLY='}'

# using onie-sysinfo
# onie-sysinfo [-hsevimrpcfdatP]
# Dump ONIE system information.

# COMMAND LINE OPTIONS

#         The default is to dump the ONIE platform (-p).
#         -h
#                 Help.  Print this message.
#         -s
#                 Serial Number
#         -P
#                 Part Number
#         -e
#                 Management Ethernet MAC address
#         -v
#                 ONIE version string
#         -i
#                 ONIE vendor ID.  Print the ONIE vendor's IANA enterprise number.
#         -m
#                 ONIE machine string
#         -r
#                 ONIE machine revision string
#         -p
#                 ONIE platform string.  This is the default.
#         -c
#                 ONIE CPU architecture
#         -f
#                 ONIE configuration version
#         -d
#                 ONIE build date
#         -t
#                 ONIE partition type
#         -a
#                 Dump all information.
# Commands to run
# Collecting version and serial nb
VERSION=$( onie-sysinfo -v )
SERIAL_NB=$( onie-sysinfo -s)


# build the stdout data in json format
STDOUT='"'$OPEN_CURLY'
\\\\"version\\\\":\\\\"'$VERSION'\\\\",
\\\\"serialNb\\\\":\\\\"'$SERIAL_NB'\\\\"
'$CLOSE_CURLY'"'

#remove white space from stdout
STDOUT=$( echo $STDOUT | tr -d ' ')

# Finally, Add stdout to the pulled task
sed -i '$s/}/,"stdout":'${STDOUT}'}/' /tmp/mytask.json
