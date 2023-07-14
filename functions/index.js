const functions = require("firebase-functions");
const dotenv = require('dotenv');
dotenv.config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const session = require('express-session');
const saltRounds = 10;
const { encrypt, decrypt } = require('./crypto')

const app = express();

app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({ name: '__session', secret: process.env.SESSION_PASS, resave: false, saveUninitialized: true }));

const uri = "mongodb+srv://" + process.env.MONGO_USER + ":" + process.env.MONGO_PASSWORD + "@cluster0.fo2dm.mongodb.net/passmanDB";
mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });

const dataSchema = mongoose.Schema({
    Service: String,
    Username: String,
    Password: {
        iv: String,
        content: String
    }
});

const userSchema = mongoose.Schema({
    UserName: String,
    Password: String,
    Data: [dataSchema]
});

const User = mongoose.model("User", userSchema);

app.get("/", (req, res) => {
    if (!req.session.name) res.render("home");
    else res.redirect('/user');
});

app.get("/register", (req, res) => {
    if (!req.session.name) res.render("register");
    else res.redirect('/user');
});

app.get("/login", (req, res) => {
    if (!req.session.name) res.render("login");
    else res.redirect('/user');
});

app.get("/user", (req, res) => {
    // console.log(req.session);
    if (!req.session.name) {
        res.redirect("/");
    }
    else {
        User.findOne({ UserName: req.session.name }, (err, found) => {
            if (err) console.log(err);
            else {
                var Data = [];
                found.Data.forEach(data => {
                    const unitData = {
                        Service: data.Service,
                        Username: data.Username,
                        Password: decrypt(data.Password)
                    };
                    Data.push(unitData);
                });
                res.render("user", { user: `${req.session.name}`, items: Data });
            }
        });
    }
});

app.post("/", (req, res) => {
    if (req.body['button-register'] == '') {
        res.redirect("/register");
    }
    if (req.body['button-login'] == '') {
        res.redirect("/login");
    }
});

app.post("/register", (req, res) => {
    User.findOne({ UserName: req.body.newName }, (err, found) => {
        if (err) console.log(err);
        else if (found) {
            console.log("User already exists!");
            res.redirect("/register");
        }
        else {
            bcrypt.hash(req.body.newPassword, saltRounds, (err, hash) => {
                const newUser = new User({
                    UserName: req.body.newName,
                    Password: hash,
                    Data: []
                });
                newUser.save((err) => {
                    if (err) console.log(err);
                    else {
                        req.session.name = req.body.newName;
                        res.redirect("/user");
                    }
                });
            });
        }
    });
});

app.post("/login", (req, res) => {
    User.findOne({ UserName: req.body.Name }, (err, found) => {
        if (err) console.log(err);
        else if (found) {
            bcrypt.compare(req.body.Password, found.Password, (err, result) => {
                if (err) console.log(err);
                else if (result) {
                    req.session.name = found.UserName;
                    res.redirect("/user");
                }
                else {
                    console.log("Wrong Password!");
                    res.redirect("/login");
                }
            });
        }
        else {
            console.log("User doesn\'t exists!");
            res.redirect("/login");
        }
    });
});

app.post("/user", (req, res) => {
    if (req.body['button-delete'] == '') {
        var temp = [];
        User.findOne({ UserName: req.session.name }, (err, found) => {
            if (err) console.log(err);
            else if (found) {
                for (var i = 0; i < found.Data.length; i++) {
                    if (found.Data[i].Service === req.body.service && found.Data[i].Username === req.body.username && decrypt(found.Data[i].Password) === req.body.password)
                        continue;
                    temp.push(found.Data[i]);
                }
                User.findOneAndUpdate({ UserName: req.session.name }, { $set: { Data: temp } }, { new: true }, (err, updatedData) => {
                    if (err) console.log(err);
                    // else console.log(updatedData);
                });
            }
        });
    }
    else if (req.body['button-add'] == '') {
        if (req.body.service === '' || req.body.username === '' || req.body.password === '')
            console.log('Invalid data entry!');
        else {
            var t = [];
            t.push({ Service: req.body.service, Username: req.body.username, Password: encrypt(req.body.password) });
            // console.log(t);
            User.find({ UserName: req.session.name }, (err, data) => {
                if (data) {
                    var flag = true;
                    if (data[0].Data) {
                        data[0].Data.forEach(element => {
                            if (element.Service === t[0].Service && element.Username === t[0].Username)
                                flag = false;
                        });
                    }
                    if (flag === true) {
                        User.findOneAndUpdate({ UserName: req.session.name }, { $push: { Data: t } }, { new: true }, (err, updatedData) => {
                            if (err) console.log(err);
                            // else console.log(updatedData);
                        });
                    }
                    else {
                        console.log('Duplicate Data found!');
                    }
                }
                else {
                    console.log('No user found');
                }
            });

        }

    }
    else if (req.body['button-logout'] == '') {
        req.session.name = null;
    }
    setTimeout(() => { res.redirect("/user"); }, 500);
});

exports.app = functions.https.onRequest(app);
