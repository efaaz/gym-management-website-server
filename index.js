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
    const slotsCollection = client
      .db("gym-site")
      .collection("slots-collection");

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

    app.get("/search-by-photo", async (req, res) => {
      const { photoUrl } = req.query;

      // Implement logic to find matching document in database based on photoUrl
      try {
        // Example MongoDB query
        const trainer = await allTrainersCollection.findOne({
          photo: photoUrl,
        });

        if (!trainer) {
          return res.status(404).json({ message: "Trainer not found" });
        }

        res.json(trainer); // Send the matching document as JSON response
      } catch (error) {
        console.error("Error searching by photo:", error);
        res.status(500).json({ message: "Internal Server Error" });
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

    app.get("/classes", async (req, res) => {
      const { page = 1, limit = 6, search = "" } = req.query;
      const searchRegex = new RegExp(search, "i"); // Case-insensitive search regex
      const skip = (page - 1) * limit;

      try {
        const classes = await allclassesCollection
          .find({
            title: { $regex: searchRegex },
          })
          .skip(skip)
          .limit(parseInt(limit))
          .toArray();

        const totalClasses = await allclassesCollection.countDocuments({
          title: { $regex: searchRegex },
        });

        const hasMore = totalClasses > page * limit;

        res.json({ data: classes, pagination: { page, hasMore } });
      } catch (error) {
        console.error("Error fetching classes:", error);
        res.status(500).json({ message: "Internal Server Error" });
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
    app.get("/trainer", verifyToken, async (req, res) => {
      try {
        const query = { role: "trainer" };
        // Query to find all documents where the role field is "trainer"
        const trainers = await userCollection.find(query).toArray();
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
    app.get("/get-trainers", verifyToken, async (req, res) => {
      let query = { status: "pending" };
      const result = await applyTrainersCollection.find(query).toArray();
      try {
        res.send(result);
      } catch {
        res.status(404).send({ message: "Trainer not found" });
      }
    });
    // Route to fetch applied trainer details by ID

    app.get("/applied-trainers/:id", verifyToken, async (req, res) => {
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

    // update the status to Trainer
    // app.put("/update-trainer-status/:id", async (req, res) => {
    //   const { id } = req.params;
    //   const { status } = req.body;

    //   try {
    //     // Find the applied trainer by ID
    //     const query = { _id: ObjectId(id) };
    //     const trainer = await applyTrainersCollection.findOne(query);

    //     // If the status is confirmed, update the user's role in the user collection
    //     if (status === "confirmed") {
    //       await userCollection.updateOne(
    //         { email: trainer.email },
    //         { $set: { role: "trainer" } }
    //       );
    //     }

    //     // Remove the trainer from the applied trainers collection
    //     await applyTrainersCollection.deleteOne(query);

    //     res.send({ message: "Trainer status updated successfully" });
    //   } catch (error) {
    //     console.error("Error updating trainer status:", error);
    //     res.status(500).json({ message: "Internal Server Error" });
    //   }
    // });

    app.put("/update-trainer-status/:id", async (req, res) => {
      const { id } = req.params;
      const { status, feedback, email } = req.body;
      try {
        const query1 = { _id: new ObjectId(id) };
        const options = { upsert: true };
        const query2 = { email: email };
        const update1 = { $set: { status, feedback } };
        const update2 = { $set: { role: "trainer" } };

        // Update the trainer's status and feedback
        const result1 = await applyTrainersCollection.updateOne(
          query1,
          update1,
          options
        );

        // Update the user's role if the trainer's status update was successful
        const result2 = await userCollection.updateOne(query2, update2);

        res
          .status(200)
          .send({ message: "Trainer status updated successfully" });
      } catch (error) {
        console.error("Error updating trainer status:", error);
        res.status(500).json({ message: "Internal Server Error" });
      }
    });

    // post add class
    app.post("/add-class", async (req, res) => {
      try {
        const newClass = {
          title: req.body.title,
          coverImg: req.body.coverImg,
          description: req.body.description,
          trainerDetails: req.body.trainerDetails,
          trainers: req.body.trainers,
        };
        const result = await allclassesCollection.insertOne(newClass);

        res.status(200).send(result);
      } catch (error) {
        res.status(500).send({
          message: "There was an error submitting the application.",
          error,
        });
      }
    });

    app.get("/last-six-documents", verifyToken, async (req, res) => {
      try {
        // Query MongoDB to find last 6 documents
        const lastSixDocs = await allclassesCollection
          .find()
          .sort({ _id: -1 })
          .limit(6)
          .toArray();

        res.json(lastSixDocs);
      } catch (err) {
        res.status(500).json({ message: err.message });
      }
    });
    // Endpoint to get total balance and last six transactions
    app.get("/balance", verifyToken, async (req, res) => {
      try {
        const transactions = await bookedTrainerCollection
          .find({})
          .limit(6)
          .toArray();

        const totalBalance = await bookedTrainerCollection
          .aggregate([{ $group: { _id: null, total: { $sum: "$price" } } }])
          .toArray();

        res.status(200).json({
          totalBalance: totalBalance[0]?.total || 0,
          transactions,
        });
      } catch (error) {
        console.error("Error fetching balance data:", error);
        res.status(500).json({ message: "Internal Server Error" });
      }
    });

    // Endpoint to get total newsletter subscribers and total paid members
    app.get("/stats", async (req, res) => {
      try {
        const totalSubscribers =
          await newsletterSubscribersCollection.countDocuments();
        const totalPaidMembers = await bookedTrainerCollection.countDocuments();

        res.status(200).json({
          totalSubscribers,
          totalPaidMembers,
        });
      } catch (error) {
        console.error("Error fetching stats data:", error);
        res.status(500).json({ message: "Internal Server Error" });
      }
    });
    // Member role routes

    //Acivity log page
    app.get("/activity-log", verifyToken, async (req, res) => {
      try {
        const query = { status: { $in: ["pending", "rejected"] } };
        const trainers = await applyTrainersCollection.find(query).toArray();
        res.send(trainers);
      } catch (error) {
        console.error("Error fetching activity log:", error);
        res.status(500).json({ message: "Internal Server Error" });
      }
    });

    // Profile page
    app.get("/profile/:email", verifyToken, async (req, res) => {
      const { email } = req.params;

      try {
        const user = await userCollection.findOne({ email: email });
        res.send(user);
      } catch (error) {
        console.error("Error fetching user details:", error);
        res.status(500).json({ message: "Internal Server Error" });
      }
    });

    app.put("/profile/:email", async (req, res) => {
      const { email } = req.params;
      const { name, profilePicture, otherInfo } = req.body;

      try {
        const result = await userCollection.updateOne(
          { email: email },
          { $set: { name, profilePicture, otherInfo } },
          { upsert: true }
        );
        if (result.modifiedCount === 1 || result.upsertedCount === 1) {
          res.status(200).json({ message: "Profile updated successfully" });
        } else {
          res.status(500).json({ message: "Failed to update profile" });
        }
      } catch (error) {
        console.error("Error updating profile:", error);
        res.status(500).json({ message: "Internal Server Error" });
      }
    });

    // Fetch booked trainer details by user ID
    app.get("/booked-trainer/:email", verifyToken, async (req, res) => {
      const { email } = req.params;

      try {
        const booking = await bookedTrainerCollection.findOne({
          userEmail: email,
        });

        if (!booking) {
          return res
            .status(404)
            .json({ message: "No booking found for this user." });
        }

        const trainer = await allTrainersCollection.findOne({
          _id: new ObjectId("6663224737ce6ed411df5518"),
        });

        res.json({ booking, trainer });
      } catch (error) {
        console.error("Error fetching booked trainer details:", error);
        res.status(500).json({ message: "Internal Server Error" });
      }
    });

    app.get("/trainer-classes-slots", verifyToken, async (req, res) => {
      try {
        const classes = await allclassesCollection
          .find({ title: "Pilates" })
          .toArray();
        const slots = await allTrainersCollection
          .find({ availableSlots: "Mon-Fri, 9am-5pm" })
          .toArray();

        res.json({ classes, slots });
      } catch (error) {
        console.error("Error fetching classes and slots:", error);
        res.status(500).json({ message: "Internal Server Error" });
      }
    });

    app.post("/submit-feedback", async (req, res) => {
      const { userEmail, feedback, name, image, rating } = req.body;

      try {
        const result = await reviewCollection.insertOne({
          userEmail: userEmail,
          review: feedback,
          name: name,
          image: image,
          rating: rating,
        });

        res.json({ message: "Feedback submitted successfully" });
      } catch (error) {
        console.error("Error submitting feedback:", error);
        res.status(500).json({ message: "Internal Server Error" });
      }
    });

    // Trainer Role Routes

    app.post("/add-forum", async (req, res) => {
      const { title, description, userRole } = req.body;

      const newForum = {
        title: title,
        description: description,
        badge: userRole,
      };

      try {
        const result = await forumCollection.insertOne(newForum);
        res.status(200).json({ message: "Forum added successfully" });
      } catch (error) {
        console.error("Error adding forum:", error);
        res.status(500).json({ message: "Internal Server Error" });
      }
    });

    // Trainer Role Routes
    app.get("/trainer-slots/:email", async (req, res) => {
      const { email } = req.params;
      try {
        const slots = await applyTrainersCollection
          .find({ email: email })
          .toArray();
        res.status(200).send(slots);
      } catch (error) {
        console.error("Error fetching slots:", error);
        res.status(500).json({ message: "Internal Server Error" });
      }
    });
    app.delete("/delete-slot/:id", async (req, res) => {
      const { id } = req.params;
      try {
        const result = await applyTrainersCollection.deleteOne({
          _id: new ObjectId(id),
        });
        if (result.deletedCount === 1) {
          res.status(200).send({ message: "Slot deleted successfully" });
        } else {
          res.status(404).json({ message: "Slot not found" });
        }
      } catch (error) {
        console.error("Error deleting slot:", error);
        res.status(500).json({ message: "Internal Server Error" });
      }
    });

    // Add a new slot
    app.get("/trainer-details/:email", async (req, res) => {
      const { email } = req.params;
      try {
        const trainer = await applyTrainersCollection.findOne({ email });
        res.status(200).send(trainer);
      } catch (error) {
        console.error("Error fetching trainer details:", error);
        res.status(500).json({ message: "Internal Server Error" });
      }
    });

    app.post("/add-slot", async (req, res) => {
      const {
        trainerEmail,
        slotName,
        slotTime,
        selectedDays,
        selectedClasses,
        otherInfo,
      } = req.body;
      try {
        const newSlot = {
          trainerEmail,
          slotName,
          slotTime,
          selectedDays,
          selectedClasses,
          otherInfo,
        };

        const result = await slotsCollection.insertOne(newSlot);

        res.status(200).send({ message: "Slot added successfully" });
      } catch (error) {
        res.status(500).json({ message: "Internal Server Error" });
      }
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
