import mongoose from "mongoose";

mongoose.connect('mongodb+srv://vishal1:QAZ1@cluster0.9invlks.mongodb.net/');

const userSchema = new mongoose.Schema({
    username: String,
    email: String,
    password: String,
    age: Number
});

const User = mongoose.model("user", userSchema);

export default User;