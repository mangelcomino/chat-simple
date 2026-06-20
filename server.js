const express = require('express')
const http = require('http')
const session = require('express-session')
const { Server } = require('socket.io')

const app = express()
const server = http.createServer(app)

const PASSWORD = 'luis'

app.use(express.urlencoded({ extended: true }))

app.use(
  session({
    secret: 'clave-secreta-del-chat',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: null,
    },
  }),
)

app.get('/login', (req, res) => {
  req.session.authenticated = false

  res.send(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Gestionar preferencias de privacidad</title>

      <style>
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          min-height: 100vh;
          font-family: Arial, sans-serif;
          background: #f4f4f4;
          color: #222;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 20px;
        }

        .card {
          width: 100%;
          max-width: 430px;
          background: white;
          border-radius: 14px;
          padding: 24px;
          box-shadow: 0 8px 30px rgba(0,0,0,0.12);
        }

        .tag {
          display: inline-block;
          background: #eef2ff;
          color: #1f3a8a;
          padding: 6px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: bold;
          margin-bottom: 14px;
        }

        h1 {
          font-size: 22px;
          margin: 0 0 12px;
        }

        p {
          font-size: 14px;
          line-height: 1.5;
          color: #555;
          margin-bottom: 16px;
        }

        .price {
          background: #f8fafc;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          padding: 14px;
          margin-bottom: 18px;
          font-size: 14px;
        }

        .price strong {
          font-size: 22px;
          color: #111;
        }

        label {
          display: block;
          font-size: 13px;
          font-weight: bold;
          margin-bottom: 6px;
        }

        input {
          width: 100%;
          padding: 13px;
          margin-bottom: 14px;
          border: 1px solid #ccc;
          border-radius: 8px;
          font-size: 16px;
        }

        button {
          width: 100%;
          padding: 14px;
          border: none;
          border-radius: 8px;
          background: #111827;
          color: white;
          font-size: 16px;
          font-weight: bold;
          cursor: pointer;
        }

        .error {
          margin-top: 14px;
          padding: 12px;
          border-radius: 8px;
          background: #fff7ed;
          color: #9a3412;
          font-size: 14px;
        }

        .small {
          margin-top: 14px;
          font-size: 12px;
          color: #777;
          text-align: center;
        }
      </style>
    </head>

    <body>
      <div class="card">
        <div class="tag">Preferencias de privacidad</div>

        <h1>Continúa navegando sin cookies publicitarias</h1>

        <p>
          Puedes suscribirte para mantener una experiencia personalizada y navegar sin cookies publicitarias.
        </p>

        <div class="price">
          Plan mensual desde <strong>2,99 €</strong> / mes.
        </div>

        <form method="POST" action="/login">
          <label for="username">Usuario</label>
          <input 
            id="username"
            type="text" 
            name="username" 
            placeholder="Introduce tu usuario"
            autocomplete="off"
          >

          <label for="password">Contraseña</label>
          <input 
            id="password"
            type="password" 
            name="password" 
            placeholder="Introduce tu contraseña"
            autocomplete="off"
          >

          <button type="submit">Continuar</button>
        </form>

        ${
          req.query.error
            ? `
          <div class="error">
            El servidor no responde en este momento. Inténtalo más tarde.
          </div>
        `
            : ''
        }

        <div class="small">
          Servicio de gestión de privacidad y preferencias de navegación.
        </div>
      </div>
    </body>
    </html>
  `)
})

app.post('/login', (req, res) => {
  if (req.body.password === PASSWORD) {
    req.session.authenticated = true
    req.session.cookie.expires = false
    res.redirect('/chat')
  } else {
    res.redirect('/login?error=1')
  }
})

app.get('/', (req, res) => {
  res.redirect('/login')
})

app.get('/chat', (req, res, next) => {
  if (req.session.authenticated) {
    next()
  } else {
    res.redirect('/login')
  }
})

app.use('/chat', express.static('public'))

const io = new Server(server)

let historialMensajes = []

io.on('connection', socket => {
  console.log('Usuario conectado')

  socket.emit('historial', historialMensajes)

  socket.on('mensaje', mensaje => {
    const nuevoMensaje = {
      id: Date.now(),
      texto: mensaje.texto,
      usuario: mensaje.usuario,
      hora: new Date().toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    }

    historialMensajes.push(nuevoMensaje)

    if (historialMensajes.length > 100) {
      historialMensajes.shift()
    }

    io.emit('mensaje', nuevoMensaje)
  })

  socket.on('disconnect', () => {
    console.log('Usuario desconectado')
  })
})

const PORT = process.env.PORT || 3000

server.listen(PORT, () => {
  console.log(`Servidor iniciado en puerto ${PORT}`)
})
