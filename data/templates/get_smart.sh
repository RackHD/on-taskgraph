#!/bin/bash
############################
# Author: Peter.Pan@emc.com
#############################

# Check Root privillage
if [[ $EUID -ne 0 ]]; then
   echo "[Error]This script must be run as root"
   exit -1
fi


nr=0
declare -a disk_array


smartctl --scan | while read line
do

    #########################################
    # smartctl --scan ( version 6.1) output as below
    #
    #
    #/dev/sda -d scsi # /dev/sda, SCSI device
    #/dev/sdb -d scsi # /dev/sdb, SCSI device
    #/dev/sdc -d scsi # /dev/sdc, SCSI device
    #/dev/sdd -d scsi # /dev/sdd, SCSI device
    #/dev/bus/10 -d megaraid,8 # /dev/bus/10 [megaraid_disk_08], SCSI device
    #/dev/bus/10 -d megaraid,9 # /dev/bus/10 [megaraid_disk_09], SCSI device
    #/dev/bus/10 -d megaraid,13 # /dev/bus/10 [megaraid_disk_13], SCSI device
    #/dev/bus/10 -d megaraid,14 # /dev/bus/10 [megaraid_disk_14], SCSI device
    #########################################


    # save the first column --  the device
    my_dev=$(echo $line |awk '{print $1 }')

    # save the 3rd column  -- the device-type
    # "-d" type will be : ata, scsi, sat[,auto][,N][+TYPE], usbcypress[,X], usbjmicron[,p][,x][,N], usbsunplus, marvell, areca,N/E, 3ware,N, hpt,L/M/N, megaraid,N, cciss,N, auto, test <=======
    my_type=$(echo $line |awk '{print $3 }')


    type_param=$my_type
    # we want to get all SMART data, instead of scsi only , for sat only.
    if [ "$my_type"_ == "ata"_ ] || [ "$my_type"_ == "scsi"_ ] || [ "$my_type"_ == "sat"_ ] ; then
        type_param='auto'
    fi

    echo "####""$my_dev ""$my_type" # this is an "index" for script parser, "####" is used to indicates the start of a devices

    # execute the SMART tool to retrieve SMART for this device
    my_smart=$( smartctl -a -d $type_param    $my_dev )

    # check SN, to reduce the duplicated lines (example, the /dev/sdc may be duplicated as megaraid,8, if it's a "JBOD" connection to RAID )

    my_SN=$( echo "$my_smart" |grep Serial|awk '{print $3}')  # NOTE, the quote for "$var" is important, to keep the newline in $var variable
    my_Vendor=$( echo "$my_smart" |grep Vendor|awk '{print $3}')

    is_duplicate=$(  echo "${disk_array[@]}" | grep -w "$my_SN"  );

    if [ "my_SN"_  !=  ""_ ] && [ $is_duplicate ] ; then
        echo "[Debug] duplicated disk item, skip this item"
        continue;
    else
        echo "$my_smart"

        disk_array[$nr]="$my_SN"
        nr=$(($nr+1))

        #####################################
        # Adding controller information
        #
        # Added by Ted.Chen@emc.com
        #
        # Controller information including:
        #     controller_name - Example: LSI Logic / Symbios Logic MegaRAID SAS-3 3108 [Invader] (rev 02).
        #     controller_PCI_BDF: The PCIe domain:bus:device.function ID of the SAS controller.
        #     host_ID - The scsi host ID read from /sys/class/scsi_host/hostx
        ####################################

        is_megaraid=$(  echo "${my_type}" | grep -w "megaraid" );

        if [ $is_megaraid ] ; then 			# Seeking for HDDs with megaraid type
            # $line example :
            #   $line = /dev/bus/0 -d megaraid,1 # /dev/bus/0 [megaraid_disk_01], SCSI device
            my_ctrl_num=$( echo "$line" | awk '{print $1}' | awk -F / '{print $4}');    #The host ID
        else # HDDs other than megaraid type
            # example :
            #   $line = /dev/sda -d scsi # /dev/sda, SCSI device'
            my_disk_name=$( echo "$line" | awk '{print $1}');    #The disk name, ie. /dev/sda
            # example of lsscsi output: [10:0:0:0]   disk    ATA      SATADOM-SV 3SE   710   /dev/sda
            my_ctrl_num=$(lsscsi | grep $my_disk_name | awk -F : '{print $1}' | awk -F [ '{print $2}' );
        fi

        # example of output of readlink:
        # : ../../devices/pci0000:00/0000:00:03.2/0000:07:00.0/host0/scsi_host/host0
        # or: ../../devices/pci0000:00/0000:00:11.4/ata1/host1/scsi_host/host1
        my_ctrl_bdf=$(readlink /sys/class/scsi_host/host$my_ctrl_num | grep -o '[0-9a-z]\+:[0-9a-z]\+:[0-9a-z]\+.[0-9a-z]\+' | tail -n 1);
        my_ctrl_name=$(lspci -s $my_ctrl_bdf | awk -F : '{print $3}');

        echo "###""HBA Controller Information for $my_dev $my_type";
        echo "controller_name=""$my_ctrl_name";
        echo "controller_PCI_BDF=""$my_ctrl_bdf";
        echo "host_ID=""$my_ctrl_num";
        continue;
    fi

done
