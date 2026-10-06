# KPOS Print Agent LAN/WiFi - Windows PowerShell, no paid service required
# Local HTTP bridge: http://127.0.0.1:17654 -> ESC/POS printer via TCP/IP (default port 9100)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$AgentVersion = '1.0.0'
$ListenPort = 17654
$MaxImageWidth = 576

function Send-JsonResponse($stream, [int]$status, $obj) {
    $json = $obj | ConvertTo-Json -Compress -Depth 6
    $body = [Text.Encoding]::UTF8.GetBytes($json)
    $statusText = if ($status -eq 200) {'OK'} elseif ($status -eq 204) {'No Content'} else {'Bad Request'}
    $headers = "HTTP/1.1 $status $statusText`r`nContent-Type: application/json; charset=utf-8`r`nContent-Length: $($body.Length)`r`nAccess-Control-Allow-Origin: *`r`nAccess-Control-Allow-Methods: GET, POST, OPTIONS`r`nAccess-Control-Allow-Headers: Content-Type`r`nAccess-Control-Allow-Private-Network: true`r`nConnection: close`r`n`r`n"
    $head = [Text.Encoding]::ASCII.GetBytes($headers)
    $stream.Write($head,0,$head.Length)
    if($body.Length -gt 0){$stream.Write($body,0,$body.Length)}
    $stream.Flush()
}

function Test-PrinterTcp([string]$HostName,[int]$Port,[int]$TimeoutMs=2500){
    $client = New-Object Net.Sockets.TcpClient
    try {
        $task = $client.ConnectAsync($HostName,$Port)
        if(-not $task.Wait($TimeoutMs)){ throw "Timeout khi kết nối $HostName`:$Port" }
        if(-not $client.Connected){ throw "Không kết nối được $HostName`:$Port" }
        return $true
    } finally { $client.Close() }
}

function Send-Raw([string]$HostName,[int]$Port,[byte[]]$Bytes,[int]$TimeoutMs=5000){
    $client = New-Object Net.Sockets.TcpClient
    try {
        $task = $client.ConnectAsync($HostName,$Port)
        if(-not $task.Wait($TimeoutMs)){ throw "Timeout khi kết nối máy in" }
        $stream=$client.GetStream();$stream.WriteTimeout=$TimeoutMs;$stream.Write($Bytes,0,$Bytes.Length);$stream.Flush();Start-Sleep -Milliseconds 120
    } finally { $client.Close() }
}

function Bitmap-ToEscPos([System.Drawing.Bitmap]$Bitmap,[bool]$Cut=$true){
    $src=$Bitmap
    $target=$null
    if($src.Width -gt $MaxImageWidth){
        $h=[int][Math]::Round($src.Height*($MaxImageWidth/[double]$src.Width))
        $target=New-Object Drawing.Bitmap $MaxImageWidth,$h
        $g=[Drawing.Graphics]::FromImage($target);$g.Clear([Drawing.Color]::White);$g.DrawImage($src,0,0,$MaxImageWidth,$h);$g.Dispose();$bmp=$target
    } else {$bmp=$src}
    try{
        $width=$bmp.Width;$height=$bmp.Height;$bytesPerRow=[int][Math]::Ceiling($width/8.0)
        $data=New-Object byte[] ($bytesPerRow*$height)
        for($y=0;$y -lt $height;$y++){
            for($x=0;$x -lt $width;$x++){
                $c=$bmp.GetPixel($x,$y);$lum=[int](0.299*$c.R+0.587*$c.G+0.114*$c.B)
                if($lum -lt 185){$idx=$y*$bytesPerRow+[int]($x/8);$bit=7-($x%8);$data[$idx]=$data[$idx] -bor (1 -shl $bit)}
            }
        }
        $ms=New-Object IO.MemoryStream
        $ms.Write([byte[]](0x1B,0x40),0,2)
        $xL=$bytesPerRow -band 0xFF;$xH=($bytesPerRow -shr 8) -band 0xFF;$yL=$height -band 0xFF;$yH=($height -shr 8) -band 0xFF
        $hdr=[byte[]](0x1D,0x76,0x30,0x00,$xL,$xH,$yL,$yH);$ms.Write($hdr,0,$hdr.Length);$ms.Write($data,0,$data.Length)
        $feed=[byte[]](0x0A,0x0A,0x0A);$ms.Write($feed,0,$feed.Length)
        if($Cut){$cutBytes=[byte[]](0x1D,0x56,0x42,0x00);$ms.Write($cutBytes,0,$cutBytes.Length)}
        return $ms.ToArray()
    } finally {if($target){$target.Dispose()}}
}

