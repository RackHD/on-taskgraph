#!/usr/bin/env bash

# Copyright 2017, Dell EMC, Inc.

hddArr=<%- JSON.stringify(hddArr) || [] %>
ssdStoragePoolArr=<%- JSON.stringify(ssdStoragePoolArr) || [] %>
ssdCacheCadeArr=<%- JSON.stringify(ssdCacheCadeArr) || [] %>
path=<%=path%>
controller=<%=controller%>

echo hddArr is: $hddArr
echo ssdStoragePoolArr is: $ssdStoragePoolArr
echo ssdCacheCadeArr is: $ssdCacheCadeArr
echo path is: $path
echo controller is: $controller

function create_vd_for_hdd()
{
    echo "Creating Virtual Disks For Hard Drives"
    <% hddArr.forEach(function (value){ %>
        convertedDrivesList=(<%=value.drives.replace(/[[\],]/g,' ')%>)
        for i in "${convertedDrivesList[@]}"
            do
                ensure_ugood_drive_state "<%=value.enclosure%>:$i" "vd"
            done

        echo running: $path /c$controller add vd type=<%=value.type%> drives=<%=value.enclosure%>:<%=value.drives.replace(/[[\]]/g,'')%> direct wb ra pdcache=off
        $path /c$controller add vd type=<%=value.type%> drives=<%=value.enclosure%>:<%=value.drives.replace(/[[\]]/g,'')%> direct wb ra pdcache=off
    <% }); %>
    echo "Done Creating Virtual Disks For Hard Drives"
}

function create_vd_for_ssd_sp()
{
    echo "Creating Virtual Disks for Solid  State Drives For Storage Pool"
    <% ssdStoragePoolArr.forEach(function (value){ %>
        convertedDrivesList=(<%=value.drives.replace(/[[\],]/g,' ')%>)
        for i in "${convertedDrivesList[@]}"
            do
                ensure_ugood_drive_state "<%=value.enclosure%>:$i" "vd"
            done

        echo running: $path /c$controller add vd type=<%=value.type%> drives=<%=value.enclosure%>:<%=value.drives.replace(/[[\]]/g,'')%> direct wt ra
        $path /c$controller add vd type=<%=value.type%> drives=<%=value.enclosure%>:<%=value.drives.replace(/[[\]]/g,'')%> direct wt ra
    <% }); %>
    echo "Done creating Virtual Disks for Solid  State Drives For Storage Pool"
}

#revisit/test on Dell nodes because currently H730 mini controller does not support cachecading
# seeing SSC-spread spectrum clocking is not supported
function create_sp_for_ssd_cache()
{
    echo "Creating Virtual Disks for Solid  State Drives For Cache Cade"
    <% ssdCacheCadeArr.forEach(function (value){ %>
        convertedDrivesList=(<%=value.drives.replace(/[[\],]/g,' ')%>)
        for i in "${convertedDrivesList[@]}"
            do
                ensure_ugood_drive_state "<%=value.enclosure%>:$i" "ssd_cc"
            done

        echo running: $path /c$controller add vd cc type=<%=value.type%> drives=<%=value.enclosure%>:<%=value.drives.replace(/[[\]]/g,'')%> WB
        $path /c$controller add vd cc type=<%=value.type%> drives=<%=value.enclosure%>:<%=value.drives.replace(/[[\]]/g,'')%> WB
        #Currently only Cac0 exists
        ssdVD=$(sudo $path /c$controller /vall show | grep 'Cac0' |cut -d / -f2 |cut -d " " -f1)
        #Disabling read ahead cache (nora) on the VD that was created above
        echo running: $path  /c$controller/v$ssdVD  set rdcache=nora
        $path  /c$controller/v$ssdVD  set rdcache=nora
    <% }); %>
    echo "Done creating Virtual Disks for Solid  State Drives For Cache Cade"
}

function ensure_ugood_drive_state()
{
   echo Assesing drive $1 for Ugood state
   cmdReturn=$(sudo $path /c$controller /eall /sall show | grep $1)
   stateInfo=(${cmdReturn})
   if [[ ${stateInfo[2]} == "Onln" ]]; then
       echo "Given disk is online, changing into Ugood State"
       #Using |grep followed by |cut with delimiters / and " " to get the number after the DG/
       vdMatch1=$(sudo $path /c$controller /vall show | grep ${stateInfo[3]}\/ |cut -d / -f2 |cut -d " " -f1)
       # split on / and call delete
       if [[ $2 == "vd" ]]; then
           delete_individual_vd $vdMatch1
       elif [[ $2 == "ssd_cc" ]]; then
           delete_individual_ssd_cc $vdMatch1
       fi
   fi
}

function delete_individual_vd()
{
    echo "Deleting $1 Virtual Disks"
    echo running: $path /c$controller/v$1 del force
    $path /c$controller/v$1 del force
    echo "Done Deleting Virtual Disks"
}

function delete_individual_ssd_cc()
{
    echo "Deleting $1 Virtual Disks"
    echo running: $path /c$controller/v$1 del cc
    $path /c$controller/v$1 del cc
    echo "Done Deleting Virtual Disks"
}

create_sp_for_ssd_cache
create_vd_for_hdd
create_vd_for_ssd_sp
