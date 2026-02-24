import mongoose from "mongoose";

const postSchema = new mongoose.Schema(
  {
    imageUrl: {
      type: String,
      required: true,
    },
    caption: String,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    username: {
      type: String,
      required: true,
    },
    description:{
      type: String,
      required:true
    }
  },
  { timestamps: true }
);

export const Post = mongoose.model("Post", postSchema);
