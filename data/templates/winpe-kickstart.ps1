# The progress notification is just something nice-to-have, so progress notification failure should
# never impact the normal installation process
<% if( typeof progressMilestones !== 'undefined' && progressMilestones.startInstallerUri ) { %>
# the url may contain query, the symbol '&' will mess the command line logic, so the whole url need be wrapped in quotation marks
try
{
    curl -Method POST -ContentType 'application/json' "http://<%=server%>:<%=port%><%-progressMilestones.startInstallerUri%>"
}
catch
{
    echo "Failed to notify the current progress: <%=progressMilestones.startInstaller.description%>"
}
<% } %>
$repo = "<%=smbRepo%>"
$smb_passwd = "<%=smbPassword%>"
$smb_user = "<%=smbUser%>"
Start-Sleep -s 2
net use w: ${repo} ${smb_passwd} /user:${smb_user}
Start-Sleep -s 2
w:\setup.exe /unattend:x:\Windows\System32\unattend.xml
curl -Method POST -ContentType 'application/json' http://<%=server%>:<%=port%>/api/current/notification?nodeId=<%=nodeId%> -Outfile winpe-kickstart.log
