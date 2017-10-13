#!/bin/bash

<%_ if ('undefined' !== typeof networkDevices) { _%>
## Set network interfaces
# Remove old network config
rm /etc/systemd/network/*

    <%_ networkDevices.forEach(function(d) { _%>
# Create new network config file for <%=d.device%>
cat > /etc/systemd/network/<%=d.device%>-static.network << "EOF"
[Match]
Name=<%=d.device%>

[Network]
EOF

chmod 644 /etc/systemd/network/<%=d.device%>-static.network

        <%_ for (conf in d) { _%>
            <%_ if (undefined === d[conf]) continue; _%>
            <%_ if ('ipv4' === conf || 'ipv6' === conf) { _%>
                <%_ ipconfig = d[conf] _%>
                <%_ cidr = 0 _%>
                <%_ maskNodes = ipconfig.netmask.match(/(\w+)/g) _%>
                <%_ maskNodes.forEach(function(i) { _%>
                    <%_ if ('ipv4' === conf) { _%>
                        <%_ cidr += ((parseInt(i, 10).toString(2)).match(/1/g) || []).length; _%>
                    <%_ } else { _%>
                        <%_ cidr += ((parseInt(i, 16).toString(2)).match(/1/g) || []).length; _%>
                    <%_ } _%>
                <%_ }); _%>
echo "Address=<%=ipconfig.ipAddr%>/<%=cidr%>" >> /etc/systemd/network/<%=d.device%>-static.network
echo "Gateway=<%=ipconfig.gateway%>" >> /etc/systemd/network/<%=d.device%>-static.network
                <%_ if ('vlanIds' in ipconfig) { _%>
                    <%_ ipconfig.vlanIds.forEach(function(vlanid) { _%>
echo "VLAN=<%=d.device%>.<%=vlanid%>" >> /etc/systemd/network/<%=d.device%>-static.network

# Create vlan config file for <%=d.device%>.<%=vlanid%>
cat >  /etc/systemd/network/<%=d.device%>.<%=vlanid%>.netdev << "EOF"
[NetDev]
Name=<%=d.device%>.<%=vlanid%>
Kind=vlan

[VLAN]
Id=<%=vlanid%>
EOF

chmod 644 /etc/systemd/network/<%=d.device%>.<%=vlanid%>.netdev

                    <%_ }); _%>
                <%_ } _%>
            <%_ } _%>
        <%_ } _%>

    <%_ }) _%>
# Restart network service
systemctl restart systemd-networkd.service
<%_ } _%>

<%_ if ('undefined' !== typeof dnsServers) { _%>
# Config DNS server
    <%_ dnsServers.forEach(function(dns) { _%>
echo "DNS=<%=dns%>" >> /etc/systemd/resolved.conf
    <%_ }) _%>
systemctl restart systemd-resolved
<%_ } _%>

# Enable sshd
sed -i 's/PermitRootLogin no/PermitRootLogin yes/g' /etc/ssh/sshd_config
systemctl restart sshd

<%_ if ('undefined' !== typeof domain) { _%>
    <%_ if ('localhost' !== hostname) { _%>
# Set domain name
# search domain in DNS cannot be set. Issue opened https://github.com/vmware/photon/issues/488
line=`wc -l < /etc/hosts`
sed -i "${line}i 127.0.0.1\t<%=hostname%>.<%=domain%>\t<%=hostname%>" /etc/hosts
    <%_ } _%>
<%_ } _%>

<%_ if ('undefined' !== typeof users) { _%>
# Set user info
    <%_ users.forEach(function(user) { _%>
        <%_ if ('uid' in user) { _%>
useradd -m '<%=user.name%>' -p '<%=user.encryptedPassword%>' -u <%=user.uid%>
        <%_ } else { _%>
useradd -m '<%=user.name%>' -p '<%=user.encryptedPassword%>'
        <%_ } _%>
        <%_ if ('sshKey' in user) { _%>
mkdir /home/<%=user.name%>/.ssh
echo <%=user.sshKey%> > /home/<%=user.name%>/.ssh/authorized_keys
        <%_ } _%>

    <%_ }) _%>
<% } -%>
