import "dotenv/config";
import express from "express";
import jwt from "jsonwebtoken";
import cors from "cors";
import { MongoClient, ServerApiVersion, ObjectId } from "mongodb";

const app = express();
const port = process.env.PORT || 5000;

//  middleware
app.use(express.json());
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://gym-management-site.web.app",
      "https://gym-management-site.firebaseapp.com",
    ],
    credentials: true,
  })
);

const verifyToken = (req, res, next) => {
  console.log("Authorization Header:", req.headers.authorization);
  if (!req.headers.authorization) {
    return res.status(401).send({ message: "Unauthorized access" });
  }
  const token = req.headers.authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      console.error("JWT Error:", err);
      return res.status(401).send({ message: "Unauthorized access" });
    }
    console.log("Decoded Token:", decoded);
    req.decoded = decoded;
    next();
  });
};

// use verify admin after verifyToken
const verifyAdmin = async (req, res, next) => {
  const email = req.decoded.email;
  const query = { email: email };
  const user = await userCollection.findOne(query);
  const isAdmin = user?.role === "admin";
  if (!isAdmin) {
    return res.status(403).send({ message: "forbidden access" });
  }
  next();
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.p9odpl5.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    const userCollection = client.db("gym-site").collection("users");
    const reviewCollection = client.db("gym-site").collection("reviewData");
    const bookedTrainerCollection = client
      .db("gym-site")
      .collection("bookedTrainer");
    const forumCollection = client.db("gym-site").collection("forumData");
    const allTrainersCollection = client
      .db("gym-site")
      .collection("all-trainers");
    const trainersCollection = client
      .db("gym-site")
      .collection("bookedtrainers");
    const allclassesCollection = client
      .db("gym-site")
      .collection("all-classes");
    const newsletterSubscribersCollection = client
      .db("gym-site")
      .collection("newsletter-subscribers");
    const applyTrainersCollection = client
      .db("gym-site")
      .collection("applied-trainers");

    // jwt related api
    app.get("/users/role/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "Forbidden access" });
      }

      const query = { email };
      let user = await userCollection.findOne(query);

      if (!user) {
        return res.status(404).send({ message: "User not found" });
      }

      if (!user.role) {
        // Upsert the role to 'member' if it doesn't exist
        await userCollection.updateOne(query, { $set: { role: "member" } });
        user = await userCollection.findOne(query); // Re-fetch the updated user
      }

      const role = user.role;

      res.send({ role: role });
    });

    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    // users related api
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exists", insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    // users related api
    app.get("/review/data", async (req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result);
    });

    app.get("/latest/forum", async (req, res) => {
      const cursor = forumCollection.find();
      const result = await cursor.limit(6).toArray();
      res.send(result);
    });

    // Define POST route to handle newsletter subscription
    app.post("/subscribe", async (req, res) => {
      const data = req.body;
      const result = await newsletterSubscribersCollection.insertOne(data);
      res.send(result);
    });
    // get newsletter subscribers information
    app.get("/subscribers", async (req, res) => {
      const result = await newsletterSubscribersCollection.find().toArray();
      res.send(result);
    });

    // get all trainer
    app.get("/trainers", async (req, res) => {
      const result = await allTrainersCollection.find().toArray();
      res.send(result);
    });

    app.get("/trainers/:name", async (req, res) => {
      const name = req.params.name;
      const trainer = await allTrainersCollection.findOne({ name });
      if (trainer) {
        res.send(trainer);
      } else {
        res.status(404).send({ message: "Trainer not found" });
      }
    });

    app.post("/apply-trainer", async (req, res) => {
      try {
        const trainerData = {
          fullName: req.body.fullName,
          email: req.body.email,
          age: req.body.age,
          profileImage: req.body.profileImage, // image URL
          skills: req.body.skills,
          availableDays: req.body.availableDays,
          availableTime: req.body.availableTime,
          status: req.body.status,
        };

        const result = await applyTrainersCollection.insertOne(trainerData);
        res.status(200).send(result);
      } catch (error) {
        res.status(500).send({
          message: "There was an error submitting the application.",
          error,
        });
      }
    });
    app.get("/get-trainers", async (req, res) => {
      const result = await applyTrainersCollection.find().toArray();
      try {
        res.send(result);
      } catch {
        res.status(404).send({ message: "Trainer not found" });
      }
    });

    // Route to fetch trainer details by ID

    app.get("/applied-trainers/:id", async (req, res) => {
      const { id } = req.params;

      try {
        let query = { _id: new ObjectId(id) }; // Ensure ObjectId is used correctly
        const results = await applyTrainersCollection.findOne(query);

        res.send(results);
      } catch (error) {
        console.error("Error fetching trainer details:", error);
        res.status(500).json({ message: "Internal Server Error" });
      }
    });

    app.get("/classes", async (req, res) => {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 6; // Default limit is 6 classes per page
      const skip = (page - 1) * limit;

      try {
        const cursor = allclassesCollection.find().skip(skip).limit(limit);
        const totalCount = await allclassesCollection.countDocuments();
        const totalPages = Math.ceil(totalCount / limit);

        const result = await cursor.toArray();
        const pagination = {
          currentPage: page,
          totalPages: totalPages,
          hasMore: page < totalPages,
        };

        res.send({ data: result, pagination: pagination });
      } catch (error) {
        res
          .status(500)
          .send({ message: "Internal Server Error", error: error });
      }
    });

    app.get("/forum", async (req, res) => {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 6; // Default limit is 6 posts per page
      const skip = (page - 1) * limit;

      try {
        const cursor = forumCollection.find().skip(skip).limit(limit);
        const totalCount = await forumCollection.countDocuments();
        const totalPages = Math.ceil(totalCount / limit);

        const result = await cursor.toArray();
        const pagination = {
          currentPage: page,
          totalPages: totalPages,
          hasMore: page < totalPages,
        };

        res.send({ posts: result, pagination: pagination });
      } catch (error) {
        res
          .status(500)
          .send({ message: "Internal Server Error", error: error });
      }
    });

    // Route to handle upvoting a post
    app.patch("/posts/:postId/upvote", async (req, res) => {
      const { postId } = req.params;

      const query = { _id: new ObjectId(postId) };
      try {
        await forumCollection.updateOne(query, { $inc: { upVotes: 1 } });
        // Find the service after incrementing views
        const service = await forumCollection.findOne(query);

        // If service doesn't exist, return 404
        if (!service) {
          return res.status(404).send("Service not found");
        }
        res.send(service);
      } catch (err) {
        // Handle errors
        res.status(500).send(err);
      }
    });

    // Route to handle downvoting a post
    app.patch("/posts/:postId/downvote", async (req, res) => {
      const { postId } = req.params;

      const query = { _id: new ObjectId(postId) };
      try {
        await forumCollection.updateOne(query, { $inc: { downVotes: 1 } });
        // Find the service after incrementing views
        const service = await forumCollection.findOne(query);

        // If service doesn't exist, return 404
        if (!service) {
          return res.status(404).send("Service not found");
        }
        res.send(service);
      } catch (err) {
        // Handle errors
        res.status(500).send(err);
      }
    });

    // Payment and booked trainer
    app.post("/payment", async (req, res) => {
      const data = req.body;
      const result = await bookedTrainerCollection.insertOne(data);
      res.send(result);
    });

    // find trainers
    app.get("/trainer", async (req, res) => {
      try {
        const query = { role: "trainer" };
        // Query to find all documents where the role field is "trainer"
        const trainers = await userCollection.find(query).toArray(); // Corrected

        // Send the trainers data as a response
        res.send(trainers);
      } catch (error) {
        console.error("Error fetching trainers:", error);
        res.status(500).json({ message: "Internal Server Error" });
      }
    });

    // update role
    app.patch("/updaterole", async (req, res) => {
      const userInfo = req.body;
      const filter = { email: userInfo.email };
      const updateDoc = {
        $set: {
          role: "member",
        },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.get("/", (req, res) => {
      res.send("Hello World!");
    });

    app.listen(port, () => {
      console.log(`Example app listening on port ${port}`);
    });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // Uncomment the following line in production to ensure the MongoDB client closes
    // await client.close();
  }
}
run().catch(console.dir);
