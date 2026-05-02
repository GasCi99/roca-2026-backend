import express, { Request, Response } from 'express';
import nodemailer from 'nodemailer';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
// Render usa process.env.PORT, es vital que se mantenga así
const PORT = Number(process.env.PORT) || 10000;

// Configuración de CORS corregida
app.use(cors({
  origin: '*', // Permite que tu web de Firebase Hosting se comunique sin bloqueos
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json());

// Verificación de variables de entorno (EMAIL_USER y EMAIL_PASS configurados en Render)
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

app.get('/', (req, res) => {
  res.send('ROCA 2026 Mail Server is Running!');
});

app.post('/api/send-match-emails', async (req: Request, res: Response) => {
  const { matchId, players, date, host } = req.body;

  if (!EMAIL_USER || !EMAIL_PASS) {
    console.error('Error: EMAIL_USER o EMAIL_PASS no configurados en las variables de entorno.');
    return res.status(500).json({ error: 'Configuración de servidor incompleta.' });
  }

  // Configuración de Nodemailer robusta para Gmail
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS, // Recordá usar la "Contraseña de Aplicación" de 16 letras
    },
    tls: {
      // Esto evita errores de "Self-signed certificate" comunes en servidores gratuitos
      rejectUnauthorized: false
    }
  });

  const results = { sent: 0, failed: 0, errors: [] as string[] };

  try {
    // Usamos un bucle secuencial o Promise.all para enviar los correos
    const emailPromises = players.map(async (player: any) => {
      if (!player.email) return;

      // Generamos el link de votación usando el host dinámico de la web
      const votingLink = `${host}/votar/${matchId}?voter=${encodeURIComponent(player.name)}`;

      try {
        await transporter.sendMail({
          from: `"ROCA 2026" <${EMAIL_USER}>`,
          to: player.email,
          subject: `¡Vota la figura del partido! - ${date}`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background-color: #0c0a09; color: #ffffff; padding: 20px; border-radius: 16px; border: 1px solid #10b981;">
              <h1 style="color: #10b981; text-align: center; margin-bottom: 20px;">ROCA 2026</h1>
              <p style="font-size: 16px; line-height: 1.5;">Hola <strong>${player.name}</strong>,</p>
              <p style="font-size: 16px; line-height: 1.5;">El partido del <strong>${date}</strong> ya terminó. Es hora de elegir al <strong>Jugador del Partido (MOTM)</strong>.</p>
              <div style="text-align: center; margin: 35px 0;">
                <a href="${votingLink}" style="background-color: #10b981; color: #000000; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: bold; font-size: 18px; display: inline-block;">IR A VOTAR</a>
              </div>
              <p style="font-size: 14px; color: #78716c; text-align: center;">Este link es único para vos. No podés votarte a vos mismo.</p>
              <hr style="border: 0; border-top: 1px solid #292524; margin: 25px 0;">
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
    console.error('Error global en el servidor:', globalError);
    res.status(500).json({ error: globalError.message });
  }
});

// Escuchar en '0.0.0.0' es obligatorio para que Render pueda exponer el servicio
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor de ROCA 2026 corriendo en el puerto ${PORT}`);
});