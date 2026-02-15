const dotenv = require("dotenv")
dotenv.config({
  path: "./config.env"
})
const mongoose = require('mongoose');
const app = require("./app");

const { Server } = require("socket.io");

process.on("uncaughtException", (err) => {
  console.log(err);
  process.exit(1);
});

const http = require("http");
const { sendEmail } = require("./services/mailer");
const User = require("./models/user");

const path = require("path");

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  }
})

const DB = process.env.DBURI.replace("<db_password>", process.env.DBPASSWORD)

mongoose.connect(DB)
  .then((con) => {
    console.log("DB is connected");
  })
  .catch((err) => {
    console.log(err);
  });




const port = process.env.PORT || 8000;

server.listen(port, "0.0.0.0", () => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`✅ Backend Server is running on PORT: ${port}`);
  console.log(`✅ Listening on: 0.0.0.0:${port}`);
  console.log(`✅ Network accessible at: http://<YOUR_LOCAL_IP>:${port}`);
  console.log(`✅ For debugging: http://192.168.1.65:${port}`);
  console.log(`${'='.repeat(60)}\n`);

  // Start Cron Jobs
  require('./cron/certificateCron')();
});







process.on("unhandledRejection", (err) => {
  console.log(err);
  server.close(() => {
    process.exit(1);
  });
});



