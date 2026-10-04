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
    'www.politie.nl',
    'politie.nl',
    'rss.politie.nl',
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

// Present itself like a normal browser so bot filters let us through
$user_agent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_MAXREDIRS => 3,
    CURLOPT_TIMEOUT => 15,
    CURLOPT_CONNECTTIMEOUT => 8,
    CURLOPT_USERAGENT => $user_agent,
    CURLOPT_ACCEPT_ENCODING => '',
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_HTTPHEADER => [
        'Accept: application/rss+xml, application/xml, text/xml, */*',
        'Accept-Language: nl-NL,nl;q=0.9,en;q=0.6',
    ],
]);
$body = curl_exec($ch);
$errno = curl_errno($ch);
$errmsg = curl_error($ch);
$status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
$contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
curl_close($ch);

if ($errno !== 0 || $body === false) {
    http_response_code(502);
    header('Content-Type: text/plain; charset=utf-8');
    exit('proxyfout: curl ' . $errno . ' ' . $errmsg);
}
if ($status >= 400) {
    http_response_code(502);
    header('Content-Type: text/plain; charset=utf-8');
    exit('bron reageert met HTTP ' . $status . ' (toegang geblokkeerd?)');
}

// Some sites redirect feeds to an HTML page; detect that so the app can report it
$ct = strtolower($contentType);
if ($ct && strpos($ct, 'html') !== false && strpos($body, '<rss') === false && strpos($body, '<feed') === false) {
    http_response_code(502);
    header('Content-Type: text/plain; charset=utf-8');
    exit('bron gaf HTML terug in plaats van RSS (feed-URL verouderd?)');
}

header('Content-Type: ' . ($contentType ?: 'application/rss+xml; charset=utf-8'));
header('Cache-Control: public, max-age=300');
echo $body;
