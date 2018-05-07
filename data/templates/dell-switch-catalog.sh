#!/bin/sh

# Copyright 2018, DELL EMC, Inc.
OPEN_CURLY='{'
CLOSE_CURLY='}'
LOGFILE="/tmp/rackhd.log"

OS_VERSION=$( f10do "show system" | grep 'Dell EMC Networking OS Version' | awk -F: '{print $NF}' | tr -d '[:space:]')
STACK_MAC=$( f10do "show system" | grep 'Stack MAC' | grep -o -E '([[:xdigit:]]{1,2}:){5}[[:xdigit:]]{1,2}')
MODUL_TYPE=$( f10do "show system" | grep 'Module Type' | awk -F: '{print $NF}' | tr -d '[:space:]')

# build the stdout data in json format
STDOUT='"'$OPEN_CURLY'
\\\\\\"osVersion\\\\\\":\\\\\\"'$OS_VERSION'\\\\\\",
\\\\\\"stackMack\\\\\\":\\\\\\"'$STACK_MAC'\\\\\\",
\\\\\\"moduleType\\\\\\":\\\\\\"'$MODUL_TYPE'\\\\\\"
'$CLOSE_CURLY'"'

#remove white space from stdout
STDOUT=$( echo $STDOUT | tr -d ' ')
echo $STDOUT >> $LOGFILE
# Finally, Add stdout to the pulled task
sed -e '$s/}/,"stdout":'${STDOUT}'}/' /tmp/mytask.json | tee /tmp/mytask.json