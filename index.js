const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, delay } = require('@whiskeysockets/baileys');
const express = require('express');
const app = express();

app.use(express.json());
const PORT = process.env.PORT || 3000;
const startTime = Date.now();

// Track AI auto-reply state globally
let aiStatus = false;

app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>WhatsApp Bot Linker</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background: #f0f2f5; margin: 0; }
                .card { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); text-align: center; max-width: 400px; width: 90%; }
                input { width: 100%; padding: 12px; margin: 15px 0; border: 1px solid #ccc; border-radius: 5px; box-sizing: border-box; font-size: 16px; }
                button { width: 100%; padding: 12px; background: #25D366; color: white; border: none; border-radius: 5px; font-size: 16px; cursor: pointer; font-weight: bold; }
                #codeDisplay { margin-top: 20px; font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #075E54; background: #e3f2fd; padding: 10px; border-radius: 5px; display: none; }
            </style>
        </head>
        <body>
            <div class="card">
                <h2>Link WhatsApp Bot</h2>
                <p>Enter your phone number with country code (e.g., 254712345678) to get your linking code.</p>
                <input type="text" id="phoneNumber" placeholder="254712345678">
                <button onclick="getCode()">Generate Code</button>
                <div id="codeDisplay"></div>
            </div>
            <script>
                async function getCode() {
                    const num = document.getElementById('phoneNumber').value.trim();
                    if (!num) return alert('Please enter a valid number');
                    const btn = document.querySelector('button');
                    const display = document.getElementById('codeDisplay');
                    btn.innerText = 'Generating...';
                    display.style.display = 'none';
                    try {
                        const res = await fetch('/get-code?num=' + num);
                        const data = await res.json();
                        if (data.code) {
                            display.innerText = data.code;
                            display.style.display = 'block';
                            btn.innerText = 'Generate Code';
                        } else {
                            alert(data.error || 'Failed to get code');
                            btn.innerText = 'Generate Code';
                        }
                    } catch (err) {
                        alert('Error connecting to server');
                        btn.innerText = 'Generate Code';
                    }
                }
            </script>
        </body>
        </html>
    `);
});

app.get('/get-code', async (req, res) => {
    let phoneNumber = req.query.num;
    if (!phoneNumber) return res.status(400).json({ error: 'Number required' });
    phoneNumber = phoneNumber.replace(/[^0-9]/g, '');

    try {
        const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
        const sock = makeWASocket({ auth: state, printQRInTerminal: false });

        sock.ev.on('creds.update', saveCreds);
        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === 'close') {
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                if (shouldReconnect) handleBotFeatures(sock); 
            }
        });

        await delay(3000);
        let code = await sock.requestPairingCode(phoneNumber);
        code = code?.match(/.{1,4}/g)?.join('-') || code;

        res.json({ code: code });
        handleBotFeatures(sock);

    } catch (error) {
        res.status(500).json({ error: 'Failed to request pairing code' });
    }
});

function formatRuntime(ms) {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

// Built-in Smart Local Responder Logic
function getLocalResponse(incomingText) {
    const cleanText = incomingText.toLowerCase().trim();

    if (cleanText.includes('hi') || cleanText.includes('hello') || cleanText.includes('hey')) {
        return "Hello! 👋 I am an automated assistant. How can I help you today?";
    }
    if (cleanText.includes('how are you')) {
        return "I'm running perfectly 24/7 on Render! Thank you for asking. 🚀";
    }
    if (cleanText.includes('owner') || cleanText.includes('creator')) {
        return "This bot was generated via Mini-Beltah customization.";
    }
    if (cleanText.includes('help')) {
        return "Feel free to leave your message here. My owner will see it when they are online!";
    }

    // Default fallback text response
    return "🤖 *Auto-Response Mode*:\n\nThanks for your message! My owner is currently away, but your message has been received.";
}

function handleBotFeatures(sock) {
    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        const from = msg.key.remoteJid;
        const isGroup = from.endsWith('@g.us');

        const prefix = ".";
        
        if (text.startsWith(prefix)) {
            const args = text.slice(prefix.length).trim().split(/ +/);
            const command = args.shift().toLowerCase();

            const senderJid = msg.key.participant || msg.key.remoteJid;
            const senderName = msg.pushName || `@${senderJid.split('@')[0]}`;

            const eatTime = new Date().toLocaleTimeString('en-GB', { 
                timeZone: 'Africa/Nairobi', 
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit' 
            });

            if (command === 'menu') {
                const menuText = `*🤖 MINI-BELTAH BOT MENU*

👤 *User:* ${senderName}
🕒 *Time:* ${eatTime} EAT
🤖 *Auto-Reply:* ${aiStatus ? '✅ ON' : '❌ OFF'}

📌 *Available Commands:*
• \`.menu\` - Show this configuration panel
• \`.ping\` - Test processing speed performance
• \`.runtime\` - Check active runtime metrics
• \`.ai on\` - Enable automated private replies
• \`.ai off\` - Disable automated private replies`;
                
                await sock.sendMessage(from, { text: menuText }, { quoted: msg });
                return;
            }

            if (command === 'ping') {
                const startPing = Date.now();
                await sock.sendMessage(from, { text: 'Evaluating link latency...' }, { quoted: msg });
                const endPing = Date.now();
                const latency = endPing - startPing;
                
                await sock.sendMessage(from, { text: `🚀 *Pong!* Response processing speed is *${latency}ms*` }, { quoted: msg });
                return;
            }

            if (command === 'runtime') {
                const currentRuntime = Date.now() - startTime;
                await sock.sendMessage(from, { text: `🕒 *System Status Runtime:* ${formatRuntime(currentRuntime)}` }, { quoted: msg });
                return;
            }

            if (command === 'ai') {
                const targetState = args[0]?.toLowerCase();
                if (targetState === 'on') {
                    aiStatus = true;
                    await sock.sendMessage(from, { text: '🤖 *Automated private replies have been ENABLED.*' }, { quoted: msg });
                } else if (targetState === 'off') {
                    aiStatus = false;
                    await sock.sendMessage(from, { text: '🤖 *Automated private replies have been DISABLED.*' }, { quoted: msg });
                } else {
                    await sock.sendMessage(from, { text: '⚠️ *Invalid format.* Use `.ai on` or `.ai off`' }, { quoted: msg });
                }
                return;
            }
        }

        // Handle local response system for incoming private messages
        if (aiStatus && !isGroup && text && !text.startsWith(prefix)) {
            const botReply = getLocalResponse(text);
            await sock.sendMessage(from, { text: botReply }, { quoted: msg });
        }
    });
}

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
