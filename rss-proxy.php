<?php
// Zeeland Vandaag — tiny self-hosted RSS proxy.
// Upload this file next to index.html on any PHP host (e.g. rammeloo.eu).
// It fetches RSS feeds server-side so the browser avoids CORS issues.

$allowed_hosts = [
    'www.omroepzeeland.nl',
    'omroepzeeland.nl',
    'www.pzc.nl',
    'pzc.nl',
    'www.bndestem.nl',
    'bndestem.nl',
    'www.hvzeeland.nl',
    'hvzeeland.nl',
    'www.zeeland.nl',
    'zeeland.nl',
];

$url = isset($_GET['url']) ? $_GET['url'] : '';
if ($url === '') {
    http_response_code(400);
    exit('Missing url parameter');
}

$host = parse_url($url, PHP_URL_HOST);
if ($host === null || !in_array(strtolower($host), $allowed_hosts, true)) {
    http_response_code(403);
    exit('Host not allowed');
}

if (!filter_var($url, FILTER_VALIDATE_URL)) {
    http_response_code(400);
    exit('Invalid url');
}

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_MAXREDIRS => 3,
    CURLOPT_TIMEOUT => 12,
    CURLOPT_CONNECTTIMEOUT => 5,
    CURLOPT_USERAGENT => 'ZeelandVandaag/1.0 (+https://rammeloo.eu)',
    CURLOPT_SSL_VERIFYPEER => true,
]);
$body = curl_exec($ch);
$errno = curl_errno($ch);
$status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
$contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
curl_close($ch);

if ($errno !== 0 || $body === false || ($status >= 400)) {
    http_response_code(502);
    exit('Upstream fetch failed');
}

header('Content-Type: ' . ($contentType ?: 'application/rss+xml; charset=utf-8'));
header('Cache-Control: public, max-age=300');
echo $body;
