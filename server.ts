import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Nodemailer transporter configuration
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      configured: !!(process.env.EMAIL_USER && process.env.EMAIL_PASS) 
    });
  });

  // Route to send unique voting links to players
  app.post('/api/send-match-emails', async (req, res) => {
    const { matchId, players, date, host } = req.body;
    
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      return res.status(500).json({ error: 'Configuración incompleta: EMAIL_USER o EMAIL_PASS faltantes en el servidor.' });
    }

    const results = { sent: 0, failed: 0, errors: [] as string[] };

    for (const player of players) {
      if (!player.email) continue;

      const votingLink = `${host}/votar/${matchId}?voter=${encodeURIComponent(player.name)}`;
      
      try {
        await transporter.sendMail({
          from: `"ROCA 2026" <${process.env.EMAIL_USER}>`,
          to: player.email,
          subject: `⚽ ¡Vota la figura! - ${date}`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background-color: #0c0a09; color: #ffffff; padding: 20px; border-radius: 16px; border: 1px solid #10b981;">
              <h1 style="color: #10b981; text-align: center; margin-bottom: 20px;">ROCA 2026</h1>
              <p style="font-size: 16px; line-height: 1.5;">Hola <strong>${player.name}</strong>,</p>
              <p style="font-size: 16px; line-height: 1.5;">El partido del <strong>${date}</strong> ha finalizado. Tu participación es clave para elegir al jugador del partido.</p>
              <div style="text-align: center; margin: 35px 0;">
                <a href="${votingLink}" style="background-color: #10b981; color: #000000; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 800; font-size: 18px; display: inline-block;">INGRESAR A VOTAR</a>
              </div>
              <p style="font-size: 13px; color: #78716c; text-align: center; font-style: italic;">Este enlace es personal y único para vos.</p>
              <hr style="border: 0; border-top: 1px solid #292524; margin: 25px 0;">
              <p style="font-size: 11px; color: #44403c; text-align: center;">Sistema de Gestión Roca Futbol • 2026</p>
            </div>
          `,
        });
        results.sent++;
      } catch (error: any) {
        console.error(`Error enviando a ${player.email}:`, error);
        results.failed++;
        results.errors.push(`${player.name}: ${error.message}`);
      }
    }

    res.json(results);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    console.log('Starting in DEVELOPMENT mode');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    console.log('Starting in PRODUCTION mode');
    const distPath = path.resolve(process.cwd(), 'dist');
    
    // Serve static files
    app.use(express.static(distPath));
    
    // API routes are already defined above, so any other request goes to the SPA
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
