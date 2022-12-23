const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const port = 3000;
const multer = require("multer")
const path = require("path")
const fs = require("fs")
const lodash =require("lodash")
const storage = multer.diskStorage({
  destination: (req, file, cb) =>{
    cb(null, "public/images")
  },

  filename: (req, file, cb) =>{
    console.log(file)
    cb(null, Date.now() + path.extname(file.originalname))
  }
})

const upload = multer({storage: storage})


const homeStartingContent = "Burada eklediğin kişiler ve tipleri gözükecektir yukaridaki ekle butonundan yeni kişiler ekleyebilir ya da ara butonundan istediğin kişiyi görebilirsin ";

const app = express();
const _ = require("lodash");
const { isMainThread } = require("worker_threads");
const { userInfo } = require("os");

// mongodb://localhost:27017/MBTIDB
// mongodb+srv://admin:test123@todolist.ac9ps0o.mongodb.net/todolistDB
mongoose.set("strictQuery", true);
mongoose.connect("mongodb+srv://admin:test123@todolist.ac9ps0o.mongodb.net/todolistDB", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

function escapeRegex(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
};

app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json())
app.use(express.static("public"));

const personSchema = new mongoose.Schema({
  name: {
    required: true,
    type: String,
  },
  type : {
    required: true,
    type: String
  },
  reviews: [{review:String}],
  img: String
});

const Person = mongoose.model("Person", personSchema);



app.get("/", function(req, res){
  if(req.query.search){
    const regex = new RegExp(escapeRegex(req.query.search), 'gi');
    Person.find({name:regex}, function(err, foundPosts){
      var noMatch;
      if(foundPosts.length < 1){
        var noMatch = "Böyle biri sistemde yok oluşturmayı deneyebilirsin"
        startingContent = undefined;
      }
      res.render("home", {
        startingContent: homeStartingContent,
        posts: foundPosts,
        noMatch: noMatch
      })}); 
  }else{
    var noMatch;
  Person.find({}, function(err, foundPosts){
    res.render("home", {
      startingContent: homeStartingContent,
      posts: foundPosts,
      noMatch: noMatch
      }); 
  })};
})


app.get("/char/:charID", function(req,res){
  const requestedID = req.params.charID;

  Person.findOne({_id: requestedID}, function(err, char){
    res.render("char", {char:char});
  });
});


app.get("/compose", function(req, res){
  res.render("compose");
})

app.get("/compose/update", function(req, res){
  const requestedID = req.query.updatedChar
  Person.findOne({_id: requestedID}, function(err, char){
    res.render("composeupdate",{char:char});
  });
})

app.post("/compose/update/:charID", upload.single("image"),function(req,res){
  Person.findOne({_id:req.body.updatedChar}, function(err, foundChar){
    if(req.body.charName !== undefined){
      foundChar.name = lodash.capitalize(req.body.charName)
    }
    if(req.body.charType !== undefined){
      foundChar.type = req.body.charType
    }
    if(req.file && req.file.originalname){
      if (foundChar.img !== "/images/default.jpeg"){
      console.log("calisti")
      let filePath = "./public" +foundChar.img
      fs.unlink(filePath,function(err){
        if(err){
          console.log(err)
        }
        
      })}
      foundChar.img = req.file.path.replace("public","")

      }
    foundChar.save(function(err){
      if(!err){
        res.redirect("/char/" + req.body.updatedChar)
      }
    })

  })
});



app.post("/compose", upload.single("image"),function(req,res){

  const newPost = new Person({
    name: lodash.capitalize(req.body.charName),
    type : req.body.charType,
    reviews: [],
    img: "/images/default.jpeg"
  });
  if(req.file && req.file.originalname) newPost.img = req.file.path.replace("public","");
  newPost.save(function(err){
    if(!err){
      res.redirect("/");
    }
  });
})

app.post("/char/delete/:charID", function(req,res){
  Person.deleteOne({_id:req.body.deletedChar}, function(err){
    res.redirect("/")
  })
});

app.post("/char/addcomment/:charID", function(req,res){
  Person.updateOne(
    {_id:req.body.commentedChar},
    { $push: { reviews: {review:req.body.addedComment} } }, 
    {new:true},
    function(err){
      if(!err){
        res.redirect("/char/" + req.body.commentedChar)
      } else{
        console.log(err)
      }
    })
})


app.listen(process.env.PORT || port, function() {
  console.log("Server started on port 3000");
});
