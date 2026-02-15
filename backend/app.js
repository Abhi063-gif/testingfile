const express = require("express");
const morgan = require("morgan");
const routes = require("./routes/index")
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const bodyParser = require("body-parser");
var cors = require("cors");
const xss = require("xss");

const app = express();
app.use(
  express.json({
    limit: "10kb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
  })
);

app.use(mongoSanitize());

//   app.use(xss());

app.use(
  cors({
    origin: function(origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      // Allow all origins for development
      callback(null, true);
    },
    methods: ["GET", "PATCH", "POST", "DELETE", "PUT"],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(helmet());


const path = require("path");

app.use(express.static(path.join(__dirname, "public")));

app.use(routes)

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

const limiter = rateLimit({
  max: 3000,
  windowMs: 60 * 60 * 1000, //1 hour,
  message: "Too many request from this IP, Please try again in an hour",
});
app.use("/tawk", limiter);

module.exports = app;
