#!/bin/bash
set -e
CLOUD_CONFIG_FILE=pxe-cloud-config.yml

<% if( typeof progressMilestones !== 'undefined' && progressMilestones.installToDiskUri ) { %>
curl -X POST -H 'Content-Type:application/json' 'http://<%=server%>:<%=port%><%-progressMilestones.installToDiskUri%>' || true
<% } %>

curl -o $CLOUD_CONFIG_FILE http://<%=server%>:<%=port%>/api/current/templates/$CLOUD_CONFIG_FILE?nodeId=<%=nodeId%>

<% if (typeof ignitionScriptUri !== 'undefined') { %>
IGNITION_SCRIPT_FILE=ignition.json
  <% if (typeof vaultToken !== 'undefined') { %>
    curl -o ${IGNITION_SCRIPT_FILE}.tmp -X POST -d '' -H 'X-Vault-Token: <%=vaultToken%>' <%=ignitionScriptUri%>
    jq '.data' ${IGNITION_SCRIPT_FILE}.tmp > ${IGNITION_SCRIPT_FILE}
  <% } else { %>
    curl -o ${IGNITION_SCRIPT_FILE} <%=ignitionScriptUri%>
  <% } %>
    sudo coreos-install -d <%=installDisk%> -i ${IGNITION_SCRIPT_FILE} -b <%=repo%>
<% } else { %>
  sudo coreos-install -d <%=installDisk%> -c ${CLOUD_CONFIG_FILE} -b <%=repo%>
<% } %>

<% if (typeof grubLinuxAppend !== 'undefined') { %>
  mkdir /mnt/coreos
  OEM_PARTITION_NUM=6 # https://coreos.com/os/docs/latest/sdk-disk-partitions.html
  mount <%=installDisk%>${OEM_PARTITION_NUM} /mnt/coreos/
  if [ -f /mnt/coreos/grub.cfg ]; then  # Running 'coreos-install -i' will create the grub.cfg, don't clobber it
      sed -i 's/\(linux_append="[^"]*\)/\1 <%=grubLinuxAppend%>/' /mnt/coreos/grub.cfg
  else
      echo "set linux_append=\"<%=grubLinuxAppend%>\"" > /mnt/coreos/grub.cfg
  fi
  umount /mnt/coreos/
<%} %>

curl -X POST -H 'Content-Type:application/json' http://<%=server%>:<%=port%>/api/current/notification?nodeId=<%=nodeId%>
sudo reboot
