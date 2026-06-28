const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 8080;

// মূল IPTV URL (শেষে স্ল্যাশসহ)
const TARGET_BASE = "http://180.94.28.28:8097/JALSHA-MOVIES/";

// CORS মিডলওয়্যার
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Type');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// m3u8 কন্টেন্ট মডিফাই করার হেল্পার ফাংশন
function modifyM3U8(m3u8Content, host, protocol, currentFileDir = "") {
    const proxyBase = `${protocol}://${host}/segment?file=`;

    return m3u8Content.split('\n').map(line => {
        let trimmedLine = line.trim();
        if (!trimmedLine) return line;

        // ১. প্লেলিস্টের লাইনে URI="...." থাকলে রূপান্তর
        if (/URI=/i.test(trimmedLine)) {
            return trimmedLine.replace(/URI=["']([^"']+)["']/i, (match, file) => {
                if (!file.startsWith('http')) {
                    // যদি ফাইলে আগে থেকেই ডিরেক্টরি পাথ না থাকে, তবে কারেন্ট ডিরেক্টরি যোগ হবে
                    const resolvedFile = file.includes('/') ? file : currentFileDir + file;
                    return `URI="${proxyBase}${encodeURIComponent(resolvedFile)}"`;
                }
                return match;
            });
        }

        // ২. সাধারণ ভিডিও সেগমেন্ট বা সাব-প্লেলিস্টের লিঙ্ক পরিবর্তন
        if (!trimmedLine.startsWith('#')) {
            if (!trimmedLine.startsWith('http')) {
                const resolvedFile = trimmedLine.includes('/') ? trimmedLine : currentFileDir + trimmedLine;
                return `${proxyBase}${encodeURIComponent(resolvedFile)}`;
            }
        }
        
        return line;
    }).join('\n');
}

// ১. মেইন .m3u8 ফাইল প্রক্সি করার রুট
app.get('/live.m3u8', async (req, res) => {
    try {
        const targetUrl = `${TARGET_BASE}index.fmp4.m3u8`;
        
        const response = await axios.get(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': TARGET_BASE
            },
            responseType: 'text'
        });

        const host = req.get('host');
        const protocol = req.protocol;
        
        const modifiedContent = modifyM3U8(response.data, host, protocol, "");
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.send(modifiedContent);

    } catch (error) {
        console.error("Error fetching main m3u8:", error.message);
        res.status(500).send("IPTV Stream unavailable.");
    }
});

// ২. ভিডিও সেগমেন্ট এবং সাব-প্লেলিস্ট প্রক্সি করার রুট
app.get('/segment', async (req, res) => {
    const fileName = req.query.file;
    if (!fileName) return res.status(400).send("File param missing");

    const segmentUrl = `${TARGET_BASE}${fileName}`;
    console.log(`Proxied request for: ${segmentUrl}`);

    try {
        // সাব-প্লেলিস্ট (.m3u8) হ্যান্ডলিং
        if (fileName.includes('.m3u8')) {
            const response = await axios.get(segmentUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Referer': TARGET_BASE
                },
                responseType: 'text'
            });

            // সাব-ডিরেক্টরি ট্র্যাক করা (যেমন "tracks-v1/index.fmp4.m3u8" থেকে "tracks-v1/")
            const lastSlashIndex = fileName.lastIndexOf('/');
            const currentFileDir = lastSlashIndex !== -1 ? fileName.substring(0, lastSlashIndex + 1) : "";

            const host = req.get('host');
            const protocol = req.protocol;
            const modifiedContent = modifyM3U8(response.data, host, protocol, currentFileDir);

            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
            return res.send(modifiedContent);
        }

        // সাধারণ মিডিয়া ফাইল স্ট্রিম করা
        const response = await axios.get(segmentUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': '*/*',
                'Referer': TARGET_BASE
            },
            responseType: 'stream'
        });

        // কন্টেন্ট টাইপ ও হেডার পাস করা
        if (fileName.includes('.fmp4') || fileName.includes('.mp4') || fileName.includes('init')) {
            res.setHeader('Content-Type', 'video/mp4');
        } else if (fileName.includes('.ts')) {
            res.setHeader('Content-Type', 'video/mp2t');
        } else if (response.headers['content-type']) {
            res.setHeader('Content-Type', response.headers['content-type']);
        }
        
        response.data.pipe(res);

    } catch (error) {
        console.error(`Error on segment [${fileName}]:`, error.message);
        res.status(500).send("Segment fetch failed.");
    }
});

app.listen(PORT, () => {
    console.log(`Proxy Server running on http://localhost:${PORT}/live.m3u8`);
});