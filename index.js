const express = require("express");
const app = express();
const cors = require("cors");
const admin = require("firebase-admin");
require("dotenv").config();
const { MongoClient } = require("mongodb");

const ObjectId = require("mongodb").ObjectId;

const port = process.env.PORT || 5000;

// Firebase admin SDK
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

// middleware
app.use(cors());
app.use(express.json());

// Connection to the cluster
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ihos6.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

async function verifyToken(req, res, next) {
    if (req.headers?.authorization?.startsWith("Bearer ")) {
        const token = req.headers.authorization.split(" ")[1];

        try {
            const decodedUser = await admin.auth().verifyIdToken(token);
            req.decodedEmail = decodedUser.email;
        } catch {}
    }
    next();
}

async function run() {
    try {
        await client.connect();
        const database = client.db("MotoBet");
        const motorcyclesCollection = database.collection("motorcycles");
        const ordersCollection = database.collection("orders");
        const usersCollection = database.collection("users");
        const feedbackCollection = database.collection("feedback");

        // Getting orders with email
        app.get("/orders", async (req, res) => {
            const email = req.query.email;
            let query = {};
            if (email) {
                query = { email: email };
            }
            const cursor = ordersCollection.find(query);
            const orders = await cursor.toArray();
            res.json(orders);
        });

        // Posting orders
        app.post("/orders", async (req, res) => {
            const order = req.body;
            const result = await ordersCollection.insertOne(order);
            res.json({ result });
        });

        // Deleting orders
        app.delete("/deleteOrder/:id", async (req, res) => {
            const id = req.params.id;
            const item = {
                _id: ObjectId(id)
            };
            const result = await ordersCollection.deleteOne(item);
            res.send(result);
        });

        // Update order status
        app.put("/updateOrder/:id", async (req, res) => {
            const id = req.params.id;
            const status = req.body;
            const filter = { _id: ObjectId(id) };
            const options = { upsert: true };
            const updateDoc = {
                $set: status
            };
            const result = await ordersCollection.updateOne(
                filter,
                updateDoc,
                options
            );
            res.json(result);
        });

        // Getting Motorcycles
        app.get("/motorcycles", async (req, res) => {
            const queryHome = req.query.cap;
            let query = 0;
            if (queryHome) {
                query = parseInt(queryHome);
            }
            const cursor = motorcyclesCollection.find({}).limit(query);
            const motorcycles = await cursor.toArray();
            res.send(motorcycles);
        });

        // Adding Motorcycle
        app.post("/motorcycles", async (req, res) => {
            const motorcycle = req.body;
            const result = await motorcyclesCollection.insertOne(motorcycle);
            res.json(result);
        });

        // Deleting Motorcycle
        app.delete("/deleteMotorcycle/:id", async (req, res) => {
            const id = req.params.id;
            const item = {
                _id: ObjectId(id)
            };
            const result = await motorcyclesCollection.deleteOne(item);
            res.send(result);
        });

        // User Adding
        app.post("/users", async (req, res) => {
            const user = req.body;
            const result = await usersCollection.insertOne(user);
            res.json(result);
        });

        // Update or insert user
        app.put("/users", async (req, res) => {
            const user = req.body;
            const filter = { email: user.email };
            const options = { upsert: true };
            const updateDoc = { $set: user };
            const result = await usersCollection.updateOne(
                filter,
                updateDoc,
                options
            );
            res.json(result);
        });

        // Making admin
        app.put("/users/admin", verifyToken, async (req, res) => {
            const user = req.body;
            const requester = req.decodedEmail;
            if (requester) {
                const requesterAccount = await usersCollection.findOne({
                    email: requester
                });
                if (requesterAccount.role === "admin") {
                    const filter = { email: user.email };
                    const updateDoc = { $set: { role: "admin" } };
                    const result = await usersCollection.updateOne(
                        filter,
                        updateDoc
                    );
                    res.json(result);
                }
            } else {
                res.status(403).json({
                    message: "You do not have permission to make admin"
                });
            }
        });

        // Checking Admin State
        app.get("/users/:email", async (req, res) => {
            const email = req.params.email;
            const query = { email };
            const user = await usersCollection.findOne(query);
            let isAdmin = false;
            if (user?.role === "admin") {
                isAdmin = true;
            }
            res.json({ admin: isAdmin });
        });

        // Adding Feedback
        app.post("/feedback", async (req, res) => {
            const feedback = req.body;
            const result = await feedbackCollection.insertOne(feedback);
            res.json(result);
        });

        // Getting Feedback
        app.get("/feedback", async (req, res) => {
            const cursor = feedbackCollection.find({});
            const feedback = await cursor.toArray();
            res.send(feedback);
        });
    } finally {
        // await client.close
    }
}
run().catch(console.dir);

app.get("/", (req, res) => {
    res.send("Running Server");
});

app.listen(port, () => {
    console.log("Running server on Port", port);
});
