<?php
// Zeeland Vandaag — tiny self-hosted RSS proxy.
// Upload this file next to index.html on any PHP host (e.g. rammeloo.eu).
// It fetches RSS feeds server-side so the browser avoids CORS issues.
// For sources without an RSS feed (Omroep ZVL, AVS) it scrapes the news
// page and emits RSS on the fly.

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
    'avs.be',
    'www.avs.be',
    'news.google.com',
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
        CURLOPT_SSLVERSION => CURL_SSLVERSION_TLSv1_2,
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

// --- Sitemap mode: XML sitemap -> RSS ---------------------------------------
// Sources like AVS and Omroep ZVL expose a news sitemap with real article
// URLs and lastmod dates. This yields clean articles (no category pages).
function sitemap_to_rss($body, $source_host) {
    $dom = new DOMDocument();
    libxml_use_internal_errors(true);
    $dom->loadXML($body);
    libxml_clear_errors();
    $xpath = new DOMXPath($dom);
    $entries = [];
    foreach ($xpath->query('//url') as $urlNode) {
        $locs = $urlNode->getElementsByTagName('loc');
        $mods = $urlNode->getElementsByTagName('lastmod');
        if ($locs->length === 0) continue;
        $loc = trim($locs->item(0)->textContent);
        $path = parse_url($loc, PHP_URL_PATH);
        if (!preg_match('~/nieuws/([^/]+)$~', $path, $m)) continue;
        $slug = $m[1];
        if ($slug === '') continue;
        $ts = $mods->length > 0 ? strtotime($mods->item(0)->textContent) : false;
        if ($ts === false || $ts === -1) $ts = time();
        $title = ucfirst(str_replace('-', ' ', $slug));
        $entries[] = ['ts' => $ts, 'loc' => $loc, 'title' => $title];
    }
    usort($entries, function ($a, $b) { return $b['ts'] - $a['ts']; });
    $entries = array_slice($entries, 0, 60);
    $items = '';
    foreach ($entries as $e) {
        $items .= "    <item>\n"
            . "      <title>" . htmlspecialchars($e['title'], ENT_XML1, 'UTF-8') . "</title>\n"
            . "      <link>" . htmlspecialchars($e['loc'], ENT_XML1, 'UTF-8') . "</link>\n"
            . "      <guid>" . htmlspecialchars($e['loc'], ENT_XML1, 'UTF-8') . "</guid>\n"
            . "      <pubDate>" . date('D, d M Y H:i:s O', $e['ts']) . "</pubDate>\n"
            . "    </item>\n";
    }
    if ($items === '') return null;
    return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
        . "<rss version=\"2.0\">\n  <channel>\n"
        . "    <title>Nieuws</title>\n"
        . "    <link>" . htmlspecialchars('https://' . $source_host, ENT_XML1, 'UTF-8') . "</link>\n"
        . $items
        . "  </channel>\n</rss>\n";
}

