#!/bin/sh

# Copyright 2018, DELL EMC, Inc.

TASKS_URI="http://<%=server%>:<%=port%>/api/2.0/tasks/<%=identifier%>"
echo $TASKS_URI
LOGFILE="/tmp/rackhd.log"

# tasks will be downloaded to:
# /tmp/mytask.json
getTask(){
    curl -X GET -s -w '%{http_code}' $TASKS_URI -o /tmp/mytask.json    
}

# Once the task is excecuted and updated
# post task will post it to TASKS_URI
postTask(){
    # Below is an example of expected data
    # DATA='{"identifier":"5aeb28b34e9d8e96b83877b1","tasks":[{"stdout":"{\"version\":\"1.2.3.4\"}","source":"version","format":"json","catalog":true}]}'
    read DATA</tmp/mytask.json
    echo "$DATA" >> $LOGFILE
    curl -X POST --header 'Content-Type: application/json' --header 'Accept: application/json' -d @/tmp/mytask.json $TASKS_URI
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
        if [[ $DOWNLOAD_URL = *".exp"* ]]; then
            echo "Run expect script"
            RESP='"'$( curl  -o - $DOWNLOAD_URL | expect 2>&1 )'"'
            # Assuming that the .exp is a configuration script,
            # the network is disconnected until we exit the configuration bmp mode
            # We need to exit bmp and then update RackHD task to finish the workflow
            (n=0; until [ $n -ge 5 ]; do postTask && break; n=$[$n+1]; sleep 15; done;) &
            echo "exit taskrunner"
            exit 0
        else
            RESP='"'$( curl -s -o - $DOWNLOAD_URL | sh 2>&1 )'"'
        fi
    fi
    if [ $? -ne 0 ]; then
       echo Error: $RESP
       # Add error to the pulled task
       sed -e '$s/}/,"error":'"${RESP}"'}/' /tmp/mytask.json | tee /tmp/mytask.json
    fi
}

# main
while :
do
  echo "Pull tasks from RackHD"
  RESP=$( getTask)
  echo "get task return $?" >> $LOGFILE
  # If there is any tasks; proceed
  # othewise, wait 30 seconds and try again
  if [ $?=0 ] && [ $RESP -eq 200 ]
  then
      #check for exit task
      EXIT=$( grep -o '"exit"' /tmp/mytask.json || echo "failed" )
      executeUrl
      postTask
      # if the tasks contains "exit" command; exit this loop
      if [ $EXIT == '"exit"' ]
      then
         echo " Don't Exit; We need the task runner to stay up for the next task"
         # skip exit for now
         #return 0
      fi;
      sleep 10;
  else
      sleep 120;
  fi;  
done;
#TODO upload task result

