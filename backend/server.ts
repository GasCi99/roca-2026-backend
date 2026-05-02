import express, { Request, Response } from 'express';
import nodemailer from 'nodemailer';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 10000;

// Configuración de CORS
// IMPORTANTE: Cambia esto por tu URL de Firebase Hosting cuando la tengas
app.use(cors({
  origin: '*', // Permitir todos para el desarrollo, luego podés restringirlo
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json());

// Verificación de variables de entorno
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

app.get('/', (req, res) => {
  res.send('ROCA 2026 Mail Server is Running!');
});

app.post('/api/send-match-emails', async (req: Request, res: Response) => {
  const { matchId, players, date, host } = req.body;

  if (!EMAIL_USER || !EMAIL_PASS) {
    console.error('Error: EMAIL_USER o EMAIL_PASS no configurados.');
    return res.status(500).json({ error: 'Configuración de servidor incompleta.' });
  }

  // Configuración de Nodemailer preparada para Gmail y Render
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // true para puerto 465
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS,
    },
    tls: {
      // Evita problemas de certificados en entornos como Render
      rejectUnauthorized: false
    }
  });

  const results = { sent: 0, failed: 0, errors: [] as string[] };

  try {
    const emailPromises = players.map(async (player: any) => {
      if (!player.email) return;

      const votingLink = `${host}/votar/${matchId}?voter=${encodeURIComponent(player.name)}`;
      
      try {
        await transporter.sendMail({
          from: `"ROCA 2026" <${EMAIL_USER}>`,
          to: player.email,
          subject: `¡Vota la figura del partido! - ${date}`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background-color: #0c0a09; color: #ffffff; padding: 20px; border-radius: 16px;">
              <h1 style="color: #10b981; text-align: center;">ROCA 2026</h1>
              <p style="font-size: 16px; line-height: 1.5;">Hola <strong>${player.name}</strong>,</p>
              <p style="font-size: 16px; line-height: 1.5;">El partido del <strong>${date}</strong> ya terminó. Es hora de votar a la figura (MOTM).</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${votingLink}" style="background-color: #10b981; color: #000000; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 18px;">IR A VOTAR</a>
              </div>
              <p style="font-size: 14px; color: #78716c; text-align: center;">Este link es único para vos. No podés votarte a vos mismo.</p>
              <hr style="border: 0; border-top: 1px solid #292524; margin: 20px 0;">
              <p style="font-size: 12px; color: #44403c; text-align: center;">Roca Futbol System • 2026</p>
            </div>
          `,
        });
        results.sent++;
      } catch (error: any) {
        results.failed++;
        results.errors.push(`${player.name}: ${error.message}`);
        console.error(`Error enviando a ${player.name}:`, error);
      }
    });

    await Promise.all(emailPromises);
    res.json(results);
  } catch (globalError: any) {
    res.status(500).json({ error: globalError.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
