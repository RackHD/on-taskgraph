
$LocalEndPoint = New-Object System.Net.IPEndPoint([ipaddress]::Any,65433)

$MulticastEndPoint = New-Object System.Net.IPEndPoint([ipaddress]::Parse("239.255.255.250"),1900)

$UDPSocket = New-Object System.Net.Sockets.Socket([System.Net.Sockets.AddressFamily]::InterNetwork,[System.Net.Sockets.SocketType]::Dgram,[System.Net.Sockets.ProtocolType]::Udp)

$UDPSocket.SetSocketOption([System.Net.Sockets.SocketOptionLevel]::Socket, [System.Net.Sockets.SocketOptionName]::ReuseAddress,$true)

$UDPSocket.Bind($LocalEndPoint)

$UDPSocket.SetSocketOption([System.Net.Sockets.SocketOptionLevel]::IP,[System.Net.Sockets.SocketOptionName]::AddMembership, (New-Object System.Net.Sockets.MulticastOption($MulticastEndPoint.Address, [ipaddress]::Any)))

$UDPSocket.SetSocketOption([System.Net.Sockets.SocketOptionLevel]::IP, [System.Net.Sockets.SocketOptionName]::MulticastTimeToLive, 2)

$UDPSocket.SetSocketOption([System.Net.Sockets.SocketOptionLevel]::IP, [System.Net.Sockets.SocketOptionName]::MulticastLoopback, $true)

# Search for the RackHD server advertising the 2.0 API endpoint
$SearchString = "M-SEARCH * HTTP/1.1`r`nHOST:239.255.255.250:1900`r`nMAN:`"ssdp:discover`"`r`nST:urn:schemas-upnp-org:service:api:2.0:southbound`r`nMX:3`r`n`r`n"

$UDPSocket.SendTo([System.Text.Encoding]::UTF8.GetBytes($SearchString), [System.Net.Sockets.SocketFlags]::None, $MulticastEndPoint) | Out-Null

Write-Host "M-Search sent...`r`n"

[byte[]]$RecieveBuffer = New-Object byte[] 64000

[int]$RecieveBytes = 0

$Response_RAW = ""
$Timer = [System.Diagnostics.Stopwatch]::StartNew()
$Delay = $True
$endpoint = new-object System.Net.IPEndPoint ([IPAddress]::Any,0)
while($Delay){
    #15 Second delay so it does not run forever
    if($Timer.Elapsed.TotalSeconds -ge 15){Remove-Variable Timer; $Delay = $false}
    if($UDPSocket.Available -gt 0){
        $RecieveBytes = $UDPSocket.ReceiveFrom($RecieveBuffer, [System.Net.Sockets.SocketFlags]::None, [ref]$endpoint)
        if($RecieveBytes -gt 0){
            $Text = "$([System.Text.Encoding]::UTF8.GetString($RecieveBuffer, 0, $RecieveBytes))"
            $Response_RAW += $Text
            break
        }
    }
}

if( $Response_RAW -match "LOCATION:(.*)" ) {
    $server = $matches[1].Trim()
} else {
    # Unable to find RackHD host, hopefully it is the DHCP server...
    $objWin32NAC = Get-WmiObject -Class Win32_NetworkAdapterConfiguration -namespace "root\CIMV2" -computername "." -Filter "IPEnabled = 'True' AND DHCPEnabled ='True'"
    $server = $objWin32NAC | select -Unique -First 1 -ExpandProperty DhcpServer
    $server = "http://${server}:9080/api/2.0/"
}

Write-Host Using RackHD instance: $server

$macAddress = Get-WmiObject -Class Win32_NetworkAdapterConfiguration -Filter "MACAddress!=null" | select -First 1 -ExpandProperty MACAddress
$url1 = "${server}templates/unattend_server2012.xml?macs=${macAddress}"
$url2 = "${server}templates/winpe-kickstart.ps1?macs=${macAddress}"
curl ${url1} -Outfile unattend.xml
Write-Host loading ${url2}
curl ${url2} -Outfile winpe-kickstart.ps1

Write-Host executing ${url2}
powershell -ExecutionPolicy ByPass -File winpe-kickstart.ps1
