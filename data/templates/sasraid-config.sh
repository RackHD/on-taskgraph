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
        drives=""
        for i in "${convertedDrivesList[@]}"
            do
                drives="${drives} <%=value.enclosure%>:$i"
            done

        echo running: $path $controller create <%=value.type%> MAX ${drives} <%=value.name%> noprompt
        $path $controller create <%=value.type%> MAX ${drives} <%=value.name%> noprompt
    <% }); %>
    echo "Done Creating Virtual Disks For Hard Drives"
}

function delete()
{
    echo "Deleting $controller Virtual Disks"
    echo running: $path $controller delete noprompt
    $path $controller delete noprompt
    echo "Done Deleting Virtual Disks"
}

delete
create_vd_for_hdd
