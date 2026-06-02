import { makeWASocket, useMultiFileAuthState, delay } from '@whiskeysockets/baileys';

export default async function handler(req, res) {
  const { num } = req.query;
  if (!num) return res.status(400).json({ error: 'Number required' });

  try {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const sock = makeWASocket({ auth: state, printQRInTerminal: false });

    sock.ev.on('creds.update', saveCreds);

    await delay(3000);
    let code = await sock.requestPairingCode(num.replace(/[^0-9]/g, ''));
    code = code?.match(/.{1,4}/g)?.join('-') || code;

    res.json({ code });
  } catch (error) {
    res.status(500).json({ error: 'Failed to request pairing code' });
  }
}
