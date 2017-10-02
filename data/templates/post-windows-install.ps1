#notify the current progress
<% if( typeof progressMilestones !== 'undefined' && progressMilestones.postConfigUri ) { %>
# the url may contain query, the symbol '&' will mess the command line logic, so the whole url need be wrapped in quotation marks
try
{
    curl -Method POST -ContentType 'application/json' "http://<%=server%>:<%=port%><%-progressMilestones.postConfigUri%>"
}
catch
{
    echo "Failed to notify the current progress: <%=progressMilestones.postConfig.description%>"
}
<% } %>

<% if ( typeof networkDevices !== 'undefined' ) { %>
            <% networkDevices.forEach(function(n) { %>
                  <% if(   typeof n.ipv4.vlanIds !== 'undefined') { %>
                        Get-NetAdapterAdvancedProperty <%= n.device%> -RegistryKeyword "VlanID"
                        If($? -eq "0") #Make sure that VLAN is supported  on a the specified Ethernet port

                            {
                                Write-Host "Vlan is supported on <%= n.device%> Ethernet port"
                                IF(<%=n.ipv4.vlanIds[0]%> -ge 0 -Or <%=n.ipv4.vlanIds[0]%> -le 4095)
                                    {
                                        Set-NetAdapterAdvancedProperty <%= n.device%> -RegistryKeyword "VlanID" -DisplayValue <%=n.ipv4.vlanIds[0]%>
                                    }
                                Else
                                    {
                                        Write-Host "Vlan value should with the 0-4095 range"
                                    }
                            }
                        Else
                            {
                                Write-Host "Vlan is NOT supported on <%= n.device%> Ethernet port"
                            }

                   <% }%>

           <%});%>
<% } %>


#signify ORA the installation completed
curl -Method POST -ContentType 'application/json' http://<%=server%>:<%=port%>/api/current/notification?nodeId=<%=nodeId%> -Outfile post-windows-install.log
