const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const port = 3000;
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
require("dotenv").config();
var MongoDBStore = require('connect-mongodb-session')(session);

const lodash = require("lodash");
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/images");
  },

  filename: (req, file, cb) => {
    console.log(file);
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage: storage });
const homeStartingContent =
  "Burada eklediğin kişiler ve tipleri gözükecektir yukaridaki ekle butonundan yeni kişiler ekleyebilir ya da ara butonundan istediğin kişiyi görebilirsin ";

const app = express();
app.set("view engine", "ejs");

var store = new MongoDBStore({
  uri: process.env.DATABASE_CONNECTION,
  collection: 'mySessions'
});

// Catch errors
store.on('error', function(error) {
  console.log(error);
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static("public"));
app.use(
  session({
    secret: process.env.SECRET,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7 // 1 week
    },
    store: store,
    resave: true,
    saveUninitialized: true,
  })
);

app.use(passport.initialize());
app.use(passport.session());

const { isMainThread } = require("worker_threads");
const { userInfo } = require("os");


mongoose.set("strictQuery", true);
mongoose.connect(process.env.DATABASE_CONNECTION, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const userSchema = new mongoose.Schema({
  username: String,
  password: String,
});

userSchema.plugin(passportLocalMongoose);

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

function escapeRegex(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

const personSchema = new mongoose.Schema({
  name: {
    required: true,
    type: String,
  },
  type: {
    required: true,
    type: String,
  },
  reviews: [{ review: String, author: String }],
  img: String,
});

const Person = mongoose.model("Person", personSchema);
app.get("/", function (req, res) {
  res.render("login");
});

app.post("/", function (req, res) {
  const user = new User({
    username: req.body.username,
    password: req.body.password,
  });

  req.login(user, function (err) {
    if (err) {
      console.log(err);
    } else {
      passport.authenticate("local")(req, res, function () {
        res.redirect("/home");
      });
    }
  });
});



app.get("/home", function (req, res) {
  if (req.isAuthenticated()) {
    if (req.query.search) {
      const regex = new RegExp(escapeRegex(req.query.search), "gi");
      Person.find({ name: regex }, function (err, foundPosts) {
        var noMatch;
        if (foundPosts.length < 1) {
          var noMatch = "Böyle biri sistemde yok oluşturmayı deneyebilirsin";
          startingContent = undefined;
        }
        res.render("home", {
          startingContent: homeStartingContent,
          posts: foundPosts,
          noMatch: noMatch,
        });
      });
    } else {
      var noMatch;
      Person.find({}, function (err, foundPosts) {
        res.render("home", {
          startingContent: homeStartingContent,
          posts: foundPosts,
          noMatch: noMatch,
        });
      });
    }
  } else {
    res.redirect("/");
  }
});

app.get("/char/:charID", function (req, res) {
  if (req.isAuthenticated()) {
    const requestedID = req.params.charID;

    Person.findOne({ _id: requestedID }, function (err, char) {
      res.render("char", { char: char });
    });
  } else {
    res.redirect("/");
  }
});

app.get("/compose", function (req, res) {
  if (req.isAuthenticated()) {
    res.render("compose");
  } else {
    res.redirect("/");
  }
});

app.get("/compose/update", function (req, res) {
  if (req.isAuthenticated()) {
    const requestedID = req.query.updatedChar;
    Person.findOne({ _id: requestedID }, function (err, char) {
      res.render("composeupdate", { char: char });
    });
  } else {
    res.redirect("/");
  }
});

app.post(
  "/compose/update/:charID",
  upload.single("image"),
  function (req, res) {
    if (req.isAuthenticated()) {
      Person.findOne({ _id: req.body.updatedChar }, function (err, foundChar) {
        if (req.body.charName !== undefined) {
          foundChar.name = lodash.capitalize(req.body.charName);
        }
        if (req.body.charType !== undefined) {
          foundChar.type = req.body.charType;
        }
        if (req.file && req.file.originalname) {
          if (foundChar.img !== "/images/default.jpeg") {
            let filePath = "./public" + foundChar.img;
            fs.unlink(filePath, function (err) {
              if (err) {
                console.log(err);
              }
            });
          }
          foundChar.img = req.file.path.replace("public", "");
        }
        foundChar.save(function (err) {
          if (!err) {
            res.redirect("/char/" + req.body.updatedChar);
          }
        });
      });
    } else {
      res.redirect("/");
    }
  }
);

app.post("/compose", upload.single("image"), function (req, res) {
  if (req.isAuthenticated()) {
    const newPost = new Person({
      name: lodash.capitalize(req.body.charName),
      type: req.body.charType,
      reviews: [],
      img: "/images/default.jpeg",
    });
    if (req.file && req.file.originalname)
      newPost.img = req.file.path.replace("public", "");
    newPost.save(function (err) {
      if (!err) {
        res.redirect("/home");
      }
    });
  } else {
    res.redirect("/");
  }
});

app.post("/char/delete/:charID", function (req, res) {
  if (req.isAuthenticated()) {
    if (req.body.deletedImg !== "/images/default.jpeg") {
      let filePath = "./public" + req.body.deletedImg;
      fs.unlink(filePath, function (err) {
        if (err) {
          console.log(err);
        }
      });
    }
    Person.deleteOne({ _id: req.body.deletedChar }, function (err) {
      res.redirect("/home");
    });
  } else {
    res.redirect("/");
  }
});

app.post("/char/addcomment/:charID", function (req, res) {
  if (req.isAuthenticated()) {
    Person.updateOne(
      { _id: req.body.commentedChar },
      {
        $push: {
          reviews: {
            review: req.body.addedComment,
            author: lodash.capitalize(req.user.username),
          },
        },
      },
      { new: true },
      function (err) {
        if (!err) {
          res.redirect("/char/" + req.body.commentedChar);
        } else {
          console.log("bu error");
          console.log(err);
        }
      }
    );
  } else {
    res.redirect("/");
  }
});




app.listen(process.env.PORT || port, function () {
  console.log("Server started on port 3000");
});
