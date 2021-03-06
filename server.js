var mongoose = require("mongoose");
var logger = require("morgan");
var exphbs = require("express-handlebars");
var axios = require("axios");
var cheerio = require("cheerio");
var path = require('path');
var express = require("express");
var app = express();

var db = require("./models");

var Article = require("./models/Article.js");
var Note = require("./models/Note.js");

var PORT = 8080;

// Configure middleware

// Use morgan logger for logging requests
app.use(logger("dev"));
// Parse request body as JSONcd
app.use(express.urlencoded({ extended: true }));
app.use(express.json());


// Make public a static folder
app.use(express.static("public"));

// Set Handlebars as the default templating engine.
app.engine("handlebars", exphbs({ defaultLayout: "main" }));
app.set("view engine", "handlebars");


// Connect to the Mongo DB


var MONGODB_URI = process.env.MONGODB_URI || "mongodb://user:passwordk9@ds261238.mlab.com:61238/heroku_g78vxsjd"
mongoose.connect(MONGODB_URI, { useNewUrlParser: true });


// // Routes

// A GET route for scraping ABlogToWatchWebsite website
app.get("/scrape", function(req, res) {
  // First, we grab the body of the html with axios
  axios.get("https://www.ablogtowatch.com/?gclid=Cj0KCQjw2efrBRD3ARIsAEnt0eijMRkFYzRPnXDG0TacA1PxEYZwA_umgcvQ1psqf3AUKCxy7ZjlbXwaAnR1EALw_wcB").then(function(response) {
    // Then, we load that into cheerio and save it to $ for a shorthand selector
    var $ = cheerio.load(response.data);

    // Now, we grab every h2 within an article tag, and do the following:
    $("article h2").each(function(i, element) {
      // Save an empty result object
      var result = {};

      // Add the text and href of every link, and save them as properties of the result object   ============
      result.title = $(this)
        .children("a")
        .text();
      result.link = $(this)
        .children("a")
        .attr("href");
      
      // Create a new Article using the `result` object built from scraping
      db.Article.create(result)
        .then(function(dbArticle) {
          // View the added result in the console
          console.log(dbArticle);
        })
        .catch(function(err) {
          // If an error occurred, log it
          console.log(err);
        });
    });
     res.redirect("/");
  });
});


// Route for getting all Articles from the db
app.get("/", function(req, res){
  db.Article.find({})
  .then(function(dbArticle) {
    // If we were able to successfully find Articles, send them back to the client
    res.render("partials/note.handlebars", {article: dbArticle});
  })
  .catch(function(err) {
    // If an error occurred, send it to the client
    res.json(err);
  });
});



// Route for getting all Articles from the db
app.get("/articles", function(req, res) {
  // Grab every document in the Articles collection
  db.Article.find({})
    .then(function(dbArticle) {
      // If we were able to successfully find Articles, send them back to the client
      res.json(dbArticle);
    })
    .catch(function(err) {
      // If an error occurred, send it to the client
      res.json(err);
    });
  });

app.get("/articles-json", function(req, res) {
  Article.find({}, function(err, doc) {
    if (err) {
      console.log(err);
    } else {
      res.json(doc);
    }
  });
});


app.get("/readArticle/:id", function(req, res) {
  var articleId = req.params.id;
  var hbsObj = {
    article: [],
    body: []
  };

  Article.findOne({ _id: articleId })
    .populate("note")
    .exec(function(err, doc) {
      if (err) {
        console.log("Error: " + err);
      } else {
        hbsObj.article = doc;
        var link = doc.link;
        request(link, function(error, response, html) {
          var $ = cheerio.load(html);

          $(".l-col__main").each(function(i, element) {
            hbsObj.body = $(this)
              .children(".c-entry-content")
              .children("p")
              .text();

            res.render("article", hbsObj);
            return false;
          });
        });
      }
    });
});

// Route for grabbing a specific Article by id, populate it with it's note
app.get("/article/:id", function(req, res) {
  // Using the id passed in the id parameter, prepare a query that finds the matching one in our db...
  db.Article.findOne({ _id: req.params.id })
    // ..and populate all of the notes associated with it
    .populate("note")
    .then(function(dbArticle) {
      // If we were able to successfully find an Article with the given id, send it back to the client
      res.json(dbArticle);
    })
    .catch(function(err) {
      // If an error occurred, send it to the client
      res.json(err);
    });
});

// Route for saving/updating an Article's associated Note
app.post("/article/:id", function(req, res) {
  // Create a new note and pass the req.body to the entry
  db.Note.create(req.body)
    .then(function(dbNote) {
      // If a Note was created successfully, find one Article with an `_id` equal to `req.params.id`. Update the Article to be associated with the new Note
      // { new: true } tells the query that we want it to return the updated User -- it returns the original by default
      // Since our mongoose query returns a promise, we can chain another `.then` which receives the result of the query
      return db.Article.findOneAndUpdate({ _id: req.params.id }, { Note: dbNote._id }, { new: true });
    })
    .then(function(dbArticle) {
      // If we were able to successfully update an Article, send it back to the client
      res.json(dbArticle);
    })
    .catch(function(err) {
      // If an error occurred, send it to the client
      res.json(err);
    });
});



// Start the server
app.listen(process.env.PORT || PORT, function() {
  console.log("App running on port " + PORT + "!");
})