function Convert-ImageBase64ToEscPos([string]$Base64,[bool]$Cut=$true){
    $raw=[Convert]::FromBase64String($Base64);$mem=New-Object IO.MemoryStream(,$raw);$bmp=$null
    try{$bmp=New-Object Drawing.Bitmap $mem;return Bitmap-ToEscPos $bmp $Cut}finally{if($bmp){$bmp.Dispose()};$mem.Dispose()}
}

$listener=[Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,$ListenPort)
$listener.Start()
Write-Host "KPOS Print Agent v$AgentVersion" -ForegroundColor Green
Write-Host "Dang chay tai http://127.0.0.1:$ListenPort" -ForegroundColor Cyan
Write-Host "Giu cua so nay mo de KPOS co the in LAN/WiFi. Nhan Ctrl+C de dung." -ForegroundColor Yellow

try{
    while($true){
        $client=$listener.AcceptTcpClient()
        try{
            $stream=$client.GetStream();$reader=New-Object IO.StreamReader($stream,[Text.Encoding]::UTF8,$false,4096,$true)
            $requestLine=$reader.ReadLine();if(-not $requestLine){continue}
            $parts=$requestLine.Split(' ');$method=$parts[0];$path=$parts[1]
            $len=0
            while($true){$line=$reader.ReadLine();if([string]::IsNullOrEmpty($line)){break};if($line -match '^Content-Length:\s*(\d+)'){$len=[int]$Matches[1]}}
            if($method -eq 'OPTIONS'){Send-JsonResponse $stream 204 @{ok=$true};continue}
            $body='';if($len -gt 0){$chars=New-Object char[] $len;$read=0;while($read -lt $len){$n=$reader.Read($chars,$read,$len-$read);if($n -le 0){break};$read+=$n};$body=-join $chars[0..([Math]::Max(0,$read-1))]}
            $payload=if($body){$body|ConvertFrom-Json}else{$null}
            if($method -eq 'GET' -and $path -eq '/health'){
                Send-JsonResponse $stream 200 @{ok=$true;version=$AgentVersion;port=$ListenPort;platform='Windows PowerShell'}
            } elseif($method -eq 'POST' -and $path -eq '/test-connection'){
                $hostName=[string]$payload.host;$port=[int]$payload.port;$timeoutMs=if($payload.timeoutMs){[int]$payload.timeoutMs}else{2500}
                if(-not $hostName){throw 'Thiếu IP máy in'};Test-PrinterTcp $hostName $port $timeoutMs|Out-Null
                Send-JsonResponse $stream 200 @{ok=$true;host=$hostName;port=$port}
            } elseif($method -eq 'POST' -and $path -eq '/print-image'){
                $hostName=[string]$payload.host;$port=[int]$payload.port;$copies=[Math]::Max(1,[Math]::Min(5,[int]$payload.copies));$cut=if($null -eq $payload.cut){$true}else{[bool]$payload.cut}
                if(-not $hostName){throw 'Thiếu IP máy in'};if(-not $payload.imageBase64){throw 'Thiếu dữ liệu hình ảnh'}
                $bytes=Convert-ImageBase64ToEscPos ([string]$payload.imageBase64) $cut
                for($i=0;$i -lt $copies;$i++){Send-Raw $hostName $port $bytes 7000}
                Send-JsonResponse $stream 200 @{ok=$true;printed=$copies;host=$hostName;port=$port;bytes=$bytes.Length}
            } else {Send-JsonResponse $stream 400 @{ok=$false;error='Endpoint không hợp lệ'}}
        } catch {try{Send-JsonResponse $stream 400 @{ok=$false;error=$_.Exception.Message}}catch{}}
        finally{$client.Close()}
    }
} finally {$listener.Stop()}
