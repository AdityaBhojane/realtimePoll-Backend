const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { Server } = require('socket.io');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));

const pollSchema = new mongoose.Schema({
    question: String,
    options: [{ option: String, votes: Number }],
    isActive: Boolean
});
const Poll = mongoose.model('Poll', pollSchema);

app.use(express.json());

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('launchPoll', async (pollData) => {
        console.log('Poll launched:', pollData);
        const poll = new Poll({ ...pollData, isActive: true });
        await poll.save();
        io.emit('newPoll', poll);
    });

    socket.on('vote', async ({ pollId, optionIndex }) => {
        console.log('Vote received:', pollId, optionIndex);
        const poll = await Poll.findById(pollId);
        if (poll && poll.isActive) {
            poll.options[optionIndex].votes++;
            await poll.save();
            io.emit('voteUpdate', poll);
        }
    });

    socket.on('endPoll', async (pollId) => {
        console.log('Ending poll:', pollId);
        const poll = await Poll.findById(pollId);
        if (poll && poll.isActive) {
            poll.isActive = false;
            await poll.save();
            io.emit('pollEnded', poll);
        }
    });
});


app.get('/polls', async (req, res) => {
    const polls = await Poll.find();
    res.json(polls);
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
