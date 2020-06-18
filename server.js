const express = require("express");
const app = express();
const cors = require("cors");
const mongoose = require("mongoose");
const moment = require("moment");

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

app.use(cors());
// Parse POST body & JSON data
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Serve the HTMl + CSS
app.use(express.static("public"));
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/views/index.html");
});

// Subdocument schema for userSchema
const exerciseSchema = new mongoose.Schema({
  description: { type: String, required: true },
  duration: { type: Number, required: true },
  date: String
});

// New users schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  exercise: [exerciseSchema],
  count: Number
});

const User = mongoose.model("User", userSchema);

// Post a new user to database
app.post("/api/exercise/new-user", async function(req, res) {
  const username = req.body.username;
  try {
    let user = await User.findOne({ username: username });
    if (user) {
      res.json("Username already in use");
    } else {
      user = new User({
        username: username
      });
      await user.save();
      res.json({ username: user.username, _id: user._id });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json("No username provided");
  }
});

// List all users in database
app.get("/api/exercise/users", async function(req, res) {
  try {
    let users = await User.find({}, "username _id");
    res.json(users);
  } catch (err) {
    res.status(400).json(err.message || "Internal Server Error");
  }
});

// Post exercise description, duration and date (optional, specific format) to a user
app.post("/api/exercise/add", async function(req, res) {
  const { userId: id, description, duration } = req.body;

  let date = req.body.date;
  const validDate = moment(date, "YYYY-MM-DD").isValid();

  if (!date) {
    date = moment(new Date()).format("YYYY-MM-DD");
  } else if (!validDate) {
    return res.status(400).json("Please provide date as indicated");
  }

  try {
    const user = await User.findById(id);
    const exerciseCount = user.exercise.length;
    user.exercise.push({
      description: description,
      duration: duration,
      date: date
    });
    user.count = exerciseCount + 1;
    await user.save();
    res.json({
      username: user.username,
      _id: user._id,
      description: description,
      duration: duration,
      date: date
    });
  } catch (err) {
    console.log(err);
    res
      .status(400)
      .json(err.message || "Please complete the fields as specified");
  }
});

app.get("/api/exercise/log/:userId", async function(req, res) {
  const id = req.params.userId;
  try {
    const user = await User.findById(id);
    res.json(user);
  } catch (err) {
    res.status(400).json("No such user in database");
  }
});

app.get("/api/exercise/log", async function(req, res) {
  const id = req.query.userId;
  let from;
  let to;
  if (req.query.from && req.query.to) {
    from = new Date(req.query.from);
    to = new Date(req.query.to);
  }
  const limit = req.query.limit;
  console.log(from, to, limit);
  let exercisesArray;
  try {
    const user = await User.findById(id);
    if (from && to && limit) {
      return res.json("Select date or limit filter");
    } else if (from && to) {
      exercisesArray = user.exercise.filter(item => {
        let date = new Date(item.date);
        return date >= from && date <= to});
    } else if (limit) {
      exercisesArray = user.exercise.slice(0, +limit);
    }
    res.json({
      username: user.username,
      _id: user._id,
      exercise: exercisesArray
    });
  } catch (err) {
    res.status(400).json(err.message || "Internal Server Error");
  }
});

// Not found middleware
app.use((req, res, next) => {
  return next({ status: 404, message: "not found" });
});

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage;

  if (err.errors) {
    // mongoose validation error
    errCode = 400; // bad request
    const keys = Object.keys(err.errors);
    // report the first validation error
    errMessage = err.errors[keys[0]].message;
  } else {
    // generic or custom error
    errCode = err.status || 500;
    errMessage = err.message || "Internal Server Error";
  }
  res
    .status(errCode)
    .type("txt")
    .send(errMessage);
});

const listener = app.listen(process.env.PORT || 3000, () => {
  // console.log('Your app is listening on port ' + listener.address().port)
});
