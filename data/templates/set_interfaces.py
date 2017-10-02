import os
import time
count = 0
string= ""
interfaces=[]
for dirname, dirnames, filenames in os.walk('/sys/class/net/'):
    for subdirname in dirnames:
        if subdirname != "lo":
            #Here we are assigning an arbitrary IP which could be a different one. This is just to get the interface up
            interfaces.append(subdirname)
            ip= 100+count
            string += "auto " + subdirname
            string += "\niface " +  subdirname +" inet static"
            string += "\naddress 10.0.0." + str(ip)
            if count == 0:
                string += "\ngateway 10.0.0.1"
            string += "\nnetmask 255.255.255.0\n\n"
            count=count+1

with open("/etc/network/interfaces", "w") as text_file:
    text_file.write(string)

for item in interfaces:
    os.system("sudo ifup "+ item)
    f= os.popen("sudo ethtool "+ item + " | grep -i \"Link detected\"")
    result = f.read()
    count = 0
    while result.find("yes") == -1:
        time.sleep(5)
        f= os.popen("sudo ethtool "+ item + " | grep -i \"Link detected\"" )
        result = f.read()
        count = count + 1
        print result
        if count > 20:
            break
