<?php
// Zeeland Vandaag — tiny self-hosted RSS proxy.
// Upload this file next to index.html on any PHP host (e.g. rammeloo.eu).
// It fetches RSS feeds server-side so the browser avoids CORS issues.
// For sources without an RSS feed (Omroep ZVL) it scrapes the news page
// and emits RSS on the fly.

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
    'www.omroepzvl.nl',
    'omroepzvl.nl',
    'www.nieuwsblad.be',
    'nieuwsblad.be',
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

$user_agent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function fetch_url($url, $user_agent) {
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
            'Accept: text/html, application/rss+xml, application/xml, text/xml, */*',
            'Accept-Language: nl-NL,nl;q=0.9,en;q=0.6',
        ],
    ]);
    $body = curl_exec($ch);
    $errno = curl_errno($ch);
    $errmsg = curl_error($ch);
    $status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
    curl_close($ch);
    return [$body, $errno, $errmsg, $status, $contentType];
}

function fail($msg) {
    http_response_code(502);
    header('Content-Type: text/plain; charset=utf-8');
    exit($msg);
}

function xml_out($xml, $contentType) {
    $ct = strtolower($contentType ?: '');
    if (strpos($ct, 'html') !== false) fail('bron gaf HTML terug in plaats van RSS (feed-URL verouderd?)');
    header('Content-Type: ' . ($contentType ?: 'application/rss+xml; charset=utf-8'));
    header('Cache-Control: public, max-age=300');
    echo $xml;
}

// --- Scrape mode: Omroep ZVL news page -> RSS ------------------------------
function scrape_zvl($html) {
    $dom = new DOMDocument();
    libxml_use_internal_errors(true);
    $dom->loadHTML($html);
    libxml_clear_errors();
    $xpath = new DOMXPath($dom);

    $seen = [];
    $items = '';
    $nodes = $xpath->query("//a[contains(@href,'/nieuws/')]");
    foreach ($nodes as $node) {
        $href = $node->getAttribute('href');
        if (strpos($href, 'http') !== 0) $href = 'https://www.omroepzvl.nl' . $href;
        $href = strtok($href, '?#');
        if (isset($seen[$href])) continue;
        if (preg_match('~/nieuws/(\d+)$~', $href) === false && strpos($href, '/nieuws/') === false) continue;
        $seen[$href] = true;

        $title = trim($node->textContent);
        if ($title === '') continue;
        $title = preg_replace('/\s+/u', ' ', $title);

        $items .= "    <item>\n"
            . "      <title>" . htmlspecialchars($title, ENT_XML1, 'UTF-8') . "</title>\n"
            . "      <link>" . htmlspecialchars($href, ENT_XML1, 'UTF-8') . "</link>\n"
            . "      <guid>" . htmlspecialchars($href, ENT_XML1, 'UTF-8') . "</guid>\n"
            . "    </item>\n";
        if (count($seen) >= 30) break;
    }

    if ($items === '') return null;

    return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
        . "<rss version=\"2.0\">\n  <channel>\n"
        . "    <title>Omroep ZVL - Nieuws</title>\n"
        . "    <link>https://www.omroepzvl.nl/nieuws</link>\n"
        . $items
        . "  </channel>\n</rss>\n";
}

// --- Main -------------------------------------------------------------------
list($body, $errno, $errmsg, $status, $contentType) = fetch_url($url, $user_agent);

if ($errno !== 0 || $body === false) {
    fail('proxyfout: curl ' . $errno . ' ' . $errmsg);
}
if ($status >= 400) {
    fail('bron reageert met HTTP ' . $status . ' (toegang geblokkeerd?)');
}

$ct = strtolower($contentType);
$is_html = $ct && strpos($ct, 'html') !== false;

if ($is_html) {
    // No pubDates available from the listing page; emit items undated so the
    // app treats them as "recent" via its fallback.
    $rss = scrape_zvl($body);
    if ($rss !== null) {
        header('Content-Type: application/rss+xml; charset=utf-8');
        header('Cache-Control: public, max-age=300');
        echo $rss;
        exit;
    }
    fail('kon geen nieuws vinden op de pagina (structuur gewijzigd?)');
}

xml_out($body, $contentType);
