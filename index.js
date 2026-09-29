const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const express = require('express');

// Hapa ndipo tulipoongeza seva ya wavuti ili kuituliza Render isilete Port Timeout
const app = express();
const PORT = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('MR. SIDE WhatsApp Bot ipo Live na salama!'));
app.listen(PORT, () => console.log(`Seva inasikiliza kwenye port ${PORT}`));

const SESSION_ID = process.env.SESSION_ID || "";
const AUTO_STATUS_VIEW = process.env.AUTO_STATUS_VIEW === "true";

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('session_auth');
    
    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true,
        auth: state
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            console.log('MR. SIDE Bot ipo ONLINE sasa kwenye Render!');
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages;
        if (!msg || !msg.message) return;

        const from = msg.key.remoteJid;

        if (from === 'status@broadcast' && AUTO_STATUS_VIEW) {
            await sock.readMessages([msg.key]);
            await sock.sendMessage(from, { react: { text: "❤️", key: msg.key } });
            return;
        }

        const body = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

        if (from.endsWith('@g.us') && (body.includes('http://') || body.includes('https://') || body.includes('wa.me'))) {
            console.log('Link imegundulika! Inafutwa...');
            await sock.sendMessage(from, { delete: msg.key });
        }
    });

    sock.ev.on('group-participants.update', async (anu) => {
        if (anu.action === 'add') {
            const groupMetadata = await sock.groupMetadata(anu.id);
            for (let num of anu.participants) {
                await sock.sendMessage(anu.id, { text: `Karibu sana @${num.split('@')} kwenye kikundi cha ${groupMetadata.subject}!`, mentions: [num] });
            }
        }
    });
}

startBot();
