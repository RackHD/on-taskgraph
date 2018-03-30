# Copyright 2016-2018, Dell EMC, Inc.
# The progress notification is just something nice-to-have, so progress notification failure should
# never impact the normal installation process
<% if( typeof progressMilestones !== 'undefined' && progressMilestones.startInstallerUri ) { %>
# the url may contain query, the symbol '&' will mess the command line logic, so the whole url need be wrapped in quotation marks
try
{
    curl -UseBasicParsing -Method POST -ContentType 'application/json' "http://<%=server%>:<%=port%><%-progressMilestones.startInstallerUri%>"
}
catch
{
    echo "Failed to notify the current progress: <%=progressMilestones.startInstaller.description%>"
}
<% } %>
$repo = "<%=smbRepo%>"
$smb_passwd = "<%-smbPassword%>"
$smb_user = "<%=smbUser%>"
Start-Sleep -s 2

try {
    # These are non terminate commands and cannot be caught directly, so use exit code to terminate them when error
    $out = net use w: ${repo} ${smb_passwd} /user:${smb_user} 2>&1
    if ($LASTEXITCODE) {
        throw $out
    }

    Start-Sleep -s 2
    $out = w:\setup.exe /unattend:x:\Windows\System32\unattend.xml 2>&1
    if ($LASTEXITCODE) {
        throw $out
    }
}
catch {
    echo $_.Exception.Message
    $body = @{
        error = $_.Exception.Message
    }

    Invoke-RestMethod -Method Post -Uri 'http://<%=server%>:<%=port%>/api/2.0/notification?nodeId=<%=nodeId%>&status=fail' -ContentType 'application/json' `
        -body (ConvertTo-Json $body) -Outfile winpe-kickstart.log
    exit 1
}

curl -UseBasicParsing -Method POST -ContentType 'application/json' http://<%=server%>:<%=port%>/api/current/notification?nodeId=<%=nodeId%> -Outfile winpe-kickstart.log

