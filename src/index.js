const config = require("../config.json");
const express = require("express");
const ws = require("ws");

const app = express();
const server = new ws.Server({ port: config.wsPort });

var playerId = 0;
var players = [];

function close_player(player) {
    console.log(player.toString(), "disconnected");
    var idx = players.indexOf(player);
    if (idx != -1) delete players[idx];
}

class Player {
    constructor(socket, id) {
        this.id = id;
        this.socket = socket;
        this.playerData = {};

        var self = this;
        this.socket.on("message", (msg) => {
            self.message(msg);
        });

        this.socket.on("error", () => {
            close_player(this);
        });

        this.color = "#ffffff";
        this.username = `Anon${this.id}`;

        this.socket.send(
            JSON.stringify({
                type: "onboard",
                data: {
                    id: this.id,
                    username: this.username
                }
            })
        );

        this.position = { x: 0, y: 0, a: 0 };
    }

    toString() {
        return `Player(id: ${this.id})`;
    }

    message(msg) {
        try {
            var packet = JSON.parse(msg);

            if (packet.type == "position") {
                this.position = packet.data;
            }

            if (packet.type == "meta") {
                console.log("meta", packet);
                this.playerData = packet.data;
                if (!this.playerData.username)
                    this.playerData.username = `Anon${this.id}`;
            }
        } catch (e) {
            return;
        }
    }
}

server.on("connection", (socket) => {
    var player = new Player(socket, playerId);
    playerId++;

    players.push(player);
    console.log(player.toString(), "connected");
});

setInterval(() => {
    var data = [];
    players.forEach((player) => {
        data.push({
            x: player.position.x,
            y: player.position.y,
            a: player.position.a,
            id: player.id,
            playerData: player.playerData
        });
    });

    players.forEach((player) => {
        if (player.socket.readyState == 3) {
            close_player(player);
        } else {
            player.socket.send(
                JSON.stringify({
                    type: "gamestate",
                    data: data
                })
            );
        }
    });
}, 1000 / config.tps);

app.use(express.static("static"));

app.get("/websocket", (req, res) => {
    res.send(`${config.protocol}://${config.domain}:${config.wsPort}`);
});

app.on("upgrade", (request, socket, head) => {
    server.handleUpgrade(request, socket, head, (socket) => {
        server.emit("connection", socket, request);
    });
});

app.listen(config.httpPort, () => {
    console.log(`Server listening at http://localhost:${config.httpPort}`);
});
