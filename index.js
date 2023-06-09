const express = require('express')
const app = express()
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
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
        await client.connect();
        
        const sliderCollection = client.db('danceRevolutions').collection('slider-categories');
        const usersCollection = client.db('danceRevolutions').collection('users');
        const classesCollection = client.db('danceRevolutions').collection('classes');
        const selectedClassesCollection = client.db('danceRevolutions').collection('selectedClasses');


        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '1h'});
            res.send({token});
        })


        // Slider Categories API:--------
        app.get('/slider-categories', async (req, res) => {
            const result = await sliderCollection.find().toArray() ;
            res.send(result);
        })

        
        // Users API:--------
        app.get('/users', async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result);
        })

        app.patch('/users/instructor/:id', async (req, res) => {
            const id = req.params.id;
            const filter = {_id: new ObjectId(id)};
            const updateDoc = {
                $set: {
                    role: 'Instructor'
                },
            };
            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result);
        })

        app.patch('/users/admin/:id', async (req, res) => {
            const id = req.params.id;
            const filter = {_id: new ObjectId(id)};
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
            const query = {email: user.email}
            const existed = await usersCollection.findOne(query);
            if(existed){
                return res.send({message: 'User already exists!'});
            }

            const result = await usersCollection.insertOne(user);
            res.send(result);
        })


        // Classes API:--------
        app.get('/topClasses', async (req, res) => {
            const result = await classesCollection.find().sort({availableSeats: 1}).limit(6).toArray();
            res.send(result);
        })

        app.get('/approvedClasses', async (req, res) => {
            const result = await classesCollection.find({status: "Approved" }).toArray();
            res.send(result);
        })

        // Selected classes API
        app.get('/mySelectedClasses', verifyJWT, async (req, res) => {
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

        app.post('/selectedClasses', async (req, res) => {
            const item = req.body;
            // console.log(item);
            const result = await selectedClassesCollection.insertOne(item);
            res.send(result);
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