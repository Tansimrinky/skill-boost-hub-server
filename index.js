const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.fsmcn5d.mongodb.net/?retryWrites=true&w=majority`;

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
    const courseCollection = client.db("SkillBoostDB").collection("courses");
    const userCollection = client.db("SkillBoostDB").collection("user");
    const paymentCollection = client.db("SkillBoostDB").collection("payments");
    const teacherRequestCollection = client.db("SkillBoostDB").collection("request");
    const assignmentCollection = client.db("SkillBoostDB").collection("assignments");
    const submitedAssignmentCollection = client.db("SkillBoostDB").collection("submission");
    const reviewCollection = client.db("SkillBoostDB").collection("reviews");
    const submitedClassCollection = client.db("SkillBoostDB").collection("submitClass");

    // jwt related api
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
      res.send({ token });
    })

    // middleware
    // middlewares 
    const verifyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send({ message: 'unauthorized access' });
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next();
      })
    }

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === 'admin';
      if (!isAdmin) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      next();
    }

    app.get('/users/admin/:email', verifyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' })
      }

      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === 'admin';
      }
      res.send({ admin });
    })
    app.get('/users/teacher/:email', verifyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' })
      }

      const query = { email: email };
      const user = await userCollection.findOne(query);
      let teacher = false;
      if (user) {
        teacher = user?.role === 'teacher';
      }
      res.send({ teacher });
    })


    app.get('/assignments', async(req, res) => {
      const cursor = assignmentCollection.find();
     const result  = await cursor.toArray();
     res.send(result)
    })

    app.get("/courses", async (req, res) => {
      const page = parseInt(req.query.page);
      const size = parseInt(req.query.size);
      console.log("pagination", page, size);
      const result = await courseCollection
        .find()
        .skip(page * size)
        .limit(size)
        .toArray();
      res.send(result);
    });

    app.get("/courses/:id", async(req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id)}
      const result = await courseCollection.findOne(query);
      res.send(result
        )
    })

    app.get("/coursesCount", async (req, res) => {
      const count = await courseCollection.estimatedDocumentCount();
      res.send({ count });
    });

    app.get('/payments', async(req, res) => {
     const cursor = paymentCollection.find();
     const result  = await cursor.toArray();
     res.send(result)
    } )

    app.get("/users" ,verifyToken,  async(req, res) => {
      const cursor = userCollection.find()
      const result = await cursor.toArray()
      res.send(result)
    })

    app.get('/payments/:id', async(req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id)};
      const result = await paymentCollection.findOne(query);
      res.send(result)
    })

    app.get('/teachReq/admin/:id', async(req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id)};
      const result = await teacherRequestCollection.findOne(query)
      res.send(result)
    })

    app.get('/teachReq', async(req, res) => {
      const cursor = teacherRequestCollection.find();
      const result = await cursor.toArray();
      res.send(result)
    })

    app.get('/addClass', async(req, res) => {
      const cursor = submitedClassCollection.find();
      const result = await cursor.toArray();
      res.send(result)
    })

    app.get('/reviews', async(req, res) => {
      const cursor = reviewCollection.find();
      const result = await cursor.toArray();
      res.send(result)
    })

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
    // payment intent
    app.post('/create-payment-intent', async(req, res) => {
      const {price} = req.body;
      const amount = parseInt(price*100)

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      });
      res.send({
        clientSecret: paymentIntent.client_secret
  
      })
    } )
    // payment related api

    app.post('/payments', async(req, res) => {
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);
      res.send(paymentResult)
      
    })

    app.post('/courses' , async(req, res) => {
      const course = req.body;
      const result = await courseCollection.insertOne(course);
      res.send(result)
    })

    app.post('/addClass' , async(req, res) => {
      const classes = req.body;
      const result = await submitedClassCollection.insertOne(classes);
      res.send(result)
    })
    app.post('/submission', async(req, res) => {
      const allSubmission = req.body;
      const result = await submitedAssignmentCollection.insertOne(allSubmission);
      res.send(result)
      
    })
    app.post('/reviews', async(req, res) => {
      const reviews = req.body;
      const result = await reviewCollection.insertOne(reviews);
      res.send(result)
      
    })

    app.post('/teachReq', async(req, res) => {
        const request = req.body;
        const result = await teacherRequestCollection.insertOne(request) 
        res.send(result)
        })



        // Admin api

        app.patch('/users/teacher/:id', async(req, res) => {
          const id = req.params.id;
          const query = {_id: new ObjectId(id)};
          const updatedDoc = {
            $set: {
              role: 'teacher'
            }
          }
          const result = await userCollection.updateOne(query, updatedDoc)
          res.send(result)
        })

        app.delete('/teachReq/admin/:id', async (req, res) => {
          const id = req.params.id;
          const query = { _id: new ObjectId(id) }
          const result = await userCollection.deleteOne(query);
          res.send(result);
        })

        app.patch('/users/admin/:id', async (req, res) => {
          const id = req.params.id;
          const filter = { _id: new ObjectId(id) };
          const updatedDoc = {
            $set: {
              role: 'admin'
            }
          }
          const result = await userCollection.updateOne(filter, updatedDoc);
          res.send(result);
        })

    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("SkillBoost HUb is running");
});

app.listen(port, () => {
  console.log(`SkillBoost Hub is running on the port ${port}`);
});
