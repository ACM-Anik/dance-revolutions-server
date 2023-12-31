const express = require('express')
const app = express()
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY);
const port = process.env.PORT || 5000;


// Middleware:-
app.use(cors());
app.use(express.json());


const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'Unauthorized access' });
    }
    // (Bearer) (token)
    const token = authorization.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ error: true, message: 'Unauthorized access' })
        }
        req.decoded = decoded;
        next();
    })
}



const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.vxma4ez.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        client.connect();

        const sliderCollection = client.db('danceRevolutions').collection('slider-categories');
        const usersCollection = client.db('danceRevolutions').collection('users');
        const classesCollection = client.db('danceRevolutions').collection('classes');
        const selectedClassesCollection = client.db('danceRevolutions').collection('selectedClasses');
        const paymentCollection = client.db('danceRevolutions').collection('payments');


        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
            res.send({ token });
        })

        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            if (user?.role !== 'Admin') {
                return res.status(403).send({ error: true, message: 'Forbidden message!' })
            }
            next();
        }

        const verifyInstructor = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            if (user?.role !== 'Instructor') {
                return res.status(403).send({ error: true, message: 'Forbidden message!' })
            }
            next();
        }



        // Slider Categories API:--------
        app.get('/slider-categories', async (req, res) => {
            const result = await sliderCollection.find().toArray();
            res.send(result);
        })


        // Users API:--------
        // --------------------------
        app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result);
        })

        app.get('/users/instructors', async (req, res) => {
            const result = await usersCollection.find({ role: "Instructor" }).toArray();
            res.send(result);
        })

        // isAdmin
        app.get('/users/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;

            if (req.decoded.email !== email) {
                res.send({ Admin: false })
            }

            const query = { email: email };
            const user = await usersCollection.findOne(query);
            const result = { Admin: user?.role === 'Admin' };
            res.send(result);
        })

        // isInstructor
        app.get('/users/instructor/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;

            if (req.decoded.email !== email) {
                res.send({ Instructor: false })
            }

            const query = { email: email };
            const user = await usersCollection.findOne(query);
            const result = { Instructor: user?.role === 'Instructor' };
            res.send(result);
        })

        app.patch('/users/instructor/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: 'Instructor'
                },
            };
            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result);
        })

        app.patch('/users/admin/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: 'Admin'
                },
            };
            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result);
        })

        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email }
            const existed = await usersCollection.findOne(query);
            if (existed) {
                return res.send({ message: 'User already exists!' });
            }

            const result = await usersCollection.insertOne(user);
            res.send(result);
        })

        // ----------------------
        // Classes API:--
        // ----------------------
        app.get('/allClasses', verifyJWT, verifyAdmin, async (req, res) => {
            const result = await classesCollection.find().toArray();
            res.send(result);
        })
        // ===||(Requirement not clear for this)||===
        // app.get('/pendingClasses',  async (req, res) => {
        //     const result = await classesCollection.find({status: "Pending" }).toArray();
        //     res.send(result);
        // })

        app.patch('/allClasses/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };

            const update = { $inc: { availableSeats: -1 } };

            const result = await classesCollection.updateOne(filter, update);

            if (result.modifiedCount === 1) {
                res.send({ message: 'Successfully reduced 1 seat' });
            } else {
                res.status(404).send({ message: 'Class not found' });
            }

        })

        app.get('/myAddedClasses', verifyJWT, verifyInstructor, async (req, res) => {
            const email = req.query.email;

            if (!email) {
                res.send([]);
            }

            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
                return res.status(403).send({ error: true, message: 'Forbidden access!' })
            }

            const query = { instructorEmail: email };
            const result = await classesCollection.find(query).toArray();
            res.send(result);
        })

        app.patch('/allClasses/approve/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    status: 'Approved'
                },
            };
            const result = await classesCollection.updateOne(filter, updateDoc);
            res.send(result);
        })

        app.patch('/allClasses/deny/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    status: 'Denied'
                },
            };
            const result = await classesCollection.updateOne(filter, updateDoc);
            res.send(result);
        })

        app.patch('/allClasses/feedback/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const feedback = req.body.feedback;

            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    feedback: feedback
                },
            };
            const result = await classesCollection.updateOne(filter, updateDoc);
            res.send(result);
        })

        app.get('/topClasses', async (req, res) => {
            const result = await classesCollection.find().sort({ availableSeats: 1 }).limit(6).toArray();
            res.send(result);
        })

        app.get('/approvedClasses', async (req, res) => {
            const result = await classesCollection.find({ status: "Approved" }).toArray();
            res.send(result);
        })

        // Selected classes API
        app.get('/selectedClasses', verifyJWT, async (req, res) => {
            const email = req.query.email;

            if (!email) {
                res.send([]);
            }

            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
                return res.status(403).send({ error: true, message: 'Forbidden access!' })
            }

            const query = { email: email };
            const result = await selectedClassesCollection.find(query).toArray();
            res.send(result);
        });

        app.get('/selectedClasses/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const result = await selectedClassesCollection.findOne({ _id: new ObjectId(id) });
            res.send(result);
        })

        // payment api 
        app.get('/myEnrolledClasses', verifyJWT, async (req, res) => {
            const email = req.query.email;

            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
                return res.status(403).send({ error: true, message: 'Forbidden access!' })
            }

            const query = { email: email };
            const result = await paymentCollection.find(query).toArray();

            if (!result) {
                return res.send({ message: 'No enrolled Classes yet!', error: true });
            }

            res.send(result);
        })

        app.get('/paymentHistory', verifyJWT, async (req, res) => {
            const email = req.query.email;

            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
                return res.status(403).send({ error: true, message: 'Forbidden access!' })
            }

            const query = { email: email };
            const result = await paymentCollection.find(query).sort({ date: -1 }).toArray();

            if (!result) {
                return res.send({ message: 'No Payment yet!', error: true });
            }

            res.send(result);
        });
          

        app.post('/allClasses', verifyJWT, async (req, res) => {
            const newClass = req.body;
            const result = await classesCollection.insertOne(newClass);
            res.send(result);
        })

        app.post('/selectedClasses', async (req, res) => {
            const selectedClass = req.body;
            // console.log(selectedClass);

            const filter = { classId: selectedClass.selectedId, email: selectedClass.email }
            const find = await paymentCollection.findOne(filter);

            if (find) {
                return res.send({ message: 'Already enrolled!', enrolled: true });
            }

            const query = { selectedId: selectedClass.selectedId, email: selectedClass.email };
            const exists = await selectedClassesCollection.findOne(query);

            if (exists) {
                return res.send({ message: 'Class already exists!', exists: true });
            }

            const result = await selectedClassesCollection.insertOne(selectedClass);
            res.send(result);
        })

        app.delete('/selectedClasses/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await selectedClassesCollection.deleteOne(query);
            res.send(result);
        })



        // Creating Payment Intent:---
        // ---------------------------
        app.post('/create-payment-intent', verifyJWT, async (req, res) => {
            const { price } = req.body;
            const amount = price * 100;
            // console.log(typeof(price), typeof(amount));

            try {
                const paymentIntent = await stripe.paymentIntents.create({
                    amount: amount,
                    currency: 'usd',
                    payment_method_types: ['card'],
                });

                console.log('PaymentIntent:', paymentIntent);

                res.send({
                    clientSecret: paymentIntent.client_secret,
                });
            } catch (error) {
                console.error('Error creating PaymentIntent:', error);

                res.status(500).send({ error: 'Failed to create PaymentIntent' });
            }
        })

        // Payment related API:-
        app.post('/payments', verifyJWT, async (req, res) => {
            const payment = req.body;
            const insertResult = await paymentCollection.insertOne(payment);

            const query = { _id: new ObjectId(payment.selectId) };
            const deleteResult = await selectedClassesCollection.deleteOne(query);

            res.send({ insertResult, deleteResult });
        })



        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);




app.get('/', (req, res) => {
    res.send('Dance Revolutions is running perfectly!')
})

app.listen(port, () => {
    console.log(`Dance Revolutions is listening on port ${port}`)
})