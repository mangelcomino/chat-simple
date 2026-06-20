const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let historialMensajes = [];

io.on("connection", (socket) => {
    console.log("Usuario conectado");

    socket.emit("historial", historialMensajes);

    socket.on("mensaje", (mensaje) => {
        const nuevoMensaje = {
            id: Date.now(),
            texto: mensaje.texto,
            usuario: mensaje.usuario,
            hora: new Date().toLocaleTimeString("es-ES", {
                hour: "2-digit",
                minute: "2-digit"
            })
        };

        historialMensajes.push(nuevoMensaje);

        if (historialMensajes.length > 100) {
            historialMensajes.shift();
        }

        io.emit("mensaje", nuevoMensaje);
    });

    socket.on("disconnect", () => {
        console.log("Usuario desconectado");
    });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`Servidor iniciado en puerto ${PORT}`);
});