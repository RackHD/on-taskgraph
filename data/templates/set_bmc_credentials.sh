#!/usr/bin/env bash

channel=''
function set_channel()
{
    for i in {1..15}; do
        ipmitool user list $i &>/dev/null
        status=$?
        if [ "$status" -eq "0" ] ; then
            channel=$i
            break
        fi
    done
}
set_channel
echo "channel number is" $channel
if [ -z "${channel}" ]; then
 echo "Channel number was not set correctly, exiting script"
exit 1
fi
echo " Getting the user list"
cmdReturn=$(ipmitool user list $channel)
myarray=(${cmdReturn//$'\n'/ })
mapfile -t userlist < <(ipmitool user list $channel)
userNumber=${#userlist[@]}
if [ "$userNumber" -gt  "1" ]; then
   userNumber=$(expr $userNumber - 1)
fi
user=$(<%=user%>)
#The check variable is a flag to determine if the user already exists
#(1:already exist and 0:user does not exist)
check=0
#The i variable is an index to determine the userID from the cmdReturn(userList)
i=0
#UserID used for adding new user
newUserNumber=0

for x in $cmdReturn; do
   if [ <%=user%> == $x ]; then
   userNumber=${myarray[$(($i-1))]}
   echo "Username already present, overwriting existing user"
   ipmitool user set name $userNumber <%=user%>
   ipmitool user set password $userNumber <%=password%>
   ipmitool channel setaccess $channel $userNumber callin=on ipmi=on link=on privilege=4
   ipmitool user enable $userNumber
   check=$((check + 1))
  exit
  fi
  i=$((i+1))
done

function get_newUserNumber()
{
  cmdReturn=$(sudo ipmitool user summary $channel)
  myarray=(${cmdReturn//$'\n'/ })
  maxCount=${myarray[3]}
  if [ $userNumber -lt $maxCount ]; then
    #try to find out the empty user id
    maxLength=${#userlist[@]}
    for ((i=1;i<$maxLength;i++)) do
      id=`echo ${userlist[i]} | awk '{print $1}'`
      if [ $id != $i ]; then
        newUserNumber=$i
        break
      fi
    done
    if [ $newUserNumber -eq 0 ]; then
      newUserNumber=$((userNumber + 1))
    fi
  else
    echo 'reach max user count'
    exit 1
  fi
}

if [ $check == 0 ]; then
 echo "Creating a new user"
 get_newUserNumber
 ipmitool user set name $newUserNumber <%=user%>
 ipmitool user set password $newUserNumber <%=password%>
 ipmitool channel setaccess $channel $newUserNumber callin=on ipmi=on link=on privilege=4
 ipmitool user enable $newUserNumber
exit
fi
echo "Done"