// --- Scrape mode: HTML news listing -> RSS ---------------------------------
// Handles sources without an RSS feed. Extracts article links, titles,
// and (when present) Dutch dates like "za 3 oktober".
function scrape_listing($html, $source_host) {
    $dom = new DOMDocument();
    libxml_use_internal_errors(true);
    $dom->loadHTML($html);
    libxml_clear_errors();
    $xpath = new DOMXPath($dom);

    $month_map = [
        'januari' => 1, 'februari' => 2, 'maart' => 3, 'april' => 4,
        'mei' => 5, 'juni' => 6, 'juli' => 7, 'augustus' => 8,
        'september' => 9, 'oktober' => 10, 'november' => 11, 'december' => 12,
    ];

    $seen = [];
    $items = '';
    $nodes = $xpath->query('//a[@href]');
    foreach ($nodes as $node) {
        $href = $node->getAttribute('href');
        if (preg_match('~^https?://~i', $href) && stripos($href, $source_host) === false) continue;
        if (strpos($href, 'http') !== 0) $href = 'https://' . $source_host . (strpos($href, '/') === 0 ? $href : '/' . $href);
        $path = parse_url($href, PHP_URL_PATH);

        $is_article = false;
        if ($source_host === 'www.omroepzvl.nl') {
            $is_article = (bool) preg_match('~/nieuws/.+~', $path);
        } elseif ($source_host === 'avs.be') {
            $is_article = (bool) preg_match('~/nieuws/.+~', $path) && !preg_match('~/nieuws/?$~', $path);
        }
        if (!$is_article) continue;

        $href = strtok($href, '?#');
        if (isset($seen[$href])) continue;

        $title = trim(preg_replace('/\s+/u', ' ', $node->textContent));
        if ($title === '' || mb_strlen($title) < 8) continue;
        $seen[$href] = true;

        // Look for a Dutch date near the link: search ancestors for text like "za 3 oktober"
        $date = null;
        $p = $node->parentNode;
        for ($i = 0; $i < 4 && $p; $i++) {
            $txt = $p->textContent;
            if (preg_match('~\b(vr|za|zo|ma|di|wo|do)\s+(\d{1,2})\s+([a-z]+)~iu', $txt, $m)) {
                $mon = mb_strtolower($m[3]);
                if (isset($month_map[$mon])) {
                    $y = (int) date('Y');
                    $ts = mktime(12, 0, 0, $month_map[$mon], (int) $m[2], $y);
                    if ($ts > time() + 86400) $ts = mktime(12, 0, 0, $month_map[$mon], (int) $m[2], $y - 1);
                    $date = date('D, d M Y H:i:s O', $ts);
                }
                break;
            }
            $p = $p->parentNode;
        }

        $items .= "    <item>\n"
            . "      <title>" . htmlspecialchars($title, ENT_XML1, 'UTF-8') . "</title>\n"
            . "      <link>" . htmlspecialchars($href, ENT_XML1, 'UTF-8') . "</link>\n"
            . "      <guid>" . htmlspecialchars($href, ENT_XML1, 'UTF-8') . "</guid>\n"
            . ($date ? "      <pubDate>" . $date . "</pubDate>\n" : '')
            . "    </item>\n";
        if (count($seen) >= 30) break;
    }

    if ($items === '') return null;

    return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
        . "<rss version=\"2.0\">\n  <channel>\n"
        . "    <title>Nieuws</title>\n"
        . "    <link>" . htmlspecialchars('https://' . $source_host, ENT_XML1, 'UTF-8') . "</link>\n"
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

$ct = strtolower($contentType ?: '');
$is_html = strpos($ct, 'html') !== false;
$looks_sitemap = strpos($body, '<urlset') !== false;
if ($looks_sitemap) {
    $rss = sitemap_to_rss($body, strtolower($host));
    if ($rss !== null) {
        header('Content-Type: application/rss+xml; charset=utf-8');
        header('Cache-Control: public, max-age=300');
        echo $rss;
        exit;
    }
    fail('kon geen nieuws vinden in de sitemap');
}
$looks_xml = (strpos($body, '<rss') !== false) || (strpos($body, '<feed') !== false) || (strpos($body, '<?xml') !== false);

if ($is_html && !$looks_xml) {
    $rss = scrape_listing($body, strtolower($host));
    if ($rss !== null) {
        header('Content-Type: application/rss+xml; charset=utf-8');
        header('Cache-Control: public, max-age=300');
        echo $rss;
        exit;
    }
    fail('kon geen nieuws vinden op de pagina (structuur gewijzigd?)');
}

if ($is_html && $looks_xml) {
    // content-type lies; serve it as XML anyway
    header('Content-Type: application/rss+xml; charset=utf-8');
    header('Cache-Control: public, max-age=300');
    echo $body;
    exit;
}

if (!$looks_xml && !$is_html) {
    fail('onverwacht antwoord van bron (geen RSS, geen HTML)');
}

header('Content-Type: ' . ($contentType ?: 'application/rss+xml; charset=utf-8'));
header('Cache-Control: public, max-age=300');
echo $body;
