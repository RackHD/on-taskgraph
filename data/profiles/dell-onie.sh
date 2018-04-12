#!/bin/sh

# Copyright 2018, DELL EMC, Inc.


TASKS_URI="http://<%=server%>:<%=port%>/api/2.0/tasks/<%=identifier%>"
echo $TASKS_URI
LOGFILE="/var/log/rackhd.log"

# tasks will be downloaded to:
# /tmp/mytask.json
getTask(){
    wget $TASKS_URI -O /tmp/mytask.json
}

# Once the task is excecuted and updated
# post task will post it to TASKS_URI
postTask(){
    # Below is an example of expected data
    # DATA='{"identifier":"5ace33a577a36e54bf23bcba","tasks":[{"stdout":"{\"version\":\"1.2.3.4\"}","source":"version","format":"json","catalog":true}]}'
    read DATA</tmp/mytask.json
    echo "$DATA" >> $LOGFILE
    wget --post-data=$DATA --header="Content-Type: application/json" $TASKS_URI
}

# Args:
# $1 key
# return : key value
getValue(){
    grep -o "\"${1}\":*\"[^\"]*\"" /tmp/mytask.json | grep -o '"[^"]*"$'  | tr -d '"'
}

# If the loaded task contains a Download URI; Download & execute
# key we are looking for is: downloadUrl
executeUrl(){
    DOWNLOAD_URL=$( getValue downloadUrl);
    echo " downloaded URL $DOWNLOAD_URL" >> $LOGFILE
    if [ ! -z $DOWNLOAD_URL ]; then
        RESP='"'$( wget -O - $DOWNLOAD_URL | sh 2>&1 )'"'
        if [ $? -ne 0 ]; then           
           echo Error: $RESP
           RESP=$( echo $RESP | tr ' ' '_' )                 
           # Add error to the pulled task
           sed -i '$s/}/,"error":'"${RESP}"'}/' /tmp/mytask.json
        fi
    fi
}

# main
while true;
do
  # Pull tasks from RackHD
  getTask
  # If there is any tasks; proceed
  # othewise, wait 30 seconds and try again
  if [ $? = 0 ]
  then
      #check for exit task
      EXIT=$( grep -o '"exit"' /tmp/mytask.json)
      executeUrl
      postTask
      # if the tasks contains "exit" command; exit this loop
      if [ $EXIT == '"exit"' ]
      then
         return 0
      fi;
      sleep 10;
  else
      sleep 30;
  fi;
done;
#TODO upload task result

