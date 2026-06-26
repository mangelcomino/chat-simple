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
        * { box-sizing: border-box; }

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

        h1 {
          font-size: 22px;
          margin: 0 0 12px;
        }

        p {
          font-size: 14px;
          line-height: 1.5;
          color: #555;
        }

        .price {
          background: #f8fafc;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          padding: 14px;
          margin: 18px 0;
        }

        .price strong {
          font-size: 22px;
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
      </style>
    </head>

    <body>
      <div class="card">
        <h1>Continúa navegando sin cookies publicitarias</h1>

        <p>
          Puedes suscribirte para mantener una experiencia personalizada y navegar sin cookies publicitarias.
        </p>

        <div class="price">
          Plan mensual desde <strong>2,99 €</strong> / mes.
        </div>

        <form method="POST" action="/login">
          <label>Usuario</label>
          <input type="text" name="username" placeholder="Introduce tu usuario" autocomplete="off">

          <label>Contraseña</label>
          <input type="password" name="password" placeholder="Introduce tu contraseña" autocomplete="off">

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

const io = new Server(server, {
  maxHttpBufferSize: 1e9,
})

let historialMensajes = []
const usuariosActivos = new Map()

function emitirEstadoChat() {
  io.emit('estadoChat', {
    usuariosConectados: usuariosActivos.size,
  })
}


function emitirEstadoChat() {
  const ahora = Date.now()
  const LIMITE_ACTIVO = 10000

  for (const [usuario, ultimaVez] of usuariosActivos.entries()) {
    if (ahora - ultimaVez > LIMITE_ACTIVO) {
      usuariosActivos.delete(usuario)
    }
  }

  io.emit('estadoChat', {
    usuariosConectados: usuariosActivos.size,
  })
}

setInterval(emitirEstadoChat, 3000)

io.on('connection', socket => {
  console.log('Usuario conectado')

  socket.emit('historial', historialMensajes)

  socket.on('mensaje', (mensaje, callback) => {
    const nuevoMensaje = {
      id: Date.now(),
      tipo: mensaje.tipo || 'texto',
      texto: mensaje.texto || '',
      archivo: mensaje.archivo || null,
      nombreArchivo: mensaje.nombreArchivo || null,
      mimeType: mensaje.mimeType || null,
      usuario: mensaje.usuario,
      estado: 'enviado',
      hora: new Date().toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      respuesta: mensaje.respuesta || null,
    }

    historialMensajes.push(nuevoMensaje)

    io.emit('mensaje', nuevoMensaje)
    socket.emit('estadoMensaje', {
      id: nuevoMensaje.id,
      estado: 'enviado',
    })
    if (callback) {
      callback({ ok: true })
    }
  })

  socket.on('disconnect', () => {
    if (socket.usuarioChat) {
      setTimeout(() => {
        emitirEstadoChat()
      }, 3000)
    }

    console.log('Usuario desconectado')
  })
  socket.on('vaciarChat', () => {
    historialMensajes = []

    io.emit('chatVaciado')
  })

  socket.on('escribiendo', usuario => {
    socket.broadcast.emit('usuarioEscribiendo', usuario)
  })

  socket.on('dejoDeEscribir', usuario => {
    socket.broadcast.emit('usuarioDejoDeEscribir', usuario)
  })

  socket.on('usuarioEnChat', usuario => {
    socket.usuarioChat = usuario
    usuariosActivos.set(usuario, Date.now())
    emitirEstadoChat()
  })

  socket.on('usuarioSaleChat', usuario => {
    usuariosActivos.delete(usuario)
    emitirEstadoChat()
  })
  socket.on('heartbeat', usuario => {
    socket.usuarioChat = usuario
    usuariosActivos.set(usuario, Date.now())
    emitirEstadoChat()
  })

  socket.on('mensajeEntregado', data => {
    const mensaje = historialMensajes.find(m => m.id === data.id)

    if (mensaje && mensaje.usuario !== data.usuario && mensaje.estado === 'enviado') {
      mensaje.estado = 'entregado'

      io.emit('estadoMensaje', {
        id: mensaje.id,
        estado: 'entregado',
      })
    }
  })

  socket.on('mensajeLeido', data => {
    const mensaje = historialMensajes.find(m => m.id === data.id)

    if (mensaje && mensaje.usuario !== data.usuario) {
      mensaje.estado = 'leido'

      io.emit('estadoMensaje', {
        id: mensaje.id,
        estado: 'leido',
      })
    }
  })

})

const PORT = process.env.PORT || 3000

server.listen(PORT, () => {
  console.log(`Servidor iniciado en puerto ${PORT}`)
})
