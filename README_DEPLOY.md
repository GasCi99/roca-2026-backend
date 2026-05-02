# Guía de Despliegue - ROCA 2026

Este proyecto es una aplicación **Full-Stack** que consta de un frontend en React (Vite) y un backend en Node.js (Express).

## Requisitos para Producción

Para que la aplicación funcione correctamente online (incluyendo el envío de emails y la navegación), no puede ser hosteado únicamente como un "sitio estático" (como GitHub Pages o Firebase Hosting estándar sin funciones). Requiere un entorno que pueda ejecutar **Node.js**.

### Pasos para Desplegar (VPS o Servidor propio)

1.  **Instalar dependencias:**
    ```bash
    npm install
    ```
2.  **Construir el frontend:**
    ```bash
    npm run build
    ```
    Esto generará la carpeta `dist/`.
3.  **Configurar Variables de Entorno (.env):**
    Crea un archivo `.env` en el servidor con los siguientes datos (especialmente los de SMTP para que funcionen los mails):
    ```env
    SMTP_HOST=smtp.gmail.com
    SMTP_PORT=465
    SMTP_USER=tu-email@gmail.com
    SMTP_PASS=tu-contraseña-de-aplicacion
    ```
4.  **Iniciar el servidor:**
    ```bash
    npm start
    ```
    El servidor correrá en el puerto 3000 y servirá tanto la API como el frontend.

## Despliegue en Vercel (Recomendado)

Si usás Vercel, el proyecto ya está preparado. Vercel detectará el archivo `vercel.json` (si existe) o podés configurarlo como una "Vercel Project".

**IMPORTANTE:** Debes configurar las "Environment Variables" en el panel de control de Vercel con tus credenciales de SMTP.

## "Page Not Found" (404)

Si ves un error "Page Not Found" al navegar a `/historial` o `/votar`, es porque el servidor donde lo subiste no está configurado para manejar rutas de Single Page Application (SPA). El archivo `server.ts` ya tiene la configuración necesaria:
```ts
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});
```
Asegúrate de estar ejecutando la aplicación con `npm start` (que usa `server.ts`) y no simplemente sirviendo la carpeta `dist/` con un servidor estático como Apache o Nginx sin configuración adicional.

## Problemas con Emails

Si los emails no se envían:
1. Verificá que `SMTP_USER` y `SMTP_PASS` estén configurados en el entorno.
2. Si usás Gmail, tenés que usar una **"Contraseña de Aplicación"** y no tu contraseña normal.
3. Revisá los logs del servidor para ver el error exacto que devuelve Nodemailer.

## Despliegue en Firebase (Hosting + Functions)

Para que todo funcione en Firebase, no alcanza con "Hosting" (que es estático). Necesitás usar **Firebase Functions** para el envío de mails.

### 1. Solución al "Page Not Found"
He actualizado el archivo `firebase.json`. Al desplegar, Firebase ahora sabe que cualquier ruta debe redirigir a `index.html`, permitiendo que React maneje la navegación sin errores 404.

### 2. Solución a los Emails (IMPORTANTE)
Firebase Hosting no puede ejecutar código de Node.js. Por eso, he creado una carpeta `functions` con la lógica necesaria.

**Pasos para que los mails anden en Firebase:**
1.  **Plan Blaze (Pago por uso):** Firebase exige el Plan Blaze para realizar peticiones a servidores externos (como el SMTP de Gmail). Si estás en el plan gratuito (Spark), los mails **no se enviarán**.
2.  **Configurar Variables:** Debés configurar tu usuario y contraseña de SMTP en Firebase. Podés hacerlo desde la terminal antes de desplegar:
    ```bash
    firebase functions:secrets:set SMTP_USER
    firebase functions:secrets:set SMTP_PASS
    ```
    (Y seguí las instrucciones para pegar los valores).
3.  **Desplegar:**
    ```bash
    npm run build
    firebase deploy
    ```

### Alternativa Gratuita (Sin Plan Blaze)
Si no querés pasarte al Plan Blaze, podés hostear el backend en **Render.com**.

**Pasos para conectar tu Web con Render:**
1.  Desplegá el backend en Render. Tu URL es: `https://roca-mails-v2.onrender.com`
2.  En tu proyecto de la web (donde tenés el código de React), creá o editá tu archivo `.env`:
    ```env
    VITE_MAIL_API_URL=https://roca-mails-v2.onrender.com/api/send-match-emails
    ```
3.  Hacé el build y desplegá la web de nuevo a Firebase:
    ```bash
    npm run build
    firebase deploy
    ```

